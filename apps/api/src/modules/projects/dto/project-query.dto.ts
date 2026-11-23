import { IsEnum, IsOptional } from 'class-validator';
import { PageQuery } from '../../../common/dto/page-query.dto';
import { ProjectStatus } from '../../../common/enums';

export class ProjectQueryDto extends PageQuery {
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}
