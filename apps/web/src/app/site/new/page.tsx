'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, ImagePlus, Sparkles, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChangeEvent, FormEvent, Suspense, useEffect, useState } from 'react';
import { Badge, Button, ButtonLink, ErrorState, Input, PageHeader, Panel, Select, Spinner, Textarea, useErrorToast } from '@/components/ui';
import { get, post, upload } from '@/lib/api';
import type { Page, ProjectDetail, ProjectSummary, Suggestion, Update } from '@/lib/types';

const MAX_PHOTOS = 8;

/** Shrinks a photo on the phone before upload (faster on mobile data). Falls back to the original file. */
async function compress(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function NewUpdate() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => get<Page<ProjectSummary>>('/projects?pageSize=100').then((p) => p.items) });
  const [projectId, setProjectId] = useState(params.get('project') ?? '');
  useEffect(() => {
    // Start on the project where building is actually happening.
    if (!projectId && projects.data?.length) setProjectId((projects.data.find((p) => p.status === 'UNDER_CONSTRUCTION') ?? projects.data[0]).id);
  }, [projects.data, projectId]);
  const project = useQuery({ queryKey: ['project', projectId], enabled: !!projectId, queryFn: () => get<ProjectDetail>(`/projects/${projectId}`) });

  const [files, setFiles] = useState<Array<{ file: File; url: string }>>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'photos' | 'confirm' | 'done'>('photos');
  const [result, setResult] = useState<{ update: Update; suggestion: Suggestion } | null>(null);
  const [stageId, setStageId] = useState('');
  const [progress, setProgress] = useState(0);
  const [draft, setDraft] = useState<{ title: string; text: string; source: string } | null>(null);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - files.length);
    setFiles((f) => [...f, ...list.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    e.target.value = '';
  };

  const send = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('title', title.trim());
      if (note.trim()) form.append('note', note.trim());
      for (const f of files) form.append('photos', await compress(f.file), f.file.name.replace(/\.\w+$/, '.jpg'));
      return upload<{ update: Update; suggestion: Suggestion }>(`/projects/${projectId}/updates`, form);
    },
    onSuccess: (r) => {
      setResult(r);
      setStageId(r.suggestion.milestoneId ?? '');
      setProgress(r.suggestion.progress ?? 0);
      setStep('confirm');
    },
    onError,
  });

  const confirm = useMutation({
    mutationFn: () => post<{ update: Update; draft: { title: string; text: string; source: string } }>(`/updates/${result!.update.id}/submit`, { milestoneId: stageId || null, progressAfter: stageId ? progress : null, note }),
    onSuccess: (r) => {
      setDraft(r.draft);
      setStep('done');
      qc.invalidateQueries({ queryKey: ['updates'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError,
  });

  const stage = project.data?.milestones.find((m) => m.id === stageId);
  const minProgress = stage?.progress ?? 0;

  if (projects.isLoading) return <Spinner />;
  if (projects.error) return <ErrorState error={projects.error} onRetry={() => projects.refetch()} />;

  if (step === 'done') {
    return (
      <Panel>
        <div className="flex flex-col items-start gap-3">
          <CheckCircle2 className="size-8 text-done" aria-hidden />
          <h2 className="text-xl font-semibold">Sent for review</h2>
          <p className="text-rebar">A manager will check it before buyers see it. This is the update the AI drafted for buyers:</p>
          {draft && (
            <blockquote className="w-full rounded-[var(--radius-control)] bg-concrete px-4 py-3">
              <p className="font-medium">{draft.title}</p>
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{draft.text}</p>
            </blockquote>
          )}
          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={() => location.reload()}>Post another update</Button>
            <ButtonLink href="/site" className="h-12">Back to my sites</ButtonLink>
          </div>
        </div>
      </Panel>
    );
  }

  if (step === 'confirm' && result) {
    const s = result.suggestion;
    return (
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          confirm.mutate();
        }}
        className="flex flex-col gap-5"
      >
        <Panel>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--brand-accent)]" aria-hidden />
            <div>
              <p className="font-semibold">
                {s.source === 'ai' ? 'AI suggestion' : 'Suggested from the schedule'}: {s.milestoneName ?? 'no stage'}
                {s.progress !== null && <span className="figure"> at {s.progress}%</span>}
              </p>
              <p className="text-sm text-rebar">
                {s.description}
                {s.confidence !== null && s.source === 'ai' && ` Confidence ${Math.round(s.confidence * 100)}%.`}
              </p>
              {s.notice && <p className="mt-1 text-sm text-rebar">{s.notice}</p>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {result.update.photos.map((p) => {
              const w = s.photos.find((x) => x.photoId === p.id)?.warnings ?? [];
              return (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt="Uploaded site photo" className="aspect-square w-full rounded object-cover" />
                  {w.length > 0 && <span className="absolute inset-x-0 bottom-0 bg-overdue/90 px-1 text-[11px] text-white">{w.join(', ')}</span>}
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Check and confirm">
          <div className="flex flex-col gap-4">
            <Select label="Stage shown in the photos" value={stageId} onChange={(e) => { setStageId(e.target.value); const m = project.data?.milestones.find((x) => x.id === e.target.value); if (m) setProgress(Math.max(progress, m.progress)); }}>
              <option value="">General site update (no stage change)</option>
              {project.data?.milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (now {m.progress}%)
                </option>
              ))}
            </Select>
            {stageId && (
              <div>
                <label htmlFor="progress" className="text-sm font-medium">
                  Progress after this work: <span className="figure">{progress}%</span>
                </label>
                <input id="progress" type="range" min={minProgress} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="mt-2 h-8 w-full accent-[var(--brand-accent)]" />
                <p className="text-[13px] text-rebar">Cannot be lower than the current {minProgress}%. Set 100% only when the stage is fully finished.</p>
              </div>
            )}
            <Textarea label="Note for the manager (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          </div>
        </Panel>
        <Button type="submit" size="lg" loading={confirm.isPending}>
          {stage && stageId === s.milestoneId && progress === s.progress ? 'Confirm and send' : 'Send with my changes'}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        send.mutate();
      }}
      className="flex flex-col gap-5"
    >
      {projects.data && projects.data.length > 1 && (
        <Select label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.data.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      )}
      <div>
        <p className="mb-2 text-sm font-medium">Photos ({files.length}/{MAX_PHOTOS})</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f, i) => (
            <div key={f.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={`Selected photo ${i + 1}`} className="aspect-square w-full rounded object-cover" />
              <button type="button" onClick={() => setFiles((x) => x.filter((_, k) => k !== i))} className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white" aria-label={`Remove photo ${i + 1}`}>
                <X className="size-4" />
              </button>
            </div>
          ))}
          {files.length < MAX_PHOTOS && (
            <>
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-line bg-slab text-sm text-rebar hover:border-rebar">
                <Camera className="size-6" aria-hidden /> Take photo
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={addFiles} />
              </label>
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-line bg-slab text-sm text-rebar hover:border-rebar">
                <ImagePlus className="size-6" aria-hidden /> From gallery
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={addFiles} />
              </label>
            </>
          )}
        </div>
      </div>
      <Input label="What did you work on?" placeholder="e.g. Floor 6 slab casting" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <Textarea label="Notes (optional)" hint="Anything the manager should know: delays, weather, materials." value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      {project.data && (
        <p className="text-sm text-rebar">
          Current stage at {project.data.name}: <Badge status="IN_PROGRESS">{project.data.currentStage?.name ?? 'none'}</Badge>
        </p>
      )}
      <Button type="submit" size="lg" loading={send.isPending} disabled={!files.length || title.trim().length < 3 || !projectId}>
        {send.isPending ? 'Uploading and checking photos' : 'Upload and get AI suggestion'}
      </Button>
    </form>
  );
}

export default function NewUpdatePage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: '/site', label: 'My sites' }} title="Post an update" />
      <Suspense fallback={<Spinner />}>
        <NewUpdate />
      </Suspense>
    </div>
  );
}
