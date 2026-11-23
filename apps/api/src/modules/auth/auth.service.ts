import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { Role } from '../../common/enums';
import { loadEnv } from '../../config/env';
import { MessagingService } from '../mail/messaging.service';
import { Organization } from '../users/entities/organization.entity';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';

export const ACCESS_TTL_S = 15 * 60;
export const REFRESH_TTL_S = 7 * 24 * 60 * 60;
const RESET_TTL_MS = 60 * 60 * 1000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** bcrypt cost factor: 2^12 rounds (about 0.25 s per hash), slow enough to resist brute force. */
export const BCRYPT_ROUNDS = 12;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, BCRYPT_ROUNDS);
}

export async function verifyPassword(hash: string, pw: string) {
  return bcrypt.compare(pw, hash).catch(() => false);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Used to spend the same time on unknown emails as on wrong passwords.
  private dummyHash: Promise<string> = hashPassword('not-a-real-password');

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken) private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly messaging: MessagingService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('lower(u.email) = lower(:email)', { email: email.trim() })
      .getOne();
    const ok = user ? await verifyPassword(user.passwordHash, password) : await verifyPassword(await this.dummyHash, password);
    if (!user || !ok || !user.isActive) throw new UnauthorizedException('Incorrect email or password.');
    await this.users.update(user.id, { lastLoginAt: new Date() });
    return { user, ...(await this.issueTokens(user)) };
  }

  /**
   * Self-registration for flat buyers. Staff accounts are only created by an admin.
   * The developer (organization) is chosen by slug; it defaults to DEFAULT_ORG_SLUG.
   */
  async register(dto: { name: string; email: string; password: string; phone?: string; organizationSlug?: string }) {
    const slug = dto.organizationSlug ?? loadEnv().DEFAULT_ORG_SLUG;
    const org = await this.orgs.findOne({ where: { slug } });
    if (!org) throw new NotFoundException(`No developer found with the code "${slug}".`);
    const email = dto.email.trim().toLowerCase();
    const exists = await this.users.createQueryBuilder('u').where('lower(u.email) = :email', { email }).getExists();
    if (exists) throw new ConflictException('An account with this email already exists. Please sign in instead.');
    const user = await this.users.save(
      this.users.create({
        organizationId: org.id,
        role: Role.BUYER,
        name: dto.name.trim(),
        email,
        phone: dto.phone?.trim() || null,
        passwordHash: await hashPassword(dto.password),
      }),
    );
    void this.messaging.email(
      user.email,
      `Welcome to ${org.name} on BuildTrack`,
      `Hello ${user.name},\n\nYour BuildTrack account is ready. When ${org.name} records your flat booking, you will see its construction progress, payment schedule, receipts and documents here.`,
      '/portal',
    );
    return { user, ...(await this.issueTokens(user)) };
  }

  async issueTokens(user: User) {
    const env = loadEnv();
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, org: user.organizationId, role: user.role, name: user.name, email: user.email },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL_S },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshTokens.insert({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000),
    });
    return { accessToken, refreshToken };
  }

  /**
   * Rotates the refresh token. If an already-used token is presented again
   * (a sign of theft), every session of that user is revoked.
   */
  async refresh(token: string | undefined) {
    if (!token) throw new UnauthorizedException('Please sign in.');
    const row = await this.refreshTokens.findOne({ where: { tokenHash: sha256(token) } });
    if (!row || row.expiresAt < new Date()) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    if (row.revokedAt) {
      await this.refreshTokens.update({ userId: row.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      this.logger.warn({ userId: row.userId }, 'Refresh token reuse detected; all sessions revoked');
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    const claimed = await this.refreshTokens.update({ id: row.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!claimed.affected) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const user = await this.users.findOne({ where: { id: row.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Your account is not active.');
    return { user, ...(await this.issueTokens(user)) };
  }

  async revokeAllSessions(userId: string) {
    await this.refreshTokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async logout(token: string | undefined) {
    if (!token) return;
    await this.refreshTokens.update({ tokenHash: sha256(token), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async me(userId: string) {
    const user = await this.users.findOne({ where: { id: userId }, relations: { organization: true } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    const o = user.organization;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      organization: { id: o.id, name: o.name, slug: o.slug, primaryColor: o.primaryColor, accentColor: o.accentColor, logoUrl: o.logoUrl },
    };
  }

  /** Always succeeds from the caller's point of view, so emails cannot be probed. */
  async forgotPassword(email: string) {
    const user = await this.users.createQueryBuilder('u').where('lower(u.email) = lower(:email)', { email: email.trim() }).getOne();
    if (!user || !user.isActive) return;
    const token = randomBytes(32).toString('base64url');
    await this.resetTokens.insert({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
    await this.messaging.email(
      user.email,
      'Reset your BuildTrack password',
      `Hello ${user.name},\n\nUse the link below to set a new password. It expires in 1 hour. If you did not ask for this, you can ignore this email.`,
      `/reset-password?token=${token}`,
    );
  }

  async resetPassword(token: string, newPassword: string) {
    const row = await this.resetTokens.findOne({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('This reset link is invalid or has expired.');
    const claimed = await this.resetTokens.update({ id: row.id, usedAt: IsNull() }, { usedAt: new Date() });
    if (!claimed.affected) throw new BadRequestException('This reset link has already been used.');
    await this.users.update(row.userId, { passwordHash: await hashPassword(newPassword) });
    await this.refreshTokens.update({ userId: row.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.users.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id: userId }).getOneOrFail();
    if (!(await verifyPassword(user.passwordHash, current))) {
      throw new BadRequestException('Your current password is incorrect.');
    }
    await this.users.update(userId, { passwordHash: await hashPassword(next) });
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string | null }) {
    await this.users.update(userId, data);
    return this.me(userId);
  }
}
