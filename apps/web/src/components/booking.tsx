'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { get, post } from '@/lib/api';
import { inputDate, taka } from '@/lib/format';
import type { Page, ProjectDetail, UserRow } from '@/lib/types';
import { Button, cx, Dialog, Input, Select, useErrorToast, useToast } from './ui';

interface Row {
  label: string;
  amount: string;
  dueType: 'FIXED_DATE' | 'MILESTONE';
  dueDate: string;
  milestoneId: string;
}

const toPoisha = (s: string) => Math.round(Number(s || 0) * 100);
const fromPoisha = (p: number) => (p / 100).toFixed(2);

/** Standard Bangladeshi plan: 10% booking, 15% agreement, 65% across construction stages, 10% at handover. */
function standardPlan(total: string, project: ProjectDetail): Row[] {
  const t = toPoisha(total);
  if (!t) return [];
  const open = project.milestones.filter((m) => m.status !== 'COMPLETED');
  const last = project.milestones[project.milestones.length - 1];
  const middle = open.filter((m) => m.id !== last?.id);
  const picks = middle.length <= 6 ? middle : Array.from({ length: 6 }, (_, i) => middle[Math.round((i * (middle.length - 1)) / 5)]);
  // Round to whole thousands of Taka; the final installment absorbs the remainder.
  const k = (p: number) => Math.round(p / 100000) * 100000;
  const booking = k(t * 0.1);
  const agreement = k(t * 0.15);
  const final = k(t * 0.1);
  const each = picks.length ? Math.floor((t - booking - agreement - final) / picks.length / 100000) * 100000 : 0;
  const rows: Row[] = [
    { label: 'Booking money', amount: fromPoisha(booking), dueType: 'FIXED_DATE', dueDate: inputDate(), milestoneId: '' },
    { label: 'Agreement signing', amount: fromPoisha(agreement), dueType: 'FIXED_DATE', dueDate: inputDate(new Date(Date.now() + 30 * 86_400_000)), milestoneId: '' },
    ...picks.map((m) => ({ label: `On completion of ${m.name}`, amount: fromPoisha(each), dueType: 'MILESTONE' as const, dueDate: '', milestoneId: m.id })),
  ];
  const used = rows.reduce((s, r) => s + toPoisha(r.amount), 0);
  rows.push({ label: 'Final payment at handover', amount: fromPoisha(t - used), dueType: last ? 'MILESTONE' : 'FIXED_DATE', dueDate: '', milestoneId: last?.id ?? '' });
  return rows;
}

export function BookingDialog({ project, unit, onClose }: { project: ProjectDetail; unit: { id: string; code: string; listPrice: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const onError = useErrorToast();
  const buyers = useQuery({ queryKey: ['buyers', 'all'], queryFn: () => get<Page<UserRow>>('/buyers?pageSize=100') });
  const [buyerId, setBuyerId] = useState('');
  const [newBuyer, setNewBuyer] = useState({ name: '', email: '', phone: '' });
  const [bookingDate, setBookingDate] = useState(inputDate());
  const [total, setTotal] = useState(Number(unit.listPrice).toFixed(0));
  const [rows, setRows] = useState<Row[]>(() => standardPlan(unit.listPrice, project));

  const sum = useMemo(() => rows.reduce((s, r) => s + toPoisha(r.amount), 0), [rows]);
  const diff = toPoisha(total) - sum;
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const rowsValid = rows.length > 0 && rows.every((r) => r.label.trim().length >= 2 && toPoisha(r.amount) > 0 && (r.dueType === 'FIXED_DATE' ? !!r.dueDate : !!r.milestoneId));

  const save = useMutation({
    mutationFn: async () => {
      let id = buyerId;
      if (id === 'new') {
        const b = await post<UserRow>('/buyers', { name: newBuyer.name, email: newBuyer.email, phone: newBuyer.phone || undefined });
        id = b.id;
      }
      return post<{ id: string }>('/purchases', {
        unitId: unit.id,
        buyerId: id,
        bookingDate: new Date(bookingDate).toISOString(),
        totalPrice: Number(total).toFixed(2),
        installments: rows.map((r) => ({
          label: r.label,
          amount: Number(r.amount).toFixed(2),
          dueType: r.dueType,
          dueDate: r.dueType === 'FIXED_DATE' ? new Date(r.dueDate).toISOString() : undefined,
          milestoneId: r.dueType === 'MILESTONE' ? r.milestoneId : undefined,
        })),
      });
    },
    onSuccess: (p) => {
      toast(`Booking recorded for ${unit.code}. The buyer has been sent a link to set their password.`);
      qc.invalidateQueries({ queryKey: ['units', project.id] });
      qc.invalidateQueries({ queryKey: ['purchases', project.id] });
      qc.invalidateQueries({ queryKey: ['buyers'] });
      onClose();
      router.push(`/admin/purchases/${p.id}`);
    },
    onError,
  });

  const buyerReady = buyerId && (buyerId !== 'new' || (newBuyer.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(newBuyer.email)));

  return (
    <Dialog open onClose={onClose} title={`Record booking: flat ${unit.code}`} wide>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Buyer" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            <option value="">Choose a buyer</option>
            <option value="new">+ New buyer</option>
            {buyers.data?.items.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.email})</option>)}
          </Select>
          <Input label="Booking date" type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
          <Input label="Total price (Tk)" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ''))} />
        </div>
        {buyerId === 'new' && (
          <div className="grid gap-4 rounded-[var(--radius-control)] bg-concrete p-4 sm:grid-cols-3">
            <Input label="Full name" value={newBuyer.name} onChange={(e) => setNewBuyer({ ...newBuyer, name: e.target.value })} />
            <Input label="Email" type="email" value={newBuyer.email} onChange={(e) => setNewBuyer({ ...newBuyer, email: e.target.value })} />
            <Input label="Mobile (for SMS)" value={newBuyer.phone} onChange={(e) => setNewBuyer({ ...newBuyer, phone: e.target.value })} />
          </div>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Installment plan</p>
            <span className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setRows(standardPlan(total, project))}>Use standard plan</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setRows((r) => [...r, { label: '', amount: diff > 0 ? fromPoisha(diff) : '', dueType: 'FIXED_DATE', dueDate: inputDate(), milestoneId: '' }])}>
                <Plus className="size-4" aria-hidden /> Add installment
              </Button>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-[var(--radius-control)] border border-line p-2 sm:grid-cols-[1.6fr_1fr_1fr_1.6fr_auto] sm:items-center sm:border-0 sm:p-0">
                <input aria-label={`Installment ${i + 1} name`} value={r.label} onChange={(e) => set(i, { label: e.target.value })} className="col-span-2 h-9 rounded border border-line px-2 sm:col-span-1" placeholder="Name" />
                <input aria-label={`Installment ${i + 1} amount`} inputMode="decimal" value={r.amount} onChange={(e) => set(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} className="figure h-9 rounded border border-line px-2" placeholder="Amount" />
                <select aria-label={`Installment ${i + 1} due type`} value={r.dueType} onChange={(e) => set(i, { dueType: e.target.value as Row['dueType'] })} className="h-9 rounded border border-line px-1.5 text-sm">
                  <option value="FIXED_DATE">On a date</option>
                  <option value="MILESTONE">After a stage</option>
                </select>
                {r.dueType === 'FIXED_DATE' ? (
                  <input aria-label={`Installment ${i + 1} due date`} type="date" value={r.dueDate} onChange={(e) => set(i, { dueDate: e.target.value })} className="h-9 rounded border border-line px-2" />
                ) : (
                  <select aria-label={`Installment ${i + 1} stage`} value={r.milestoneId} onChange={(e) => set(i, { milestoneId: e.target.value })} className="h-9 rounded border border-line px-1.5 text-sm">
                    <option value="">Choose stage</option>
                    {project.milestones.map((m) => <option key={m.id} value={m.id}>{m.name}{m.status === 'COMPLETED' ? ' (done)' : ''}</option>)}
                  </select>
                )}
                <button type="button" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} className="justify-self-end rounded p-1.5 text-rebar hover:bg-overdue-soft hover:text-overdue" aria-label={`Remove installment ${i + 1}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <p className={cx('mt-3 text-sm', diff === 0 ? 'text-done' : 'text-overdue')} role="status">
            Plan total {taka(fromPoisha(sum))} of {taka(total)}
            {diff === 0 ? ': adds up.' : diff > 0 ? `: ${taka(fromPoisha(diff))} still to assign.` : `: ${taka(fromPoisha(-diff))} too much.`}
          </p>
        </div>
        <Button type="submit" size="lg" loading={save.isPending} disabled={!buyerReady || diff !== 0 || !rowsValid || !Number(total)}>
          Record booking
        </Button>
      </form>
    </Dialog>
  );
}
