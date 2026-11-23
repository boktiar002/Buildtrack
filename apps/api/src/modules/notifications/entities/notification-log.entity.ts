import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationChannel } from '../../../common/enums';
import { ts } from '../../../database/column-types';

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column({ type: 'enum', enum: NotificationChannel }) channel: NotificationChannel;
  @Column() type: string;
  @Column({ unique: true }) dedupeKey: string;
  @CreateDateColumn(ts) sentAt: Date;
}
