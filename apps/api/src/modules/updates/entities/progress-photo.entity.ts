import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { AiPhotoAnalysis } from '../../ai/entities/ai-photo-analysis.entity';
import { ProgressUpdate } from './progress-update.entity';

@Entity('progress_photos')
@Index(['updateId'])
export class ProgressPhoto {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') updateId: string;
  @ManyToOne(() => ProgressUpdate, (u) => u.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'updateId' })
  update: Relation<ProgressUpdate>;
  @Column() fileKey: string;
  @Column() thumbKey: string;
  @Column({ type: 'text', nullable: true }) caption: string | null;
  @Column({ type: 'int', default: 0 }) sortOrder: number;
  @CreateDateColumn(ts) createdAt: Date;
  @OneToOne(() => AiPhotoAnalysis, (a) => a.photo) analysis: Relation<AiPhotoAnalysis | null>;
}
