'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, CircleUserRound, ClipboardCheck, FileSpreadsheet, History, LayoutDashboard, LifeBuoy, Settings, Sparkles, UserCog, Users, Wallet } from 'lucide-react';
import { AppShell } from '@/components/shell';
import { get } from '@/lib/api';
import { useMe } from '@/lib/session';

const icon = 'size-[18px] shrink-0';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const staff = me.data?.role === 'ORG_ADMIN' || me.data?.role === 'MANAGER';
  const router = useRouter();
  const path = usePathname();
  // Managers and admins share these pages; managers see them under /manager.
  const base = me.data?.role === 'MANAGER' ? '/manager' : '/admin';
  useEffect(() => {
    if (me.data && !path.startsWith(base)) router.replace(base + path.replace(/^\/(admin|manager)/, '') + location.search);
  }, [me.data, path, base, router]);
  const queue = useQuery({ queryKey: ['review-queue'], enabled: staff, queryFn: () => get<unknown[]>('/updates/review-queue'), refetchInterval: 60_000 });
  return (
    <AppShell
      roles={['ORG_ADMIN', 'MANAGER']}
      nav={[
        { href: `${base}`, label: 'Dashboard', icon: <LayoutDashboard className={icon} /> },
        { href: `${base}/projects`, label: 'Projects', icon: <Building2 className={icon} /> },
        { href: `${base}/reviews`, label: 'Updates to review', icon: <ClipboardCheck className={icon} />, badge: queue.data?.length },
        { href: `${base}/buyers`, label: 'Buyers', icon: <Users className={icon} /> },
        { href: `${base}/payments`, label: 'Payments', icon: <Wallet className={icon} /> },
        { href: `${base}/tickets`, label: 'Support', icon: <LifeBuoy className={icon} /> },
        { href: `${base}/reports`, label: 'Reports', icon: <FileSpreadsheet className={icon} /> },
        { href: `${base}/ai`, label: 'AI insights', icon: <Sparkles className={icon} /> },
        { href: `${base}/users`, label: 'Team', icon: <UserCog className={icon} />, roles: ['ORG_ADMIN'] },
        { href: `${base}/audit`, label: 'Activity log', icon: <History className={icon} />, roles: ['ORG_ADMIN'] },
        { href: `${base}/settings`, label: 'Settings', icon: <Settings className={icon} />, roles: ['ORG_ADMIN'] },
        { href: `${base}/profile`, label: 'Profile', icon: <CircleUserRound className={icon} /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
