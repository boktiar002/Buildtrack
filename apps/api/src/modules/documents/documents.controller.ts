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
import { ApiConsumes, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @ApiOperation({ summary: 'List documents the user may see; filter by project or booking' })
  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: DocumentQueryDto) {
    return this.docs.list(u, q);
  }

  @ApiOperation({ summary: 'Upload a document (PDF, JPG or PNG, up to 20 MB) with its visibility' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(@CurrentUser() u: AuthUser, @Body() dto: CreateDocumentDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Please choose a file (PDF, JPG or PNG).');
    return this.docs.upload(u, dto, file);
  }

  @ApiOperation({ summary: "Get one document's details" })
  @Get(':id')
  findOne(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.findOne(u, id);
  }

  @ApiOperation({ summary: "Change a document's title, type or visibility" })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto) {
    return this.docs.update(u, id, dto);
  }

  @ApiOperation({ summary: 'Get a signed link to open the file (expires in 5 minutes)' })
  @Get(':id/url')
  url(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.url(u, id);
  }

  @ApiOperation({ summary: 'Re-read one document for the assistant' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  @Post(':id/reindex')
  @HttpCode(200)
  reindex(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.reindex(u, id);
  }

  @ApiOperation({ summary: 'Delete a document and its file' })
  @Roles(Role.ORG_ADMIN)
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.remove(u, id);
  }
}
