import { IsEnum, IsOptional } from 'class-validator';
import { PageQuery } from '../../../common/dto/page-query.dto';
import { UnitStatus } from '../../../common/enums';

export class UnitQueryDto extends PageQuery {
  @IsOptional() @IsEnum(UnitStatus) status?: UnitStatus;
}
