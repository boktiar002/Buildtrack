'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use } from 'react';
import { Elevation } from '@/components/elevation';
import { PhotoGrid } from '@/components/photos';
import { ErrorState, Spinner } from '@/components/ui';
import { get } from '@/lib/api';
import { date, label } from '@/lib/format';
import { ORG_SLUG, PublicProject, toStages } from '@/lib/public';

export default function PublicProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const q = useQuery({
    queryKey: ['public', ORG_SLUG, slug],
    queryFn: () => get<PublicProject & { photos: Array<{ url: string; thumbUrl: string; date: string }>; organization: { name: string } }>(`/public/${ORG_SLUG}/projects/${slug}`),
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/" className="text-sm text-rebar hover:text-ink">
        ‹ All projects
      </Link>
      {q.isLoading && <Spinner />}
      {q.error && <div className="mt-6"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>}
      {q.data && (
        <>
          <div className="mt-4 grid gap-8 md:grid-cols-[1fr_300px]">
            <div>
              <h1 className="text-[34px] font-bold" style={{ fontStretch: '120%' }}>{q.data.name}</h1>
              <p className="text-rebar">{q.data.location}</p>
              {q.data.description && <p className="mt-4 max-w-[60ch] leading-relaxed">{q.data.description}</p>}
              <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div><dt className="text-sm text-rebar">Built so far</dt><dd className="figure text-2xl font-semibold">{q.data.overallProgress}%</dd></div>
                <div><dt className="text-sm text-rebar">Working on</dt><dd className="font-medium">{q.data.currentStage ?? 'Finished'}</dd></div>
                <div><dt className="text-sm text-rebar">Expected handover</dt><dd className="font-medium">{date(q.data.expectedHandoverDate)}</dd></div>
                <div><dt className="text-sm text-rebar">Floors</dt><dd className="font-medium">{q.data.totalFloors}</dd></div>
                <div><dt className="text-sm text-rebar">Status</dt><dd className="font-medium">{label(q.data.status)}</dd></div>
              </dl>
              <p className="mt-8 text-rebar">
                Already a buyer?{' '}
                <Link href="/login" className="font-medium text-ink underline underline-offset-4">
                  Sign in to see your flat, payments and documents
                </Link>
              </p>
            </div>
            {q.data.stages && (
              <div className="rounded-[var(--radius-panel)] border border-line bg-slab p-5">
                <Elevation stages={toStages(q.data.stages)} height={340} />
              </div>
            )}
          </div>
          {q.data.photos.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-semibold">Latest from the site</h2>
              <PhotoGrid photos={q.data.photos.map((p, i) => ({ id: String(i), caption: `Site photo, ${date(p.date)}`, url: p.url, thumbUrl: p.thumbUrl }))} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
