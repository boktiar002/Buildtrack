import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { User } from '../../users/entities/user.entity';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: Relation<User>;
  @Column({ unique: true }) tokenHash: string;
  @Column(ts) expiresAt: Date;
  @Column({ ...ts, nullable: true }) usedAt: Date | null;
}
