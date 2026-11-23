import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { InstallmentDueType, InstallmentStatus } from '../../../common/enums';
import { money, ts } from '../../../database/column-types';
import { Milestone } from '../../projects/entities/milestone.entity';
import { Purchase } from './purchase.entity';

@Entity('installments')
@Index(['purchaseId', 'sortOrder'])
@Index(['milestoneId'])
@Index(['status', 'dueDate'])
@Check('CHK_installment_amount', `"amount" > 0`)
@Check('CHK_installment_paid', `"paidAmount" >= 0 AND "paidAmount" <= "amount"`)
export class Installment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') purchaseId: string;
  @ManyToOne(() => Purchase, (p) => p.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseId' })
  purchase: Relation<Purchase>;
  @Column() label: string;
  @Column('int') sortOrder: number;
  @Column(money) amount: string;
  @Column({ type: 'enum', enum: InstallmentDueType }) dueType: InstallmentDueType;
  @Column({ ...ts, nullable: true }) dueDate: Date | null;
  @Column({ type: 'uuid', nullable: true }) milestoneId: string | null;
  @ManyToOne(() => Milestone, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'milestoneId' })
  milestone: Relation<Milestone | null>;
  @Column({ ...money, default: 0 }) paidAmount: string;
  @Column({ type: 'enum', enum: InstallmentStatus, default: InstallmentStatus.UPCOMING }) status: InstallmentStatus;
  @Column({ type: 'text', nullable: true }) waiveReason: string | null;
}
