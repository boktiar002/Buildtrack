import { MilestoneStatus, RiskLevel } from '../../common/enums';
import { daysBetween } from '../../common/utils/dates';
import { currentStage, overallProgress } from '../projects/progress';

export interface RiskStage {
  id: string;
  name: string;
  sortOrder: number;
  weight: number;
  progress: number;
  status: MilestoneStatus;
  plannedStart: Date | null;
  plannedEnd: Date | null;
}

export interface RiskInput {
  startDate: Date | null;
  originalHandoverDate: Date;
  expectedHandoverDate: Date;
  stages: RiskStage[];
  lastPublishedUpdate: Date | null;
}

export interface RiskFactor {
  label: string;
  detail: string;
  points: number;
}

/** Progress the schedule says should be done by `now` (weighted by stage plans). */
export function plannedProgress(stages: RiskStage[], now: Date): number | null {
  const planned = stages.filter((s) => s.plannedStart && s.plannedEnd);
  if (!planned.length) return null;
  const total = planned.reduce((s, m) => s + m.weight, 0);
  const t = now.getTime();
  const done = planned.reduce((sum, m) => {
    const a = m.plannedStart!.getTime();
    const b = m.plannedEnd!.getTime();
    const frac = t >= b ? 1 : t <= a ? 0 : (t - a) / (b - a);
    return sum + m.weight * frac;
  }, 0);
  return Math.round((done / total) * 1000) / 10;
}

/**
 * AI feature 4 (scoring part): a transparent delay-risk score from 0 to 100.
 * Every point comes from a named factor, so managers can see exactly why a
 * project is flagged. The AI only explains these factors in plain language.
 */
export function computeRisk(input: RiskInput, now = new Date()) {
  const factors: RiskFactor[] = [];
  const actual = overallProgress(input.stages);
  const expected = plannedProgress(input.stages, now);
  const current = currentStage(input.stages);

  if (expected !== null && expected - actual > 2) {
    const gap = Math.round((expected - actual) * 10) / 10;
    factors.push({
      label: 'Behind schedule',
      detail: `${actual}% done, but the plan expected about ${expected}% by today (${gap} points behind).`,
      points: Math.min(40, Math.round(gap * 1.5)),
    });
  }

  if (current?.plannedEnd && current.plannedEnd < now) {
    const late = daysBetween(current.plannedEnd, now);
    factors.push({
      label: 'Current stage overdue',
      detail: `"${current.name}" was planned to finish ${late} days ago and is at ${current.progress}%.`,
      points: Math.min(25, 10 + Math.floor(late / 10)),
    });
  }

  const quiet = input.lastPublishedUpdate ? daysBetween(input.lastPublishedUpdate, now) : null;
  if (actual < 100 && (quiet === null || quiet > 21)) {
    factors.push({
      label: 'No recent site updates',
      detail: quiet === null ? 'No progress update has been published yet.' : `The last published update was ${quiet} days ago.`,
      points: quiet === null ? 8 : Math.min(15, 5 + Math.floor((quiet - 21) / 7)),
    });
  }

  const delayed = daysBetween(input.originalHandoverDate, input.expectedHandoverDate);
  if (delayed > 0) {
    factors.push({
      label: 'Handover already moved',
      detail: `The expected handover is ${delayed} days later than originally promised.`,
      points: Math.min(15, 5 + Math.floor(delayed / 30)),
    });
  }

  // Pace forecast: at the average speed so far, when would the building be finished?
  if (input.startDate && actual > 5 && actual < 100) {
    const elapsed = Math.max(1, daysBetween(input.startDate, now));
    const perDay = actual / elapsed;
    const remainingDays = Math.ceil((100 - actual) / perDay);
    const forecast = new Date(now.getTime() + remainingDays * 86_400_000);
    const late = daysBetween(input.expectedHandoverDate, forecast);
    if (late > 30) {
      factors.push({
        label: 'Pace forecast',
        detail: `At the current pace, work would finish around ${forecast.toISOString().slice(0, 10)}, about ${late} days after the expected handover.`,
        points: Math.min(20, 5 + Math.floor(late / 30) * 3),
      });
    }
  }

  const score = Math.min(
    100,
    factors.reduce((s, f) => s + f.points, 0),
  );
  const level = score >= 60 ? RiskLevel.HIGH : score >= 30 ? RiskLevel.MEDIUM : RiskLevel.LOW;
  return { score, level, factors, actual, expected, currentStageId: current?.id ?? null };
}
