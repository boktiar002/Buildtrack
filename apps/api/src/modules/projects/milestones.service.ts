import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  InstallmentDueType,
  InstallmentStatus,
  MilestoneStatus,
  NotificationChannel,
  ProjectStatus,
  PurchaseStatus,
} from '../../common/enums';
import { AuthUser, isStaff } from '../../common/interfaces/auth-user.interface';
import { AccessService } from '../../common/services/access.service';
import { addDays } from '../../common/utils/dates';
import { formatTaka } from '../../common/utils/money';
import { AuditService } from '../audit/audit.service';
import { Installment } from '../finance/entities/installment.entity';
import { Purchase } from '../finance/entities/purchase.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Organization } from '../users/entities/organization.entity';
import { Milestone } from './entities/milestone.entity';
import { Project } from './entities/project.entity';
import { statusForProgress } from './progress';

export interface ProgressChange {
  progress: number;
  reason?: string;
  completedAt?: Date;
}

@Injectable()
export class MilestonesService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async getForUser(user: AuthUser, milestoneId: string) {
    const m = await this.db.getRepository(Milestone).findOne({ where: { id: milestoneId } });
    if (!m) throw new NotFoundException('Stage not found');
    await this.access.project(user, m.projectId);
    return m;
  }

  /**
   * Changes a stage's progress, applying rules R1 (status), R3 (no silent
   * decreases) and R12 (completing a stage makes linked installments due).
   * Runs in a transaction; buyer notifications are sent only after commit.
   */
  async setProgress(user: AuthUser, milestoneId: string, change: ProgressChange, outer?: EntityManager) {
    const after: Array<() => void> = [];
    const run = async (em: EntityManager) => {
      const m = await em.getRepository(Milestone).findOne({ where: { id: milestoneId }, lock: { mode: 'pessimistic_write' } });
      if (!m) throw new NotFoundException('Stage not found');
      await this.access.project(user, m.projectId);

      const next = Math.round(change.progress);
      if (next < 0 || next > 100) throw new BadRequestException('Progress must be between 0 and 100.');
      if (next < m.progress) {
        if (!isStaff(user)) throw new ForbiddenException('Only a manager can reduce progress.');
        if (!change.reason || change.reason.trim().length < 10) {
          throw new BadRequestException('Please give a reason (at least 10 characters) for reducing progress.');
        }
        await this.audit.log(
          user,
          'PROGRESS_DECREASED',
          'Milestone',
          m.id,
          { oldValue: { progress: m.progress }, newValue: { progress: next }, reason: change.reason },
          em,
        );
      }
      if (next === m.progress) return m;

      const wasCompleted = m.status === MilestoneStatus.COMPLETED;
      m.progress = next;
      m.status = statusForProgress(next);
      if (next > 0 && !m.actualStart) m.actualStart = new Date();
      if (m.status === MilestoneStatus.COMPLETED && !wasCompleted) m.completedAt = change.completedAt ?? new Date();
      if (m.status !== MilestoneStatus.COMPLETED) m.completedAt = null;
      await em.getRepository(Milestone).save(m);

      const project = await em.getRepository(Project).findOneByOrFail({ id: m.projectId });
      if (next > 0 && project.status === ProjectStatus.PLANNING) {
        await em.getRepository(Project).update(project.id, { status: ProjectStatus.UNDER_CONSTRUCTION });
      }
      if (m.status === MilestoneStatus.COMPLETED && !wasCompleted) {
        after.push(...(await this.triggerInstallments(em, m, project)));
      }
      return m;
    };

    const result = outer ? await run(outer) : await this.db.transaction(run);
    if (outer) return { milestone: result, afterCommit: after };
    after.forEach((fn) => fn());
    return { milestone: result, afterCommit: [] as Array<() => void> };
  }

  /** R12: linked UPCOMING installments become DUE after the grace period. */
  private async triggerInstallments(em: EntityManager, m: Milestone, project: Project) {
    const org = await em.getRepository(Organization).findOneByOrFail({ id: project.organizationId });
    const dueDate = addDays(m.completedAt ?? new Date(), org.milestoneGraceDays);
    const linked = await em
      .getRepository(Installment)
      .createQueryBuilder('i')
      .innerJoin(Purchase, 'p', 'p.id = i.purchaseId')
      .where('i.milestoneId = :mid AND i.dueType = :dt AND i.status = :st AND p.status = :ps', {
        mid: m.id,
        dt: InstallmentDueType.MILESTONE,
        st: InstallmentStatus.UPCOMING,
        ps: PurchaseStatus.ACTIVE,
      })
      .getMany();
    if (!linked.length) return [];
    await em.getRepository(Installment).update({ id: In(linked.map((i) => i.id)) }, { status: InstallmentStatus.DUE, dueDate });

    const purchases = await em
      .getRepository(Purchase)
      .find({ where: { id: In(linked.map((i) => i.purchaseId)) }, relations: { unit: true } });
    const byId = new Map(purchases.map((p) => [p.id, p]));
    const dateText = dueDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: 'short', year: 'numeric' });

    return linked.map((inst) => () => {
      const p = byId.get(inst.purchaseId);
      if (!p) return;
      this.notifications.send({
        userIds: [p.buyerId],
        type: 'INSTALLMENT_DUE',
        title: `Installment due for ${p.unit.code}`,
        body: `"${m.name}" is complete at ${project.name}. Your installment "${inst.label}" of ${formatTaka(inst.amount)} is now due on ${dateText}.`,
        link: `/portal/units/${p.id}`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
        sms: `${org.name}: Installment of ${formatTaka(inst.amount)} for ${p.unit.code} is due on ${dateText}.`,
        dedupeKey: `inst-due:${inst.id}`,
      });
    });
  }
}
