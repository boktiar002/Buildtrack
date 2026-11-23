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
  UpdateDateColumn,
} from 'typeorm';
import { TicketStatus } from '../../../common/enums';
import { ts } from '../../../database/column-types';
import { Purchase } from '../../finance/entities/purchase.entity';
import { TicketMessage } from './ticket-message.entity';

@Entity('tickets')
@Index(['purchaseId'])
@Index(['status'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') purchaseId: string;
  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'purchaseId' }) purchase: Relation<Purchase>;
  @Column() subject: string;
  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN }) status: TicketStatus;
  @Column({ default: false }) fromAi: boolean;
  @CreateDateColumn(ts) createdAt: Date;
  @UpdateDateColumn(ts) updatedAt: Date;
  @OneToMany(() => TicketMessage, (m) => m.ticket) messages: Relation<TicketMessage[]>;
}
