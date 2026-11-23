import { InstallmentDueType, InstallmentStatus } from '../../common/enums';
import { DAY_MS, startOfDhakaDay } from '../../common/utils/dates';
import { Poisha, toPoisha } from '../../common/utils/money';

export interface InstallmentLike {
  id: string;
  sortOrder: number;
  amount: string;
  paidAmount: string;
  dueType: InstallmentDueType;
  dueDate: Date | null;
  status: InstallmentStatus;
}

/** Fixed-date installments become due this many days before their date (R20). */
export const DUE_WINDOW_DAYS = 30;

/**
 * The single source of truth for an installment's status (R14, R19, R20).
 * Used after payments, voids, milestone triggers and by the daily scheduler.
 */
export function computeStatus(
  inst: Pick<InstallmentLike, 'amount' | 'paidAmount' | 'dueType' | 'dueDate' | 'status'>,
  now = new Date(),
): InstallmentStatus {
  if (inst.status === InstallmentStatus.WAIVED) return InstallmentStatus.WAIVED;
  const amount = toPoisha(inst.amount);
  const paid = toPoisha(inst.paidAmount);
  if (paid >= amount) return InstallmentStatus.PAID;

  let base: InstallmentStatus;
  if (!inst.dueDate) {
    base = InstallmentStatus.UPCOMING; // milestone not reached yet
  } else {
    const today = startOfDhakaDay(now).getTime();
    const due = startOfDhakaDay(inst.dueDate).getTime();
    if (due < today) base = InstallmentStatus.OVERDUE;
    else if (inst.dueType === InstallmentDueType.MILESTONE || due - today <= DUE_WINDOW_DAYS * DAY_MS) base = InstallmentStatus.DUE;
    else base = InstallmentStatus.UPCOMING;
  }
  if (paid > 0 && base !== InstallmentStatus.OVERDUE) return InstallmentStatus.PARTIALLY_PAID;
  return base;
}

export function remaining(inst: Pick<InstallmentLike, 'amount' | 'paidAmount' | 'status'>): Poisha {
  if (inst.status === InstallmentStatus.WAIVED) return 0;
  return Math.max(0, toPoisha(inst.amount) - toPoisha(inst.paidAmount));
}

/**
 * R13: allocates a payment to the oldest unpaid installments first (by order).
 * Returns the allocation per installment, in poisha. Throws if the amount is
 * more than what is still owed.
 */
export function autoAllocate(installments: InstallmentLike[], amount: Poisha): Map<string, Poisha> {
  if (amount <= 0) throw new Error('Payment amount must be greater than zero.');
  const owed = installments.reduce((s, i) => s + remaining(i), 0);
  if (amount > owed) throw new Error('Payment is more than the remaining balance.');
  const result = new Map<string, Poisha>();
  let left = amount;
  for (const inst of [...installments].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (left <= 0) break;
    const take = Math.min(left, remaining(inst));
    if (take > 0) {
      result.set(inst.id, take);
      left -= take;
    }
  }
  return result;
}

/** Validates allocations chosen manually by a manager. */
export function validateManual(installments: InstallmentLike[], allocations: { installmentId: string; amount: Poisha }[], amount: Poisha) {
  const byId = new Map(installments.map((i) => [i.id, i]));
  const total = allocations.reduce((s, a) => s + a.amount, 0);
  if (total !== amount) throw new Error('The allocated amounts must add up to the payment amount.');
  const seen = new Set<string>();
  for (const a of allocations) {
    const inst = byId.get(a.installmentId);
    if (!inst) throw new Error('An allocation refers to an installment of another purchase.');
    if (seen.has(a.installmentId)) throw new Error('Each installment can appear only once.');
    seen.add(a.installmentId);
    if (a.amount <= 0) throw new Error('Allocated amounts must be greater than zero.');
    if (a.amount > remaining(inst)) throw new Error(`"${a.installmentId}" would be overpaid.`);
  }
  return new Map(allocations.map((a) => [a.installmentId, a.amount]));
}
