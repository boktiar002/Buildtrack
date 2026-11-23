'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge, ErrorState, PageHeader, Panel, Spinner, Table } from '@/components/ui';
import { get } from '@/lib/api';
import { date, taka } from '@/lib/format';

interface DueRow { project: string; unit: string; buyer: string; phone: string | null; installment: string; status: string; dueDate: string | null; amount: string; paid: string; remaining: string }

const REPORTS = [
  { href: '/api/v1/reports/dues?format=csv', title: 'Dues', text: 'Every unpaid installment with buyer contact details, overdue first.' },
  { href: '/api/v1/reports/collections?format=csv', title: 'Collections', text: 'Every payment with receipt number, method and status.' },
  { href: '/api/v1/reports/progress?format=csv', title: 'Construction progress', text: 'Planned and actual dates for every stage, with days late.' },
];

export default function Reports() {
  const q = useQuery({ queryKey: ['dues'], queryFn: () => get<DueRow[]>('/reports/dues') });
  const due = q.data?.filter((d) => d.status !== 'UPCOMING') ?? [];
  return (
    <div>
      <PageHeader title="Reports" subtitle="CSV files open directly in Excel or Google Sheets." />
      <div className="grid gap-4 sm:grid-cols-3">
        {REPORTS.map((r) => (
          <a key={r.title} href={r.href} className="rounded-[var(--radius-panel)] border border-line bg-slab p-5 hover:border-rebar">
            <p className="font-semibold">{r.title}</p>
            <p className="mt-1 text-sm text-rebar">{r.text}</p>
            <p className="mt-3 text-sm font-medium underline underline-offset-4">Download CSV</p>
          </a>
        ))}
      </div>
      <Panel title="Due and overdue now" flush className="mt-6">
        {q.isLoading ? <Spinner /> : q.error ? <div className="p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : due.length ? (
          <Table head={['Buyer', 'Flat', 'Installment', 'Due', 'Remaining', 'Status']}>
            {due.map((d, i) => (
              <tr key={i}>
                <td className="font-medium">{d.buyer}{d.phone && <span className="block text-[13px] font-normal text-rebar">{d.phone}</span>}</td>
                <td className="text-rebar">{d.unit}, {d.project}</td>
                <td>{d.installment}</td>
                <td className="whitespace-nowrap">{date(d.dueDate)}</td>
                <td className="figure whitespace-nowrap">{taka(d.remaining)}</td>
                <td><Badge status={d.status} /></td>
              </tr>
            ))}
          </Table>
        ) : <p className="p-5 text-rebar">Nothing is due right now. <Link href="/admin" className="underline">Back to the dashboard</Link></p>}
      </Panel>
    </div>
  );
}
