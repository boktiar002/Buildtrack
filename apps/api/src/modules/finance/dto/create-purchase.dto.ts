import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InstallmentPlanItemDto } from './installment-plan-item.dto';
import { MONEY, MONEY_MSG } from './money.validation';

export class CreatePurchaseDto {
  @IsUUID() unitId: string;
  @IsUUID() buyerId: string;
  @IsDateString() bookingDate: string;
  @Matches(MONEY, MONEY_MSG) totalPrice: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => InstallmentPlanItemDto)
  installments: InstallmentPlanItemDto[];
}
