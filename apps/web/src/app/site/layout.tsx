'use client';

import { AppShell } from '@/components/shell';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      roles={['ENGINEER', 'ORG_ADMIN', 'MANAGER']}
      variant="top"
      nav={[
        { href: '/site', label: 'My sites' },
        { href: '/site/new', label: 'Post an update' },
      ]}
    >
      {children}
    </AppShell>
  );
}
