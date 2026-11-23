import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class SubmitUpdateDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() milestoneId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(0) @Max(100) progressAfter?: number | null;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
