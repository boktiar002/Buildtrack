'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { get } from '@/lib/api';
import { date, label, taka } from '@/lib/format';
import type { HandoverChange, Installment, Payment } from '@/lib/types';
import { Badge, Button, ErrorState, ProgressBar, Spinner, Table } from './ui';

export function Schedule({ installments }: { installments: Installment[] }) {
  return (
    <Table head={['Installment', 'When', 'Amount', 'Paid', 'Status']}>
      {installments.map((i) => (
        <tr key={i.id}>
          <td className="font-medium">{i.label}</td>
          <td className="text-rebar">
            {i.dueDate ? date(i.dueDate) : i.milestone ? <>After &ldquo;{i.milestone.name}&rdquo;</> : '—'}
          </td>
          <td className="figure whitespace-nowrap">{taka(i.amount)}</td>
          <td className="figure whitespace-nowrap text-rebar">{Number(i.paidAmount) > 0 ? taka(i.paidAmount) : '—'}</td>
          <td>
            <Badge status={i.status} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function PaidSummary({ totals }: { totals: { total: string; paid: string; balance: string; percentPaid: number } }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="figure text-2xl font-semibold">{taka(totals.paid)}</span> <span className="text-rebar">paid of {taka(totals.total)}</span>
        </p>
        <p className="text-rebar">
          Balance <span className="figure font-semibold text-ink">{taka(totals.balance)}</span>
        </p>
      </div>
      <ProgressBar value={totals.percentPaid} tone="done" className="mt-3" labelText="Amount paid" />
    </div>
  );
}

export function PaymentsList({ payments, receiptBase, onVoid }: { payments: Payment[]; receiptBase: string; onVoid?: (p: Payment) => void }) {
  if (!payments.length) return <p className="text-rebar">No payments recorded yet.</p>;
  return (
    <Table head={['Receipt', 'Date', 'Method', 'Amount', '']}>
      {payments.map((p) => (
        <tr key={p.id} className={p.voidedAt ? 'text-rebar line-through decoration-1' : ''}>
          <td className="figure">{p.receiptNumber}</td>
          <td>{date(p.paidAt)}</td>
          <td>
            {label(p.method)}
            {p.reference && <span className="block text-[13px] text-rebar no-underline">{p.reference}</span>}
          </td>
          <td className="figure whitespace-nowrap">{taka(p.amount)}</td>
          <td className="whitespace-nowrap text-right no-underline">
            {p.voidedAt ? (
              <span className="text-[13px]" title={p.voidReason ?? ''}>Void</span>
            ) : (
              <>
                <Link href={`${receiptBase}/${p.id}`} className="text-sm font-medium underline underline-offset-4">
                  Receipt
                </Link>
                {onVoid && (
                  <button onClick={() => onVoid(p)} className="ml-3 text-sm text-overdue hover:underline">
                    Void
                  </button>
                )}
              </>
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function HandoverHistory({ original, expected, delayDays, history }: { original: string; expected: string; delayDays: number; history: HandoverChange[] }) {
  return (
    <div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-rebar">Originally promised</dt>
          <dd className="font-medium">{date(original)}</dd>
        </div>
        <div>
          <dt className="text-sm text-rebar">Expected now</dt>
          <dd className="font-medium">{date(expected)}</dd>
        </div>
        <div>
          <dt className="text-sm text-rebar">Difference</dt>
          <dd className={delayDays ? 'font-medium text-overdue' : 'font-medium text-done'}>{delayDays ? `${delayDays} days later` : 'On the original date'}</dd>
        </div>
      </dl>
      {history.length > 0 && (
        <ol className="mt-5 border-l-2 border-line pl-5">
          {history.map((h) => (
            <li key={h.id} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-slab bg-[var(--brand-accent)]" aria-hidden />
              <p className="font-medium">
                {date(h.oldDate)} changed to {date(h.newDate)}
              </p>
              <p className="text-rebar">&ldquo;{h.reason}&rdquo;</p>
              <p className="text-[13px] text-rebar">Announced {date(h.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface ReceiptData {
  organization: { name: string };
  receiptNumber: string;
  amount: string;
  amountText: string;
  method: string;
  reference: string | null;
  paidAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  buyer: { name: string; email: string; phone: string | null };
  unit: string;
  project: string;
  allocations: Array<{ label: string; amount: string }>;
}

/** Printable receipt (the browser's "Save as PDF" gives a PDF copy). */
export function Receipt({ id, back }: { id: string; back: string }) {
  const q = useQuery({ queryKey: ['receipt', id], queryFn: () => get<ReceiptData>(`/payments/${id}/receipt`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data!;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex justify-between">
        <Link href={back} className="text-sm text-rebar hover:text-ink">‹ Back</Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      <article className="relative rounded-[var(--radius-panel)] border border-line bg-slab p-8">
        {r.voidedAt && (
          <p className="mb-4 rounded bg-overdue-soft px-3 py-2 text-overdue">This receipt is void: {r.voidReason}</p>
        )}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[var(--brand-accent)] pb-4">
          <div>
            <p className="display text-xl font-semibold">{r.organization.name}</p>
            <p className="text-rebar">Payment receipt</p>
          </div>
          <div className="text-right">
            <p className="figure text-lg font-semibold">{r.receiptNumber}</p>
            <p className="text-rebar">{date(r.paidAt)}</p>
          </div>
        </header>
        <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div><dt className="text-sm text-rebar">Received from</dt><dd className="font-medium">{r.buyer.name}</dd></div>
          <div><dt className="text-sm text-rebar">Flat</dt><dd className="font-medium">{r.unit}, {r.project}</dd></div>
          <div><dt className="text-sm text-rebar">Method</dt><dd>{label(r.method)}{r.reference ? ` (${r.reference})` : ''}</dd></div>
          <div><dt className="text-sm text-rebar">Amount</dt><dd className="figure text-xl font-semibold">{r.amountText}</dd></div>
        </dl>
        <table className="mt-6 w-full text-left">
          <thead><tr className="border-b border-line text-sm text-rebar"><th className="py-2 font-medium">Applied to</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
          <tbody>
            {r.allocations.map((a) => (
              <tr key={a.label} className="border-b border-line/60"><td className="py-2">{a.label}</td><td className="figure py-2 text-right">{taka(a.amount)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-8 text-[13px] text-rebar">This receipt was issued electronically by BuildTrack and is valid without a signature.</p>
      </article>
    </div>
  );
}
