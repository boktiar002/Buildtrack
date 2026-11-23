/**
 * Money is never handled as floating point.
 * Postgres numeric(14,2) values arrive as strings ("1250000.00"); we convert
 * them to integer poisha (1 Taka = 100 poisha) for all arithmetic, then back.
 */
export type Poisha = number;

export function toPoisha(value: string | number | null | undefined): Poisha {
  if (value === null || value === undefined || value === '') return 0;
  const s = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid money value: ${value}`);
  const negative = s.startsWith('-');
  const [whole, frac = ''] = s.replace('-', '').split('.');
  const p = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(p)) throw new Error(`Money value out of range: ${value}`);
  return negative ? -p : p;
}

export function fromPoisha(p: Poisha): string {
  const negative = p < 0;
  const abs = Math.abs(p);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${s}` : s;
}

/** Bangladeshi lakh grouping: 1250000 -> "12,50,000". */
export function formatTaka(value: string | number): string {
  const p = toPoisha(value);
  const whole = Math.floor(Math.abs(p) / 100).toString();
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  const frac = Math.abs(p) % 100;
  return `${p < 0 ? '-' : ''}Tk ${grouped}${frac ? '.' + String(frac).padStart(2, '0') : ''}`;
}
