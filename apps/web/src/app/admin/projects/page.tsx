'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Badge, Button, Dialog, Empty, ErrorState, Input, PageHeader, ProgressBar, Skeleton, Textarea, useErrorToast } from '@/components/ui';
import { get, post } from '@/lib/api';
import { date, label } from '@/lib/format';
import type { Page, ProjectSummary } from '@/lib/types';

export default function Projects() {
  const q = useQuery({ queryKey: ['projects'], queryFn: () => get<Page<ProjectSummary>>('/projects?pageSize=100').then((p) => p.items) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', description: '', totalFloors: '10', startDate: '', originalHandoverDate: '' });
  const router = useRouter();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const create = useMutation({
    mutationFn: () =>
      post<{ id: string }>('/projects', {
        name: form.name,
        location: form.location,
        description: form.description || undefined,
        totalFloors: Number(form.totalFloors),
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        originalHandoverDate: new Date(form.originalHandoverDate).toISOString(),
      }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/admin/projects/${p.id}`);
    },
    onError,
  });
  const valid = form.name.trim().length >= 2 && form.location.trim().length >= 2 && Number(form.totalFloors) >= 1 && form.originalHandoverDate;

  return (
    <div>
      <PageHeader title="Projects" action={<Button onClick={() => setOpen(true)}>New project</Button>} />
      {q.isLoading && <Skeleton className="h-48" />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <Empty title="No projects yet" action={<Button onClick={() => setOpen(true)}>Create the first project</Button>} />}
      <div className="grid gap-4 md:grid-cols-2">
        {q.data?.map((p) => (
          <Link key={p.id} href={`/admin/projects/${p.id}`} className="rounded-[var(--radius-panel)] border border-line bg-slab p-5 hover:border-rebar">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{p.name}</p>
                <p className="text-sm text-rebar">{p.location}</p>
              </div>
              <Badge status={p.status} />
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-rebar">{p.currentStage ? `Now: ${p.currentStage.name}` : label(p.status)}</span>
              <span className="figure text-xl font-semibold">{p.overallProgress}%</span>
            </div>
            <ProgressBar value={p.overallProgress} className="mt-2" labelText={`${p.name} progress`} />
            <p className="mt-3 text-sm text-rebar">
              Handover {date(p.expectedHandoverDate)}
              {p.delayDays > 0 && <span className="text-overdue"> ({p.delayDays} days late)</span>}
              {p.risk && <> · {label(p.risk.level)} delay risk</>}
            </p>
          </Link>
        ))}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="New project">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }} className="flex flex-col gap-4">
          <Input label="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={200} />
          <Textarea label="Description (shown on the public page)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Floors" type="number" min={1} max={60} value={form.totalFloors} onChange={(e) => setForm({ ...form, totalFloors: e.target.value })} />
            <Input label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Promised handover" type="date" value={form.originalHandoverDate} onChange={(e) => setForm({ ...form, originalHandoverDate: e.target.value })} />
          </div>
          <p className="text-sm text-rebar">Construction stages (piling to final handover) are created automatically, with planned dates spread between the start and handover dates. You can edit them later.</p>
          <Button type="submit" loading={create.isPending} disabled={!valid}>Create project</Button>
        </form>
      </Dialog>
    </div>
  );
}
