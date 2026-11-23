import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UpdateStatus } from '../../common/enums';
import { Milestone } from '../projects/entities/milestone.entity';
import { Project } from '../projects/entities/project.entity';
import { currentStage, overallProgress } from '../projects/progress';
import { StorageService } from '../storage/storage.service';
import { ProgressPhoto } from '../updates/entities/progress-photo.entity';
import { Organization } from '../users/entities/organization.entity';

/** Marketing pages. Exposes only public, non-personal information (no buyers, no money). */
@Injectable()
export class PublicService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly storage: StorageService,
  ) {}

  private async org(slug: string) {
    const org = await this.db.getRepository(Organization).findOne({ where: { slug } });
    if (!org) throw new NotFoundException('Not found');
    return org;
  }

  private async card(p: Project) {
    const ms = await this.db.getRepository(Milestone).find({ where: { projectId: p.id }, order: { sortOrder: 'ASC' } });
    const cur = currentStage(ms);
    return {
      name: p.name,
      slug: p.slug,
      location: p.location,
      description: p.description,
      status: p.status,
      totalFloors: p.totalFloors,
      overallProgress: overallProgress(ms),
      currentStage: cur?.name ?? null,
      expectedHandoverDate: p.expectedHandoverDate,
      coverImageUrl: this.storage.signedUrl(p.coverImageKey, 3600),
    };
  }

  async organization(slug: string) {
    const org = await this.org(slug);
    const projects = await this.db
      .getRepository(Project)
      .find({ where: { organizationId: org.id, isPublic: true }, order: { name: 'ASC' } });
    return {
      organization: { name: org.name, slug: org.slug, primaryColor: org.primaryColor, accentColor: org.accentColor, logoUrl: org.logoUrl },
      projects: await Promise.all(projects.map((p) => this.card(p))),
    };
  }

  async project(orgSlug: string, slug: string) {
    const org = await this.org(orgSlug);
    const p = await this.db.getRepository(Project).findOne({ where: { organizationId: org.id, slug, isPublic: true } });
    if (!p) throw new NotFoundException('Not found');
    const photos = await this.db
      .getRepository(ProgressPhoto)
      .createQueryBuilder('ph')
      .innerJoinAndSelect('ph.update', 'u')
      .where('u.projectId = :id AND u.status = :st', { id: p.id, st: UpdateStatus.PUBLISHED })
      .orderBy('u.createdAt', 'DESC')
      .addOrderBy('ph.sortOrder', 'ASC')
      .take(6)
      .getMany();
    const ms = await this.db.getRepository(Milestone).find({ where: { projectId: p.id }, order: { sortOrder: 'ASC' } });
    return {
      organization: { name: org.name, slug: org.slug },
      ...(await this.card(p)),
      stages: ms.map((m) => ({ name: m.name, status: m.status, progress: m.progress })),
      photos: photos.map((ph) => ({
        url: this.storage.signedUrl(ph.fileKey, 3600),
        thumbUrl: this.storage.signedUrl(ph.thumbKey, 3600),
        date: ph.update.createdAt,
      })),
    };
  }
}
