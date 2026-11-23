import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@Controller('tickets')
@Roles(Role.ORG_ADMIN, Role.MANAGER, Role.BUYER)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @ApiOperation({ summary: 'List support conversations' })
  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: TicketQueryDto) {
    return this.tickets.list(u, q.status);
  }

  @ApiOperation({ summary: 'Open a support conversation about a booking' })
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(u, dto);
  }

  @ApiOperation({ summary: 'Get a support conversation with its messages' })
  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.get(u, id);
  }

  @ApiOperation({ summary: 'Reply in a support conversation' })
  @Post(':id/messages')
  reply(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTicketMessageDto) {
    return this.tickets.reply(u, id, dto.body);
  }

  @ApiOperation({ summary: 'Close a support conversation' })
  @Patch(':id/close')
  close(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.close(u, id);
  }
}
