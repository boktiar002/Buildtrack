'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { use, useState } from 'react';
import { Elevation } from '@/components/elevation';
import { HandoverHistory, PaidSummary, PaymentsList, Schedule } from '@/components/finance';
import { PhotoGrid } from '@/components/photos';
import { StageTimeline } from '@/components/stages';
import { ButtonLink, Empty, ErrorState, PageHeader, Panel, Spinner, Tabs, useErrorToast } from '@/components/ui';
import { get } from '@/lib/api';
import { date, relative } from '@/lib/format';
import type { ProjectDetail, PurchaseDetail, Update } from '@/lib/types';

interface Doc {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

function Documents({ projectId, purchaseId }: { projectId: string; purchaseId: string }) {
  const q = useQuery({ queryKey: ['docs', projectId], queryFn: () => get<Doc[]>(`/documents?projectId=${projectId}`) });
  const onError = useErrorToast();
  const open = useMutation({
    mutationFn: (id: string) => get<{ url: string }>(`/documents/${id}/url`),
    onSuccess: (r) => window.open(r.url, '_blank', 'noopener'),
    onError,
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <Empty title="No documents yet">Your allotment letter, agreement and approvals will appear here when the developer uploads them.</Empty>;
  return (
    <ul className="divide-y divide-line">
      {q.data.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-3">
          <span className="flex items-center gap-3">
            <FileText className="size-5 text-rebar" aria-hidden />
            <span>
              <span className="block font-medium">{d.title}</span>
              <span className="text-sm text-rebar">Added {date(d.createdAt)}</span>
            </span>
          </span>
          <button className="text-sm font-medium underline underline-offset-4" onClick={() => open.mutate(d.id)} disabled={open.isPending}>
            Open
          </button>
        </li>
      ))}
      <li className="pt-3 text-sm text-rebar" data-purchase={purchaseId}>
        Links open for 5 minutes for your security.
      </li>
    </ul>
  );
}

export default function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<'progress' | 'photos' | 'payments' | 'handover' | 'documents'>('progress');
  const p = useQuery({ queryKey: ['purchase', id], queryFn: () => get<PurchaseDetail>(`/purchases/${id}`) });
  const projectId = p.data?.unit.projectId;
  const project = useQuery({ queryKey: ['project', projectId], enabled: !!projectId, queryFn: () => get<ProjectDetail>(`/projects/${projectId}`) });
  const updates = useQuery({ queryKey: ['updates', projectId], enabled: !!projectId, queryFn: () => get<Update[]>(`/projects/${projectId}/updates`) });

  if (p.isLoading) return <Spinner />;
  if (p.error) return <ErrorState error={p.error} onRetry={() => p.refetch()} />;
  const purchase = p.data!;
  const pr = project.data;

  return (
    <div>
      <PageHeader
        back={{ href: '/portal', label: 'My flat' }}
        title={`Flat ${purchase.unit.code}`}
        subtitle={`${purchase.unit.project.name} · floor ${purchase.unit.floor} · ${purchase.unit.sizeSqft} sqft`}
        action={<ButtonLink href={`/portal/assistant?purchase=${id}`}>Ask a question</ButtonLink>}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'progress', label: 'Progress' },
          { id: 'photos', label: 'Site photos' },
          { id: 'payments', label: 'Payments' },
          { id: 'handover', label: 'Handover' },
          { id: 'documents', label: 'Documents' },
        ]}
      />
      {tab === 'progress' &&
        (pr ? (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
            <Panel title={`${pr.overallProgress}% built`}>
              <StageTimeline stages={pr.milestones} />
            </Panel>
            <Panel>
              <Elevation stages={pr.milestones} height={380} />
            </Panel>
          </div>
        ) : (
          <Spinner />
        ))}
      {tab === 'photos' && (
        <div className="flex flex-col gap-5">
          {updates.isLoading && <Spinner />}
          {updates.data?.length === 0 && <Empty title="No site updates yet" />}
          {updates.data?.map((u) => (
            <Panel key={u.id} title={u.title} action={<span className="text-sm text-rebar">{date(u.approvedAt ?? u.createdAt)}</span>}>
              {u.text && <p className="mb-4 max-w-[70ch] whitespace-pre-line leading-relaxed">{u.text}</p>}
              <PhotoGrid photos={u.photos} caption={`${u.title}, ${date(u.createdAt)}`} />
              {u.milestoneName && u.progressAfter !== null && (
                <p className="mt-3 text-sm text-rebar">
                  {u.milestoneName}: {u.progressAfter}% · posted {relative(u.approvedAt ?? u.createdAt)}
                </p>
              )}
            </Panel>
          ))}
        </div>
      )}
      {tab === 'payments' && (
        <div className="flex flex-col gap-6">
          <Panel>
            <PaidSummary totals={purchase.totals} />
          </Panel>
          <Panel title="Installment schedule" flush>
            <Schedule installments={purchase.installments} />
          </Panel>
          <Panel title="Payments and receipts" flush>
            <PaymentsList payments={purchase.payments} receiptBase="/portal/receipts" />
          </Panel>
        </div>
      )}
      {tab === 'handover' && pr && (
        <Panel title="Handover date">
          <HandoverHistory original={pr.originalHandoverDate} expected={pr.expectedHandoverDate} delayDays={pr.delayDays} history={pr.handoverHistory} />
        </Panel>
      )}
      {tab === 'documents' && projectId && (
        <Panel title="Your documents">
          <Documents projectId={projectId} purchaseId={id} />
        </Panel>
      )}
    </div>
  );
}
