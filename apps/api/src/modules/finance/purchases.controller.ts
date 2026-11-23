import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ReasonDto } from './dto/reason.dto';
import { FinanceService } from './finance.service';

const STAFF = [Role.ORG_ADMIN, Role.MANAGER] as const;

@ApiTags('purchases')
@Controller()
export class PurchasesController {
  constructor(private readonly finance: FinanceService) {}

  @ApiOperation({ summary: 'List bookings of a project' })
  @Roles(...STAFF)
  @Get('projects/:id/purchases')
  listForProject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.finance.listPurchases(u, id);
  }

  @ApiOperation({ summary: 'Book a flat with its installment plan (transaction)' })
  @Roles(...STAFF)
  @Post('purchases')
  @ResponseMessage('Booking recorded')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreatePurchaseDto) {
    return this.finance.createPurchase(u, dto);
  }

  @ApiOperation({ summary: "The signed-in buyer's flats" })
  @Roles(Role.BUYER)
  @Get('my/purchases')
  mine(@CurrentUser() u: AuthUser) {
    return this.finance.myPurchases(u);
  }

  @ApiOperation({ summary: 'Get one booking with installments, payments and totals' })
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.BUYER)
  @Get('purchases/:id')
  findOne(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.finance.purchaseDetail(u, id);
  }

  @ApiOperation({ summary: 'Cancel a booking with a reason; the flat becomes available' })
  @Roles(Role.ORG_ADMIN)
  @Patch('purchases/:id/cancel')
  @ResponseMessage('Booking cancelled')
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.finance.cancelPurchase(u, id, dto.reason);
  }

  @ApiOperation({ summary: 'Waive the unpaid part of an installment with a reason' })
  @Roles(Role.ORG_ADMIN)
  @Post('installments/:id/waive')
  @ResponseMessage('Installment waived')
  @HttpCode(200)
  waive(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.finance.waiveInstallment(u, id, dto.reason);
  }
}
