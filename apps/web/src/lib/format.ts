/** Display helpers. Money uses Bangladeshi lakh grouping; dates are shown in Dhaka time. */

export function taka(value: string | number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  if (opts.compact) {
    if (Math.abs(n) >= 1_00_00_000) return `Tk ${trim(n / 1_00_00_000)} crore`;
    if (Math.abs(n) >= 1_00_000) return `Tk ${trim(n / 1_00_000)} lakh`;
  }
  const negative = n < 0;
  const [whole, frac] = Math.abs(n).toFixed(2).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${negative ? '-' : ''}Tk ${grouped}${frac !== '00' ? '.' + frac : ''}`;
}

function trim(n: number) {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function date(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

export function relative(value: string | Date | null | undefined): string {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.round(diff / 86_400_000);
  if (Math.abs(diff) < 3_600_000) return 'just now';
  if (Math.abs(days) < 1) return `${Math.round(diff / 3_600_000)} h ago`;
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 30) return `${days} days ago`;
  if (days < 0 && days > -60) return `in ${-days} days`;
  return date(value);
}

/** yyyy-mm-dd for <input type="date">, in Dhaka time. */
export function inputDate(value: string | Date = new Date()): string {
  const d = new Date(value);
  return new Date(d.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);
}

export const STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'Not due yet',
  DUE: 'Due',
  PARTIALLY_PAID: 'Part paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  WAIVED: 'Waived',
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  PLANNING: 'Planning',
  UNDER_CONSTRUCTION: 'Under construction',
  HANDED_OVER: 'Handed over',
  AVAILABLE: 'Available',
  BOOKED: 'Booked',
  SOLD: 'Sold',
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled',
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Waiting for review',
  PUBLISHED: 'Published',
  REJECTED: 'Needs changes',
  UNPUBLISHED: 'Unpublished',
  OPEN: 'Open',
  ANSWERED: 'Answered',
  CLOSED: 'Closed',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  OTHER: 'Other',
  ORG_ADMIN: 'Admin',
  MANAGER: 'Manager',
  ENGINEER: 'Site engineer',
  BUYER: 'Buyer',
  INDEXED: 'Ready for assistant',
  NOT_INDEXED: 'Processing',
  FAILED: 'Could not read',
  INTERNAL: 'Staff only',
  PROJECT_BUYERS: 'All buyers of this project',
  PURCHASE_BUYER: 'One buyer',
  ALLOTMENT_LETTER: 'Allotment letter',
  AGREEMENT: 'Agreement',
  RECEIPT: 'Receipt',
  APPROVAL: 'Approval',
  FLOOR_PLAN: 'Floor plan',
};

export const label = (s: string | null | undefined) => (s ? (STATUS_LABEL[s] ?? s) : '—');
