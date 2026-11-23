'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Empty, ErrorState, PageHeader, Panel, Select, Skeleton, Table } from '@/components/ui';
import { get } from '@/lib/api';
import { date, dateTime, label, taka } from '@/lib/format';
import { useRequireRole } from '@/lib/session';
import type { Page, Role } from '@/lib/types';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorName: string | null;
  actorRole: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ENTITIES = ['Project', 'Milestone', 'Unit', 'Purchase', 'Payment', 'Installment', 'ProgressUpdate', 'Document', 'User', 'Ticket'];
const ENTITY_LABEL: Record<string, string> = {
  ProgressUpdate: 'Site update',
  Unit: 'Flat',
  Purchase: 'Booking',
  Milestone: 'Stage',
  ProjectAssignment: 'Engineer assignment',
};
const ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'PAYMENT_RECORDED',
  'PAYMENT_VOIDED',
  'PURCHASE_CREATED',
  'PURCHASE_CANCELLED',
  'HANDOVER_DATE_CHANGED',
  'PROGRESS_DECREASED',
  'INSTALLMENT_WAIVED',
];
const PAGE_SIZE = 25;
const ADMIN_ONLY: Role[] = ['ORG_ADMIN'];

const actionText = (a: string) => a.charAt(0) + a.slice(1).toLowerCase().replace(/_/g, ' ');
const tone = (a: string) =>
  a === 'DELETE' || a.endsWith('VOIDED') || a.endsWith('CANCELLED')
    ? 'OVERDUE'
    : a === 'CREATE' || a.endsWith('RECORDED') || a.endsWith('CREATED')
      ? 'PAID'
      : 'DUE';

const MONEY_KEYS = /amount|price|total|balance/i;

/** Field names as people read them: "expectedHandoverDate" -> "Expected handover date". */
const fieldName = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

function show(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return /date$/i.test(key) ? date(v) : dateTime(v);
  if (MONEY_KEYS.test(key) && /^-?\d+(\.\d+)?$/.test(String(v))) return taka(String(v));
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && /^[A-Z_]+$/.test(v)) return label(v);
  if (typeof v === 'object') return JSON.stringify(v);
  const text = String(v);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

/** Lists the fields that changed, as "field: before → after". */
function Changes({ row }: { row: AuditRow }) {
  const isId = (k: string) => /Id$/.test(k) && /^[0-9a-f-]{36}$/.test(String(row.newValue?.[k] ?? row.oldValue?.[k] ?? ''));
  const keys = [...new Set([...Object.keys(row.oldValue ?? {}), ...Object.keys(row.newValue ?? {})])].filter((k) => !isId(k)).slice(0, 5);
  const reason = row.meta?.reason as string | undefined;
  if (!keys.length && !reason) return <span className="text-rebar">—</span>;
  return (
    <ul className="flex flex-col gap-0.5 text-[14px]">
      {keys.map((k) => (
        <li key={k} className="break-words">
          <span className="text-rebar">{fieldName(k)}: </span>
          {row.oldValue && k in row.oldValue && (
            <>
              <span className="text-overdue line-through decoration-1">{show(k, row.oldValue[k])}</span>
              {row.newValue && k in row.newValue && <span className="text-rebar"> → </span>}
            </>
          )}
          {row.newValue && k in row.newValue && <span>{show(k, row.newValue[k])}</span>}
        </li>
      ))}
      {reason && <li className="text-rebar">Reason: {reason}</li>}
    </ul>
  );
}

export default function AuditLogPage() {
  useRequireRole(ADMIN_ONLY);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (entity) params.set('entity', entity);
  if (action) params.set('action', action);
  const q = useQuery({ queryKey: ['audit', entity, action, page], queryFn: () => get<Page<AuditRow>>(`/audit-logs?${params}`) });

  return (
    <div>
      <PageHeader
        title="Activity log"
        subtitle="Every change to projects, flats, bookings and money: who made it, what changed, when, and from where."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[220px_260px]">
        <Select
          label="Record type"
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All records</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {ENTITY_LABEL[e] ?? e}
            </option>
          ))}
        </Select>
        <Select
          label="Action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {actionText(a)}
            </option>
          ))}
        </Select>
      </div>
      <Panel flush>
        {q.isLoading ? (
          <div className="flex flex-col gap-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : q.error ? (
          <div className="p-5">
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : !q.data!.items.length ? (
          <div className="p-5">
            <Empty title="No activity matches these filters">Try another record type or action.</Empty>
          </div>
        ) : (
          <>
            {/* Phones: one card per change */}
            <ul className="divide-y divide-line md:hidden">
              {q.data!.items.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge status={tone(r.action)}>{actionText(r.action)}</Badge>
                    <span className="text-[13px] text-rebar">{dateTime(r.createdAt)}</span>
                  </div>
                  <p className="text-[15px]">
                    <span className="font-medium">{r.actorName ?? 'Unknown'}</span>
                    <span className="text-rebar"> · {ENTITY_LABEL[r.entity] ?? r.entity}</span>
                  </p>
                  <Changes row={r} />
                  {r.ipAddress && <p className="font-mono text-[12px] text-rebar">IP {r.ipAddress}</p>}
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table head={['When', 'Who', 'Action', 'Record', 'What changed', 'IP address']}>
                {q.data!.items.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap text-rebar">{dateTime(r.createdAt)}</td>
                    <td>
                      <span className="font-medium">{r.actorName ?? 'Unknown'}</span>
                      {r.actorRole && <span className="block text-[13px] text-rebar">{label(r.actorRole)}</span>}
                    </td>
                    <td>
                      <Badge status={tone(r.action)}>{actionText(r.action)}</Badge>
                    </td>
                    <td>
                      {ENTITY_LABEL[r.entity] ?? r.entity}
                      <span className="block font-mono text-[12px] text-rebar" title={r.entityId}>
                        {r.entityId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="max-w-[340px]">
                      <Changes row={r} />
                    </td>
                    <td className="whitespace-nowrap font-mono text-[13px] text-rebar">{r.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </Table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-rebar">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, q.data!.total)} of {q.data!.total}
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={page * PAGE_SIZE >= q.data!.total} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </span>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
