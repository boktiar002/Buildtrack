import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ts } from '../../../database/column-types';

@Entity('organizations')
@Unique('UQ_organizations_receiptPrefix', ['receiptPrefix'])
export class Organization {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ unique: true }) slug: string;
  @Column({ type: 'text', nullable: true }) logoUrl: string | null;
  @Column({ default: '#1F2A37' }) primaryColor: string;
  @Column({ default: '#C8A24A' }) accentColor: string;
  @Column({ default: 'RCP' }) receiptPrefix: string;
  @Column({ type: 'int', default: 15 }) milestoneGraceDays: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 5 }) aiMonthlyBudgetUsd: string;
  @CreateDateColumn(ts) createdAt: Date;
}
