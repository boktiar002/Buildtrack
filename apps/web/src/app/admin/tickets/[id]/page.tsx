'use client';

import Link from 'next/link';
import { use } from 'react';
import { TicketThread } from '@/components/tickets';

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="max-w-3xl">
      <Link href="/admin/tickets" className="mb-3 inline-block text-sm text-rebar hover:text-ink">‹ Support</Link>
      <TicketThread id={id} />
    </div>
  );
}
