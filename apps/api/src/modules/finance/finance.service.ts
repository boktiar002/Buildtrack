import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { PageQuery } from '../../common/dto/page-query.dto';
import {
  InstallmentDueType,
  InstallmentStatus,
  MilestoneStatus,
  NotificationChannel,
  PaymentMethod,
  PurchaseStatus,
  Role,
  UnitStatus,
} from '../../common/enums';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AccessService } from '../../common/services/access.service';
import { addDays } from '../../common/utils/dates';
import { formatTaka, fromPoisha, toPoisha } from '../../common/utils/money';
import { page, skipTake } from '../../common/utils/pagination';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Milestone } from '../projects/entities/milestone.entity';
import { Project } from '../projects/entities/project.entity';
import { Organization } from '../users/entities/organization.entity';
import { User } from '../users/entities/user.entity';
import { Installment } from './entities/installment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { Payment } from './entities/payment.entity';
import { Purchase } from './entities/purchase.entity';
import { Unit } from './entities/unit.entity';
import { autoAllocate, computeStatus, remaining, validateManual } from './installment-rules';

export interface PlanItem {
  label: string;
  amount: string;
  dueType: InstallmentDueType;
  dueDate?: string;
  milestoneId?: string;
}
export interface CreatePurchaseInput {
  unitId: string;
  buyerId: string;
  bookingDate: string;
  totalPrice: string;
  notes?: string;
  installments: PlanItem[];
}
export interface PaymentInput {
  amount: string;
  method: PaymentMethod;
  reference?: string;
  paidAt: string;
  allocations?: { installmentId: string; amount: string }[];
}
export interface UnitInput {
  code: string;
  floor: number;
  sizeSqft: number;
  bedrooms?: number;
  listPrice: string;
}

@Injectable()
export class FinanceService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // --------------------------------------------------------------------- units

  /** Flats of one project, filterable by status and code, newest floor first, with paging. */
  async listUnits(user: AuthUser, projectId: string, q: PageQuery & { status?: UnitStatus }) {
    await this.access.project(user, projectId);
    const qb = this.db
      .getRepository(Unit)
      .createQueryBuilder('u')
      .where('u.projectId = :projectId', { projectId })
      .orderBy('u.floor', 'ASC')
      .addOrderBy('u.code', 'ASC')
      .skip(skipTake(q).skip)
      .take(skipTake(q).take);
    if (q.status) qb.andWhere('u.status = :status', { status: q.status });
    if (q.search) qb.andWhere('u.code ILIKE :s', { s: `%${q.search.trim()}%` });
    const [units, total] = await qb.getManyAndCount();
    const purchases = units.length
      ? await this.db.getRepository(Purchase).find({
          where: { unitId: In(units.map((u) => u.id)), status: In([PurchaseStatus.ACTIVE, PurchaseStatus.COMPLETED]) },
          relations: { buyer: true },
        })
      : [];
    const byUnit = new Map(purchases.map((p) => [p.unitId, p]));
    const items = units.map((u) => {
      const p = byUnit.get(u.id);
      return { ...u, purchase: p ? { id: p.id, buyerName: p.buyer.name, status: p.status } : null };
    });
    return page(items, total, q);
  }

  async unitDetail(user: AuthUser, id: string) {
    const unit = await this.db.getRepository(Unit).findOne({ where: { id }, relations: { project: true } });
    if (!unit) throw new NotFoundException('Flat not found');
    await this.access.project(user, unit.projectId);
    const purchase = await this.db.getRepository(Purchase).findOne({
      where: { unitId: id, status: In([PurchaseStatus.ACTIVE, PurchaseStatus.COMPLETED]) },
      relations: { buyer: true },
    });
    const { project, ...rest } = unit;
    return {
      ...rest,
      project: { id: project.id, name: project.name },
      purchase: purchase
        ? { id: purchase.id, buyerName: purchase.buyer.name, status: purchase.status, totalPrice: purchase.totalPrice }
        : null,
    };
  }

  /** A flat can be deleted only if it was never booked; bookings are financial records and are kept. */
  async deleteUnit(user: AuthUser, id: string) {
    const unit = await this.db.getRepository(Unit).findOne({ where: { id } });
    if (!unit) throw new NotFoundException('Flat not found');
    await this.access.project(user, unit.projectId);
    if (await this.db.getRepository(Purchase).exist({ where: { unitId: id } }))
      throw new ConflictException(`Flat ${unit.code} has a booking on record and cannot be deleted.`);
    await this.db.getRepository(Unit).delete(id);
    await this.audit.log(user, 'DELETE', 'Unit', id, { oldValue: { code: unit.code, floor: unit.floor, listPrice: unit.listPrice } });
  }

  async createUnits(user: AuthUser, projectId: string, units: UnitInput[]) {
    await this.access.project(user, projectId);
    const errors: string[] = [];
    const clean = units.map((u, i) => {
      const row = i + 1;
      if (!u.code?.trim()) errors.push(`Row ${row}: code is required`);
      if (!Number.isInteger(u.floor) || u.floor < 0 || u.floor > 100) errors.push(`Row ${row}: floor must be a whole number`);
      if (!Number.isInteger(u.sizeSqft) || u.sizeSqft < 50 || u.sizeSqft > 100000)
        errors.push(`Row ${row}: size must be 50 to 100000 sqft`);
      try {
        if (toPoisha(u.listPrice) <= 0) errors.push(`Row ${row}: price must be positive`);
      } catch {
        errors.push(`Row ${row}: price is not a valid amount`);
      }
      return {
        projectId,
        code: u.code?.trim().toUpperCase(),
        floor: u.floor,
        sizeSqft: u.sizeSqft,
        bedrooms: u.bedrooms ?? null,
        listPrice: u.listPrice,
      };
    });
    const codes = clean.map((c) => c.code);
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (dupes.length) errors.push(`Duplicate codes in file: ${[...new Set(dupes)].join(', ')}`);
    const existing = await this.db.getRepository(Unit).find({ where: { projectId, code: In(codes) } });
    if (errors.length) throw new BadRequestException(errors.slice(0, 20));
    if (existing.length)
      throw new ConflictException(`These flat codes already exist in this project: ${existing.map((e) => e.code).join(', ')}`);
    await this.db.getRepository(Unit).insert(clean);
    return { created: clean.length };
  }

  parseUnitsCsv(csv: string): UnitInput[] {
    const lines = csv
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new BadRequestException('The CSV file is empty.');
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const col = (n: string) => header.indexOf(n.toLowerCase());
    for (const required of ['code', 'floor', 'sizeSqft', 'listPrice']) {
      if (col(required) < 0)
        throw new BadRequestException(`Missing column "${required}". Expected: code,floor,sizeSqft,bedrooms,listPrice`);
    }
    if (lines.length > 501) throw new BadRequestException('At most 500 units per file.');
    return lines.slice(1).map((line) => {
      const c = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      return {
        code: c[col('code')],
        floor: Number(c[col('floor')]),
        sizeSqft: Number(c[col('sizeSqft')]),
        bedrooms: col('bedrooms') >= 0 && c[col('bedrooms')] ? Number(c[col('bedrooms')]) : undefined,
        listPrice: c[col('listPrice')],
      };
    });
  }

  async updateUnit(user: AuthUser, id: string, dto: Partial<UnitInput>) {
    const unit = await this.db.getRepository(Unit).findOne({ where: { id } });
    if (!unit) throw new NotFoundException('Unit not found');
    await this.access.project(user, unit.projectId);
    if (dto.listPrice !== undefined) toPoisha(dto.listPrice);
    await this.db.getRepository(Unit).update(id, { ...dto, code: dto.code?.trim().toUpperCase() });
    return this.db.getRepository(Unit).findOneByOrFail({ id });
  }

  // ----------------------------------------------------------------- purchases

  /** R10, R11, R18: creates a booking and its installment plan in one transaction. */
  async createPurchase(user: AuthUser, dto: CreatePurchaseInput) {
    const total = toPoisha(dto.totalPrice);
    if (total <= 0) throw new BadRequestException('Total price must be positive.');
    if (!dto.installments?.length) throw new BadRequestException('Add at least one installment.');
    const sum = dto.installments.reduce((s, i) => s + toPoisha(i.amount), 0);
    if (sum !== total) {
      throw new BadRequestException(
        `Installments add up to ${formatTaka(fromPoisha(sum))}, but the total price is ${formatTaka(dto.totalPrice)}.`,
      );
    }

    // Explicit QueryRunner transaction: the flat row is locked, the booking and every installment are
    // written, and the flat is marked BOOKED. If any step fails (for example an installment points to a
    // stage of another project) everything is rolled back and the flat stays AVAILABLE.
    const qr = this.db.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let purchaseId: string;
    try {
      const em = qr.manager;
      const unit = await em.getRepository(Unit).findOne({ where: { id: dto.unitId }, lock: { mode: 'pessimistic_write' } });
      if (!unit) throw new NotFoundException('Unit not found');
      const project = await em.getRepository(Project).findOne({ where: { id: unit.projectId, organizationId: user.orgId } });
      if (!project) throw new NotFoundException('Unit not found');
      if (unit.status !== UnitStatus.AVAILABLE) throw new ConflictException(`Unit ${unit.code} is not available.`);
      const buyer = await em.getRepository(User).findOne({ where: { id: dto.buyerId, organizationId: user.orgId, role: Role.BUYER } });
      if (!buyer) throw new NotFoundException('Buyer not found');

      const milestones = await em.getRepository(Milestone).find({ where: { projectId: project.id } });
      const msById = new Map(milestones.map((m) => [m.id, m]));
      const org = await em.getRepository(Organization).findOneByOrFail({ id: user.orgId });

      const purchase = await em.getRepository(Purchase).save(
        em.getRepository(Purchase).create({
          unitId: unit.id,
          buyerId: buyer.id,
          bookingDate: new Date(dto.bookingDate),
          totalPrice: fromPoisha(total),
          notes: dto.notes?.trim() || null,
        }),
      );

      const rows = dto.installments.map((item, idx) => {
        const amount = toPoisha(item.amount);
        if (amount <= 0) throw new BadRequestException(`Installment ${idx + 1}: amount must be positive.`);
        let dueDate: Date | null = null;
        let milestoneId: string | null = null;
        if (item.dueType === InstallmentDueType.FIXED_DATE) {
          if (!item.dueDate) throw new BadRequestException(`Installment ${idx + 1}: a due date is required.`);
          dueDate = new Date(item.dueDate);
        } else {
          const m = item.milestoneId ? msById.get(item.milestoneId) : undefined;
          if (!m) throw new BadRequestException(`Installment ${idx + 1}: choose a construction stage of this project.`);
          milestoneId = m.id;
          if (m.status === MilestoneStatus.COMPLETED) {
            // Stage already finished before this booking: due after the booking date.
            const from = Math.max(new Date(dto.bookingDate).getTime(), m.completedAt?.getTime() ?? 0);
            dueDate = addDays(new Date(from), org.milestoneGraceDays);
          }
        }
        const row = {
          purchaseId: purchase.id,
          label: item.label.trim(),
          sortOrder: idx + 1,
          amount: fromPoisha(amount),
          dueType: item.dueType,
          dueDate,
          milestoneId,
          paidAmount: '0.00',
          status: InstallmentStatus.UPCOMING,
        };
        return { ...row, status: computeStatus(row) };
      });
      await em.getRepository(Installment).insert(rows);
      await em.getRepository(Unit).update(unit.id, { status: UnitStatus.BOOKED });
      await this.audit.log(
        user,
        'PURCHASE_CREATED',
        'Purchase',
        purchase.id,
        { newValue: { unit: unit.code, total: dto.totalPrice, installments: rows.length } },
        em,
      );
      purchaseId = purchase.id;
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    const purchase = await this.purchaseDetail(user, purchaseId);
    this.notifications.send({
      userIds: [dto.buyerId],
      type: 'PURCHASE_CREATED',
      title: `Welcome to ${purchase.unit.project.name}`,
      body: `Your booking for flat ${purchase.unit.code} is recorded. You can follow construction progress and your payments in BuildTrack.`,
      link: `/portal/units/${purchaseId}`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    });
    return purchase;
  }

  async purchaseDetail(user: AuthUser, id: string) {
    const purchase = await this.access.purchase(user, id);
    const installments = await this.db
      .getRepository(Installment)
      .find({ where: { purchaseId: id }, relations: { milestone: true }, order: { sortOrder: 'ASC' } });
    const payments = await this.db
      .getRepository(Payment)
      .find({ where: { purchaseId: id }, relations: { allocations: true }, order: { paidAt: 'DESC' } });
    const paid = installments.reduce((s, i) => s + toPoisha(i.paidAmount), 0);
    const waived = installments
      .filter((i) => i.status === InstallmentStatus.WAIVED)
      .reduce((s, i) => s + remaining({ ...i, status: InstallmentStatus.DUE }), 0);
    const total = toPoisha(purchase.totalPrice);
    const next =
      installments.find((i) => [InstallmentStatus.OVERDUE, InstallmentStatus.DUE, InstallmentStatus.PARTIALLY_PAID].includes(i.status)) ??
      installments.find((i) => i.status === InstallmentStatus.UPCOMING) ??
      null;
    const { buyer, ...rest } = purchase;
    return {
      ...rest,
      buyer: { id: buyer.id, name: buyer.name, email: buyer.email, phone: buyer.phone },
      installments: installments.map((i) => ({
        ...i,
        milestone: i.milestone ? { id: i.milestone.id, name: i.milestone.name, status: i.milestone.status } : null,
      })),
      payments,
      totals: {
        total: fromPoisha(total),
        paid: fromPoisha(paid),
        waived: fromPoisha(waived),
        balance: fromPoisha(Math.max(0, total - paid - waived)),
        percentPaid: total ? Math.round((paid / total) * 1000) / 10 : 0,
      },
      nextInstallment: next,
    };
  }

  async listPurchases(user: AuthUser, projectId: string) {
    await this.access.project(user, projectId);
    const purchases = await this.db
      .getRepository(Purchase)
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.unit', 'u')
      .innerJoinAndSelect('p.buyer', 'b')
      .where('u.projectId = :projectId', { projectId })
      .orderBy('u.code', 'ASC')
      .getMany();
    const installments = purchases.length
      ? await this.db
          .getRepository(Installment)
          .find({ where: { purchaseId: In(purchases.map((p) => p.id)) }, order: { sortOrder: 'ASC' } })
      : [];
    return purchases.map((p) => {
      const mine = installments.filter((i) => i.purchaseId === p.id);
      const paid = mine.reduce((s, i) => s + toPoisha(i.paidAmount), 0);
      const owed = mine.reduce((s, i) => s + remaining(i), 0);
      const next = mine.find((i) => ['OVERDUE', 'DUE', 'PARTIALLY_PAID'].includes(i.status)) ?? null;
      return {
        id: p.id,
        status: p.status,
        bookingDate: p.bookingDate,
        unit: { id: p.unit.id, code: p.unit.code, floor: p.unit.floor },
        buyer: { id: p.buyer.id, name: p.buyer.name, email: p.buyer.email },
        totalPrice: p.totalPrice,
        paid: fromPoisha(paid),
        balance: fromPoisha(owed),
        overdue: mine.some((i) => i.status === InstallmentStatus.OVERDUE),
        nextDue: next ? { label: next.label, dueDate: next.dueDate, amount: next.amount, status: next.status } : null,
      };
    });
  }

  async myPurchases(user: AuthUser) {
    const ids = await this.access.buyerPurchaseIds(user.id);
    const out = [];
    for (const id of ids) out.push(await this.purchaseDetail(user, id));
    return out.filter((p) => p.status !== PurchaseStatus.CANCELLED);
  }

  async cancelPurchase(user: AuthUser, id: string, reason: string) {
    await this.access.purchase(user, id);
    await this.db.transaction(async (em) => {
      const p = await em.getRepository(Purchase).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!p) throw new NotFoundException('Purchase not found');
      if (p.status === PurchaseStatus.CANCELLED) throw new ConflictException('This purchase is already cancelled.');
      const activePayments = await em
        .getRepository(Payment)
        .createQueryBuilder('pay')
        .where('pay.purchaseId = :id AND pay.voidedAt IS NULL', { id })
        .getCount();
      if (activePayments) throw new ConflictException('Void the recorded payments (and refund the buyer) before cancelling.');
      await em.getRepository(Purchase).update(id, { status: PurchaseStatus.CANCELLED });
      await em.getRepository(Unit).update(p.unitId, { status: UnitStatus.AVAILABLE });
      await this.audit.log(
        user,
        'PURCHASE_CANCELLED',
        'Purchase',
        id,
        { oldValue: { status: p.status }, newValue: { status: 'CANCELLED' }, reason },
        em,
      );
    });
    return this.purchaseDetail(user, id);
  }

  // ------------------------------------------------------------------ payments

  /** Atomic per-organization, per-year receipt counter (safe under concurrency). */
  private async nextReceiptNumber(em: EntityManager, orgId: string, prefix: string, date: Date) {
    const year = Number(date.toLocaleString('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric' }));
    const rows: Array<{ last: number }> = await em.query(
      `INSERT INTO receipt_counters ("organizationId", year, last) VALUES ($1, $2, 1)
       ON CONFLICT ("organizationId", year) DO UPDATE SET last = receipt_counters.last + 1
       RETURNING last`,
      [orgId, year],
    );
    return `${prefix}-${year}-${String(rows[0].last).padStart(6, '0')}`;
  }

  /** Re-applies status rules to installments and closes the purchase when fully paid (R14, R17, R18). */
  private async refreshPurchase(em: EntityManager, purchaseId: string) {
    const installments = await em.getRepository(Installment).find({ where: { purchaseId } });
    for (const inst of installments) {
      const status = computeStatus(inst);
      if (status !== inst.status) await em.getRepository(Installment).update(inst.id, { status });
      inst.status = status;
    }
    const purchase = await em.getRepository(Purchase).findOneByOrFail({ id: purchaseId });
    const allSettled = installments.every((i) => i.status === InstallmentStatus.PAID || i.status === InstallmentStatus.WAIVED);
    if (purchase.status !== PurchaseStatus.CANCELLED) {
      const status = allSettled ? PurchaseStatus.COMPLETED : PurchaseStatus.ACTIVE;
      if (status !== purchase.status) {
        await em.getRepository(Purchase).update(purchaseId, { status });
        await em
          .getRepository(Unit)
          .update(purchase.unitId, { status: status === PurchaseStatus.COMPLETED ? UnitStatus.SOLD : UnitStatus.BOOKED });
      }
    }
  }

  async recordPayment(user: AuthUser, purchaseId: string, dto: PaymentInput) {
    await this.access.purchase(user, purchaseId);
    const amount = toPoisha(dto.amount);
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero.');
    const paidAt = new Date(dto.paidAt);
    if (paidAt.getTime() > Date.now() + 24 * 3600 * 1000) throw new BadRequestException('Payment date cannot be in the future.');

    const payment = await this.db.transaction(async (em) => {
      const purchase = await em.getRepository(Purchase).findOne({ where: { id: purchaseId }, lock: { mode: 'pessimistic_write' } });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status === PurchaseStatus.CANCELLED) throw new ConflictException('This purchase is cancelled.');
      const installments = await em.getRepository(Installment).find({ where: { purchaseId }, order: { sortOrder: 'ASC' } });

      let allocation: Map<string, number>;
      try {
        allocation = dto.allocations?.length
          ? validateManual(
              installments,
              dto.allocations.map((a) => ({ installmentId: a.installmentId, amount: toPoisha(a.amount) })),
              amount,
            )
          : autoAllocate(installments, amount);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }

      const org = await em.getRepository(Organization).findOneByOrFail({ id: user.orgId });
      const receiptNumber = await this.nextReceiptNumber(em, org.id, org.receiptPrefix, paidAt);
      const payment = await em.getRepository(Payment).save(
        em.getRepository(Payment).create({
          purchaseId,
          amount: fromPoisha(amount),
          method: dto.method,
          reference: dto.reference?.trim() || null,
          paidAt,
          receiptNumber,
          recordedById: user.id,
        }),
      );
      for (const inst of installments) {
        const add = allocation.get(inst.id);
        if (!add) continue;
        await em.getRepository(PaymentAllocation).insert({ paymentId: payment.id, installmentId: inst.id, amount: fromPoisha(add) });
        await em.getRepository(Installment).update(inst.id, { paidAmount: fromPoisha(toPoisha(inst.paidAmount) + add) });
      }
      await this.refreshPurchase(em, purchaseId);
      await this.audit.log(
        user,
        'PAYMENT_RECORDED',
        'Payment',
        payment.id,
        { newValue: { receiptNumber, amount: dto.amount, method: dto.method, reference: dto.reference ?? null } },
        em,
      );
      return { ...payment, buyerId: purchase.buyerId };
    });

    this.notifications.send({
      userIds: [payment.buyerId],
      type: 'PAYMENT_RECORDED',
      title: `Payment received: ${formatTaka(payment.amount)}`,
      body: `We have recorded your payment of ${formatTaka(payment.amount)}. Receipt number ${payment.receiptNumber}.`,
      link: `/portal/receipts/${payment.id}`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    });
    return payment;
  }

  /** R16: payments are never deleted, only voided with a reason. */
  async voidPayment(user: AuthUser, paymentId: string, reason: string) {
    if (reason.trim().length < 5) throw new BadRequestException('Please give a reason.');
    const existing = await this.db.getRepository(Payment).findOne({ where: { id: paymentId } });
    if (!existing) throw new NotFoundException('Payment not found');
    await this.access.purchase(user, existing.purchaseId);
    await this.db.transaction(async (em) => {
      await em.getRepository(Purchase).findOne({ where: { id: existing.purchaseId }, lock: { mode: 'pessimistic_write' } });
      const payment = await em.getRepository(Payment).findOne({ where: { id: paymentId }, relations: { allocations: true } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.voidedAt) throw new ConflictException('This payment is already void.');
      for (const a of payment.allocations) {
        const inst = await em.getRepository(Installment).findOneByOrFail({ id: a.installmentId });
        await em
          .getRepository(Installment)
          .update(inst.id, { paidAmount: fromPoisha(Math.max(0, toPoisha(inst.paidAmount) - toPoisha(a.amount))) });
      }
      await em.getRepository(Payment).update(paymentId, { voidedAt: new Date(), voidReason: reason.trim() });
      await this.refreshPurchase(em, payment.purchaseId);
      await this.audit.log(
        user,
        'PAYMENT_VOIDED',
        'Payment',
        paymentId,
        { oldValue: { voidedAt: null }, newValue: { voidedAt: new Date() }, receiptNumber: payment.receiptNumber, reason },
        em,
      );
    });
    return this.db.getRepository(Payment).findOneByOrFail({ id: paymentId });
  }

  async waiveInstallment(user: AuthUser, installmentId: string, reason: string) {
    const inst = await this.db.getRepository(Installment).findOne({ where: { id: installmentId } });
    if (!inst) throw new NotFoundException('Installment not found');
    await this.access.purchase(user, inst.purchaseId);
    if (inst.status === InstallmentStatus.PAID) throw new ConflictException('This installment is already paid.');
    await this.db.transaction(async (em) => {
      await em.getRepository(Installment).update(installmentId, { status: InstallmentStatus.WAIVED, waiveReason: reason.trim() });
      await this.refreshPurchase(em, inst.purchaseId);
      await this.audit.log(user, 'INSTALLMENT_WAIVED', 'Installment', installmentId, { newValue: { status: 'WAIVED' }, reason }, em);
    });
    return this.db.getRepository(Installment).findOneByOrFail({ id: installmentId });
  }

  async listPayments(user: AuthUser, q: PageQuery & { projectId?: string; method?: PaymentMethod; from?: string; to?: string }) {
    const qb = this.db
      .getRepository(Payment)
      .createQueryBuilder('pay')
      .innerJoinAndSelect('pay.purchase', 'p')
      .innerJoinAndSelect('p.unit', 'u')
      .innerJoinAndSelect('u.project', 'proj')
      .innerJoinAndSelect('p.buyer', 'b')
      .where('proj.organizationId = :org', { org: user.orgId });
    if (q.projectId) qb.andWhere('proj.id = :pid', { pid: q.projectId });
    if (q.method) qb.andWhere('pay.method = :m', { m: q.method });
    if (q.from) qb.andWhere('pay.paidAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('pay.paidAt < :to', { to: addDays(new Date(q.to), 1) });
    if (q.search) qb.andWhere('(pay.receiptNumber ILIKE :s OR b.name ILIKE :s OR u.code ILIKE :s)', { s: `%${q.search}%` });
    const [rows, total] = await qb.orderBy('pay.paidAt', 'DESC').skip(skipTake(q).skip).take(q.pageSize).getManyAndCount();
    const items = rows.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      amount: r.amount,
      method: r.method,
      reference: r.reference,
      paidAt: r.paidAt,
      voidedAt: r.voidedAt,
      purchaseId: r.purchaseId,
      unit: r.purchase.unit.code,
      project: r.purchase.unit.project.name,
      buyer: r.purchase.buyer.name,
    }));
    return page(items, total, q);
  }

  async receipt(user: AuthUser, paymentId: string) {
    const payment = await this.db
      .getRepository(Payment)
      .findOne({ where: { id: paymentId }, relations: { allocations: { installment: true } } });
    if (!payment) throw new NotFoundException('Receipt not found');
    const purchase = await this.access.purchase(user, payment.purchaseId);
    if (user.role === Role.ENGINEER) throw new ForbiddenException();
    const org = await this.db.getRepository(Organization).findOneByOrFail({ id: user.orgId });
    return {
      organization: { name: org.name, primaryColor: org.primaryColor, accentColor: org.accentColor },
      receiptNumber: payment.receiptNumber,
      amount: payment.amount,
      amountText: formatTaka(payment.amount),
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
      voidedAt: payment.voidedAt,
      voidReason: payment.voidReason,
      buyer: { name: purchase.buyer.name, email: purchase.buyer.email, phone: purchase.buyer.phone },
      unit: purchase.unit.code,
      project: purchase.unit.project.name,
      allocations: payment.allocations.map((a) => ({ label: a.installment.label, amount: a.amount })),
    };
  }
}
