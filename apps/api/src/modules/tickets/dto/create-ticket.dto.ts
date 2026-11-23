import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsUUID() purchaseId: string;
  @IsString() @MinLength(3) @MaxLength(120) subject: string;
  @IsString() @MinLength(3) @MaxLength(3000) body: string;
}
