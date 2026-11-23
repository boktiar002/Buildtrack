import { IsEnum, IsOptional } from 'class-validator';
import { TicketStatus } from '../../../common/enums';

export class TicketQueryDto {
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
}
