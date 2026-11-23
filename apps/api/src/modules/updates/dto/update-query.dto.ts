import { IsEnum, IsOptional } from 'class-validator';
import { UpdateStatus } from '../../../common/enums';

export class UpdateQueryDto {
  @IsOptional() @IsEnum(UpdateStatus) status?: UpdateStatus;
}
