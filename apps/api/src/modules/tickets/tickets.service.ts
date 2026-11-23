import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationChannel, Role, TicketStatus } from '../../common/enums';
import { AuthUser, isStaff } from '../../common/interfaces/auth-user.interface';
import { AccessService } from '../../common/services/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketMessage } from './entities/ticket-message.entity';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, status?: TicketStatus) {
    const qb = this.db
      .getRepository(Ticket)
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.purchase', 'p')
      .innerJoinAndSelect('p.unit', 'u')
      .innerJoinAndSelect('u.project', 'proj')
      .innerJoinAndSelect('p.buyer', 'b')
      .where('proj.organizationId = :org', { org: user.orgId });
    if (user.role === Role.BUYER) qb.andWhere('p.buyerId = :me', { me: user.id });
    if (status) qb.andWhere('t.status = :status', { status });
    const rows = await qb.orderBy('t.updatedAt', 'DESC').take(200).getMany();
    return rows.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      fromAi: t.fromAi,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      purchaseId: t.purchaseId,
      unit: t.purchase.unit.code,
      project: t.purchase.unit.project.name,
      buyer: t.purchase.buyer.name,
    }));
  }

  private async load(user: AuthUser, id: string) {
    const t = await this.db.getRepository(Ticket).findOne({ where: { id } });
    if (!t) throw new NotFoundException('Ticket not found');
    const purchase = await this.access.purchase(user, t.purchaseId); // throws for other buyers / orgs
    return { t, purchase };
  }

  async get(user: AuthUser, id: string) {
    const { t, purchase } = await this.load(user, id);
    const messages = await this.db
      .getRepository(TicketMessage)
      .find({ where: { ticketId: id }, relations: { author: true }, order: { createdAt: 'ASC' } });
    return {
      ...t,
      unit: purchase.unit.code,
      project: purchase.unit.project.name,
      buyer: { id: purchase.buyer.id, name: purchase.buyer.name },
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt,
        author: { id: m.author.id, name: m.author.name, isStaff: m.author.role !== Role.BUYER },
      })),
    };
  }

  async create(user: AuthUser, dto: CreateTicketDto) {
    if (user.role !== Role.BUYER) throw new ForbiddenException('Tickets are opened by buyers.');
    await this.access.purchase(user, dto.purchaseId);
    const t = await this.db.transaction(async (em) => {
      const t = await em.getRepository(Ticket).save({ purchaseId: dto.purchaseId, subject: dto.subject.trim() });
      await em.getRepository(TicketMessage).insert({ ticketId: t.id, authorId: user.id, body: dto.body.trim() });
      return t;
    });
    this.notifications.send({
      userIds: await this.notifications.staffIds(user.orgId),
      type: 'TICKET_CREATED',
      title: 'New support ticket',
      body: `${user.name}: ${t.subject}`,
      link: `/admin/tickets/${t.id}`,
    });
    return this.get(user, t.id);
  }

  async reply(user: AuthUser, id: string, body: string) {
    const { t, purchase } = await this.load(user, id);
    if (t.status === TicketStatus.CLOSED) throw new ConflictException('This ticket is closed.');
    await this.db.transaction(async (em) => {
      await em.getRepository(TicketMessage).insert({ ticketId: id, authorId: user.id, body: body.trim() });
      await em
        .getRepository(Ticket)
        .update(id, { status: isStaff(user) ? TicketStatus.ANSWERED : TicketStatus.OPEN, updatedAt: new Date() });
    });
    if (isStaff(user)) {
      this.notifications.send({
        userIds: [purchase.buyerId],
        type: 'TICKET_REPLY',
        title: `Reply to "${t.subject}"`,
        body: body.trim().slice(0, 300),
        link: `/portal/support/${id}`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
    } else {
      this.notifications.send({
        userIds: await this.notifications.staffIds(user.orgId),
        type: 'TICKET_REPLY',
        title: `Buyer replied: ${t.subject}`,
        body: body.trim().slice(0, 300),
        link: `/admin/tickets/${id}`,
      });
    }
    return this.get(user, id);
  }

  async close(user: AuthUser, id: string) {
    await this.load(user, id);
    await this.db.getRepository(Ticket).update(id, { status: TicketStatus.CLOSED });
    return this.get(user, id);
  }
}
