import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocumentType, DocumentVisibility } from '../../../common/enums';

export class CreateDocumentDto {
  @IsString() @MinLength(2) @MaxLength(150) title: string;
  @IsEnum(DocumentType) type: DocumentType;
  @IsEnum(DocumentVisibility) visibility: DocumentVisibility;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() purchaseId?: string;
}
