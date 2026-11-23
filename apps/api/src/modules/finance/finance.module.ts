import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Installment } from './entities/installment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { Payment } from './entities/payment.entity';
import { Purchase } from './entities/purchase.entity';
import { ReceiptCounter } from './entities/receipt-counter.entity';
import { Unit } from './entities/unit.entity';
import { FinanceService } from './finance.service';
import { PaymentsController } from './payments.controller';
import { PurchasesController } from './purchases.controller';
import { UnitsController } from './units.controller';

/** Flats (units), bookings (purchases), installment plans, payments and receipts. */
@Module({
  imports: [TypeOrmModule.forFeature([Unit, Purchase, Installment, ReceiptCounter, Payment, PaymentAllocation])],
  controllers: [UnitsController, PurchasesController, PaymentsController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
