import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { PaymentMethod } from '../../../common/enums';
import { MONEY, MONEY_MSG } from './money.validation';
import { PaymentAllocationDto } from './payment-allocation.dto';

export class PaymentDto {
  @Matches(MONEY, MONEY_MSG) amount: string;
  @IsEnum(PaymentMethod) method: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
  @IsDateString() paidAt: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations?: PaymentAllocationDto[];
}
