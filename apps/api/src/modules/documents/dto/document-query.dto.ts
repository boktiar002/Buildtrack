import { IsOptional, IsUUID } from 'class-validator';

export class DocumentQueryDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() purchaseId?: string;
}
