import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { Purchase } from '../../finance/entities/purchase.entity';
import { User } from '../../users/entities/user.entity';

// ------------------------------------------------------------------ AI tables

@Entity('assistant_conversations')
@Index(['buyerId', 'createdAt'])
export class AssistantConversation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') buyerId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'buyerId' }) buyer: Relation<User>;
  @Column('uuid') purchaseId: string;
  @ManyToOne(() => Purchase, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'purchaseId' }) purchase: Relation<Purchase>;
  @CreateDateColumn(ts) createdAt: Date;
}
