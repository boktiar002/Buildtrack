import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ts } from '../../../database/column-types';

// ------------------------------------------------------------------ AI tables

@Entity('ai_usage_logs')
@Index(['organizationId', 'createdAt'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @Column() feature: string;
  @Column() model: string;
  @Column({ type: 'int', default: 0 }) inputTokens: number;
  @Column({ type: 'int', default: 0 }) outputTokens: number;
  @Column({ type: 'numeric', precision: 10, scale: 6, default: 0 }) costUsd: string;
  @Column('int') latencyMs: number;
  @Column() success: boolean;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn(ts) createdAt: Date;
}
