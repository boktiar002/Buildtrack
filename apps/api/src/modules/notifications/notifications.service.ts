import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { NotificationChannel, Role } from '../../common/enums';
import { MessagingService } from '../mail/messaging.service';
import { User } from '../users/entities/user.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { Notification } from './entities/notification.entity';

export interface NotifyInput {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  link?: string;
  channels?: NotificationChannel[];
  /** When set, each user is notified at most once for this key (per channel). */
  dedupeKey?: string;
  sms?: string;
}

/**
 * Sends notifications. In-app notifications are written to the database;
 * email and SMS are sent best-effort. Nothing here throws to the caller,
 * so notifications can never cause the main action (e.g. a payment) to fail.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationLog) private readonly logs: Repository<NotificationLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly messaging: MessagingService,
  ) {}

  /** Fire-and-forget: runs in the background and only logs failures. */
  send(input: NotifyInput): void {
    void this.sendNow(input).catch((err) => this.logger.error({ err, type: input.type }, 'Notification failed'));
  }

  async sendNow(input: NotifyInput): Promise<void> {
    if (process.env.BT_SILENT_NOTIFICATIONS === '1') return; // used while loading demo data
    const ids = [...new Set(input.userIds)].filter(Boolean);
    if (!ids.length) return;
    const channels = input.channels ?? [NotificationChannel.IN_APP];
    const users = await this.users.find({ where: { id: In(ids), isActive: true } });

    for (const user of users) {
      for (const channel of channels) {
        if (input.dedupeKey && !(await this.claim(user.id, channel, input.type, input.dedupeKey))) continue;
        try {
          if (channel === NotificationChannel.IN_APP) {
            await this.notifications.insert({
              userId: user.id,
              type: input.type,
              title: input.title,
              body: input.body,
              link: input.link ?? null,
            });
          } else if (channel === NotificationChannel.EMAIL) {
            await this.messaging.email(user.email, input.title, input.body, input.link);
          } else if (channel === NotificationChannel.SMS) {
            await this.messaging.sms(user.phone, input.sms ?? `${input.title}. ${input.body}`);
          }
        } catch (err) {
          this.logger.error({ err, userId: user.id, channel }, 'Notification channel failed');
        }
      }
    }
  }

  /** Atomically records a send; returns false if it was already sent. */
  private async claim(userId: string, channel: NotificationChannel, type: string, key: string) {
    const res = await this.logs
      .createQueryBuilder()
      .insert()
      .values({ userId, channel, type, dedupeKey: `${key}:${userId}:${channel}` })
      .orIgnore()
      .returning('id')
      .execute();
    return (res.raw as unknown[]).length > 0;
  }

  async staffIds(orgId: string): Promise<string[]> {
    const staff = await this.users.find({
      where: { organizationId: orgId, role: In([Role.ORG_ADMIN, Role.MANAGER]), isActive: true },
      select: { id: true },
    });
    return staff.map((s) => s.id);
  }

  // -------------------------------------------------------------- user-facing

  list(userId: string, take = 30) {
    return this.notifications.find({ where: { userId }, order: { createdAt: 'DESC' }, take });
  }

  unreadCount(userId: string) {
    return this.notifications.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string) {
    await this.notifications.update({ id, userId }, { readAt: new Date() });
  }

  async markAllRead(userId: string) {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: new Date() });
  }
}
