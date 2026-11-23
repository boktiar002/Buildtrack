'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { PhotoGrid } from '@/components/photos';
import { Button, Dialog, Empty, ErrorState, Input, PageHeader, Panel, Select, Spinner, Textarea, useErrorToast, useToast } from '@/components/ui';
import { get, post } from '@/lib/api';
import { relative } from '@/lib/format';
import type { ProjectDetail, Update } from '@/lib/types';

function splitDraft(text: string | undefined, fallbackTitle: string) {
  if (!text) return { title: fallbackTitle, body: '' };
  const [first, ...rest] = text.split('\n\n');
  return rest.length ? { title: first.trim(), body: rest.join('\n\n').trim() } : { title: fallbackTitle, body: text.trim() };
}

function ReviewCard({ u }: { u: Update }) {
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const project = useQuery({ queryKey: ['project', u.projectId], queryFn: () => get<ProjectDetail>(`/projects/${u.projectId}`) });
  const initial = splitDraft(u.aiDraft?.text, u.title);
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.body);
  const [stageId, setStageId] = useState(u.milestoneId ?? '');
  const [progress, setProgress] = useState(u.progressAfter ?? 0);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const done = () => {
    qc.invalidateQueries({ queryKey: ['review-queue'] });
    qc.invalidateQueries({ queryKey: ['project', u.projectId] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const approve = useMutation({
    mutationFn: () => post(`/updates/${u.id}/approve`, { title, text, milestoneId: stageId || null, progressAfter: stageId ? progress : null }),
    onSuccess: () => { toast('Published. Buyers have been notified.'); done(); },
    onError,
  });
  const reject = useMutation({ mutationFn: () => post(`/updates/${u.id}/reject`, { reason }), onSuccess: () => { toast('Sent back to the engineer'); setRejecting(false); done(); }, onError });
  const regenerate = useMutation({
    mutationFn: () => post<{ title: string; text: string; source: string; error?: string }>(`/updates/${u.id}/regenerate`),
    onSuccess: (d) => { setTitle(d.title); setText(d.text); toast(d.source === 'ai' ? 'New AI draft ready' : 'Draft rebuilt from the update data'); },
    onError,
  });
  const stage = project.data?.milestones.find((m) => m.id === stageId);
  const analysis = u.photos.find((p) => p.analysis)?.analysis;
  const suggested = project.data?.milestones.find((m) => m.id === analysis?.suggestedMilestoneId);
  const edited = title !== initial.title || text !== initial.body;

  return (
    <Panel title={`${u.projectName ?? ''}: ${u.title}`} action={<span className="text-sm text-rebar">by {u.authorName}, {relative(u.createdAt)}</span>}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <PhotoGrid photos={u.photos} size="md" />
          {u.engineerNote && (
            <div className="mt-4">
              <p className="text-sm text-rebar">Engineer&rsquo;s note</p>
              <p className="whitespace-pre-line">{u.engineerNote}</p>
            </div>
          )}
          {analysis && (
            <div className="mt-4 rounded-[var(--radius-control)] bg-concrete px-4 py-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium"><Sparkles className="size-4 text-[var(--brand-accent)]" aria-hidden /> Photo check</p>
              <p className="mt-1 text-rebar">
                Suggested {suggested?.name ?? 'stage'} at {analysis.suggestedProgress}%
                {analysis.confidence !== null && ` (confidence ${Math.round(analysis.confidence * 100)}%)`}.{' '}
                {analysis.accepted === true ? 'The engineer agreed.' : analysis.accepted === false ? 'The engineer corrected it.' : ''}
              </p>
              {analysis.description && <p className="mt-1 text-rebar">{analysis.description}</p>}
            </div>
          )}
        </div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); approve.mutate(); }} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="size-4 text-[var(--brand-accent)]" aria-hidden /> Draft for buyers {edited && <span className="font-normal text-rebar">(edited)</span>}</p>
            <Button type="button" size="sm" variant="ghost" loading={regenerate.isPending} onClick={() => regenerate.mutate()}>Write a new draft</Button>
          </div>
          <Input label="Headline" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <Textarea label="Update text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-40" maxLength={3000} />
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Select label="Stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
              <option value="">No stage change</option>
              {project.data?.milestones.map((m) => <option key={m.id} value={m.id}>{m.name} (now {m.progress}%)</option>)}
            </Select>
            <Input label="New progress %" type="number" min={stage?.progress ?? 0} max={100} disabled={!stageId} value={progress} onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value))))} />
          </div>
          {stage && progress === 100 && stage.progress < 100 && <p className="rounded bg-brass-soft px-3 py-2 text-sm">Publishing marks &ldquo;{stage.name}&rdquo; complete. Installments linked to it become due.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={approve.isPending} disabled={title.trim().length < 3 || text.trim().length < 10}>Publish to buyers</Button>
            <Button type="button" variant="ghost" onClick={() => setRejecting(true)}>Send back</Button>
          </div>
        </form>
      </div>
      <Dialog open={rejecting} onClose={() => setRejecting(false)} title="Send back to the engineer">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); reject.mutate(); }} className="flex flex-col gap-4">
          <Textarea label="What needs to change?" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" loading={reject.isPending} disabled={reason.trim().length < 5}>Send back</Button>
        </form>
      </Dialog>
    </Panel>
  );
}

export default function Reviews() {
  const q = useQuery({ queryKey: ['review-queue'], queryFn: () => get<Update[]>('/updates/review-queue') });
  return (
    <div>
      <PageHeader title="Updates to review" subtitle="Engineers' site updates with AI-written drafts. Nothing reaches buyers until you publish it." />
      {q.isLoading && <Spinner />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <Empty title="Nothing to review">New site updates from engineers will appear here.</Empty>}
      <div className="flex flex-col gap-6">{q.data?.map((u) => <ReviewCard key={u.id} u={u} />)}</div>
    </div>
  );
}
