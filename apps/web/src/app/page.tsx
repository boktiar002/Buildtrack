'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Elevation } from '@/components/elevation';
import { ErrorState, ProgressBar, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';
import { date, label } from '@/lib/format';
import { ORG_SLUG, PublicProject, toStages } from '@/lib/public';

export default function Landing() {
  const q = useQuery({
    queryKey: ['public', ORG_SLUG],
    queryFn: () => get<{ organization: { name: string }; projects: PublicProject[] }>(`/public/${ORG_SLUG}`),
  });
  const lead = q.data?.projects.find((p) => p.status === 'UNDER_CONSTRUCTION') ?? q.data?.projects[0];
  const detail = useQuery({
    queryKey: ['public', ORG_SLUG, lead?.slug],
    enabled: !!lead,
    queryFn: () => get<PublicProject>(`/public/${ORG_SLUG}/projects/${lead!.slug}`),
  });
  const name = q.data?.organization.name ?? 'BuildTrack';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-slab/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label={name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horizontal.png" alt={name} className="h-11 w-auto" />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/register" className="hidden rounded-[var(--radius-control)] px-4 py-2 text-[15px] font-medium text-rebar hover:text-ink sm:block">
              Create account
            </Link>
            <Link href="/login" className="rounded-[var(--radius-control)] bg-[var(--brand-ink)] px-5 py-2 text-[15px] font-medium text-white hover:bg-[#3b4b56]">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div className="pb-4">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brass-soft px-3 py-1 text-[13px] font-semibold uppercase tracking-wider text-[#7d6736]">
            <span className="size-1.5 rounded-full bg-brass" /> Construction transparency portal
          </p>
          <h1 className="max-w-[16ch] text-[40px] font-extrabold leading-[1.05] sm:text-[56px]">
            Watch your home rise, floor by floor.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-rebar">
            Every buyer at {name} gets a private page with dated site photos, construction progress, their payment schedule and every
            change to the handover date, with the reason.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-[var(--radius-control)] bg-[var(--brand-ink)] px-5 py-3 font-medium text-white hover:bg-[#3b4b56]">
              Sign in to your flat
            </Link>
            {lead && (
              <Link href={`/projects/${lead.slug}`} className="rounded-[var(--radius-control)] border border-line bg-slab px-5 py-3 font-medium hover:border-rebar">
                See {lead.name}
              </Link>
            )}
          </div>
          <p className="mt-4 text-[15px] text-rebar">
            Booked a flat but no account yet?{' '}
            <Link href="/register" className="font-medium text-ink underline underline-offset-4">
              Create one in a minute
            </Link>
          </p>
        </div>
        <div className="rounded-[18px] border border-line bg-slab p-6 shadow-[0_24px_60px_-28px_rgba(31,43,51,0.35)]">
          {detail.data?.stages ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-semibold">{detail.data.name}</p>
                  <p className="text-sm text-rebar">{detail.data.location}</p>
                </div>
                <p className="figure text-3xl font-semibold">{detail.data.overallProgress}%</p>
              </div>
              <div className="mt-4">
                <Elevation stages={toStages(detail.data.stages)} height={300} />
              </div>
              <p className="mt-3 text-sm text-rebar">
                Now: {detail.data.currentStage ?? 'Finished'} · Expected handover {date(detail.data.expectedHandoverDate)}
              </p>
            </>
          ) : q.error ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <Skeleton className="h-[340px]" />
          )}
        </div>
      </section>

      <section className="border-t border-line bg-slab">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-semibold">Our projects</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {q.isLoading && <Skeleton className="h-64" />}
            {q.data?.projects.map((p) => (
              <Link key={p.slug} href={`/projects/${p.slug}`} className="group overflow-hidden rounded-[var(--radius-panel)] border border-line bg-concrete/40 hover:border-rebar">
                {p.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImageUrl} loading="lazy" decoding="async" alt={`${p.name} construction site`} className="aspect-[16/9] w-full object-cover" />
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{p.name}</p>
                      <p className="text-sm text-rebar">{p.location}</p>
                    </div>
                    <span className="text-sm text-rebar">{label(p.status)}</span>
                  </div>
                  <ProgressBar value={p.overallProgress} className="mt-4" labelText={`${p.name} progress`} />
                  <p className="mt-2 text-sm text-rebar">
                    <span className="figure font-semibold text-ink">{p.overallProgress}%</span> built · handover {date(p.expectedHandoverDate)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-semibold">What buyers see</h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          {[
            ['Site photos with dates', 'Our engineers post photos from the site. An AI check suggests the construction stage, and a manager approves every update before you see it.'],
            ['Payments tied to real work', 'Installments linked to a construction stage only become due when that stage is finished. Every payment gets a numbered receipt.'],
            ['An honest handover date', 'If the handover date moves, you see the old date, the new date and the reason. The history can never be quietly edited.'],
          ].map(([t, d]) => (
            <div key={t}>
              <dt className="font-semibold">{t}</dt>
              <dd className="mt-1.5 text-rebar">{d}</dd>
            </div>
          ))}
        </dl>
      </section>
      <footer className="border-t border-line bg-slab px-4 py-8 text-center text-sm text-rebar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt={name} className="mx-auto mb-3 h-16 w-auto opacity-90" />
        © {new Date().getFullYear()} {name} · Construction progress by BuildTrack
      </footer>
    </div>
  );
}
