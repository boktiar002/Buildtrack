'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Badge, Button, Dialog, ErrorState, Input, PageHeader, Panel, Select, Spinner, Table, useErrorToast, useToast } from '@/components/ui';
import { get, patch, post } from '@/lib/api';
import { date, label } from '@/lib/format';
import { useMe } from '@/lib/session';
import type { Page, UserRow } from '@/lib/types';

export default function Team() {
  const me = useMe();
  const q = useQuery({ queryKey: ['staff'], queryFn: () => get<Page<UserRow>>('/users?pageSize=100') });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'ENGINEER' });
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const create = useMutation({
    mutationFn: () => post('/users', { ...form, phone: form.phone || undefined }),
    onSuccess: () => { toast('Team member added. They have been emailed a link to set their password.'); setOpen(false); qc.invalidateQueries({ queryKey: ['staff'] }); },
    onError,
  });
  const toggle = useMutation({ mutationFn: (u: UserRow) => patch(`/users/${u.id}`, { isActive: !u.isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }), onError });
  return (
    <div>
      <PageHeader title="Team" subtitle="Staff who can sign in. Managers handle sales and payments; site engineers post updates." action={<Button onClick={() => setOpen(true)}>Add team member</Button>} />
      <Panel flush>
        {q.isLoading ? <Spinner /> : q.error ? <div className="p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : (
          <Table head={['Name', 'Role', 'Email', 'Last sign-in', '']}>
            {q.data!.items.map((u) => (
              <tr key={u.id} className={u.isActive ? '' : 'text-rebar'}>
                <td className="font-medium">{u.name}</td>
                <td><Badge status={u.role}>{label(u.role)}</Badge></td>
                <td>{u.email}</td>
                <td className="text-rebar">{u.lastLoginAt ? date(u.lastLoginAt) : 'Never'}</td>
                <td className="text-right">{u.id !== me.data?.id && <button className="text-sm hover:underline" onClick={() => toggle.mutate(u)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a team member">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }} className="flex flex-col gap-4">
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Mobile" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="ENGINEER">Site engineer</option><option value="MANAGER">Manager</option><option value="ORG_ADMIN">Admin</option>
          </Select>
          <Button type="submit" loading={create.isPending} disabled={form.name.trim().length < 2 || !form.email.includes('@')}>Add and send invitation</Button>
        </form>
      </Dialog>
    </div>
  );
}
