import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('receipt_counters')
export class ReceiptCounter {
  @PrimaryColumn('uuid') organizationId: string;
  @PrimaryColumn('int') year: number;
  @Column({ type: 'int', default: 0 }) last: number;
}
