import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ProjectStatus } from '../../../common/enums';

export class CreateProjectDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() @MinLength(2) @MaxLength(200) location: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) totalFloors: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsDateString() originalHandoverDate: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsBoolean() withTemplate?: boolean;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}
