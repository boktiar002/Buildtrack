import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocumentVisibility, Role } from '../../common/enums';
import { AuthUser, isStaff } from '../../common/interfaces/auth-user.interface';
import { AccessService } from '../../common/services/access.service';
import { DocumentIndexerService } from '../ai/document-indexer.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentEntity } from './entities/document.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly indexer: DocumentIndexerService,
  ) {}

  /** R25: INTERNAL = staff only; PROJECT_BUYERS = buyers of that project; PURCHASE_BUYER = that buyer only. */
  async canSee(user: AuthUser, d: DocumentEntity) {
    if (d.organizationId !== user.orgId) return false;
    if (isStaff(user)) return true;
    if (user.role !== Role.BUYER) return false;
    if (d.visibility === DocumentVisibility.INTERNAL) return false;
    if (d.visibility === DocumentVisibility.PURCHASE_BUYER) {
      if (!d.purchaseId) return false;
      const ids = await this.access.buyerPurchaseIds(user.id);
      return ids.includes(d.purchaseId);
    }
    if (!d.projectId) return false;
    return (await this.access.projectIds(user)).includes(d.projectId);
  }

  async list(user: AuthUser, q: DocumentQueryDto) {
    if (user.role === Role.ENGINEER) return [];
    const qb = this.db.getRepository(DocumentEntity).createQueryBuilder('d').where('d.organizationId = :org', { org: user.orgId });
    if (q.projectId) qb.andWhere('d.projectId = :pid', { pid: q.projectId });
    if (q.purchaseId) qb.andWhere('d.purchaseId = :puid', { puid: q.purchaseId });
    if (user.role === Role.BUYER) {
      const projectIds = await this.access.projectIds(user);
      const purchaseIds = await this.access.buyerPurchaseIds(user.id);
      qb.andWhere(
        `((d.visibility = 'PROJECT_BUYERS' AND d.projectId IN (:...projectIds)) OR (d.visibility = 'PURCHASE_BUYER' AND d.purchaseId IN (:...purchaseIds)))`,
        {
          projectIds: projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000'],
          purchaseIds: purchaseIds.length ? purchaseIds : ['00000000-0000-0000-0000-000000000000'],
        },
      );
    }
    const docs = await qb.orderBy('d.createdAt', 'DESC').take(200).getMany();
    return docs.map(({ fileKey: _k, ...d }) => (user.role === Role.BUYER ? { ...d, indexError: undefined } : d));
  }

  async upload(user: AuthUser, dto: CreateDocumentDto, file: Express.Multer.File) {
    let projectId = dto.projectId ?? null;
    let purchaseId = dto.purchaseId ?? null;
    if (purchaseId) {
      const p = await this.access.purchase(user, purchaseId);
      projectId = p.unit.projectId;
    } else if (projectId) {
      await this.access.project(user, projectId);
    } else {
      throw new BadRequestException('Choose a project or a purchase for this document.');
    }
    if (dto.visibility === DocumentVisibility.PURCHASE_BUYER && !purchaseId) {
      throw new BadRequestException('A document for one buyer must be attached to their purchase.');
    }
    if (dto.visibility !== DocumentVisibility.PURCHASE_BUYER)
      purchaseId = purchaseId && dto.visibility === DocumentVisibility.INTERNAL ? purchaseId : null;
    const { fileKey, mime } = await this.storage.saveDocument(file.buffer);
    const doc = await this.db.getRepository(DocumentEntity).save(
      this.db.getRepository(DocumentEntity).create({
        organizationId: user.orgId,
        projectId,
        purchaseId,
        title: dto.title.trim(),
        type: dto.type,
        visibility: dto.visibility,
        fileKey,
        mimeType: mime,
        sizeBytes: file.size,
        uploadedById: user.id,
      }),
    );
    this.indexer.indexInBackground(doc.id);
    return doc;
  }

  async findOne(user: AuthUser, id: string) {
    const d = await this.db.getRepository(DocumentEntity).findOne({ where: { id } });
    if (!d || !(await this.canSee(user, d))) throw new NotFoundException('Document not found');
    const { fileKey: _k, ...rest } = d;
    return user.role === Role.BUYER ? { ...rest, indexError: undefined } : rest;
  }

  async update(user: AuthUser, id: string, dto: UpdateDocumentDto) {
    const d = await this.db.getRepository(DocumentEntity).findOne({ where: { id, organizationId: user.orgId } });
    if (!d) throw new NotFoundException('Document not found');
    if (dto.visibility === DocumentVisibility.PURCHASE_BUYER && !d.purchaseId)
      throw new BadRequestException('A document for one buyer must be attached to their booking.');
    const patch = { title: dto.title?.trim(), type: dto.type, visibility: dto.visibility };
    Object.keys(patch).forEach((k) => patch[k as keyof typeof patch] === undefined && delete patch[k as keyof typeof patch]);
    await this.db.getRepository(DocumentEntity).update(id, patch);
    await this.audit.log(user, 'UPDATE', 'Document', id, {
      oldValue: { title: d.title, type: d.type, visibility: d.visibility },
      newValue: patch,
    });
    return this.findOne(user, id);
  }

  async url(user: AuthUser, id: string) {
    const d = await this.db.getRepository(DocumentEntity).findOne({ where: { id } });
    if (!d || !(await this.canSee(user, d))) throw new NotFoundException('Document not found');
    return { url: this.storage.signedUrl(d.fileKey, 300), expiresInSeconds: 300 };
  }

  async remove(user: AuthUser, id: string) {
    const d = await this.db.getRepository(DocumentEntity).findOne({ where: { id, organizationId: user.orgId } });
    if (!d) throw new NotFoundException('Document not found');
    await this.db.getRepository(DocumentEntity).delete(id);
    await this.storage.remove(d.fileKey);
    await this.audit.log(user, 'DELETE', 'Document', id, { oldValue: { title: d.title, visibility: d.visibility } });
  }

  async reindex(user: AuthUser, id: string) {
    const d = await this.db.getRepository(DocumentEntity).findOne({ where: { id, organizationId: user.orgId } });
    if (!d) throw new NotFoundException('Document not found');
    return { status: await this.indexer.index(id) };
  }
}
