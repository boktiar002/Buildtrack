'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { TicketList } from '@/components/tickets';
import { Button, Dialog, Input, PageHeader, Select, Textarea, useErrorToast } from '@/components/ui';
import { get, post } from '@/lib/api';
import type { PurchaseDetail } from '@/lib/types';

export default function Support() {
  const [open, setOpen] = useState(false);
  const purchases = useQuery({ queryKey: ['my-purchases'], queryFn: () => get<PurchaseDetail[]>('/my/purchases') });
  const [form, setForm] = useState({ purchaseId: '', subject: '', body: '' });
  const router = useRouter();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const create = useMutation({
    mutationFn: () => post<{ id: string }>('/tickets', { ...form, purchaseId: form.purchaseId || purchases.data?.[0]?.id }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      router.push(`/portal/support/${t.id}`);
    },
    onError,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <div>
      <PageHeader title="Support" subtitle="Conversations with the developer's team." action={<Button onClick={() => setOpen(true)}>New question</Button>} />
      <div className="rounded-[var(--radius-panel)] border border-line bg-slab">
        <TicketList base="/portal/support" />
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Ask the developer's team">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {(purchases.data?.length ?? 0) > 1 && (
            <Select label="About" value={form.purchaseId} onChange={(e) => setForm({ ...form, purchaseId: e.target.value })}>
              {purchases.data?.map((p) => <option key={p.id} value={p.id}>Flat {p.unit.code}, {p.unit.project.name}</option>)}
            </Select>
          )}
          <Input label="Subject" required maxLength={120} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Textarea label="Your message" required maxLength={3000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Button type="submit" loading={create.isPending} disabled={form.subject.trim().length < 3 || form.body.trim().length < 3}>Send question</Button>
        </form>
      </Dialog>
    </div>
  );
}
