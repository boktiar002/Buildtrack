/** Dates are stored in UTC and shown in Asia/Dhaka (UTC+6, no daylight saving). */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Start of the calendar day in Dhaka, returned as a UTC instant. */
export function startOfDhakaDay(date: Date = new Date()): Date {
  const local = new Date(date.getTime() + DHAKA_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - DHAKA_OFFSET_MS);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDhakaDay(b).getTime() - startOfDhakaDay(a).getTime()) / DAY_MS);
}

export function formatDhakaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
