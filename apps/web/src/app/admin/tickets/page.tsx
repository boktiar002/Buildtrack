'use client';

import { useState } from 'react';
import { TicketList } from '@/components/tickets';
import { PageHeader, Panel, Tabs } from '@/components/ui';

export default function Tickets() {
  const [status, setStatus] = useState<'OPEN' | 'ANSWERED' | 'CLOSED' | 'ALL'>('OPEN');
  return (
    <div>
      <PageHeader title="Support" subtitle="Questions from buyers, including those passed on by the AI assistant." />
      <Tabs value={status} onChange={setStatus} tabs={[{ id: 'OPEN', label: 'Waiting for reply' }, { id: 'ANSWERED', label: 'Answered' }, { id: 'CLOSED', label: 'Closed' }, { id: 'ALL', label: 'All' }]} />
      <Panel flush><TicketList base="/admin/tickets" staff status={status === 'ALL' ? undefined : status} /></Panel>
    </div>
  );
}
