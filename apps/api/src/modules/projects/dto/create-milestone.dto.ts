import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) weight: number;
  @IsOptional() @IsDateString() plannedStart?: string;
  @IsOptional() @IsDateString() plannedEnd?: string;
}
