'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { get, patch, post } from '@/lib/api';
import { dateTime, relative } from '@/lib/format';
import { Badge, Button, cx, Empty, ErrorState, Spinner, Table, Textarea, useErrorToast } from './ui';

export interface TicketRow {
  id: string;
  subject: string;
  status: string;
  fromAi: boolean;
  updatedAt: string;
  unit: string;
  project: string;
  buyer: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  fromAi: boolean;
  unit: string;
  project: string;
  buyer: { id: string; name: string };
  messages: Array<{ id: string; body: string; createdAt: string; author: { id: string; name: string; isStaff: boolean } }>;
}

export function TicketList({ base, staff, status }: { base: string; staff?: boolean; status?: string }) {
  const q = useQuery({ queryKey: ['tickets', status ?? 'all'], queryFn: () => get<TicketRow[]>(`/tickets${status ? `?status=${status}` : ''}`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <Empty title="No conversations yet" />;
  return (
    <Table head={staff ? ['Subject', 'Buyer', 'Flat', 'Status', 'Last activity'] : ['Subject', 'Flat', 'Status', 'Last activity']}>
      {q.data.map((t) => (
        <tr key={t.id}>
          <td>
            <Link href={`${base}/${t.id}`} className="font-medium underline-offset-4 hover:underline">
              {t.subject}
            </Link>
            {t.fromAi && (
              <span className="ml-2 inline-flex items-center gap-1 text-[13px] text-rebar">
                <Sparkles className="size-3.5" aria-hidden /> from assistant
              </span>
            )}
          </td>
          {staff && <td>{t.buyer}</td>}
          <td className="text-rebar">
            {t.unit}, {t.project}
          </td>
          <td>
            <Badge status={t.status} />
          </td>
          <td className="whitespace-nowrap text-rebar">{relative(t.updatedAt)}</td>
        </tr>
      ))}
    </Table>
  );
}

export function TicketThread({ id }: { id: string }) {
  const qc = useQueryClient();
  const onError = useErrorToast();
  const [body, setBody] = useState('');
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => get<TicketDetail>(`/tickets/${id}`) });
  const reply = useMutation({
    mutationFn: () => post<TicketDetail>(`/tickets/${id}/messages`, { body }),
    onSuccess: (t) => {
      setBody('');
      qc.setQueryData(['ticket', id], t);
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError,
  });
  const close = useMutation({
    mutationFn: () => patch<TicketDetail>(`/tickets/${id}/close`),
    onSuccess: (t) => {
      qc.setQueryData(['ticket', id], t);
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError,
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data!;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim()) reply.mutate();
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold">{t.subject}</h1>
          <p className="text-rebar">
            {t.buyer.name} · flat {t.unit}, {t.project}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={t.status} />
          {t.status !== 'CLOSED' && (
            <Button variant="secondary" size="sm" onClick={() => close.mutate()} loading={close.isPending}>
              Close conversation
            </Button>
          )}
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {t.messages.map((m) => (
          <li key={m.id} className={cx('rounded-[var(--radius-panel)] border px-4 py-3', m.author.isStaff ? 'border-line bg-slab' : 'border-transparent bg-concrete-deep/60')}>
            <p className="text-sm">
              <span className="font-medium">{m.author.name}</span> <span className="text-rebar">· {m.author.isStaff ? 'Developer team' : 'Buyer'} · {dateTime(m.createdAt)}</span>
            </p>
            <p className="mt-1 whitespace-pre-line leading-relaxed">{m.body}</p>
          </li>
        ))}
      </ol>
      {t.status !== 'CLOSED' ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Textarea label="Your reply" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />
          <div>
            <Button type="submit" loading={reply.isPending} disabled={!body.trim()}>
              Send reply
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-rebar">This conversation is closed.</p>
      )}
    </div>
  );
}
