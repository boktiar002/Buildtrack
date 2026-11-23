import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PageQuery } from '../../common/dto/page-query.dto';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @ApiOperation({ summary: 'List staff accounts' })
  @Roles(Role.ORG_ADMIN)
  @Get('users')
  listStaff(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    return this.service.list(u.orgId, [Role.ORG_ADMIN, Role.MANAGER, Role.ENGINEER], q);
  }

  /** Managers need the engineer list to assign them to projects. */
  @ApiOperation({ summary: 'List engineers (for project assignment)' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('engineers')
  listEngineers(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    return this.service.list(u.orgId, [Role.ENGINEER], q);
  }

  @ApiOperation({ summary: 'Create a staff account; a set-password email is sent' })
  @Roles(Role.ORG_ADMIN)
  @Post('users')
  @ResponseMessage('Staff account created; a set-password email was sent')
  createStaff(@CurrentUser() u: AuthUser, @Body() dto: CreateStaffDto) {
    return this.service.create(u, dto, dto.role);
  }

  @ApiOperation({ summary: 'Get one user' })
  @Roles(Role.ORG_ADMIN)
  @Get('users/:id')
  findOne(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(u, id);
  }

  @ApiOperation({ summary: 'Deactivate a user (soft delete) and end their sessions' })
  @Roles(Role.ORG_ADMIN)
  @Delete('users/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(u, id);
  }

  @ApiOperation({ summary: "Change a staff member's details, role or active status" })
  @Roles(Role.ORG_ADMIN)
  @Patch('users/:id')
  updateStaff(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(u, id, dto);
  }

  @ApiOperation({ summary: 'Company settings: name, brand colours, receipt prefix, grace period and AI budget' })
  @Roles(Role.ORG_ADMIN)
  @Get('organization')
  organization(@CurrentUser() u: AuthUser) {
    return this.service.organization(u.orgId);
  }

  @ApiOperation({ summary: 'Change company settings' })
  @Roles(Role.ORG_ADMIN)
  @Patch('organization')
  @ResponseMessage('Settings saved')
  updateOrganization(@CurrentUser() u: AuthUser, @Body() dto: UpdateOrganizationDto) {
    return this.service.updateOrganization(u, dto);
  }

  @ApiOperation({ summary: 'List buyers' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('buyers')
  listBuyers(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    return this.service.list(u.orgId, [Role.BUYER], q);
  }

  @ApiOperation({ summary: 'Add a buyer; a set-password email is sent' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Post('buyers')
  @ResponseMessage('Buyer added; a set-password email was sent')
  createBuyer(@CurrentUser() u: AuthUser, @Body() dto: CreateUserDto) {
    return this.service.create(u, dto, Role.BUYER);
  }

  @ApiOperation({ summary: 'Get one buyer with their bookings' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Get('buyers/:id')
  getBuyer(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.buyer(u.orgId, id);
  }
}
