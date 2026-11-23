import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PageQuery } from '../../../common/dto/page-query.dto';

export class AuditQueryDto extends PageQuery {
  /** Table-level entity name, e.g. Payment, Project, Unit. */
  @IsOptional() @IsString() @MaxLength(60) entity?: string;
  /** e.g. CREATE, UPDATE, DELETE, PAYMENT_RECORDED. */
  @IsOptional() @Matches(/^[A-Z_]{2,60}$/) action?: string;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsString() @MaxLength(64) entityId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
