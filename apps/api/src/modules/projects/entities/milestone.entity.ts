import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { MilestoneStatus } from '../../../common/enums';
import { ts } from '../../../database/column-types';
import { Project } from './project.entity';

@Entity('milestones')
@Index(['projectId', 'sortOrder'])
@Check('CHK_milestone_progress', `"progress" BETWEEN 0 AND 100`)
@Check('CHK_milestone_weight', `"weight" BETWEEN 1 AND 100`)
export class Milestone {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') projectId: string;
  @ManyToOne(() => Project, (p) => p.milestones, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'projectId' }) project: Relation<Project>;
  @Column() name: string;
  @Column('int') sortOrder: number;
  @Column('int') weight: number;
  @Column({ type: 'int', default: 0 }) progress: number;
  @Column({ type: 'enum', enum: MilestoneStatus, default: MilestoneStatus.NOT_STARTED }) status: MilestoneStatus;
  @Column({ ...ts, nullable: true }) plannedStart: Date | null;
  @Column({ ...ts, nullable: true }) plannedEnd: Date | null;
  @Column({ ...ts, nullable: true }) actualStart: Date | null;
  @Column({ ...ts, nullable: true }) completedAt: Date | null;
}
