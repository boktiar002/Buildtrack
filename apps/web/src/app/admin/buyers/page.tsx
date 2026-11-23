'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Button, Dialog, Empty, ErrorState, Input, PageHeader, Panel, Spinner, Table, useErrorToast, useToast } from '@/components/ui';
import { get, post } from '@/lib/api';
import { date } from '@/lib/format';
import type { Page, UserRow } from '@/lib/types';

export default function Buyers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['buyers', search, page], queryFn: () => get<Page<UserRow>>(`/buyers?page=${page}&pageSize=25${search ? `&search=${encodeURIComponent(search)}` : ''}`), placeholderData: (p) => p });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const create = useMutation({
    mutationFn: () => post('/buyers', { ...form, phone: form.phone || undefined }),
    onSuccess: () => { toast('Buyer added. They have been emailed a link to set their password.'); setOpen(false); setForm({ name: '', email: '', phone: '' }); qc.invalidateQueries({ queryKey: ['buyers'] }); },
    onError,
  });
  return (
    <div>
      <PageHeader title="Buyers" action={<Button onClick={() => setOpen(true)}>Add buyer</Button>} />
      <div className="mb-4 max-w-sm"><Input label="Search by name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      <Panel flush>
        {q.isLoading ? <Spinner /> : q.error ? <div className="p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : q.data?.items.length ? (
          <>
            <Table head={['Name', 'Email', 'Mobile', 'Last sign-in']}>
              {q.data.items.map((b) => (
                <tr key={b.id}><td className="font-medium">{b.name}</td><td>{b.email}</td><td>{b.phone ?? '—'}</td><td className="text-rebar">{b.lastLoginAt ? date(b.lastLoginAt) : 'Never'}</td></tr>
              ))}
            </Table>
            {q.data.total > q.data.pageSize && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
                <span className="text-rebar">{q.data.total} buyers</span>
                <span className="flex gap-2"><Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page * q.data.pageSize >= q.data.total} onClick={() => setPage(page + 1)}>Next</Button></span>
              </div>
            )}
          </>
        ) : <div className="p-5"><Empty title="No buyers found" /></div>}
      </Panel>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a buyer">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }} className="flex flex-col gap-4">
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Mobile (for SMS reminders)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button type="submit" loading={create.isPending} disabled={form.name.trim().length < 2 || !form.email.includes('@')}>Add buyer and send invitation</Button>
        </form>
      </Dialog>
    </div>
  );
}
