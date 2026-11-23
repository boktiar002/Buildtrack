import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Role, TicketStatus, UpdateStatus } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AccessService } from '../../common/services/access.service';
import { addDays, startOfDhakaDay } from '../../common/utils/dates';
import { fromPoisha, toPoisha } from '../../common/utils/money';
import { AiService } from '../ai/ai.service';
import { AssistantMessage } from '../ai/entities/assistant-message.entity';
import { DelayRiskScore } from '../ai/entities/delay-risk-score.entity';
import { Milestone } from '../projects/entities/milestone.entity';
import { ProjectsService } from '../projects/projects.service';
import { Ticket } from '../tickets/entities/ticket.entity';
import { ProgressUpdate } from '../updates/entities/progress-update.entity';
import { UpdatesService } from '../updates/updates.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly projects: ProjectsService,
    private readonly updates: UpdatesService,
    private readonly ai: AiService,
  ) {}

  async admin(user: AuthUser) {
    const projectList = await this.projects.all(user);
    const ids = projectList.map((p) => p.id);
    const none = ['00000000-0000-0000-0000-000000000000'];
    const pids = ids.length ? ids : none;
    const monthStart = startOfDhakaDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    const [money] = await this.db.query(
      `SELECT
         COALESCE(SUM(i.amount - i."paidAmount") FILTER (WHERE i.status <> 'WAIVED'), 0) AS outstanding,
         COALESCE(SUM(i.amount - i."paidAmount") FILTER (WHERE i.status = 'OVERDUE'), 0) AS overdue,
         COUNT(*) FILTER (WHERE i.status = 'OVERDUE')::int AS "overdueCount"
       FROM installments i JOIN purchases p ON p.id = i."purchaseId" JOIN units u ON u.id = p."unitId"
       WHERE u."projectId" = ANY($1::uuid[]) AND p.status = 'ACTIVE'`,
      [pids],
    );
    const [month] = await this.db.query(
      `SELECT COALESCE(SUM(pay.amount), 0) AS collected
         FROM payments pay JOIN purchases p ON p.id = pay."purchaseId" JOIN units u ON u.id = p."unitId"
        WHERE u."projectId" = ANY($1::uuid[]) AND pay."voidedAt" IS NULL AND pay."paidAt" >= $2`,
      [pids, monthStart],
    );
    const monthly: Array<{ month: string; total: string }> = await this.db.query(
      `SELECT to_char(date_trunc('month', pay."paidAt" AT TIME ZONE 'Asia/Dhaka'), 'YYYY-MM') AS month, SUM(pay.amount) AS total
         FROM payments pay JOIN purchases p ON p.id = pay."purchaseId" JOIN units u ON u.id = p."unitId"
        WHERE u."projectId" = ANY($1::uuid[]) AND pay."voidedAt" IS NULL AND pay."paidAt" >= now() - interval '12 months'
        GROUP BY 1 ORDER BY 1`,
      [pids],
    );
    const months: Array<{ month: string; total: string }> = [];
    for (let k = 11; k >= 0; k--) {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - k);
      const key = d.toISOString().slice(0, 7);
      months.push({ month: key, total: monthly.find((m) => m.month === key)?.total ?? '0' });
    }
    const topOverdue = await this.db.query(
      `SELECT i.id, i.label, i.amount, i."paidAmount", i."dueDate", p.id AS "purchaseId", u.code AS unit, b.name AS buyer, proj.name AS project
         FROM installments i JOIN purchases p ON p.id = i."purchaseId" JOIN units u ON u.id = p."unitId"
         JOIN projects proj ON proj.id = u."projectId" JOIN users b ON b.id = p."buyerId"
        WHERE u."projectId" = ANY($1::uuid[]) AND i.status = 'OVERDUE' AND p.status = 'ACTIVE'
        ORDER BY i."dueDate" ASC LIMIT 10`,
      [pids],
    );
    const upcomingStages = ids.length
      ? await this.db
          .getRepository(Milestone)
          .createQueryBuilder('m')
          .innerJoinAndSelect('m.project', 'p')
          .where('m.projectId IN (:...ids) AND m.status <> :done AND m.plannedEnd BETWEEN :now AND :soon', {
            ids,
            done: 'COMPLETED',
            now: new Date(),
            soon: addDays(new Date(), 30),
          })
          .orderBy('m.plannedEnd', 'ASC')
          .take(10)
          .getMany()
      : [];
    const openTickets = ids.length
      ? await this.db
          .getRepository(Ticket)
          .createQueryBuilder('t')
          .innerJoin('t.purchase', 'p')
          .innerJoin('p.unit', 'u')
          .where('u.projectId IN (:...ids) AND t.status <> :closed', { ids, closed: TicketStatus.CLOSED })
          .getCount()
      : 0;
    const pendingReviews = ids.length
      ? await this.db.getRepository(ProgressUpdate).count({ where: { projectId: In(ids), status: UpdateStatus.PENDING_REVIEW } })
      : 0;

    const [assistant] = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS answers,
              COUNT(*) FILTER (WHERE m.helpful = true)::int AS helpful,
              COUNT(*) FILTER (WHERE m.helpful IS NOT NULL)::int AS rated,
              COUNT(*) FILTER (WHERE m.unsure = true)::int AS unsure
         FROM assistant_messages m JOIN assistant_conversations c ON c.id = m."conversationId"
         JOIN purchases p ON p.id = c."purchaseId" JOIN units u ON u.id = p."unitId"
        WHERE u."projectId" = ANY($1::uuid[])`,
      [pids],
    );
    const [drafts] = await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE d.decision = 'APPROVED')::int AS approved,
              COUNT(*) FILTER (WHERE d.decision = 'EDITED')::int AS edited,
              COUNT(*) FILTER (WHERE d.decision = 'REJECTED')::int AS rejected
         FROM ai_update_drafts d JOIN progress_updates u ON u.id = d."updateId"
        WHERE u."projectId" = ANY($1::uuid[])`,
      [pids],
    );

    const active = projectList.filter((p) => p.status === 'UNDER_CONSTRUCTION' || p.status === 'PLANNING');
    const building = active.filter((p) => p.status === 'UNDER_CONSTRUCTION');
    const progressBase = building.length ? building : active;
    return {
      kpis: {
        activeProjects: active.length,
        averageProgress: progressBase.length
          ? Math.round((progressBase.reduce((s, p) => s + p.overallProgress, 0) / progressBase.length) * 10) / 10
          : 0,
        buildingProjects: building.length,
        collectedThisMonth: fromPoisha(toPoisha(Number(month.collected).toFixed(2))),
        outstanding: Number(money.outstanding).toFixed(2),
        overdueAmount: Number(money.overdue).toFixed(2),
        overdueCount: money.overdueCount,
        openTickets,
        pendingReviews,
      },
      monthlyCollections: months.map((m) => ({ month: m.month, total: Number(m.total).toFixed(2) })),
      projects: projectList.map((p) => ({
        id: p.id,
        name: p.name,
        overallProgress: p.overallProgress,
        risk: p.risk,
        delayDays: p.delayDays,
        status: p.status,
      })),
      upcomingStages: upcomingStages.map((m) => ({
        id: m.id,
        name: m.name,
        progress: m.progress,
        plannedEnd: m.plannedEnd,
        projectId: m.projectId,
        project: m.project.name,
      })),
      topOverdue,
      ai: {
        photoSuggestions: await this.updates.aiAccuracy(user),
        assistant,
        drafts,
        usage: user.role === Role.ORG_ADMIN || user.role === Role.MANAGER ? await this.ai.usageSummary(user.orgId) : undefined,
      },
    };
  }

  async buyer(user: AuthUser) {
    const ids = await this.access.projectIds(user);
    const projects = await this.projects.summarise(await this.access.projectsByIds(user.orgId, ids));
    return { projects };
  }

  async collections(user: AuthUser, q: ReportQueryDto) {
    const pids = await this.scopedProjects(user, q.projectId);
    return this.db.query(
      `SELECT pay."receiptNumber" AS "receipt", pay."paidAt" AS "date", proj.name AS project, u.code AS unit, b.name AS buyer,
              pay.method, pay.reference, pay.amount, CASE WHEN pay."voidedAt" IS NULL THEN 'valid' ELSE 'void' END AS status
         FROM payments pay JOIN purchases p ON p.id = pay."purchaseId" JOIN units u ON u.id = p."unitId"
         JOIN projects proj ON proj.id = u."projectId" JOIN users b ON b.id = p."buyerId"
        WHERE u."projectId" = ANY($1::uuid[]) AND pay."paidAt" >= $2 AND pay."paidAt" < $3
        ORDER BY pay."paidAt" DESC`,
      [pids, q.from ? new Date(q.from) : new Date('2000-01-01'), q.to ? addDays(new Date(q.to), 1) : addDays(new Date(), 1)],
    );
  }

  async dues(user: AuthUser, q: ReportQueryDto) {
    const pids = await this.scopedProjects(user, q.projectId);
    return this.db.query(
      `SELECT proj.name AS project, u.code AS unit, b.name AS buyer, b.phone, i.label AS installment, i.status,
              i."dueDate" AS "dueDate", i.amount, i."paidAmount" AS paid, (i.amount - i."paidAmount") AS remaining
         FROM installments i JOIN purchases p ON p.id = i."purchaseId" JOIN units u ON u.id = p."unitId"
         JOIN projects proj ON proj.id = u."projectId" JOIN users b ON b.id = p."buyerId"
        WHERE u."projectId" = ANY($1::uuid[]) AND p.status = 'ACTIVE' AND i.status IN ('DUE','PARTIALLY_PAID','OVERDUE','UPCOMING')
        ORDER BY CASE i.status WHEN 'OVERDUE' THEN 0 WHEN 'DUE' THEN 1 WHEN 'PARTIALLY_PAID' THEN 1 ELSE 2 END, i."dueDate" NULLS LAST`,
      [pids],
    );
  }

  async progressReport(user: AuthUser, q: ReportQueryDto) {
    const pids = await this.scopedProjects(user, q.projectId);
    return this.db.query(
      `SELECT proj.name AS project, m."sortOrder" AS "order", m.name AS stage, m.weight, m.progress, m.status,
              m."plannedStart", m."plannedEnd", m."actualStart", m."completedAt",
              CASE WHEN m."completedAt" IS NOT NULL AND m."plannedEnd" IS NOT NULL
                   THEN DATE_PART('day', m."completedAt" - m."plannedEnd")::int END AS "daysLate"
         FROM milestones m JOIN projects proj ON proj.id = m."projectId"
        WHERE m."projectId" = ANY($1::uuid[]) ORDER BY proj.name, m."sortOrder"`,
      [pids],
    );
  }

  private async scopedProjects(user: AuthUser, projectId?: string) {
    if (projectId) {
      await this.access.project(user, projectId);
      return [projectId];
    }
    const ids = await this.access.projectIds(user);
    return ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
  }

  async riskOverview(user: AuthUser) {
    const ids = await this.access.projectIds(user);
    if (!ids.length) return [];
    return this.db
      .getRepository(DelayRiskScore)
      .createQueryBuilder('r')
      .distinctOn(['r.projectId'])
      .where('r.projectId IN (:...ids)', { ids })
      .orderBy('r.projectId')
      .addOrderBy('r.computedAt', 'DESC')
      .getMany();
  }

  async assistantLog(user: AuthUser) {
    const ids = await this.access.projectIds(user);
    if (!ids.length) return [];
    return this.db
      .getRepository(AssistantMessage)
      .createQueryBuilder('m')
      .innerJoin('m.conversation', 'c')
      .innerJoin('c.purchase', 'p')
      .innerJoin('p.unit', 'u')
      .where('u.projectId IN (:...ids) AND m.role = :r', { ids, r: 'assistant' })
      .orderBy('m.createdAt', 'DESC')
      .take(50)
      .getMany();
  }
}
