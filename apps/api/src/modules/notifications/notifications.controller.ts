import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @ApiOperation({ summary: "The signed-in user's notifications" })
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const [items, unread] = await Promise.all([this.service.list(user.id), this.service.unreadCount(user.id)]);
    return { items, unread };
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Patch('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AuthUser) {
    await this.service.markAllRead(user.id);
  }

  @ApiOperation({ summary: 'Mark one notification as read' })
  @Patch(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.service.markRead(user.id, id);
  }
}
