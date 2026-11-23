import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Role } from '../../../common/enums';
import { ts } from '../../../database/column-types';
import { Organization } from './organization.entity';

@Entity('users')
@Index(['organizationId'])
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'organizationId' }) organization: Relation<Organization>;
  @Column({ type: 'enum', enum: Role }) role: Role;
  @Column() name: string;
  @Column({ unique: true }) email: string;
  @Column({ type: 'text', nullable: true }) phone: string | null;
  /** bcrypt hash. Never selected by default and stripped from every response by ClassSerializerInterceptor. */
  @Exclude({ toPlainOnly: true })
  @Column({ select: false })
  passwordHash: string;
  @Column({ default: true }) isActive: boolean;
  @Column({ ...ts, nullable: true }) lastLoginAt: Date | null;
  @CreateDateColumn(ts) createdAt: Date;
}
