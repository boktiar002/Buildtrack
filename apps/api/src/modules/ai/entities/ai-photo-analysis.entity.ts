import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { Milestone } from '../../projects/entities/milestone.entity';
import { ProgressPhoto } from '../../updates/entities/progress-photo.entity';

// ------------------------------------------------------------------ AI tables

@Entity('ai_photo_analyses')
export class AiPhotoAnalysis {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) photoId: string;
  @OneToOne(() => ProgressPhoto, (p) => p.analysis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'photoId' })
  photo: Relation<ProgressPhoto>;
  @Column({ type: 'uuid', nullable: true }) suggestedMilestoneId: string | null;
  @ManyToOne(() => Milestone, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'suggestedMilestoneId' })
  suggestedMilestone: Relation<Milestone | null>;
  @Column({ type: 'int', nullable: true }) suggestedProgress: number | null;
  @Column({ type: 'real', nullable: true }) confidence: number | null;
  @Column({ type: 'text', array: true, default: () => "'{}'" }) qualityWarnings: string[];
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column() model: string;
  @Column({ type: 'boolean', nullable: true }) accepted: boolean | null;
  @Column({ type: 'uuid', nullable: true }) correctedMilestoneId: string | null;
  @Column({ type: 'int', nullable: true }) correctedProgress: number | null;
  @CreateDateColumn(ts) createdAt: Date;
}
