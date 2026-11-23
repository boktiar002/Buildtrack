import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { PageQuery } from '../../common/dto/page-query.dto';
import { NotificationChannel, ProjectStatus, PurchaseStatus, Role, UpdateStatus } from '../../common/enums';
import { AuthUser, isStaff } from '../../common/interfaces/auth-user.interface';
import { AccessService } from '../../common/services/access.service';
import { daysBetween, formatDhakaDate } from '../../common/utils/dates';
import { page, skipTake } from '../../common/utils/pagination';
import { DelayRiskScore } from '../ai/entities/delay-risk-score.entity';
import { AuditService } from '../audit/audit.service';
import { Installment } from '../finance/entities/installment.entity';
import { Purchase } from '../finance/entities/purchase.entity';
import { Unit } from '../finance/entities/unit.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { ProgressUpdate } from '../updates/entities/progress-update.entity';
import { User } from '../users/entities/user.entity';
import { HandoverDateChange } from './entities/handover-date-change.entity';
import { Milestone } from './entities/milestone.entity';
import { ProjectAssignment } from './entities/project-assignment.entity';
import { Project } from './entities/project.entity';
import { currentStage, overallProgress, stageTemplate } from './progress';

export interface ProjectInput {
  name: string;
  location: string;
  description?: string;
  totalFloors: number;
  startDate?: string;
  originalHandoverDate: string;
  isPublic?: boolean;
  status?: Project['status'];
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 60) || 'project';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  /** Adds overall progress, current stage and delay to each project. */
  async summarise(projects: Project[]) {
    if (!projects.length) return [];
    const ids = projects.map((p) => p.id);
    const milestones = await this.db.getRepository(Milestone).find({ where: { projectId: In(ids) }, order: { sortOrder: 'ASC' } });
    const risks = await this.db
      .getRepository(DelayRiskScore)
      .createQueryBuilder('r')
      .distinctOn(['r.projectId'])
      .where('r.projectId IN (:...ids) AND r.milestoneId IS NULL', { ids })
      .orderBy('r.projectId')
      .addOrderBy('r.computedAt', 'DESC')
      .getMany();
    const riskBy = new Map(risks.map((r) => [r.projectId, r]));
    return projects.map((p) => {
      const ms = milestones.filter((m) => m.projectId === p.id);
      const current = currentStage(ms);
      const risk = riskBy.get(p.id);
      return {
        ...p,
        coverImageUrl: this.storage.signedUrl(p.coverImageKey, 3600),
        overallProgress: overallProgress(ms),
        currentStage: current ? { id: current.id, name: current.name, progress: current.progress } : null,
        stageCount: ms.length,
        completedStages: ms.filter((m) => m.status === 'COMPLETED').length,
        delayDays: Math.max(0, daysBetween(p.originalHandoverDate, p.expectedHandoverDate)),
        risk: risk ? { level: risk.level, score: risk.score, computedAt: risk.computedAt } : null,
      };
    });
  }

  /** Every project the user may see, without paging (used by the dashboard). */
  async all(user: AuthUser) {
    const ids = await this.access.projectIds(user);
    const projects = await this.access.projectsByIds(user.orgId, ids);
    projects.sort((a, b) => a.name.localeCompare(b.name));
    return this.summarise(projects);
  }

  /** Projects the user may see (engineers: assigned ones; buyers: ones they bought in), with search, status filter and paging. */
  async list(user: AuthUser, q: PageQuery & { status?: ProjectStatus }) {
    const ids = await this.access.projectIds(user);
    if (!ids.length) return page([], 0, q);
    const qb = this.db
      .getRepository(Project)
      .createQueryBuilder('p')
      .where('p.organizationId = :org AND p.id IN (:...ids)', { org: user.orgId, ids })
      .orderBy('p.name', 'ASC')
      .skip(skipTake(q).skip)
      .take(skipTake(q).take);
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    if (q.search) qb.andWhere('(p.name ILIKE :s OR p.location ILIKE :s)', { s: `%${q.search.trim()}%` });
    const [projects, total] = await qb.getManyAndCount();
    return page(await this.summarise(projects), total, q);
  }

  async detail(user: AuthUser, id: string) {
    const project = await this.access.project(user, id);
    const [summary] = await this.summarise([project]);
    const milestones = await this.db.getRepository(Milestone).find({ where: { projectId: id }, order: { sortOrder: 'ASC' } });
    const handoverHistory = await this.handoverHistory(user, id);
    const staffView = isStaff(user)
      ? {
          unitCounts: await this.db
            .getRepository(Unit)
            .createQueryBuilder('u')
            .select('u.status', 'status')
            .addSelect('COUNT(*)::int', 'count')
            .where('u.projectId = :id', { id })
            .groupBy('u.status')
            .getRawMany<{ status: string; count: number }>(),
          pendingUpdates: await this.db
            .getRepository(ProgressUpdate)
            .count({ where: { projectId: id, status: UpdateStatus.PENDING_REVIEW } }),
          engineers: (await this.db.getRepository(ProjectAssignment).find({ where: { projectId: id }, relations: { user: true } })).map(
            (a) => ({ id: a.user.id, name: a.user.name, email: a.user.email }),
          ),
        }
      : {};
    return { ...summary, milestones, handoverHistory, ...staffView };
  }

  async create(user: AuthUser, dto: ProjectInput, withTemplate = true) {
    const handover = new Date(dto.originalHandoverDate);
    const start = dto.startDate ? new Date(dto.startDate) : null;
    if (start && handover <= start) throw new BadRequestException('Handover date must be after the start date.');
    return this.db.transaction(async (em) => {
      let slug = slugify(dto.name);
      if (await em.getRepository(Project).exist({ where: { organizationId: user.orgId, slug } })) {
        slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      }
      const project = await em.getRepository(Project).save(
        em.getRepository(Project).create({
          organizationId: user.orgId,
          name: dto.name.trim(),
          slug,
          location: dto.location.trim(),
          description: dto.description?.trim() || null,
          totalFloors: dto.totalFloors,
          startDate: start,
          originalHandoverDate: handover,
          expectedHandoverDate: handover,
          isPublic: dto.isPublic ?? false,
          status: dto.status,
        }),
      );
      if (withTemplate) {
        const stages = stageTemplate(dto.totalFloors, start, handover);
        await em.getRepository(Milestone).insert(stages.map((s) => ({ ...s, projectId: project.id })));
      }
      return project;
    });
  }

  async update(user: AuthUser, id: string, dto: Partial<ProjectInput>) {
    const project = await this.access.project(user, id);
    if (dto.originalHandoverDate) {
      const hasPurchases = await this.db
        .getRepository(Purchase)
        .createQueryBuilder('p')
        .innerJoin('p.unit', 'u')
        .where('u.projectId = :id', { id })
        .getExists();
      if (hasPurchases)
        throw new ConflictException(
          'The original handover date cannot change after flats have been booked. Use "Change handover date" instead.',
        );
    }
    const patch: Partial<Project> = {
      name: dto.name?.trim(),
      location: dto.location?.trim(),
      description: dto.description?.trim(),
      totalFloors: dto.totalFloors,
      isPublic: dto.isPublic,
      status: dto.status,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
    };
    if (dto.originalHandoverDate) {
      patch.originalHandoverDate = new Date(dto.originalHandoverDate);
      patch.expectedHandoverDate = new Date(dto.originalHandoverDate);
    }
    Object.keys(patch).forEach((k) => patch[k as keyof Project] === undefined && delete patch[k as keyof Project]);
    await this.db.getRepository(Project).update(project.id, patch);
    return this.detail(user, id);
  }

  /**
   * Deletes a project with its stages, flats and updates. Refused once any flat has been booked,
   * because bookings and payments are financial records that must be kept.
   */
  async remove(user: AuthUser, id: string) {
    const project = await this.access.project(user, id);
    const booked = await this.db
      .getRepository(Purchase)
      .createQueryBuilder('p')
      .innerJoin('p.unit', 'u')
      .where('u.projectId = :id', { id })
      .getExists();
    if (booked) throw new ConflictException('This project has bookings on record and cannot be deleted. Mark it completed instead.');
    await this.db.transaction(async (em) => {
      await em.getRepository(Project).delete(id);
      await this.audit.log(user, 'DELETE', 'Project', id, { oldValue: { name: project.name, location: project.location } }, em);
    });
  }

  async setCover(user: AuthUser, id: string, buf: Buffer) {
    const project = await this.access.project(user, id);
    const { fileKey, thumbKey } = await this.storage.savePhoto(buf);
    await this.storage.remove(thumbKey);
    if (project.coverImageKey) await this.storage.remove(project.coverImageKey);
    await this.db.getRepository(Project).update(id, { coverImageKey: fileKey });
    return { coverImageUrl: this.storage.signedUrl(fileKey, 3600) };
  }

  // ------------------------------------------------------------------ handover

  /** R6–R9: changes the expected handover date with a reason, keeps history, notifies buyers. */
  async changeHandover(user: AuthUser, id: string, newDate: string, reason: string) {
    const date = new Date(newDate);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date.');
    if (reason.trim().length < 20) throw new BadRequestException('Please explain the reason in at least 20 characters.');
    const { project, change } = await this.db.transaction(async (em) => {
      const project = await em
        .getRepository(Project)
        .findOne({ where: { id, organizationId: user.orgId }, lock: { mode: 'pessimistic_write' } });
      if (!project) throw new NotFoundException('Project not found');
      if (project.expectedHandoverDate.getTime() === date.getTime())
        throw new BadRequestException('This is already the expected handover date.');
      const change = await em.getRepository(HandoverDateChange).save(
        em.getRepository(HandoverDateChange).create({
          projectId: id,
          oldDate: project.expectedHandoverDate,
          newDate: date,
          reason: reason.trim(),
          changedById: user.id,
        }),
      );
      await em.getRepository(Project).update(id, { expectedHandoverDate: date });
      await this.audit.log(
        user,
        'HANDOVER_DATE_CHANGED',
        'Project',
        id,
        { oldValue: { expectedHandoverDate: project.expectedHandoverDate }, newValue: { expectedHandoverDate: date }, reason },
        em,
      );
      return { project, change };
    });

    const buyers = await this.buyerIds(id);
    const later = date > change.oldDate;
    this.notifications.send({
      userIds: buyers,
      type: 'HANDOVER_CHANGED',
      title: `Handover date ${later ? 'delayed' : 'brought forward'}: ${project.name}`,
      body: `The expected handover date changed from ${formatDhakaDate(change.oldDate)} to ${formatDhakaDate(date)}. Reason: ${change.reason}`,
      link: `/portal`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
      sms: `${project.name}: expected handover is now ${formatDhakaDate(date)}. Details in BuildTrack.`,
    });
    return change;
  }

  async handoverHistory(user: AuthUser, id: string) {
    await this.access.project(user, id);
    return this.db.getRepository(HandoverDateChange).find({ where: { projectId: id }, order: { createdAt: 'DESC' } });
  }

  async buyerIds(projectId: string) {
    const rows = await this.db
      .getRepository(Purchase)
      .createQueryBuilder('p')
      .innerJoin('p.unit', 'u')
      .select('DISTINCT p.buyerId', 'buyerId')
      .where('u.projectId = :projectId AND p.status IN (:...st)', { projectId, st: [PurchaseStatus.ACTIVE, PurchaseStatus.COMPLETED] })
      .getRawMany<{ buyerId: string }>();
    return rows.map((r) => r.buyerId);
  }

  // --------------------------------------------------------------- assignments

  async assign(user: AuthUser, projectId: string, engineerId: string) {
    await this.access.project(user, projectId);
    const engineer = await this.db
      .getRepository(User)
      .findOne({ where: { id: engineerId, organizationId: user.orgId, role: Role.ENGINEER } });
    if (!engineer) throw new NotFoundException('Engineer not found');
    await this.db
      .getRepository(ProjectAssignment)
      .createQueryBuilder()
      .insert()
      .values({ projectId, userId: engineerId })
      .orIgnore()
      .execute();
    return { ok: true };
  }

  async unassign(user: AuthUser, projectId: string, engineerId: string) {
    await this.access.project(user, projectId);
    await this.db.getRepository(ProjectAssignment).delete({ projectId, userId: engineerId });
  }

  // ---------------------------------------------------------------- milestones

  async addMilestone(user: AuthUser, projectId: string, dto: { name: string; weight: number; plannedStart?: string; plannedEnd?: string }) {
    await this.access.project(user, projectId);
    const max = await this.db.getRepository(Milestone).maximum('sortOrder', { projectId });
    return this.db.getRepository(Milestone).save(
      this.db.getRepository(Milestone).create({
        projectId,
        name: dto.name.trim(),
        weight: dto.weight,
        sortOrder: (max ?? 0) + 1,
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : null,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : null,
      }),
    );
  }

  async applyTemplate(user: AuthUser, projectId: string) {
    const project = await this.access.project(user, projectId);
    const count = await this.db.getRepository(Milestone).count({ where: { projectId } });
    if (count) throw new ConflictException('This project already has stages.');
    const stages = stageTemplate(project.totalFloors, project.startDate, project.originalHandoverDate);
    await this.db.getRepository(Milestone).insert(stages.map((s) => ({ ...s, projectId })));
    return this.db.getRepository(Milestone).find({ where: { projectId }, order: { sortOrder: 'ASC' } });
  }

  async listMilestones(user: AuthUser, projectId: string) {
    await this.access.project(user, projectId);
    return this.db.getRepository(Milestone).find({ where: { projectId }, order: { sortOrder: 'ASC' } });
  }

  async milestone(user: AuthUser, id: string) {
    const m = await this.db.getRepository(Milestone).findOne({ where: { id } });
    if (!m) throw new NotFoundException('Stage not found');
    await this.access.project(user, m.projectId);
    return m;
  }

  /** A stage can be deleted only before work starts on it and while no installment is linked to it. */
  async deleteMilestone(user: AuthUser, id: string) {
    const m = await this.milestone(user, id);
    if (m.progress > 0) throw new ConflictException('Work has already been recorded on this stage, so it cannot be deleted.');
    if (await this.db.getRepository(Installment).exist({ where: { milestoneId: id } }))
      throw new ConflictException('An installment is linked to this stage. Change that payment plan first.');
    await this.db.getRepository(Milestone).delete(id);
    await this.audit.log(user, 'DELETE', 'Milestone', id, { oldValue: { name: m.name, weight: m.weight } });
  }

  async editMilestone(user: AuthUser, id: string, dto: { name?: string; weight?: number; plannedStart?: string; plannedEnd?: string }) {
    const m = await this.db.getRepository(Milestone).findOne({ where: { id } });
    if (!m) throw new NotFoundException('Stage not found');
    await this.access.project(user, m.projectId);
    await this.db.getRepository(Milestone).update(id, {
      name: dto.name?.trim() ?? m.name,
      weight: dto.weight ?? m.weight,
      plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : m.plannedStart,
      plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : m.plannedEnd,
    });
    return this.db.getRepository(Milestone).findOneByOrFail({ id });
  }
}
