import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicService } from './public.service';

@ApiTags('public')
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly service: PublicService) {}

  @ApiOperation({ summary: "Public: a developer's public projects" })
  @Get(':orgSlug')
  org(@Param('orgSlug') orgSlug: string) {
    return this.service.organization(orgSlug);
  }

  @ApiOperation({ summary: "Public: one project's progress and published updates" })
  @Get(':orgSlug/projects/:slug')
  project(@Param('orgSlug') orgSlug: string, @Param('slug') slug: string) {
    return this.service.project(orgSlug, slug);
  }
}
