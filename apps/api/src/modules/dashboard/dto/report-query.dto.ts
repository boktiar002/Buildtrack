import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ReportQueryDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['json', 'csv']) format?: 'json' | 'csv';
}
