import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { InstallmentStatus, NotificationChannel, PurchaseStatus } from '../../common/enums';
import { daysBetween, formatDhakaDate } from '../../common/utils/dates';
import { formatTaka } from '../../common/utils/money';
import { loadEnv } from '../../config/env';
import { DelayRiskService } from '../ai/delay-risk.service';
import { Installment } from '../finance/entities/installment.entity';
import { Purchase } from '../finance/entities/purchase.entity';
import { computeStatus } from '../finance/installment-rules';
import { NotificationsService } from '../notifications/notifications.service';
import { Organization } from '../users/entities/organization.entity';

const LOCK_ID = 727_001; // Postgres advisory lock: only one server runs the job at a time

/**
 * Daily job (08:00 Dhaka time):
 *  - R19/R20: recalculates installment statuses (upcoming -> due -> overdue)
 *  - R21: sends reminders 7 days and 1 day before, on the overdue day, then weekly
 *  - managers get one overdue summary per day
 *  - AI delay-risk score for every active project
 * Each step is isolated: one failure is logged and the rest still run.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notifications: NotificationsService,
    private readonly risk: DelayRiskService,
  ) {}

  @Cron('0 8 * * *', { name: 'daily', timeZone: 'Asia/Dhaka' })
  async daily() {
    if (!loadEnv().SCHEDULER_ENABLED) return;
    await this.runAll();
  }

  async runAll(now = new Date()) {
    if (this.running) return { skipped: 'already running' };
    this.running = true;
    const runner = this.db.createQueryRunner();
    try {
      await runner.connect();
      const [{ locked }] = await runner.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_ID]);
      if (!locked) return { skipped: 'running on another server' };
      try {
        const installments = await this.step('installments', () => this.updateInstallments(now));
        const risk = await this.step('risk', () => this.risk.computeAll());
        return { installments, risk };
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
      }
    } finally {
      await runner.release();
      this.running = false;
    }
  }

  private async step<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
    try {
      const result = await fn();
      this.logger.log({ result }, `Daily step "${name}" finished`);
      return result;
    } catch (err) {
      this.logger.error({ err }, `Daily step "${name}" failed`);
      return { error: (err as Error).message };
    }
  }

  async updateInstallments(now = new Date()) {
    const repo = this.db.getRepository(Installment);
    const open = await repo.find({
      where: {
        status: In([InstallmentStatus.UPCOMING, InstallmentStatus.DUE, InstallmentStatus.PARTIALLY_PAID, InstallmentStatus.OVERDUE]),
        dueDate: Not(IsNull()),
        purchase: { status: PurchaseStatus.ACTIVE },
      },
      relations: { purchase: { unit: { project: true } } },
    });
    let changed = 0;
    let reminders = 0;
    const overdueByOrg = new Map<string, { count: number; units: string[] }>();
    const orgs = new Map((await this.db.getRepository(Organization).find()).map((o) => [o.id, o]));

    for (const inst of open) {
      const status = computeStatus(inst, now);
      if (status !== inst.status) {
        await repo.update(inst.id, { status });
        changed++;
      }
      const p = inst.purchase as Purchase;
      const org = orgs.get(p.unit.project.organizationId);
      const days = daysBetween(now, inst.dueDate!); // positive = days until due
      const owed = Number(inst.amount) - Number(inst.paidAmount);
      const amount = formatTaka(owed.toFixed(2));
      const date = formatDhakaDate(inst.dueDate!);
      let key: string | null = null;
      let title = '';
      if (days === 7) [key, title] = [`inst:${inst.id}:7d`, `Installment due in 7 days`];
      else if (days === 1) [key, title] = [`inst:${inst.id}:1d`, `Installment due tomorrow`];
      else if (days < 0 && status === InstallmentStatus.OVERDUE) {
        const late = -days;
        if (late === 1) [key, title] = [`inst:${inst.id}:overdue`, `Installment overdue`];
        else if (late % 7 === 0) [key, title] = [`inst:${inst.id}:overdue-w${late / 7}`, `Reminder: installment overdue`];
        const o = overdueByOrg.get(p.unit.project.organizationId) ?? { count: 0, units: [] };
        o.count++;
        o.units.push(p.unit.code);
        overdueByOrg.set(p.unit.project.organizationId, o);
      }
      if (key) {
        reminders++;
        this.notifications.send({
          userIds: [p.buyerId],
          type: 'INSTALLMENT_REMINDER',
          title: `${title}: ${p.unit.code}`,
          body: `"${inst.label}" (${amount}) for flat ${p.unit.code} at ${p.unit.project.name} ${days < 0 ? 'was due' : 'is due'} on ${date}.`,
          link: `/portal/units/${p.id}`,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
          sms: `${org?.name ?? 'BuildTrack'}: Installment of ${amount} for ${p.unit.code} ${days < 0 ? 'was due' : 'is due'} on ${date}.`,
          dedupeKey: key,
        });
      }
    }

    const day = now.toISOString().slice(0, 10);
    for (const [orgId, o] of overdueByOrg) {
      this.notifications.send({
        userIds: await this.notifications.staffIds(orgId),
        type: 'OVERDUE_SUMMARY',
        title: `${o.count} overdue installment${o.count > 1 ? 's' : ''}`,
        body: `Flats with overdue payments: ${[...new Set(o.units)].slice(0, 15).join(', ')}.`,
        link: '/admin/reports',
        dedupeKey: `overdue-summary:${orgId}:${day}`,
      });
    }
    return { checked: open.length, changed, reminders };
  }
}
