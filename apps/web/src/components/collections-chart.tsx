'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { taka } from '@/lib/format';

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short' });

/** Kept in its own file so the charting library is downloaded only on the admin dashboard. */
export default function CollectionsChart({ data }: { data: Array<{ month: string; total: string }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.map((m) => ({ month: monthName(m.month), total: Number(m.total) }))} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="#e3dac7" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} tickFormatter={(v: number) => (v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : String(v))} />
        <Tooltip formatter={(v: number) => [taka(v), 'Collected']} cursor={{ fill: 'rgba(166,139,85,0.12)' }} />
        <Bar isAnimationActive={false} dataKey="total" fill="var(--brand-ink)" radius={[3, 3, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
