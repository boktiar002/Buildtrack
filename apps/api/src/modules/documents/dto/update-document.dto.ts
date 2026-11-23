import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DocumentType, DocumentVisibility } from '../../../common/enums';

export class UpdateDocumentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  /** A one-buyer document can only stay one-buyer if it is attached to a booking. */
  @IsOptional() @IsEnum(DocumentVisibility) visibility?: DocumentVisibility;
}
