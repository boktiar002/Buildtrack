import type { Stage } from './types';

/** The developer whose public pages this site shows. */
export const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG ?? 'pipra';

export interface PublicProject {
  name: string;
  slug: string;
  location: string;
  description: string | null;
  status: string;
  totalFloors: number;
  overallProgress: number;
  currentStage: string | null;
  expectedHandoverDate: string;
  coverImageUrl: string | null;
  stages?: Array<{ name: string; status: Stage['status']; progress: number }>;
}

/** Public stage list has no ids or weights; give it what the elevation drawing needs. */
export function toStages(s: NonNullable<PublicProject['stages']>): Stage[] {
  return s.map((x, i) => ({ ...x, id: String(i), sortOrder: i + 1, weight: 1, plannedStart: null, plannedEnd: null, actualStart: null, completedAt: null }));
}

