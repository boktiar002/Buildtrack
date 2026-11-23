import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ApproveUpdateDto } from './dto/approve-update.dto';
import { CreateProgressUpdateDto } from './dto/create-progress-update.dto';
import { ReasonDto } from './dto/reason.dto';
import { SubmitUpdateDto } from './dto/submit-update.dto';
import { UpdateQueryDto } from './dto/update-query.dto';
import { MAX_PHOTOS, UpdatesService } from './updates.service';

const STAFF = [Role.ORG_ADMIN, Role.MANAGER] as const;
const UPLOAD = FilesInterceptor('photos', MAX_PHOTOS, { limits: { fileSize: 8 * 1024 * 1024, files: MAX_PHOTOS } });

@ApiTags('updates')
@Controller()
export class UpdatesController {
  constructor(private readonly updates: UpdatesService) {}

  @ApiOperation({ summary: 'List site updates of a project' })
  @Get('projects/:id/updates')
  list(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: UpdateQueryDto) {
    return this.updates.list(u, id, q.status);
  }

  @ApiOperation({ summary: 'Upload site photos (up to 8); returns the AI stage suggestion' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.ENGINEER)
  @Post('projects/:id/updates')
  @UseInterceptors(UPLOAD)
  create(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProgressUpdateDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.updates.create(u, id, dto, files);
  }

  @ApiOperation({ summary: "Updates waiting for a manager's review" })
  @Roles(...STAFF)
  @Get('updates/review-queue')
  queue(@CurrentUser() u: AuthUser) {
    return this.updates.reviewQueue(u);
  }

  @ApiOperation({ summary: "How often engineers accepted the AI's photo suggestions" })
  @Roles(...STAFF)
  @Get('updates/ai-accuracy')
  accuracy(@CurrentUser() u: AuthUser) {
    return this.updates.aiAccuracy(u);
  }

  @ApiOperation({ summary: 'Get one site update' })
  @Get('updates/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.updates.get(u, id);
  }

  @ApiOperation({ summary: 'Engineer confirms stage and progress; the AI drafts the buyer text' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.ENGINEER)
  @Post('updates/:id/submit')
  @HttpCode(200)
  submit(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitUpdateDto) {
    return this.updates.submit(u, id, dto);
  }

  @ApiOperation({ summary: 'Ask the AI for a new draft' })
  @Roles(...STAFF)
  @Post('updates/:id/regenerate')
  @HttpCode(200)
  regenerate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.updates.generateDraft(u, id);
  }

  @ApiOperation({ summary: 'Publish the update to buyers and apply its progress (transaction)' })
  @Roles(...STAFF)
  @Post('updates/:id/approve')
  @HttpCode(200)
  approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveUpdateDto) {
    return this.updates.approve(u, id, dto);
  }

  @ApiOperation({ summary: 'Send the update back to the engineer with a reason' })
  @Roles(...STAFF)
  @Post('updates/:id/reject')
  @HttpCode(200)
  reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.updates.reject(u, id, dto.reason);
  }

  @ApiOperation({ summary: 'Hide a published update with a reason' })
  @Roles(...STAFF)
  @Post('updates/:id/unpublish')
  @HttpCode(200)
  unpublish(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.updates.unpublish(u, id, dto.reason);
  }

  @ApiOperation({ summary: 'Delete an update that is not published' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.ENGINEER)
  @Delete('updates/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.updates.remove(u, id);
  }
}
