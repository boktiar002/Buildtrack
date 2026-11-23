import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { PaymentMethod } from '../../../common/enums';
import { money, ts } from '../../../database/column-types';
import { PaymentAllocation } from './payment-allocation.entity';
import { Purchase } from './purchase.entity';

@Entity('payments')
@Index(['purchaseId'])
@Index(['paidAt'])
@Check('CHK_payment_amount', `"amount" > 0`)
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') purchaseId: string;
  @ManyToOne(() => Purchase, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'purchaseId' }) purchase: Relation<Purchase>;
  @Column(money) amount: string;
  @Column({ type: 'enum', enum: PaymentMethod }) method: PaymentMethod;
  @Column({ type: 'text', nullable: true }) reference: string | null;
  @Column(ts) paidAt: Date;
  @Column({ unique: true }) receiptNumber: string;
  @Column('uuid') recordedById: string;
  @Column({ ...ts, nullable: true }) voidedAt: Date | null;
  @Column({ type: 'text', nullable: true }) voidReason: string | null;
  @CreateDateColumn(ts) createdAt: Date;
  @OneToMany(() => PaymentAllocation, (a) => a.payment) allocations: Relation<PaymentAllocation[]>;
}
