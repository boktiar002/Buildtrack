'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageCircleQuestion } from 'lucide-react';
import type React from 'react';
import Link from 'next/link';
import { Elevation } from '@/components/elevation';
import { Badge, Empty, ErrorState, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';
import { date, relative, taka } from '@/lib/format';
import { useMe } from '@/lib/session';
import type { ProjectDetail, PurchaseDetail, Update } from '@/lib/types';

/** The building is drawn on the dark board, so the elevation's colours are swapped for light-on-dark ones. */
const ON_DARK = {
  '--color-line': 'rgba(255,255,255,0.28)',
  '--color-concrete-deep': 'rgba(255,255,255,0.09)',
  '--color-rebar': 'rgba(255,255,255,0.65)',
} as React.CSSProperties;

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 sm:px-7 sm:py-5">
      <dt className="text-[14px] text-rebar">{title}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function FlatCard({ p }: { p: PurchaseDetail }) {
  const project = useQuery({ queryKey: ['project', p.unit.projectId], queryFn: () => get<ProjectDetail>(`/projects/${p.unit.projectId}`) });
  const updates = useQuery({ queryKey: ['updates', p.unit.projectId], queryFn: () => get<Update[]>(`/projects/${p.unit.projectId}/updates`) });
  const pr = project.data;
  const latest = updates.data?.[0];
  const next = p.nextInstallment;

  return (
    <article className="overflow-hidden rounded-[22px] border border-line bg-slab shadow-[0_20px_50px_-28px_rgba(31,43,51,0.5)]">
      <div className="relative grid gap-6 bg-[var(--brand-ink)] p-6 text-white sm:p-8 md:grid-cols-[minmax(0,1fr)_230px]">
        <span className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-[var(--brand-accent)] opacity-[0.16]" aria-hidden />
        <div className="relative">
          <p className="text-[15px] text-white/70">
            {p.unit.project.name}, {p.unit.project.location}
          </p>
          <h2 className="mt-1 text-[30px] font-extrabold">Flat {p.unit.code}</h2>

          {pr ? (
            <>
              <p className="figure mt-6 text-[88px] font-extrabold leading-[0.9] sm:text-[104px]">
                {pr.overallProgress}
                <span className="ml-1 text-[40px] font-bold text-[var(--brand-accent)]">%</span>
              </p>
              <p className="mt-3 max-w-[34ch] text-[17px] leading-snug text-white/75">
                of your building is built. Now working on <span className="font-semibold text-white">{pr.currentStage?.name ?? 'final handover'}</span>.
              </p>
              <div className="mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pr.overallProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
                <div className="h-full rounded-full bg-[var(--brand-accent)] transition-[width] duration-700" style={{ width: `${pr.overallProgress}%` }} />
              </div>
            </>
          ) : (
            <Skeleton className="mt-6 h-32 w-72 !bg-white/10" />
          )}

          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link
              href={`/portal/units/${p.id}`}
              className="inline-flex h-11 items-center rounded-[var(--radius-control)] bg-[var(--brand-accent)] px-5 font-semibold text-[#1b2227] transition hover:brightness-110 active:translate-y-px"
            >
              See progress, payments and documents
            </Link>
            <Link
              href={`/portal/assistant?purchase=${p.id}`}
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-white/30 px-5 font-semibold text-white transition hover:bg-white/10 active:translate-y-px"
            >
              <MessageCircleQuestion className="size-4" aria-hidden /> Ask a question
            </Link>
          </div>
        </div>
        <div className="relative order-first mx-auto w-44 md:order-none md:w-full" style={ON_DARK}>
          {pr ? <Elevation stages={pr.milestones} height={300} /> : project.error ? <ErrorState error={project.error} /> : <Skeleton className="h-64 !bg-white/10" />}
        </div>
      </div>

      <dl className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Fact title="Next payment">
          {next ? (
            <>
              <span className="figure text-[22px] font-bold">{taka(Number(next.amount) - Number(next.paidAmount))}</span> <Badge status={next.status} />
              <span className="mt-0.5 block text-[14px] text-rebar">
                {next.label}
                {next.dueDate ? `, due ${date(next.dueDate)}` : next.milestone ? (next.label.includes(next.milestone.name) ? ', due when that stage is finished' : `, due after "${next.milestone.name}"`) : ''}
              </span>
            </>
          ) : (
            <span className="text-[17px] font-semibold text-done">Nothing to pay right now</span>
          )}
        </Fact>
        <Fact title="Expected handover">
          <span className="text-[22px] font-bold">{date(p.unit.project.expectedHandoverDate)}</span>
          {pr && pr.delayDays > 0 && <span className="mt-0.5 block text-[14px] text-overdue">{pr.delayDays} days later than first promised</span>}
        </Fact>
        <Fact title={latest ? `Latest from the site, ${relative(latest.approvedAt ?? latest.createdAt)}` : 'Latest from the site'}>
          {latest ? <span className="text-[17px] font-semibold leading-snug">{latest.title}</span> : <span className="text-rebar">No updates published yet.</span>}
        </Fact>
      </dl>
    </article>
  );
}

export default function PortalHome() {
  const me = useMe();
  const q = useQuery({ queryKey: ['my-purchases'], queryFn: () => get<PurchaseDetail[]>('/my/purchases') });
  return (
    <div>
      <h1 className="mb-1 text-[30px] font-extrabold sm:text-[36px]">Hello, {me.data?.name.split(' ')[0]}</h1>
      <p className="mb-7 text-[16px] text-rebar">Here is where your home stands today.</p>
      {q.isLoading && <Skeleton className="h-96" />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <Empty title="No flat is linked to your account yet">
          When the developer records your booking, your flat will appear here. If you have already booked, contact the sales office.
        </Empty>
      )}
      <div className="flex flex-col gap-6">
        {q.data?.map((p) => (
          <FlatCard key={p.id} p={p} />
        ))}
      </div>
      {q.data && q.data.length > 0 && (
        <p className="mt-6 text-sm text-rebar">
          Questions about your flat? <Link href="/portal/support" className="font-medium text-ink underline underline-offset-4">Contact the developer</Link>
        </p>
      )}
    </div>
  );
}
