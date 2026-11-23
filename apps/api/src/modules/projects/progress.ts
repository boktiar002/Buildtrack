import { MilestoneStatus } from '../../common/enums';

export interface WeightedStage {
  name: string;
  sortOrder: number;
  weight: number;
  progress: number;
  status: MilestoneStatus;
}

/** Overall progress = Σ(weight × progress) ÷ Σ(weight), rounded to one decimal. */
export function overallProgress(stages: Pick<WeightedStage, 'weight' | 'progress'>[]): number {
  const totalWeight = stages.reduce((s, m) => s + m.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = stages.reduce((s, m) => s + m.weight * m.progress, 0);
  return Math.round((weighted / totalWeight) * 10) / 10;
}

/** The stage currently being worked on: first not-completed stage in order. */
export function currentStage<T extends Pick<WeightedStage, 'sortOrder' | 'status'>>(stages: T[]): T | null {
  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((m) => m.status !== MilestoneStatus.COMPLETED) ?? null;
}

/** Status a stage should have for a given progress value (rule R1). */
export function statusForProgress(progress: number): MilestoneStatus {
  if (progress >= 100) return MilestoneStatus.COMPLETED;
  if (progress > 0) return MilestoneStatus.IN_PROGRESS;
  return MilestoneStatus.NOT_STARTED;
}

/** Splits `total` points in proportion to `weights` (largest remainder), each at least 1. */
function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map((r) => Math.max(1, Math.floor(r)));
  let diff = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; diff > 0; k++, diff--) out[order[k % order.length].i]++;
  for (let k = order.length - 1; diff < 0; k--) {
    const idx = order[((k % order.length) + order.length) % order.length].i;
    if (out[idx] > 1) {
      out[idx]--;
      diff++;
    }
  }
  return out;
}

/**
 * Standard construction stages for a building with `floors` floors.
 * Weights always add up to exactly 100: floor slabs share 30 points (or 1
 * point each for very tall buildings) and the other stages share the rest
 * in fixed proportions, using the largest-remainder method.
 * If start and end dates are given, planned dates are spread by weight.
 */
export function stageTemplate(floors: number, start?: Date | null, end?: Date | null) {
  if (!Number.isInteger(floors) || floors < 1 || floors > 60) throw new Error('floors must be between 1 and 60');
  const floorWeights = floors <= 30 ? apportion(new Array(floors).fill(1), 30) : new Array(floors).fill(1);
  const before = ['Land development & piling', 'Foundation', 'Basement / ground floor structure'];
  const after = [
    'Roof slab',
    'Brick work',
    'Plumbing & electrical',
    'Plaster',
    'Lift & generator installation',
    'Tiles & fittings',
    'Painting',
    'Final finishing & handover inspection',
  ];
  const other = apportion([6, 7, 5, 4, 10, 10, 8, 5, 7, 4, 4], 100 - floorWeights.reduce((a, b) => a + b, 0));

  const stages: { name: string; weight: number }[] = [
    ...before.map((name, i) => ({ name, weight: other[i] })),
    ...floorWeights.map((weight, i) => ({ name: `Floor ${i + 1} slab`, weight })),
    ...after.map((name, i) => ({ name, weight: other[before.length + i] })),
  ];

  const total = stages.reduce((s, m) => s + m.weight, 0);
  const span = start && end && end > start ? end.getTime() - start.getTime() : null;
  let cursor = start?.getTime() ?? 0;

  return stages.map((s, i) => {
    let plannedStart: Date | null = null;
    let plannedEnd: Date | null = null;
    if (span !== null) {
      plannedStart = new Date(cursor);
      cursor += Math.round((span * s.weight) / total);
      plannedEnd = new Date(i === stages.length - 1 ? end!.getTime() : cursor);
    }
    return { ...s, sortOrder: i + 1, plannedStart, plannedEnd };
  });
}
