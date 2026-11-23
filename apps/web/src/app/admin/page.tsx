'use client';

import { useQuery } from '@tanstack/react-query';
import { Gauge, Hourglass, TriangleAlert, Wallet } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Badge, ErrorState, PageHeader, Panel, ProgressBar, Skeleton, Stat, Table } from '@/components/ui';
import { get } from '@/lib/api';
import { date, taka } from '@/lib/format';

const CollectionsChart = dynamic(() => import('@/components/collections-chart'), { ssr: false, loading: () => <Skeleton className="h-full" /> });

interface Dashboard {
  kpis: {
    activeProjects: number;
    buildingProjects: number;
    averageProgress: number;
    collectedThisMonth: string;
    outstanding: string;
    overdueAmount: string;
    overdueCount: number;
    openTickets: number;
    pendingReviews: number;
  };
  monthlyCollections: Array<{ month: string; total: string }>;
  projects: Array<{ id: string; name: string; overallProgress: number; risk: { level: string; score: number } | null; delayDays: number; status: string }>;
  upcomingStages: Array<{ id: string; name: string; progress: number; plannedEnd: string; projectId: string; project: string }>;
  topOverdue: Array<{ id: string; label: string; amount: string; paidAmount: string; dueDate: string; purchaseId: string; unit: string; buyer: string; project: string }>;
  ai: {
    photoSuggestions: { decided: number; accepted: number; rate: number | null };
    assistant: { answers: number; helpful: number; rated: number; unsure: number };
    drafts: { approved: number; edited: number; rejected: number };
  };
}

export default function AdminDashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<Dashboard>('/dashboard/admin') });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const drafts = d ? d.ai.drafts.approved + d.ai.drafts.edited + d.ai.drafts.rejected : 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Construction, collections and buyer questions at a glance." />
      {!d ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<Wallet className="size-[18px]" />} tone="done" label="Collected this month" value={taka(d.kpis.collectedThisMonth, { compact: true })} />
            <Stat icon={<Hourglass className="size-[18px]" />} label="Still to collect" value={taka(d.kpis.outstanding, { compact: true })} note="across active bookings" />
            <Stat icon={<TriangleAlert className="size-[18px]" />} label="Overdue" value={taka(d.kpis.overdueAmount, { compact: true })} note={`${d.kpis.overdueCount} installment${d.kpis.overdueCount === 1 ? '' : 's'}`} tone={d.kpis.overdueCount ? 'overdue' : undefined} />
            <Stat icon={<Gauge className="size-[18px]" />} label="Average progress" value={`${d.kpis.averageProgress}%`} note={`${d.kpis.buildingProjects} project${d.kpis.buildingProjects === 1 ? '' : 's'} under construction`} />
          </div>

          {(d.kpis.pendingReviews > 0 || d.kpis.openTickets > 0) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {d.kpis.pendingReviews > 0 && (
                <Link href="/admin/reviews" className="rounded-[var(--radius-control)] bg-brass-soft px-4 py-2.5 font-medium text-[#6b4f12] hover:bg-[#efdfb8]">
                  {d.kpis.pendingReviews} site update{d.kpis.pendingReviews > 1 ? 's' : ''} waiting for your review
                </Link>
              )}
              {d.kpis.openTickets > 0 && (
                <Link href="/admin/tickets" className="rounded-[var(--radius-control)] border border-line bg-slab px-4 py-2.5 font-medium hover:border-rebar">
                  {d.kpis.openTickets} open support conversation{d.kpis.openTickets > 1 ? 's' : ''}
                </Link>
              )}
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel title="Collections, last 12 months">
              <div className="h-64" aria-label="Bar chart of money collected per month">
                <CollectionsChart data={d.monthlyCollections} />
              </div>
            </Panel>
            <Panel title="Projects">
              <ul className="flex flex-col gap-4">
                {d.projects.map((p) => (
                  <li key={p.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      <span className="flex items-center gap-2">
                        {p.risk && <Badge status={p.risk.level}>{p.risk.level === 'LOW' ? 'Low risk' : p.risk.level === 'MEDIUM' ? 'Medium risk' : 'High risk'}</Badge>}
                        <span className="figure font-semibold">{p.overallProgress}%</span>
                      </span>
                    </div>
                    <ProgressBar value={p.overallProgress} className="mt-2" labelText={`${p.name} progress`} />
                    {p.delayDays > 0 && <p className="mt-1 text-[13px] text-overdue">Handover moved {p.delayDays} days</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Overdue installments" flush>
              {d.topOverdue.length ? (
                <Table head={['Buyer', 'Installment', 'Due', 'Owed']}>
                  {d.topOverdue.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/purchases/${o.purchaseId}`} className="font-medium hover:underline">{o.buyer}</Link>
                        <span className="block text-[13px] text-rebar">{o.unit}, {o.project}</span>
                      </td>
                      <td className="text-rebar">{o.label}</td>
                      <td className="whitespace-nowrap text-overdue">{date(o.dueDate)}</td>
                      <td className="figure whitespace-nowrap">{taka(Number(o.amount) - Number(o.paidAmount))}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p className="p-5 text-rebar">Nothing is overdue.</p>
              )}
            </Panel>
            <Panel title="Stages planned to finish in the next 30 days" flush>
              {d.upcomingStages.length ? (
                <Table head={['Stage', 'Project', 'Planned', 'Now']}>
                  {d.upcomingStages.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td><Link href={`/admin/projects/${s.projectId}`} className="hover:underline">{s.project}</Link></td>
                      <td className="whitespace-nowrap">{date(s.plannedEnd)}</td>
                      <td className="figure">{s.progress}%</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p className="p-5 text-rebar">No stages are planned to finish in the next 30 days.</p>
              )}
            </Panel>
          </div>

          <Panel title="How the AI is doing" className="mt-6" action={<Link href="/admin/ai" className="text-sm font-medium underline underline-offset-4">Details</Link>}>
            <dl className="grid gap-6 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-rebar">Photo stage suggestions accepted by engineers</dt>
                <dd className="figure mt-1 text-2xl font-semibold">{d.ai.photoSuggestions.rate !== null ? `${d.ai.photoSuggestions.rate}%` : '—'}</dd>
                <dd className="text-[13px] text-rebar">{d.ai.photoSuggestions.accepted} of {d.ai.photoSuggestions.decided} photos</dd>
              </div>
              <div>
                <dt className="text-sm text-rebar">AI-written updates approved without edits</dt>
                <dd className="figure mt-1 text-2xl font-semibold">{drafts ? `${Math.round((d.ai.drafts.approved / drafts) * 100)}%` : '—'}</dd>
                <dd className="text-[13px] text-rebar">{d.ai.drafts.edited} edited, {d.ai.drafts.rejected} rejected</dd>
              </div>
              <div>
                <dt className="text-sm text-rebar">Buyer questions answered by the assistant</dt>
                <dd className="figure mt-1 text-2xl font-semibold">{d.ai.assistant.answers}</dd>
                <dd className="text-[13px] text-rebar">
                  {d.ai.assistant.rated ? `${Math.round((d.ai.assistant.helpful / d.ai.assistant.rated) * 100)}% rated helpful` : 'No ratings yet'}, {d.ai.assistant.unsure} passed to the team
                </dd>
              </div>
            </dl>
          </Panel>
        </>
      )}
    </div>
  );
}
