import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ts } from '../../../database/column-types';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
@Index(['userId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: Relation<User>;
  @Column({ unique: true }) tokenHash: string;
  @Column(ts) expiresAt: Date;
  @Column({ ...ts, nullable: true }) revokedAt: Date | null;
  @CreateDateColumn(ts) createdAt: Date;
}
