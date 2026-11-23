import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { RiskLevel } from '../../../common/enums';
import { ts } from '../../../database/column-types';
import { Project } from '../../projects/entities/project.entity';

// ------------------------------------------------------------------ AI tables

@Entity('delay_risk_scores')
@Index(['projectId', 'computedAt'])
export class DelayRiskScore {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') projectId: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'projectId' }) project: Relation<Project>;
  @Column({ type: 'uuid', nullable: true }) milestoneId: string | null;
  @Column('int') score: number;
  @Column({ type: 'enum', enum: RiskLevel }) level: RiskLevel;
  @Column('jsonb') factors: Array<{ label: string; detail: string; points: number }>;
  @Column({ type: 'text', nullable: true }) explanation: string | null;
  @CreateDateColumn(ts) computedAt: Date;
}
