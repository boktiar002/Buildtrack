import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { MilestonesService } from './milestones.service';
import { ProjectsService } from './projects.service';

const STAFF = [Role.ORG_ADMIN, Role.MANAGER] as const;

/** Construction stages (milestones) of a project and their progress. */
@ApiTags('milestones')
@Controller()
export class MilestonesController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly milestones: MilestonesService,
  ) {}

  @ApiOperation({ summary: 'List the construction stages of a project' })
  @Get('projects/:id/milestones')
  list(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.listMilestones(u, id);
  }

  @ApiOperation({ summary: 'Get one construction stage' })
  @Get('milestones/:id')
  findOne(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.milestone(u, id);
  }

  @ApiOperation({ summary: 'Add a construction stage' })
  @Roles(...STAFF)
  @Post('projects/:id/milestones')
  create(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMilestoneDto) {
    return this.projects.addMilestone(u, id, dto);
  }

  @ApiOperation({ summary: "Create the standard stage plan for the project's floors" })
  @Roles(...STAFF)
  @Post('projects/:id/milestones/template')
  template(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.applyTemplate(u, id);
  }

  @ApiOperation({ summary: "Update a stage's name, weight or planned dates" })
  @Roles(...STAFF)
  @Patch('milestones/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMilestoneDto) {
    return this.projects.editMilestone(u, id, dto);
  }

  @ApiOperation({ summary: "Set a stage's progress; linked installments fall due at 100%" })
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.ENGINEER)
  @Patch('milestones/:id/progress')
  async progress(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgressDto) {
    const { milestone } = await this.milestones.setProgress(u, id, { progress: dto.progress, reason: dto.reason });
    return milestone;
  }

  @ApiOperation({ summary: 'Delete a stage that has no progress and no linked installment' })
  @Roles(...STAFF)
  @Delete('milestones/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.deleteMilestone(u, id);
  }
}
