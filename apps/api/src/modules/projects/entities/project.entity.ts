import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from 'typeorm';
import { ProjectStatus } from '../../../common/enums';
import { ts } from '../../../database/column-types';
import { Organization } from '../../users/entities/organization.entity';
import { Milestone } from './milestone.entity';

@Entity('projects')
@Unique(['organizationId', 'slug'])
@Index(['organizationId'])
export class Project {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'organizationId' }) organization: Relation<Organization>;
  @Column() name: string;
  @Column() slug: string;
  @Column() location: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'text', nullable: true }) coverImageKey: string | null;
  @Column('int') totalFloors: number;
  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.PLANNING }) status: ProjectStatus;
  @Column({ ...ts, nullable: true }) startDate: Date | null;
  @Column(ts) originalHandoverDate: Date;
  @Column(ts) expectedHandoverDate: Date;
  @Column({ default: false }) isPublic: boolean;
  @CreateDateColumn(ts) createdAt: Date;
  @OneToMany(() => Milestone, (m) => m.project) milestones: Relation<Milestone[]>;
}
