import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
@Index(['userId', 'readAt', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: Relation<User>;
  @Column() type: string;
  @Column() title: string;
  @Column('text') body: string;
  @Column({ type: 'text', nullable: true }) link: string | null;
  @Column({ ...ts, nullable: true }) readAt: Date | null;
  @CreateDateColumn(ts) createdAt: Date;
}
