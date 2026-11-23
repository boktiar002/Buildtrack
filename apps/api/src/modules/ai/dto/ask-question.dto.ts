import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AskQuestionDto {
  @IsUUID() purchaseId: string;
  @IsString() @MinLength(2) @MaxLength(500) question: string;
  @IsOptional() @IsUUID() conversationId?: string;
}
