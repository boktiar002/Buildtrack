import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DocumentType, DocumentVisibility, IndexStatus } from '../../../common/enums';
import { ts } from '../../../database/column-types';
import { Purchase } from '../../finance/entities/purchase.entity';
import { Project } from '../../projects/entities/project.entity';

@Entity('documents')
@Index(['organizationId'])
@Index(['projectId'])
@Index(['purchaseId'])
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @Column({ type: 'uuid', nullable: true }) projectId: string | null;
  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: true }) @JoinColumn({ name: 'projectId' }) project: Relation<Project | null>;
  @Column({ type: 'uuid', nullable: true }) purchaseId: string | null;
  @ManyToOne(() => Purchase, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'purchaseId' })
  purchase: Relation<Purchase | null>;
  @Column() title: string;
  @Column({ type: 'enum', enum: DocumentType }) type: DocumentType;
  @Column({ type: 'enum', enum: DocumentVisibility }) visibility: DocumentVisibility;
  @Column() fileKey: string;
  @Column() mimeType: string;
  @Column('int') sizeBytes: number;
  @Column('uuid') uploadedById: string;
  @Column({ type: 'enum', enum: IndexStatus, default: IndexStatus.NOT_INDEXED }) indexStatus: IndexStatus;
  @Column({ type: 'text', nullable: true }) indexError: string | null;
  @CreateDateColumn(ts) createdAt: Date;
}
