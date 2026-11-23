import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { PageQuery } from '../../common/dto/page-query.dto';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { page, skipTake } from '../../common/utils/pagination';
import { AuditService } from '../audit/audit.service';
import { AuthService, hashPassword } from '../auth/auth.service';
import { Purchase } from '../finance/entities/purchase.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Organization } from './entities/organization.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Purchase) private readonly purchases: Repository<Purchase>,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateUserDto, role: Role) {
    const exists = await this.users.createQueryBuilder('u').where('lower(u.email) = lower(:e)', { e: dto.email }).getExists();
    if (exists) throw new ConflictException('A user with this email already exists.');
    // Random password: the user sets their own through the emailed link.
    const user = await this.users.save(
      this.users.create({
        organizationId: actor.orgId,
        role,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone ?? null,
        passwordHash: await hashPassword(randomBytes(24).toString('hex')),
      }),
    );
    await this.audit.log(actor, 'USER_CREATED', 'User', user.id, { newValue: { name: user.name, email: user.email, role } });
    await this.auth.forgotPassword(user.email); // sends the "set your password" link
    return this.users.findOneByOrFail({ id: user.id });
  }

  async list(orgId: string, roles: Role[], q: PageQuery) {
    const qb = this.users.createQueryBuilder('u').where('u.organizationId = :orgId AND u.role IN (:...roles)', { orgId, roles });
    if (q.search) qb.andWhere('(u.name ILIKE :s OR u.email ILIKE :s)', { s: `%${q.search}%` });
    const [items, total] = await qb.orderBy('u.name', 'ASC').skip(skipTake(q).skip).take(q.pageSize).getManyAndCount();
    return page(items, total, q);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const user = await this.users.findOne({
      where: { id, organizationId: actor.orgId, role: In([Role.ORG_ADMIN, Role.MANAGER, Role.ENGINEER]) },
    });
    if (!user) throw new NotFoundException('User not found');
    if (dto.role === Role.BUYER) throw new ConflictException('Staff cannot be changed into buyers.');
    if (id === actor.id && (dto.isActive === false || (dto.role && dto.role !== Role.ORG_ADMIN))) {
      throw new ConflictException('You cannot deactivate or demote your own account.');
    }
    await this.users.update(id, dto);
    if (dto.role && dto.role !== user.role)
      await this.audit.log(actor, 'USER_ROLE_CHANGED', 'User', id, { oldValue: { role: user.role }, newValue: { role: dto.role } });
    return this.users.findOneByOrFail({ id });
  }

  async findOne(actor: AuthUser, id: string) {
    const user = await this.users.findOne({ where: { id, organizationId: actor.orgId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Soft delete: the account is deactivated and every session is revoked; history stays intact. */
  async deactivate(actor: AuthUser, id: string) {
    if (id === actor.id) throw new ConflictException('You cannot deactivate your own account.');
    const user = await this.findOne(actor, id);
    if (!user.isActive) throw new ConflictException('This account is already deactivated.');
    await this.users.update(id, { isActive: false });
    await this.auth.revokeAllSessions(id);
    await this.audit.log(actor, 'DELETE', 'User', id, { oldValue: { isActive: true }, newValue: { isActive: false } });
  }

  organization(orgId: string) {
    return this.orgs.findOneByOrFail({ id: orgId });
  }

  async updateOrganization(actor: AuthUser, dto: UpdateOrganizationDto) {
    const org = await this.organization(actor.orgId);
    if (dto.receiptPrefix && dto.receiptPrefix !== org.receiptPrefix) {
      const taken = await this.orgs.existsBy({ receiptPrefix: dto.receiptPrefix });
      if (taken) throw new ConflictException(`The receipt prefix ${dto.receiptPrefix} is already used by another company. Choose a different one.`);
    }
    // Only keep the fields that actually change, so the audit log shows a clean before and after.
    const changes: Partial<Organization> = {};
    const before: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      const next = key === 'aiMonthlyBudgetUsd' ? Number(value).toFixed(2) : value;
      const old = org[key as keyof Organization];
      if (String(old) === String(next)) continue;
      before[key] = old;
      (changes as Record<string, unknown>)[key] = next;
    }
    if (!Object.keys(changes).length) return org;
    await this.orgs.update(org.id, changes);
    await this.audit.log(actor, 'SETTINGS_CHANGED', 'Organization', org.id, { oldValue: before, newValue: changes });
    return this.organization(org.id);
  }

  async buyer(orgId: string, id: string) {
    const buyer = await this.users.findOne({ where: { id, organizationId: orgId, role: Role.BUYER } });
    if (!buyer) throw new NotFoundException('Buyer not found');
    const purchases = await this.purchases.find({
      where: { buyerId: id },
      relations: { unit: { project: true } },
      order: { bookingDate: 'DESC' },
    });
    return { ...buyer, purchases };
  }
}
