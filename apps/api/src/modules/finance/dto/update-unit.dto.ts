import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MONEY, MONEY_MSG } from './money.validation';

export class UpdateUnitDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) code?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) floor?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(50) @Max(100000) sizeSqft?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20) bedrooms?: number;
  @IsOptional() @Matches(MONEY, MONEY_MSG) listPrice?: string;
}
