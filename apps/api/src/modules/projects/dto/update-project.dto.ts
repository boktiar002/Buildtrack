import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ProjectStatus } from '../../../common/enums';

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) totalFloors?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() originalHandoverDate?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}
