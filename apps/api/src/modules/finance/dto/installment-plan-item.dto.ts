import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { InstallmentDueType } from '../../../common/enums';
import { MONEY, MONEY_MSG } from './money.validation';

export class InstallmentPlanItemDto {
  @IsString() @MinLength(2) @MaxLength(120) label: string;
  @Matches(MONEY, MONEY_MSG) amount: string;
  @IsEnum(InstallmentDueType) dueType: InstallmentDueType;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsUUID() milestoneId?: string;
}
