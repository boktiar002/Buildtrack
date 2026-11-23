import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { AssistantConversation } from './assistant-conversation.entity';

// ------------------------------------------------------------------ AI tables

@Entity('assistant_messages')
@Index(['conversationId', 'createdAt'])
export class AssistantMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') conversationId: string;
  @ManyToOne(() => AssistantConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Relation<AssistantConversation>;
  @Column() role: 'user' | 'assistant';
  @Column('text') text: string;
  @Column({ type: 'jsonb', nullable: true }) sources: Array<{ type: string; label: string; ref?: string }> | null;
  @Column({ default: false }) unsure: boolean;
  @Column({ type: 'boolean', nullable: true }) helpful: boolean | null;
  @CreateDateColumn(ts) createdAt: Date;
}
