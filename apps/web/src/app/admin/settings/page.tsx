'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Button, ErrorState, Input, PageHeader, Panel, Spinner, useErrorToast, useToast } from '@/components/ui';
import { get, patch } from '@/lib/api';

interface Organization {
  name: string;
  primaryColor: string;
  accentColor: string;
  receiptPrefix: string;
  milestoneGraceDays: number;
  aiMonthlyBudgetUsd: string;
}

export default function Settings() {
  const q = useQuery({ queryKey: ['organization'], queryFn: () => get<Organization>('/organization') });
  const [form, setForm] = useState<Organization | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (f: Organization) =>
      patch<Organization>('/organization', {
        name: f.name.trim(),
        primaryColor: f.primaryColor,
        accentColor: f.accentColor,
        receiptPrefix: f.receiptPrefix.trim().toUpperCase(),
        milestoneGraceDays: Number(f.milestoneGraceDays),
        aiMonthlyBudgetUsd: Number(f.aiMonthlyBudgetUsd),
      }),
    onSuccess: (org) => {
      qc.setQueryData(['organization'], org);
      qc.invalidateQueries({ queryKey: ['me'] }); // brand colours and company name come from /auth/me
      toast('Settings saved');
    },
    onError,
  });

  if (q.isLoading || (!form && !q.error)) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const f = form!;
  const set = (key: keyof Organization) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...f, [key]: e.target.value });

  return (
    <div>
      <PageHeader title="Company settings" subtitle="How your company appears to buyers, and the rules for payments and AI." />
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(f); }} className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Panel title="Company and brand">
          <div className="flex flex-col gap-4">
            <Input label="Company name" value={f.name} onChange={set('name')} />
            <div className="flex gap-4">
              <Input label="Main colour" type="color" className="w-24 p-1" value={f.primaryColor} onChange={set('primaryColor')} />
              <Input label="Highlight colour" type="color" className="w-24 p-1" value={f.accentColor} onChange={set('accentColor')} />
            </div>
          </div>
        </Panel>
        <Panel title="Payments and AI">
          <div className="flex flex-col gap-4">
            <Input
              label="Receipt prefix"
              hint={`Receipts look like ${f.receiptPrefix.toUpperCase() || 'ABC'}-${new Date().getFullYear()}-000001. 2 to 6 capital letters.`}
              maxLength={6}
              value={f.receiptPrefix}
              onChange={set('receiptPrefix')}
            />
            <Input label="Grace period (days)" hint="Days a buyer gets to pay after a linked stage is finished." type="number" min={0} max={90} value={f.milestoneGraceDays} onChange={set('milestoneGraceDays')} />
            <Input label="Monthly AI budget (US$)" hint="Google bills in dollars. When it runs out, AI switches to offline mode until next month. 0 turns AI off." type="number" min={0} max={1000} step="0.01" value={f.aiMonthlyBudgetUsd} onChange={set('aiMonthlyBudgetUsd')} />
          </div>
        </Panel>
        <div className="md:col-span-2">
          <Button type="submit" loading={save.isPending} disabled={f.name.trim().length < 2}>Save settings</Button>
        </div>
      </form>
    </div>
  );
}
