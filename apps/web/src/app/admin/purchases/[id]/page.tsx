'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, use, useState } from 'react';
import { PaidSummary, PaymentsList } from '@/components/finance';
import { Badge, Button, Dialog, ErrorState, Input, PageHeader, Panel, Select, Spinner, Table, Textarea, useErrorToast, useToast } from '@/components/ui';
import { patch, get, post } from '@/lib/api';
import { date, inputDate, label, taka } from '@/lib/format';
import { useMe } from '@/lib/session';
import type { Installment, Payment, PurchaseDetail } from '@/lib/types';

export default function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const isAdmin = me.data?.role === 'ORG_ADMIN';
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const q = useQuery({ queryKey: ['purchase', id], queryFn: () => get<PurchaseDetail>(`/purchases/${id}`) });
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: '', method: 'BANK_TRANSFER', reference: '', paidAt: inputDate() });
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [waiving, setWaiving] = useState<Installment | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['purchase', id] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const record = useMutation({
    mutationFn: () => post<Payment>(`/purchases/${id}/payments`, { amount: Number(pay.amount).toFixed(2), method: pay.method, reference: pay.reference || undefined, paidAt: new Date(`${pay.paidAt}T12:00:00+06:00`).toISOString() }),
    onSuccess: (p) => { toast(`Payment recorded. Receipt ${p.receiptNumber}.`); setPayOpen(false); setPay({ ...pay, amount: '', reference: '' }); refresh(); },
    onError,
  });
  const doVoid = useMutation({ mutationFn: () => post(`/payments/${voiding!.id}/void`, { reason }), onSuccess: () => { toast('Payment voided'); setVoiding(null); setReason(''); refresh(); }, onError });
  const doWaive = useMutation({ mutationFn: () => post(`/installments/${waiving!.id}/waive`, { reason }), onSuccess: () => { toast('Installment waived'); setWaiving(null); setReason(''); refresh(); }, onError });
  const doCancel = useMutation({ mutationFn: () => patch(`/purchases/${id}/cancel`, { reason }), onSuccess: () => { toast('Booking cancelled. The flat is available again.'); setCancelOpen(false); setReason(''); refresh(); }, onError });

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data!;
  const owed = Number(p.totals.balance);

  return (
    <div>
      <PageHeader
        back={{ href: `/admin/projects/${p.unit.projectId}?tab=flats`, label: p.unit.project.name }}
        title={`${p.unit.code} · ${p.buyer.name}`}
        subtitle={`${p.buyer.email}${p.buyer.phone ? ` · ${p.buyer.phone}` : ''} · booked ${date(p.bookingDate)}`}
        action={
          <>
            {p.status === 'ACTIVE' && <Button onClick={() => { setPay({ ...pay, amount: p.nextInstallment ? (Number(p.nextInstallment.amount) - Number(p.nextInstallment.paidAmount)).toFixed(0) : '' }); setPayOpen(true); }}>Record payment</Button>}
            {isAdmin && p.status === 'ACTIVE' && <Button variant="ghost" onClick={() => setCancelOpen(true)}>Cancel booking</Button>}
          </>
        }
      />
      {p.status !== 'ACTIVE' && <p className="mb-4"><Badge status={p.status} /></p>}
      <div className="flex flex-col gap-6">
        <Panel><PaidSummary totals={p.totals} /></Panel>
        <Panel title="Installment schedule" flush>
          <Table head={['Installment', 'When', 'Amount', 'Paid', 'Status', '']}>
            {p.installments.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">{i.label}</td>
                <td className="text-rebar">{i.dueDate ? date(i.dueDate) : i.milestone ? `After "${i.milestone.name}"` : '—'}</td>
                <td className="figure whitespace-nowrap">{taka(i.amount)}</td>
                <td className="figure whitespace-nowrap text-rebar">{Number(i.paidAmount) ? taka(i.paidAmount) : '—'}</td>
                <td><Badge status={i.status} /></td>
                <td className="text-right">{isAdmin && !['PAID', 'WAIVED'].includes(i.status) && <button className="text-sm text-rebar hover:text-ink hover:underline" onClick={() => setWaiving(i)}>Waive</button>}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Payments" flush>
          <PaymentsList payments={p.payments} receiptBase="/admin/receipts" onVoid={isAdmin ? setVoiding : undefined} />
        </Panel>
      </div>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} title="Record a payment">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); record.mutate(); }} className="flex flex-col gap-4">
          <Input label="Amount (Tk)" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value.replace(/[^\d.]/g, '') })} hint={`Balance: ${taka(owed)}. The payment is applied to the oldest unpaid installments first.`} error={Number(pay.amount) > owed ? 'This is more than the remaining balance.' : null} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              {['BANK_TRANSFER', 'BKASH', 'NAGAD', 'CHEQUE', 'CASH', 'OTHER'].map((m) => <option key={m} value={m}>{label(m)}</option>)}
            </Select>
            <Input label="Date received" type="date" max={inputDate()} value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} />
          </div>
          <Input label="Reference (transaction ID or cheque number)" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} maxLength={100} />
          <Button type="submit" loading={record.isPending} disabled={!Number(pay.amount) || Number(pay.amount) > owed}>Record payment and issue receipt</Button>
        </form>
      </Dialog>
      <Dialog open={!!voiding} onClose={() => setVoiding(null)} title={`Void receipt ${voiding?.receiptNumber ?? ''}`}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); doVoid.mutate(); }} className="flex flex-col gap-4">
          <p className="text-rebar">The payment stays in the records marked as void, and the installments go back to unpaid. This is recorded in the audit log.</p>
          <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="danger" loading={doVoid.isPending} disabled={reason.trim().length < 5}>Void payment</Button>
        </form>
      </Dialog>
      <Dialog open={!!waiving} onClose={() => setWaiving(null)} title={`Waive "${waiving?.label ?? ''}"`}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); doWaive.mutate(); }} className="flex flex-col gap-4">
          <p className="text-rebar">The buyer will no longer owe the unpaid part of this installment.</p>
          <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="danger" loading={doWaive.isPending} disabled={reason.trim().length < 5}>Waive installment</Button>
        </form>
      </Dialog>
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this booking">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); doCancel.mutate(); }} className="flex flex-col gap-4">
          <p className="text-rebar">Void any recorded payments (after refunding the buyer) before cancelling. The flat becomes available again.</p>
          <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="danger" loading={doCancel.isPending} disabled={reason.trim().length < 5}>Cancel booking</Button>
        </form>
      </Dialog>
    </div>
  );
}
