'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Empty, ErrorState, Input, PageHeader, Panel, Select, Spinner, Table } from '@/components/ui';
import { get } from '@/lib/api';
import { date, label, taka } from '@/lib/format';
import type { Page } from '@/lib/types';

interface Row { id: string; receiptNumber: string; amount: string; method: string; reference: string | null; paidAt: string; voidedAt: string | null; purchaseId: string; unit: string; project: string; buyer: string }

export default function Payments() {
  const [f, setF] = useState({ search: '', method: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), pageSize: '25', ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).toString();
  const q = useQuery({ queryKey: ['payments', qs], queryFn: () => get<Page<Row>>(`/payments?${qs}`), placeholderData: (p) => p });
  const shown = q.data?.items.filter((p) => !p.voidedAt).reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const csv = `/api/v1/reports/collections?format=csv${f.from ? `&from=${f.from}` : ''}${f.to ? `&to=${f.to}` : ''}`;
  return (
    <div>
      <PageHeader title="Payments" action={<a href={csv} className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-line bg-slab px-4 font-medium hover:border-rebar">Download CSV</a>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Input label="Search" placeholder="Receipt, buyer or flat" value={f.search} onChange={(e) => { setF({ ...f, search: e.target.value }); setPage(1); }} />
        <Select label="Method" value={f.method} onChange={(e) => { setF({ ...f, method: e.target.value }); setPage(1); }}>
          <option value="">All</option>{['BANK_TRANSFER', 'BKASH', 'NAGAD', 'CHEQUE', 'CASH', 'OTHER'].map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </Select>
        <Input label="From" type="date" value={f.from} onChange={(e) => { setF({ ...f, from: e.target.value }); setPage(1); }} />
        <Input label="To" type="date" value={f.to} onChange={(e) => { setF({ ...f, to: e.target.value }); setPage(1); }} />
      </div>
      <Panel flush>
        {q.isLoading ? <Spinner /> : q.error ? <div className="p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : q.data?.items.length ? (
          <>
            <Table head={['Receipt', 'Date', 'Buyer', 'Flat', 'Method', 'Amount']}>
              {q.data.items.map((p) => (
                <tr key={p.id} className={p.voidedAt ? 'text-rebar line-through' : ''}>
                  <td><Link href={`/admin/receipts/${p.id}`} className="figure hover:underline">{p.receiptNumber}</Link></td>
                  <td className="whitespace-nowrap">{date(p.paidAt)}</td>
                  <td><Link href={`/admin/purchases/${p.purchaseId}`} className="hover:underline">{p.buyer}</Link></td>
                  <td className="text-rebar">{p.unit}, {p.project}</td>
                  <td>{label(p.method)}</td>
                  <td className="figure whitespace-nowrap">{taka(p.amount)}</td>
                </tr>
              ))}
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
              <span className="text-rebar">{q.data.total} payments · this page {taka(shown)}</span>
              <span className="flex gap-2"><Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page * 25 >= q.data.total} onClick={() => setPage(page + 1)}>Next</Button></span>
            </div>
          </>
        ) : <div className="p-5"><Empty title="No payments match these filters" /></div>}
      </Panel>
    </div>
  );
}
