'use client';

import { Check } from 'lucide-react';
import { date } from '@/lib/format';
import type { Stage } from '@/lib/types';
import { cx } from './ui';

/** Construction stages in order: finished, current and still to come. */
export function StageTimeline({ stages, compact }: { stages: Stage[]; compact?: boolean }) {
  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentId = sorted.find((s) => s.status !== 'COMPLETED')?.id;
  return (
    <ol className="flex flex-col">
      {sorted.map((s, i) => {
        const done = s.status === 'COMPLETED';
        const current = s.id === currentId;
        return (
          <li key={s.id} className="grid grid-cols-[24px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cx(
                  'mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2',
                  done && 'border-done bg-done text-white',
                  current && 'border-[var(--brand-accent)] bg-brass-soft',
                  !done && !current && 'border-line bg-slab',
                )}
                aria-hidden
              >
                {done && <Check className="size-3" strokeWidth={3} />}
              </span>
              {i < sorted.length - 1 && <span className={cx('w-0.5 flex-1', done ? 'bg-done/50' : 'bg-line')} aria-hidden />}
            </div>
            <div className={cx('pb-3', compact && 'pb-2')}>
              <p className={cx('font-medium', !done && !current && 'text-rebar')}>
                {s.name}
                {current && <span className="figure ml-2 text-[#7d6736]">{s.progress}%</span>}
              </p>
              <p className="text-[13px] text-rebar">
                {done ? `Finished ${date(s.completedAt)}` : current ? (s.plannedEnd ? `Planned to finish ${date(s.plannedEnd)}` : 'In progress') : s.plannedEnd ? `Planned ${date(s.plannedEnd)}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
