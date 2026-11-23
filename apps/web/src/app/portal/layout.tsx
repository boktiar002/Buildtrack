'use client';

import { AppShell } from '@/components/shell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      roles={['BUYER']}
      variant="top"
      nav={[
        { href: '/portal', label: 'My flat' },
        { href: '/portal/updates', label: 'Site updates' },
        { href: '/portal/assistant', label: 'Ask a question' },
        { href: '/portal/support', label: 'Support' },
        { href: '/portal/profile', label: 'Profile' },
      ]}
    >
      {children}
    </AppShell>
  );
}
