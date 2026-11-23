import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from "../../common/decorators/public.decorator";
import { StorageService } from './storage.service';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  /** Serves a stored file if the signed link is valid and not expired. */
  @ApiOperation({ summary: "Download a file with a signed, expiring link" })
    @Public()
  @Get(':folder/:name')
  async get(
    @Param('folder') folder: string,
    @Param('name') name: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const key = `${folder}/${name}`;
    this.storage.verify(key, exp, sig);
    const { stream, size } = await this.storage.open(key);
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (ext === 'pdf') res.setHeader('Content-Disposition', 'inline');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}
