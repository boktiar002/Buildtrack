import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { currentRequest } from '../../common/context/request-context';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { page, skipTake } from '../../common/utils/pagination';
import { AuditQueryDto } from './dto/audit-query.dto';
import { User } from '../users/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditDetails {
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  [extra: string]: unknown;
}

const SECRET_KEYS = /password|token|secret|hash/i;

/** Removes passwords and tokens from values before they are stored. */
export function scrub(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !SECRET_KEYS.test(k)));
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Records a change. Pass `em` to write inside an existing transaction (the entry then commits or rolls back with it). */
  async log(user: AuthUser, action: string, entity: string, entityId: string, details?: AuditDetails, em?: EntityManager) {
    const repo = em ? em.getRepository(AuditLog) : this.repo;
    const ctx = currentRequest();
    const { oldValue, newValue, ...meta } = details ?? {};
    try {
      await repo.save(
        repo.create({
          organizationId: user.orgId,
          actorId: user.id,
          action,
          entity,
          entityId,
          oldValue: scrub(oldValue),
          newValue: scrub(newValue),
          meta: Object.keys(meta).length ? meta : null,
          ipAddress: ctx?.ip ?? null,
          requestId: ctx?.requestId ?? null,
        }),
      );
      if (ctx) ctx.audited = true;
    } catch (err) {
      if (em) throw err; // inside a transaction: let the whole action fail together
      this.logger.error({ err }, 'Failed to write audit log');
    }
  }

  async list(user: AuthUser, q: AuditQueryDto) {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.organizationId = :org', { org: user.orgId })
      .orderBy('a.createdAt', 'DESC')
      .skip(skipTake(q).skip)
      .take(skipTake(q).take);
    if (q.entity) qb.andWhere('a.entity = :entity', { entity: q.entity });
    if (q.action) qb.andWhere('a.action = :action', { action: q.action });
    if (q.actorId) qb.andWhere('a.actorId = :actorId', { actorId: q.actorId });
    if (q.entityId) qb.andWhere('a.entityId = :entityId', { entityId: q.entityId });
    if (q.from) qb.andWhere('a.createdAt >= :from', { from: q.from });
    if (q.to) qb.andWhere('a.createdAt <= :to', { to: q.to });
    const [rows, total] = await qb.getManyAndCount();
    const actorIds = [...new Set(rows.map((r) => r.actorId))];
    const actors = actorIds.length
      ? await this.users.find({ where: { id: In(actorIds) }, select: { id: true, name: true, role: true } })
      : [];
    const byId = new Map(actors.map((a) => [a.id, a]));
    const items = rows.map((r) => ({ ...r, actorName: byId.get(r.actorId)?.name ?? null, actorRole: byId.get(r.actorId)?.role ?? null }));
    return page(items, total, q);
  }

  async findOne(user: AuthUser, id: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: user.orgId } });
    if (!row) throw new NotFoundException('Audit entry not found');
    return row;
  }
}
