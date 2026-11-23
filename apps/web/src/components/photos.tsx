'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Photo } from '@/lib/types';
import { cx } from './ui';

/** Thumbnail grid with a full-screen viewer (keyboard: arrows and Escape). */
export function PhotoGrid({ photos, size = 'md', caption }: { photos: Photo[]; size?: 'sm' | 'md'; caption?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, photos.length]);
  if (!photos.length) return null;
  return (
    <>
      <div className={cx('grid gap-2', size === 'sm' ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3')}>
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setOpen(i)} className="group relative overflow-hidden rounded-[var(--radius-control)] bg-concrete-deep" aria-label={`Open photo ${i + 1} of ${photos.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbUrl} alt={p.caption ?? caption ?? `Site photo ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]" />
            {p.analysis?.warnings?.length ? (
              <span className="absolute bottom-1 left-1 rounded bg-overdue px-1.5 text-[12px] text-white">{p.analysis.warnings[0]}</span>
            ) : null}
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,17,23,0.92)] p-4" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open].url} alt={photos[open].caption ?? caption ?? 'Site photo'} className="max-h-[88vh] max-w-full rounded object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close" onClick={() => setOpen(null)}>
            <X className="size-6" />
          </button>
          {photos.length > 1 && (
            <>
              <button className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + photos.length) % photos.length); }}>
                <ChevronLeft className="size-7" />
              </button>
              <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % photos.length); }}>
                <ChevronRight className="size-7" />
              </button>
            </>
          )}
          <p className="figure absolute bottom-4 text-sm text-white/80">
            {open + 1} / {photos.length}
          </p>
        </div>
      )}
    </>
  );
}
