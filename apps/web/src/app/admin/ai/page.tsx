'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Badge, Button, ErrorState, PageHeader, Panel, Spinner, Stat, Table, useErrorToast, useToast } from '@/components/ui';
import { get, post } from '@/lib/api';
import { relative } from '@/lib/format';
import { useMe } from '@/lib/session';

interface Status {
  provider: 'gemini' | 'offline';
  model: string;
  embeddingModel: string;
  monthlyBudgetUsd: number;
  spentThisMonthUsd: number;
  vectorSearch: string;
  byFeature: Array<{ feature: string; calls: number; succeeded: number; costUsd: string; avgLatencyMs: number }>;
}
interface Answer { id: string; text: string; unsure: boolean; helpful: boolean | null; createdAt: string; sources: Array<{ label: string }> | null }

const FEATURE: Record<string, string> = {
  'photo-analysis': 'Photo stage suggestions',
  'update-writer': 'Update drafts',
  assistant: 'Buyer assistant answers',
  'assistant-search:embed': 'Document search',
  'document-index:embed': 'Reading documents',
  'document-ocr': 'Reading scanned documents',
  'delay-risk': 'Delay-risk explanations',
};

export default function AiInsights() {
  const me = useMe();
  const toast = useToast();
  const onError = useErrorToast();
  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => get<Status>('/ai/status') });
  const accuracy = useQuery({ queryKey: ['ai-accuracy'], queryFn: () => get<{ decided: number; accepted: number; rate: number | null }>('/updates/ai-accuracy') });
  const answers = useQuery({ queryKey: ['assistant-log'], queryFn: () => get<Answer[]>('/reports/assistant') });
  const reindex = useMutation({ mutationFn: () => post<{ reindexed: number }>('/ai/reindex'), onSuccess: (r) => toast(`${r.reindexed} documents re-read`), onError });
  if (status.error) return <ErrorState error={status.error} onRetry={() => status.refetch()} />;
  const s = status.data;
  const rated = answers.data?.filter((a) => a.helpful !== null) ?? [];
  return (
    <div>
      <PageHeader title="AI insights" subtitle="How the AI features are performing, and what they cost." />
      {!s ? <Spinner /> : (
        <>
          {s.provider === 'offline' && (
            <p className="mb-5 rounded-[var(--radius-panel)] border border-line bg-brass-soft px-4 py-3">
              AI is running in offline mode: no API key is set, so BuildTrack uses its built-in rules (schedule-based suggestions, template drafts and record-based answers). Add a Gemini API key to switch on the real AI.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="AI service" value={s.provider === 'gemini' ? 'Gemini' : 'Offline'} note={s.provider === 'gemini' ? s.model : 'Built-in rules'} />
            <Stat label="Spent this month" value={`$${s.spentThisMonthUsd.toFixed(2)}`} note={`Budget $${s.monthlyBudgetUsd.toFixed(2)}; AI pauses at the limit`} />
            <Stat label="Photo suggestions accepted" value={accuracy.data?.rate !== null && accuracy.data?.rate !== undefined ? `${accuracy.data.rate}%` : '—'} note={`${accuracy.data?.accepted ?? 0} of ${accuracy.data?.decided ?? 0} photos`} />
            <Stat label="Answers rated helpful" value={rated.length ? `${Math.round((rated.filter((a) => a.helpful).length / rated.length) * 100)}%` : '—'} note={`${rated.length} rated answers`} />
          </div>
          <Panel title="AI calls this month" flush className="mt-6">
            {s.byFeature.length ? (
              <Table head={['Feature', 'Calls', 'Succeeded', 'Average time', 'Cost']}>
                {s.byFeature.map((f) => (
                  <tr key={f.feature}>
                    <td className="font-medium">{FEATURE[f.feature] ?? f.feature}</td>
                    <td className="figure">{f.calls}</td>
                    <td className="figure">{f.calls ? Math.round((f.succeeded / f.calls) * 100) : 0}%</td>
                    <td className="figure">{(f.avgLatencyMs / 1000).toFixed(1)} s</td>
                    <td className="figure">${Number(f.costUsd).toFixed(4)}</td>
                  </tr>
                ))}
              </Table>
            ) : <p className="p-5 text-rebar">No calls to an AI service yet this month.</p>}
          </Panel>
          <Panel title="Recent assistant answers" flush className="mt-6" action={me.data?.role === 'ORG_ADMIN' ? <Button size="sm" variant="secondary" loading={reindex.isPending} onClick={() => reindex.mutate()}>Re-read all documents</Button> : undefined}>
            {answers.data?.length ? (
              <ul className="divide-y divide-line">
                {answers.data.slice(0, 20).map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <p className="line-clamp-3">{a.text}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-rebar">
                      {relative(a.createdAt)}
                      {a.unsure && <Badge status="OPEN">Passed to team</Badge>}
                      {a.helpful === true && <Badge status="PAID">Helpful</Badge>}
                      {a.helpful === false && <Badge status="OVERDUE">Not helpful</Badge>}
                      {a.sources?.length ? <span>From: {a.sources.map((x) => x.label).join(', ')}</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            ) : <p className="p-5 text-rebar">No buyer questions yet.</p>}
          </Panel>
          <p className="mt-4 text-[13px] text-rebar">Vector search: {s.vectorSearch === 'pgvector' ? 'PostgreSQL pgvector' : 'in-app similarity'} · embeddings: {s.embeddingModel}</p>
        </>
      )}
    </div>
  );
}
