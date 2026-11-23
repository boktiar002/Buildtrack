import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { Project } from './project.entity';

@Entity('handover_date_changes')
@Index(['projectId', 'createdAt'])
export class HandoverDateChange {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') projectId: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'projectId' }) project: Relation<Project>;
  @Column(ts) oldDate: Date;
  @Column(ts) newDate: Date;
  @Column('text') reason: string;
  @Column('uuid') changedById: string;
  @CreateDateColumn(ts) createdAt: Date;
}
