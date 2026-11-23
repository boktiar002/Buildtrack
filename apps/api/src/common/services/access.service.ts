import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Purchase } from '../../modules/finance/entities/purchase.entity';
import { ProjectAssignment } from '../../modules/projects/entities/project-assignment.entity';
import { Project } from '../../modules/projects/entities/project.entity';
import { PurchaseStatus, Role } from '../enums';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * One place for "may this user see this record?" decisions.
 * Records from another organization are reported as "not found", so their
 * existence is never revealed.
 */
@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectAssignment) private readonly assignments: Repository<ProjectAssignment>,
    @InjectRepository(Purchase) private readonly purchases: Repository<Purchase>,
  ) {}

  async project(user: AuthUser, projectId: string): Promise<Project> {
    const project = await this.projects.findOne({ where: { id: projectId, organizationId: user.orgId } });
    if (!project) throw new NotFoundException('Project not found');
    if (user.role === Role.ENGINEER) {
      const assigned = await this.assignments.exist({ where: { projectId, userId: user.id } });
      if (!assigned) throw new ForbiddenException('You are not assigned to this project.');
    }
    if (user.role === Role.BUYER) {
      const owns = await this.purchases
        .createQueryBuilder('p')
        .innerJoin('p.unit', 'u')
        .where('u.projectId = :projectId AND p.buyerId = :buyerId AND p.status IN (:...st)', {
          projectId,
          buyerId: user.id,
          st: [PurchaseStatus.ACTIVE, PurchaseStatus.COMPLETED],
        })
        .getExists();
      if (!owns) throw new NotFoundException('Project not found');
    }
    return project;
  }

  /** Project ids this user may see. */
  async projectIds(user: AuthUser): Promise<string[]> {
    if (user.role === Role.ENGINEER) {
      const rows = await this.assignments.find({ where: { userId: user.id }, select: { projectId: true } });
      return rows.map((r) => r.projectId);
    }
    if (user.role === Role.BUYER) {
      const rows = await this.purchases
        .createQueryBuilder('p')
        .innerJoin('p.unit', 'u')
        .select('DISTINCT u.projectId', 'projectId')
        .where('p.buyerId = :id AND p.status IN (:...st)', { id: user.id, st: [PurchaseStatus.ACTIVE, PurchaseStatus.COMPLETED] })
        .getRawMany<{ projectId: string }>();
      return rows.map((r) => r.projectId);
    }
    const rows = await this.projects.find({ where: { organizationId: user.orgId }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async purchase(user: AuthUser, purchaseId: string): Promise<Purchase> {
    const purchase = await this.purchases.findOne({ where: { id: purchaseId }, relations: { unit: { project: true }, buyer: true } });
    if (!purchase || purchase.unit.project.organizationId !== user.orgId) throw new NotFoundException('Purchase not found');
    if (user.role === Role.BUYER && purchase.buyerId !== user.id) throw new NotFoundException('Purchase not found');
    if (user.role === Role.ENGINEER) throw new ForbiddenException('You do not have permission to do this.');
    return purchase;
  }

  async buyerPurchaseIds(buyerId: string, projectIds?: string[]) {
    const qb = this.purchases
      .createQueryBuilder('p')
      .innerJoin('p.unit', 'u')
      .select('p.id', 'id')
      .where('p.buyerId = :buyerId', { buyerId });
    if (projectIds?.length) qb.andWhere('u.projectId IN (:...projectIds)', { projectIds });
    return (await qb.getRawMany<{ id: string }>()).map((r) => r.id);
  }

  async projectsByIds(orgId: string, ids: string[]) {
    if (!ids.length) return [];
    return this.projects.find({ where: { id: In(ids), organizationId: orgId } });
  }
}
