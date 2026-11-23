import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { UnitStatus } from '../../../common/enums';
import { money } from '../../../database/column-types';
import { Project } from '../../projects/entities/project.entity';

@Entity('units')
@Unique(['projectId', 'code'])
@Check('CHK_unit_price', `"listPrice" > 0`)
@Check('CHK_unit_size', `"sizeSqft" > 0`)
export class Unit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') projectId: string;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'projectId' }) project: Relation<Project>;
  @Column() code: string;
  @Column('int') floor: number;
  @Column('int') sizeSqft: number;
  @Column({ type: 'int', nullable: true }) bedrooms: number | null;
  @Column(money) listPrice: string;
  @Column({ type: 'enum', enum: UnitStatus, default: UnitStatus.AVAILABLE }) status: UnitStatus;
}
