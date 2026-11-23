import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { User } from '../../users/entities/user.entity';
import { Ticket } from './ticket.entity';

@Entity('ticket_messages')
@Index(['ticketId'])
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') ticketId: string;
  @ManyToOne(() => Ticket, (t) => t.messages, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'ticketId' }) ticket: Relation<Ticket>;
  @Column('uuid') authorId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'authorId' }) author: Relation<User>;
  @Column('text') body: string;
  @CreateDateColumn(ts) createdAt: Date;
}
