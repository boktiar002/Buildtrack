import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { ReasonDto } from './dto/reason.dto';
import { FinanceService } from './finance.service';

const STAFF = [Role.ORG_ADMIN, Role.MANAGER] as const;

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly finance: FinanceService) {}

  @ApiOperation({ summary: 'Record a payment and issue a receipt (transaction)' })
  @Roles(...STAFF)
  @Post('purchases/:id/payments')
  @ResponseMessage('Payment recorded')
  create(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePaymentDto) {
    return this.finance.recordPayment(u, id, dto);
  }

  @ApiOperation({ summary: 'List payments; search and filter by project, method and date' })
  @Roles(...STAFF)
  @Get('payments')
  list(@CurrentUser() u: AuthUser, @Query() q: PaymentQueryDto) {
    return this.finance.listPayments(u, q);
  }

  @ApiOperation({ summary: 'Get a payment receipt' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.BUYER)
  @Get('payments/:id/receipt')
  receipt(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.finance.receipt(u, id);
  }

  @ApiOperation({ summary: 'Void a payment with a reason; balances are restored (transaction)' })
  @Roles(Role.ORG_ADMIN)
  @Post('payments/:id/void')
  @ResponseMessage('Payment voided')
  @HttpCode(200)
  void(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.finance.voidPayment(u, id, dto.reason);
  }
}
