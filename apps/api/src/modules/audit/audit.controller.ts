import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('audit-logs')
@Roles(Role.ORG_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @ApiOperation({ summary: 'List audit entries; filter by entity, action, actor, record and date' })
  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: AuditQueryDto) {
    return this.audit.list(u, q);
  }

  @ApiOperation({ summary: 'Get one audit entry' })
  @Get(':id')
  findOne(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.audit.findOne(u, id);
  }
}
