import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PageQuery } from '../../../common/dto/page-query.dto';
import { PaymentMethod } from '../../../common/enums';

export class PaymentQueryDto extends PageQuery {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
