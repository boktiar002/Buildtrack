import { IsUUID } from 'class-validator';

export class ConversationQueryDto {
  @IsUUID() purchaseId: string;
}
