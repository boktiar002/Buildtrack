import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { AiDraftDecision } from '../../../common/enums';
import { ts } from '../../../database/column-types';
import { ProgressUpdate } from '../../updates/entities/progress-update.entity';

// ------------------------------------------------------------------ AI tables

@Entity('ai_update_drafts')
export class AiUpdateDraft {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) updateId: string;
  @OneToOne(() => ProgressUpdate, (u) => u.aiDraft, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'updateId' })
  update: Relation<ProgressUpdate>;
  @Column('text') generated: string;
  @Column() model: string;
  @Column({ type: 'text', nullable: true }) editedText: string | null;
  @Column({ type: 'enum', enum: AiDraftDecision, default: AiDraftDecision.PENDING }) decision: AiDraftDecision;
  @Column({ type: 'uuid', nullable: true }) reviewerId: string | null;
  @Column({ ...ts, nullable: true }) reviewedAt: Date | null;
  @CreateDateColumn(ts) createdAt: Date;
}
