'use client';

import type { Stage } from '@/lib/types';

/**
 * The building elevation: BuildTrack's signature view.
 * Draws the building side-on. Structure (foundation, floor slabs, roof) is
 * shown as floors that fill in; finishing work (brick, plumbing, plaster,
 * lifts, tiles, paint) is shown as the facade filling in afterwards.
 */
export function Elevation({ stages, height = 260, animate = true, label }: { stages: Stage[]; height?: number; animate?: boolean; label?: string }) {
  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const floors = sorted.filter((s) => /^Floor \d+ slab$/.test(s.name));
  const ground = sorted.filter((s) => s.sortOrder < (floors[0]?.sortOrder ?? 0));
  const roof = sorted.find((s) => s.name === 'Roof slab');
  const finishing = sorted.filter((s) => s.sortOrder > (roof?.sortOrder ?? floors[floors.length - 1]?.sortOrder ?? 0));

  const groundProgress = ground.length ? ground.reduce((s, m) => s + m.progress, 0) / ground.length : 0;
  const finishWeight = finishing.reduce((s, m) => s + m.weight, 0) || 1;
  const finishProgress = finishing.reduce((s, m) => s + m.weight * m.progress, 0) / finishWeight;

  const rows = [...floors].reverse();
  const n = Math.max(1, rows.length + 2);
  const rowH = Math.max(10, Math.min(30, (height - 30) / n));
  const totalH = rowH * n + 24;
  const W = 220;
  const bx = 40;
  const bw = 140;

  const fill = (p: number) => (p >= 100 ? 'var(--color-done)' : p > 0 ? 'var(--brand-accent)' : 'transparent');
  const desc =
    label ??
    `Building elevation: ${floors.filter((f) => f.status === 'COMPLETED').length} of ${floors.length} floor slabs cast, finishing ${Math.round(finishProgress)}% done.`;

  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ maxHeight: height }} role="img" aria-label={desc}>
      {/* ground line */}
      <line x1="6" x2={W - 6} y1={totalH - 14} y2={totalH - 14} stroke="var(--color-rebar)" strokeWidth="1.5" />
      {/* foundation */}
      <g>
        <rect x={bx} y={totalH - 14} width={bw} height={10} fill="var(--color-concrete-deep)" />
        <rect x={bx} y={totalH - 14} width={(bw * groundProgress) / 100} height={10} fill={fill(groundProgress)} />
      </g>
      {/* floors, bottom up */}
      {rows.map((f, i) => {
        const y = totalH - 14 - (rows.length - i) * rowH;
        const p = f.progress;
        return (
          <g key={f.id}>
            <title>{`${f.name}: ${p}%`}</title>
            <rect x={bx} y={y + 1.5} width={bw} height={rowH - 3} rx="1.5" fill="none" stroke="var(--color-line)" strokeDasharray={p ? '0' : '3 3'} />
            {p > 0 && (
              <rect
                className={animate ? 'floor-rise' : undefined}
                style={animate ? { animationDelay: `${(rows.length - i) * 45}ms` } : undefined}
                x={bx}
                y={y + 1.5}
                width={(bw * p) / 100}
                height={rowH - 3}
                rx="1.5"
                fill={fill(p)}
              />
            )}
            {/* facade windows appear as finishing progresses */}
            {p >= 100 &&
              Array.from({ length: 4 }, (_, k) => (
                <rect
                  key={k}
                  x={bx + 14 + k * 32}
                  y={y + rowH * 0.3}
                  width={18}
                  height={Math.max(3, rowH * 0.38)}
                  fill="white"
                  opacity={finishProgress > (k + 1) * 20 ? 0.95 : 0.35}
                />
              ))}
          </g>
        );
      })}
      {/* roof */}
      {roof && (
        <g>
          <title>{`${roof.name}: ${roof.progress}%`}</title>
          <rect x={bx - 6} y={totalH - 14 - (rows.length + 1) * rowH + rowH * 0.55} width={bw + 12} height={rowH * 0.4} rx="1.5" fill={roof.progress ? fill(roof.progress) : 'none'} stroke="var(--color-line)" strokeDasharray={roof.progress ? '0' : '3 3'} />
        </g>
      )}
      {/* floor numbers on the side */}
      {rows.map((f, i) => {
        const y = totalH - 14 - (rows.length - i) * rowH;
        const num = f.name.match(/\d+/)?.[0];
        return rowH >= 14 ? (
          <text key={`l${f.id}`} x={bx - 8} y={y + rowH / 2 + 4} textAnchor="end" fontSize="10" fill="var(--color-rebar)" fontFamily="var(--font-display)">
            {num}
          </text>
        ) : null;
      })}
    </svg>
  );
}
