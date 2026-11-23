import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { AiDraftDecision, NotificationChannel, Role, UpdateStatus } from '../../common/enums';
import { AuthUser, isStaff } from '../../common/interfaces/auth-user.interface';
import { AccessService } from '../../common/services/access.service';
import { AiPhotoAnalysis } from '../ai/entities/ai-photo-analysis.entity';
import { AiUpdateDraft } from '../ai/entities/ai-update-draft.entity';
import { PhotoAnalysisService } from '../ai/photo-analysis.service';
import { UpdateWriterService } from '../ai/update-writer.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Milestone } from '../projects/entities/milestone.entity';
import { Project } from '../projects/entities/project.entity';
import { MilestonesService } from '../projects/milestones.service';
import { overallProgress } from '../projects/progress';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../storage/storage.service';
import { ProgressPhoto } from './entities/progress-photo.entity';
import { ProgressUpdate } from './entities/progress-update.entity';

export const MAX_PHOTOS = 8;

@Injectable()
export class UpdatesService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly milestones: MilestonesService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
    private readonly photoAi: PhotoAnalysisService,
    private readonly writer: UpdateWriterService,
  ) {}

  private serialize(u: ProgressUpdate, user: AuthUser) {
    const showInternal = user.role !== Role.BUYER;
    return {
      id: u.id,
      projectId: u.projectId,
      milestoneId: u.milestoneId,
      milestoneName: u.milestone?.name ?? null,
      authorId: u.authorId,
      authorName: u.author?.name ?? null,
      title: u.title,
      text: u.status === UpdateStatus.PUBLISHED ? u.publishedText : showInternal ? u.engineerNote : null,
      engineerNote: showInternal ? u.engineerNote : undefined,
      progressAfter: u.progressAfter,
      status: u.status,
      rejectReason: showInternal ? u.rejectReason : undefined,
      approvedAt: u.approvedAt,
      createdAt: u.createdAt,
      photos: [...(u.photos ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({
          id: p.id,
          caption: p.caption,
          url: this.storage.signedUrl(p.fileKey, 3600),
          thumbUrl: this.storage.signedUrl(p.thumbKey, 3600),
          analysis:
            showInternal && p.analysis
              ? {
                  suggestedMilestoneId: p.analysis.suggestedMilestoneId,
                  suggestedProgress: p.analysis.suggestedProgress,
                  confidence: p.analysis.confidence,
                  warnings: p.analysis.qualityWarnings,
                  description: p.analysis.description,
                  model: p.analysis.model,
                  accepted: p.analysis.accepted,
                }
              : undefined,
        })),
      aiDraft: showInternal && u.aiDraft ? { text: u.aiDraft.generated, model: u.aiDraft.model, decision: u.aiDraft.decision } : undefined,
    };
  }

  private load(id: string) {
    return this.db.getRepository(ProgressUpdate).findOne({
      where: { id },
      relations: { photos: { analysis: true }, aiDraft: true, milestone: true, author: true },
    });
  }

  async list(user: AuthUser, projectId: string, status?: UpdateStatus) {
    await this.access.project(user, projectId);
    const where: Record<string, unknown> = { projectId };
    if (user.role === Role.BUYER) where.status = UpdateStatus.PUBLISHED;
    else if (status) where.status = status;
    const rows = await this.db.getRepository(ProgressUpdate).find({
      where,
      relations: { photos: { analysis: true }, aiDraft: true, milestone: true, author: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map((r) => this.serialize(r, user));
  }

  /** All updates waiting for a manager, across the organization. */
  async reviewQueue(user: AuthUser) {
    const ids = await this.access.projectIds(user);
    if (!ids.length) return [];
    const rows = await this.db.getRepository(ProgressUpdate).find({
      where: { projectId: In(ids), status: UpdateStatus.PENDING_REVIEW },
      relations: { photos: { analysis: true }, aiDraft: true, milestone: true, author: true, project: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => ({ ...this.serialize(r, user), projectName: r.project.name }));
  }

  async get(user: AuthUser, id: string) {
    const u = await this.load(id);
    if (!u) throw new NotFoundException('Update not found');
    await this.access.project(user, u.projectId);
    if (user.role === Role.BUYER && u.status !== UpdateStatus.PUBLISHED) throw new NotFoundException('Update not found');
    return this.serialize(u, user);
  }

  /** Step 1 (engineer): upload photos. The AI suggests a stage and progress. */
  async create(user: AuthUser, projectId: string, dto: { title: string; note?: string }, files: Express.Multer.File[]) {
    const project = await this.access.project(user, projectId);
    if (user.role === Role.BUYER) throw new ForbiddenException();
    if (!files.length) throw new BadRequestException('Please add at least one photo.');
    if (files.length > MAX_PHOTOS) throw new BadRequestException(`At most ${MAX_PHOTOS} photos per update.`);

    const saved: Array<{ fileKey: string; thumbKey: string; jpeg: Buffer }> = [];
    try {
      for (const f of files) saved.push(await this.storage.savePhoto(f.buffer));
    } catch (err) {
      for (const s of saved) {
        await this.storage.remove(s.fileKey);
        await this.storage.remove(s.thumbKey);
      }
      throw err;
    }

    const update = await this.db.transaction(async (em) => {
      const u = await em.getRepository(ProgressUpdate).save(
        em.getRepository(ProgressUpdate).create({
          projectId,
          authorId: user.id,
          title: dto.title.trim(),
          engineerNote: dto.note?.trim() || null,
          status: UpdateStatus.DRAFT,
        }),
      );
      await em
        .getRepository(ProgressPhoto)
        .insert(saved.map((s, i) => ({ updateId: u.id, fileKey: s.fileKey, thumbKey: s.thumbKey, sortOrder: i })));
      return u;
    });

    const photos = await this.db.getRepository(ProgressPhoto).find({ where: { updateId: update.id }, order: { sortOrder: 'ASC' } });
    const stages = await this.db.getRepository(Milestone).find({ where: { projectId }, order: { sortOrder: 'ASC' } });
    const suggestion = await this.photoAi.analyse(
      { orgId: user.orgId, userId: user.id },
      project,
      stages,
      photos.map((p, i) => ({ photo: p, jpeg: saved[i].jpeg })),
      [dto.title, dto.note].filter(Boolean).join('\n'),
    );
    return { update: await this.get(user, update.id), suggestion };
  }

  private async assertEditable(user: AuthUser, id: string) {
    const u = await this.db.getRepository(ProgressUpdate).findOne({ where: { id } });
    if (!u) throw new NotFoundException('Update not found');
    await this.access.project(user, u.projectId);
    if (user.role === Role.BUYER) throw new ForbiddenException();
    if (!isStaff(user) && u.authorId !== user.id) throw new ForbiddenException('You can only change your own updates.');
    return u;
  }

  /** Step 2 (engineer): confirm or correct the stage/progress; the AI writes a draft for buyers. */
  async submit(
    user: AuthUser,
    id: string,
    dto: { milestoneId?: string | null; progressAfter?: number | null; title?: string; note?: string },
  ) {
    const u = await this.assertEditable(user, id);
    if (![UpdateStatus.DRAFT, UpdateStatus.REJECTED, UpdateStatus.PENDING_REVIEW].includes(u.status)) {
      throw new ConflictException('This update has already been published.');
    }
    let milestone: Milestone | null = null;
    if (dto.milestoneId) {
      milestone = await this.db.getRepository(Milestone).findOne({ where: { id: dto.milestoneId, projectId: u.projectId } });
      if (!milestone) throw new BadRequestException('Choose a stage of this project.');
      if (dto.progressAfter !== undefined && dto.progressAfter !== null && dto.progressAfter < milestone.progress && !isStaff(user)) {
        throw new BadRequestException(`"${milestone.name}" is already at ${milestone.progress}%. Progress cannot go down in an update.`);
      }
    }
    const progressAfter = milestone && dto.progressAfter !== undefined && dto.progressAfter !== null ? Math.round(dto.progressAfter) : null;

    await this.db.getRepository(ProgressUpdate).update(id, {
      milestoneId: milestone?.id ?? null,
      progressAfter,
      title: dto.title?.trim() || u.title,
      engineerNote: dto.note !== undefined ? dto.note.trim() || null : u.engineerNote,
      status: UpdateStatus.PENDING_REVIEW,
      rejectReason: null,
    });
    const photos = await this.db.getRepository(ProgressPhoto).find({ where: { updateId: id }, relations: { analysis: true } });
    await this.photoAi.recordDecision(
      photos.map((p) => p.id),
      milestone?.id ?? null,
      progressAfter,
    );

    const draft = await this.generateDraft(user, id);
    this.notifications.send({
      userIds: await this.notifications.staffIds(user.orgId),
      type: 'UPDATE_PENDING',
      title: 'New progress update to review',
      body: `${user.name} posted "${dto.title?.trim() || u.title}". The AI has drafted the buyer update.`,
      link: `/admin/reviews`,
    });
    return { update: await this.get(user, id), draft };
  }

  async generateDraft(user: AuthUser, id: string) {
    const u = await this.load(id);
    if (!u) throw new NotFoundException('Update not found');
    const project = await this.db.getRepository(Project).findOneByOrFail({ id: u.projectId });
    const stages = await this.db.getRepository(Milestone).find({ where: { projectId: u.projectId } });
    const m = stages.find((s) => s.id === u.milestoneId) ?? null;
    const projected = stages.map((s) =>
      m && s.id === m.id && u.progressAfter !== null ? { ...s, progress: Math.max(s.progress, u.progressAfter) } : s,
    );
    return this.writer.draft({ orgId: user.orgId, userId: user.id }, id, {
      projectName: project.name,
      stageName: m?.name ?? null,
      progressBefore: m?.progress ?? null,
      progressAfter: u.progressAfter,
      overallProgress: overallProgress(projected),
      engineerTitle: u.title,
      engineerNote: u.engineerNote,
      photoDescription: u.photos.find((p) => p.analysis?.description)?.analysis?.description ?? null,
      photoCount: u.photos.length,
    });
  }

  /** Step 3 (manager): approve, optionally edit, and publish. Progress is applied here. */
  async approve(
    user: AuthUser,
    id: string,
    dto: { title: string; text: string; milestoneId?: string | null; progressAfter?: number | null },
  ) {
    const existing = await this.db.getRepository(ProgressUpdate).findOne({ where: { id }, relations: { aiDraft: true } });
    if (!existing) throw new NotFoundException('Update not found');
    const project = await this.access.project(user, existing.projectId);
    if (existing.status !== UpdateStatus.PENDING_REVIEW) throw new ConflictException('Only updates waiting for review can be approved.');

    const afterCommit: Array<() => void> = [];
    await this.db.transaction(async (em) => {
      const locked = await em.getRepository(ProgressUpdate).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (locked?.status !== UpdateStatus.PENDING_REVIEW) throw new ConflictException('This update was already handled.');
      const milestoneId = dto.milestoneId !== undefined ? dto.milestoneId : existing.milestoneId;
      const progressAfter = dto.progressAfter !== undefined ? dto.progressAfter : existing.progressAfter;
      if (milestoneId && progressAfter !== null && progressAfter !== undefined) {
        const m = await em.getRepository(Milestone).findOne({ where: { id: milestoneId, projectId: existing.projectId } });
        if (!m) throw new BadRequestException('Choose a stage of this project.');
        if (progressAfter > m.progress) {
          const res = await this.milestones.setProgress(user, milestoneId, { progress: progressAfter }, em);
          afterCommit.push(...res.afterCommit);
        }
      }
      const text = `${dto.title.trim()}\n\n${dto.text.trim()}`;
      await em.getRepository(ProgressUpdate).update(id, {
        title: dto.title.trim(),
        publishedText: dto.text.trim(),
        milestoneId: milestoneId ?? null,
        progressAfter: progressAfter ?? null,
        status: UpdateStatus.PUBLISHED,
        approvedById: user.id,
        approvedAt: new Date(),
      });
      if (existing.aiDraft) {
        const same = normalise(existing.aiDraft.generated) === normalise(text);
        await em.getRepository(AiUpdateDraft).update(existing.aiDraft.id, {
          decision: same ? AiDraftDecision.APPROVED : AiDraftDecision.EDITED,
          editedText: same ? null : text,
          reviewerId: user.id,
          reviewedAt: new Date(),
        });
      }
    });
    afterCommit.forEach((fn) => fn());

    const buyers = await this.projects.buyerIds(project.id);
    const day = new Date().toISOString().slice(0, 10);
    this.notifications.send({
      userIds: buyers,
      type: 'NEW_UPDATE',
      title: `New update: ${project.name}`,
      body: dto.title.trim(),
      link: '/portal/updates',
    });
    this.notifications.send({
      userIds: buyers,
      type: 'UPDATE_DIGEST',
      title: `Construction update from ${project.name}`,
      body: `${dto.title.trim()}\n\n${dto.text.trim()}`,
      link: '/portal/updates',
      channels: [NotificationChannel.EMAIL],
      dedupeKey: `update-digest:${project.id}:${day}`,
    });
    this.notifications.send({
      userIds: [existing.authorId],
      type: 'UPDATE_APPROVED',
      title: 'Your update was published',
      body: dto.title.trim(),
      link: '/site',
    });
    return this.get(user, id);
  }

  async reject(user: AuthUser, id: string, reason: string) {
    const u = await this.db.getRepository(ProgressUpdate).findOne({ where: { id }, relations: { aiDraft: true } });
    if (!u) throw new NotFoundException('Update not found');
    await this.access.project(user, u.projectId);
    if (u.status !== UpdateStatus.PENDING_REVIEW) throw new ConflictException('Only updates waiting for review can be rejected.');
    await this.db.getRepository(ProgressUpdate).update(id, { status: UpdateStatus.REJECTED, rejectReason: reason.trim() });
    if (u.aiDraft)
      await this.db
        .getRepository(AiUpdateDraft)
        .update(u.aiDraft.id, { decision: AiDraftDecision.REJECTED, reviewerId: user.id, reviewedAt: new Date() });
    this.notifications.send({
      userIds: [u.authorId],
      type: 'UPDATE_REJECTED',
      title: 'Your update needs changes',
      body: reason.trim(),
      link: '/site',
    });
    return this.get(user, id);
  }

  async unpublish(user: AuthUser, id: string, reason: string) {
    const u = await this.db.getRepository(ProgressUpdate).findOne({ where: { id } });
    if (!u) throw new NotFoundException('Update not found');
    await this.access.project(user, u.projectId);
    if (u.status !== UpdateStatus.PUBLISHED) throw new ConflictException('Only published updates can be unpublished.');
    await this.db.getRepository(ProgressUpdate).update(id, { status: UpdateStatus.UNPUBLISHED });
    await this.audit.log(user, 'UPDATE_UNPUBLISHED', 'ProgressUpdate', id, {
      oldValue: { status: 'PUBLISHED' },
      newValue: { status: 'UNPUBLISHED' },
      reason,
    });
    return this.get(user, id);
  }

  async remove(user: AuthUser, id: string) {
    const u = await this.assertEditable(user, id);
    if (u.status === UpdateStatus.PUBLISHED) throw new ConflictException('Published updates cannot be deleted. Unpublish it instead.');
    const photos = await this.db.getRepository(ProgressPhoto).find({ where: { updateId: id } });
    await this.db.getRepository(ProgressUpdate).delete(id);
    for (const p of photos) {
      await this.storage.remove(p.fileKey);
      await this.storage.remove(p.thumbKey);
    }
  }

  /** How often engineers accepted the AI's photo suggestion (objective 1 evidence). */
  async aiAccuracy(user: AuthUser) {
    const ids = await this.access.projectIds(user);
    if (!ids.length) return { decided: 0, accepted: 0, rate: null };
    const row = await this.db
      .getRepository(AiPhotoAnalysis)
      .createQueryBuilder('a')
      .innerJoin('a.photo', 'p')
      .innerJoin('p.update', 'u')
      .select('COUNT(*) FILTER (WHERE a.accepted IS NOT NULL)::int', 'decided')
      .addSelect('COUNT(*) FILTER (WHERE a.accepted = true)::int', 'accepted')
      .where('u.projectId IN (:...ids)', { ids })
      .getRawOne<{ decided: number; accepted: number }>();
    const decided = row?.decided ?? 0;
    const accepted = row?.accepted ?? 0;
    return { decided, accepted, rate: decided ? Math.round((accepted / decided) * 1000) / 10 : null };
  }
}

function normalise(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}
