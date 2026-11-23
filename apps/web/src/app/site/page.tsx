'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { Badge, ButtonLink, Empty, ErrorState, PageHeader, ProgressBar, Spinner } from '@/components/ui';
import { get } from '@/lib/api';
import { relative } from '@/lib/format';
import { useMe } from '@/lib/session';
import type { Page, ProjectSummary, Update } from '@/lib/types';

export default function SiteHome() {
  const me = useMe();
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => get<Page<ProjectSummary>>('/projects?pageSize=100').then((p) => p.items) });
  const feeds = useQueries({
    queries: (projects.data ?? []).map((p) => ({ queryKey: ['updates', p.id, 'all'], queryFn: () => get<Update[]>(`/projects/${p.id}/updates`) })),
  });
  const mine = feeds
    .flatMap((f) => f.data ?? [])
    .filter((u) => u.authorId === me.data?.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="My sites" subtitle="Post photos from the site. The AI suggests the stage; you confirm it." />
      {projects.isLoading && <Spinner />}
      {projects.error && <ErrorState error={projects.error} onRetry={() => projects.refetch()} />}
      {projects.data?.length === 0 && <Empty title="No sites assigned to you yet">Ask your manager to assign you to a project.</Empty>}
      <div className="flex flex-col gap-4">
        {projects.data?.map((p) => (
          <div key={p.id} className="rounded-[var(--radius-panel)] border border-line bg-slab p-5">
            <p className="text-lg font-semibold">{p.name}</p>
            <p className="text-sm text-rebar">{p.location}</p>
            <p className="mt-4 text-sm text-rebar">Current stage</p>
            <p className="font-medium">
              {p.currentStage?.name ?? 'All stages finished'}
              {p.currentStage && <span className="figure ml-2 text-[#7d6736]">{p.currentStage.progress}%</span>}
            </p>
            <ProgressBar value={p.overallProgress} className="mt-3" labelText={`${p.name} overall progress`} />
            <ButtonLink href={`/site/new?project=${p.id}`} variant="primary" className="mt-5 h-12 w-full text-base">
              <Camera className="size-5" aria-hidden /> Post an update
            </ButtonLink>
          </div>
        ))}
      </div>
      {mine.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">My recent updates</h2>
          <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-slab">
            {mine.map((u) => (
              <li key={u.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{u.title}</p>
                  <p className="text-sm text-rebar">{relative(u.createdAt)}{u.rejectReason ? ` · ${u.rejectReason}` : ''}</p>
                </div>
                <Badge status={u.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
