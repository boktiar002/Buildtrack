import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ts } from '../../../database/column-types';

/** One row per change: who did what to which record, the values before and after, from which IP, and when. */
@Entity('audit_logs')
@Index(['organizationId', 'createdAt'])
@Index(['entity', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @Column('uuid') actorId: string;
  /** CREATE, UPDATE, DELETE, or a business event such as PAYMENT_RECORDED. */
  @Column() action: string;
  @Column() entity: string;
  @Column() entityId: string;
  @Column({ type: 'jsonb', nullable: true }) oldValue: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) newValue: Record<string, unknown> | null;
  /** Extra context such as a reason or a receipt number. */
  @Column({ type: 'jsonb', nullable: true }) meta: Record<string, unknown> | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) ipAddress: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) requestId: string | null;
  @CreateDateColumn(ts) createdAt: Date;
}
