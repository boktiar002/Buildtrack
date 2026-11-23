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
import { PurchaseStatus } from '../../../common/enums';
import { money, ts } from '../../../database/column-types';
import { User } from '../../users/entities/user.entity';
import { Installment } from './installment.entity';
import { Unit } from './unit.entity';

@Entity('purchases')
@Index(['unitId'])
@Index(['buyerId'])
@Check('CHK_purchase_total', `"totalPrice" > 0`)
export class Purchase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') unitId: string;
  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'unitId' }) unit: Relation<Unit>;
  @Column('uuid') buyerId: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'buyerId' }) buyer: Relation<User>;
  @Column(ts) bookingDate: Date;
  @Column(money) totalPrice: string;
  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.ACTIVE }) status: PurchaseStatus;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn(ts) createdAt: Date;
  @OneToMany(() => Installment, (i) => i.purchase) installments: Relation<Installment[]>;
}
