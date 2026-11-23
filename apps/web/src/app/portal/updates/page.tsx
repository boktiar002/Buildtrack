'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { PhotoGrid } from '@/components/photos';
import { Empty, ErrorState, PageHeader, Panel, Spinner } from '@/components/ui';
import { get } from '@/lib/api';
import { date } from '@/lib/format';
import type { PurchaseDetail, Update } from '@/lib/types';

export default function UpdatesFeed() {
  const purchases = useQuery({ queryKey: ['my-purchases'], queryFn: () => get<PurchaseDetail[]>('/my/purchases') });
  const projectIds = [...new Set(purchases.data?.map((p) => p.unit.projectId) ?? [])];
  const feeds = useQueries({ queries: projectIds.map((id) => ({ queryKey: ['updates', id], queryFn: () => get<Update[]>(`/projects/${id}/updates`) })) });
  const names = new Map(purchases.data?.map((p) => [p.unit.projectId, p.unit.project.name]));
  const all = feeds.flatMap((f) => f.data ?? []).sort((a, b) => +new Date(b.approvedAt ?? b.createdAt) - +new Date(a.approvedAt ?? a.createdAt));
  const error = purchases.error ?? feeds.find((f) => f.error)?.error;
  return (
    <div>
      <PageHeader title="Site updates" subtitle="Photos and news from the construction site, newest first." />
      {(purchases.isLoading || feeds.some((f) => f.isLoading)) && <Spinner />}
      {error && <ErrorState error={error} onRetry={() => purchases.refetch()} />}
      {!purchases.isLoading && !all.length && !error && <Empty title="No updates yet">When the site team posts progress, it will appear here.</Empty>}
      <div className="flex flex-col gap-5">
        {all.map((u) => (
          <Panel key={u.id} title={u.title} action={<span className="text-sm text-rebar">{names.get(u.projectId)} · {date(u.approvedAt ?? u.createdAt)}</span>}>
            {u.text && <p className="mb-4 max-w-[70ch] whitespace-pre-line leading-relaxed">{u.text}</p>}
            <PhotoGrid photos={u.photos} caption={u.title} />
          </Panel>
        ))}
      </div>
    </div>
  );
}
