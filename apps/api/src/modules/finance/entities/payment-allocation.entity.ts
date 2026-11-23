import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { money } from '../../../database/column-types';
import { Installment } from './installment.entity';
import { Payment } from './payment.entity';

@Entity('payment_allocations')
@Index(['paymentId'])
@Index(['installmentId'])
@Check('CHK_allocation_amount', `"amount" > 0`)
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') paymentId: string;
  @ManyToOne(() => Payment, (p) => p.allocations, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'paymentId' }) payment: Relation<Payment>;
  @Column('uuid') installmentId: string;
  @ManyToOne(() => Installment, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'installmentId' }) installment: Relation<Installment>;
  @Column(money) amount: string;
}
