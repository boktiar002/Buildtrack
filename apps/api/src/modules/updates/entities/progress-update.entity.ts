import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { UpdateStatus } from '../../../common/enums';
import { ts } from '../../../database/column-types';
import { AiUpdateDraft } from '../../ai/entities/ai-update-draft.entity';
import { Milestone } from '../../projects/entities/milestone.entity';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { ProgressPhoto } from './progress-photo.entity';

@Entity('progress_updates')
@Index(['projectId', 'status', 'createdAt'])
@Index(['milestoneId'])
@Index(['authorId'])
export class ProgressUpdate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') projectId: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'projectId' }) project: Relation<Project>;
  @Column({ type: 'uuid', nullable: true }) milestoneId: string | null;
  @ManyToOne(() => Milestone, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'milestoneId' })
  milestone: Relation<Milestone | null>;
  @Column('uuid') authorId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'authorId' }) author: Relation<User>;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) engineerNote: string | null;
  @Column({ type: 'text', nullable: true }) publishedText: string | null;
  @Column({ type: 'int', nullable: true }) progressAfter: number | null;
  @Column({ type: 'enum', enum: UpdateStatus, default: UpdateStatus.DRAFT }) status: UpdateStatus;
  @Column({ type: 'text', nullable: true }) rejectReason: string | null;
  @Column({ type: 'uuid', nullable: true }) approvedById: string | null;
  @Column({ ...ts, nullable: true }) approvedAt: Date | null;
  @CreateDateColumn(ts) createdAt: Date;
  @OneToMany(() => ProgressPhoto, (p) => p.update) photos: Relation<ProgressPhoto[]>;
  @OneToOne(() => AiUpdateDraft, (d) => d.update) aiDraft: Relation<AiUpdateDraft | null>;
}
