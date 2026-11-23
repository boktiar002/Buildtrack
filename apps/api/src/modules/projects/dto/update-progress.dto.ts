import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateProgressDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) progress: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
