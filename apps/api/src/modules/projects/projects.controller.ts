import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AssignEngineerDto } from './dto/assign-engineer.dto';
import { ChangeHandoverDto } from './dto/change-handover.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

const STAFF = [Role.ORG_ADMIN, Role.MANAGER] as const;

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @ApiOperation({ summary: 'List projects the user may see; search, status filter, paging' })
  @Get('projects')
  list(@CurrentUser() u: AuthUser, @Query() q: ProjectQueryDto) {
    return this.projects.list(u, q);
  }

  @ApiOperation({ summary: 'Create a project with its standard stage plan' })
  @Roles(...STAFF)
  @Post('projects')
  @ResponseMessage('Project created')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(u, dto, dto.withTemplate ?? true);
  }

  @ApiOperation({ summary: 'Get one project with stages, progress and handover history' })
  @Get('projects/:id')
  detail(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.detail(u, id);
  }

  @ApiOperation({ summary: 'Update a project' })
  @Roles(...STAFF)
  @Patch('projects/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(u, id, dto);
  }

  @ApiOperation({ summary: 'Delete a project that has no bookings' })
  @Roles(Role.ORG_ADMIN)
  @Delete('projects/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(u, id);
  }

  @ApiOperation({ summary: "Upload the project's cover photo" })
  @Roles(...STAFF)
  @Post('projects/:id/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @HttpCode(200)
  cover(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Please choose an image.');
    return this.projects.setCover(u, id, file.buffer);
  }

  @ApiOperation({ summary: 'Change the expected handover date with a reason; buyers are notified' })
  @Roles(...STAFF)
  @Post('projects/:id/handover-date')
  @ResponseMessage('Handover date changed and buyers notified')
  handover(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeHandoverDto) {
    return this.projects.changeHandover(u, id, dto.newDate, dto.reason);
  }

  @ApiOperation({ summary: 'Every handover date change with its reason' })
  @Get('projects/:id/handover-history')
  handoverHistory(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.handoverHistory(u, id);
  }

  @ApiOperation({ summary: 'Assign an engineer to the project' })
  @Roles(...STAFF)
  @Post('projects/:id/assignments')
  assign(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignEngineerDto) {
    return this.projects.assign(u, id, dto.userId);
  }

  @ApiOperation({ summary: 'Remove an engineer from the project' })
  @Roles(...STAFF)
  @Delete('projects/:id/assignments/:userId')
  @HttpCode(204)
  unassign(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.projects.unassign(u, id, userId);
  }
}
