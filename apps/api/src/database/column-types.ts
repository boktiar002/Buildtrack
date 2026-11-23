/**
 * Money columns are numeric(14,2) and are read as strings; use common/money.ts
 * for arithmetic. Timestamps are timestamptz (stored in UTC).
 */
export const money = { type: 'numeric' as const, precision: 14, scale: 2 };

export const ts = { type: 'timestamptz' as const };
