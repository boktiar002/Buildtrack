import { IsUUID, Matches } from 'class-validator';
import { MONEY, MONEY_MSG } from './money.validation';

export class PaymentAllocationDto {
  @IsUUID() installmentId: string;
  @Matches(MONEY, MONEY_MSG) amount: string;
}
