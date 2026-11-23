'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { get, patch } from '@/lib/api';
import { relative } from '@/lib/format';
import { useRequireRole, useSignOut } from '@/lib/session';
import type { Role } from '@/lib/types';
import { cx, ErrorState, Spinner } from './ui';

export interface NavItem {
  href: string;
  label: string;
  icon?: ReactNode;
  roles?: Role[];
  badge?: number;
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get<{ items: NotificationRow[]; unread: number }>('/notifications'),
    refetchInterval: 60_000,
  });
  const readAll = useMutation({ mutationFn: () => patch('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  const unread = q.data?.unread ?? 0;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-[var(--radius-control)] p-2 text-ink hover:bg-concrete-deep"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="figure absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-overdue px-1 text-[11px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-[var(--radius-panel)] border border-line bg-slab shadow-[0_18px_40px_-18px_rgba(24,33,43,0.4)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button className="text-sm text-rebar hover:text-ink" onClick={() => readAll.mutate()}>
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {q.data?.items.length ? (
              q.data.items.map((n) => (
                <li key={n.id} className={cx('border-b border-line/70 px-4 py-3 last:border-0', !n.readAt && 'bg-brass-soft/40')}>
                  <Link href={n.link ?? '#'} onClick={() => setOpen(false)} className="block">
                    <p className="font-medium">{n.title}</p>
                    <p className="line-clamp-2 text-sm text-rebar">{n.body}</p>
                    <p className="mt-1 text-[13px] text-rebar">{relative(n.createdAt)}</p>
                  </Link>
                </li>
              ))
            ) : (
              <li className="px-4 py-6 text-rebar">You are all caught up.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Brand({ name }: { name: string }) {
  return (
    <span className="flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-horizontal.png" alt={name} className="h-10 w-auto" />
    </span>
  );
}

/** Sidebar layout for staff; top-bar layout for buyers and engineers. */
export function AppShell({ roles, nav, children, variant = 'sidebar' }: { roles: Role[]; nav: NavItem[]; children: ReactNode; variant?: 'sidebar' | 'top' }) {
  const session = useRequireRole(roles);
  const signOut = useSignOut();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
  }, [path]);

  if (session.error && session.error.status !== 401) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState error={session.error} onRetry={() => session.refetch()} />
      </div>
    );
  }
  if (!session.allowed || !session.data) return <div className="mx-auto max-w-lg p-6"><Spinner /></div>;
  const me = session.data;
  const items = nav.filter((n) => !n.roles || n.roles.includes(me.role));
  const active = (href: string) => (href === items[0]?.href ? path === href : path.startsWith(href));

  const links = (
    <nav aria-label="Main" className={variant === 'sidebar' ? 'flex flex-col gap-0.5' : 'flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1'}>
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? 'page' : undefined}
          className={cx(
            'flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[15px] font-medium transition-colors',
            active(n.href) ? 'bg-[var(--brand-ink)] text-white shadow-sm' : 'text-rebar hover:bg-concrete-deep hover:text-ink',
          )}
        >
          {n.icon}
          <span className="flex-1">{n.label}</span>
          {!!n.badge && <span className="figure rounded-full bg-[var(--brand-accent)] px-1.5 text-[12px] font-semibold text-ink">{n.badge}</span>}
        </Link>
      ))}
    </nav>
  );

  const account = (
    <div className="flex items-center gap-2">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-medium">{me.name}</p>
        <p className="text-[13px] text-rebar">{me.organization.name}</p>
      </div>
      <NotificationBell />
      <button onClick={signOut} className="rounded-[var(--radius-control)] p-2 text-rebar hover:bg-concrete-deep hover:text-ink" aria-label="Sign out" title="Sign out">
        <LogOut className="size-5" />
      </button>
    </div>
  );

  if (variant === 'top') {
    return (
      <div className="min-h-screen">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-slab/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
            <Link href={items[0]?.href ?? '/'}>
              <Brand name={me.organization.name} />
            </Link>
            <div className="ml-4 hidden flex-1 sm:block">{links}</div>
            <div className="ml-auto flex items-center gap-1">
              {account}
              <button className="rounded p-2 sm:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
                {menu ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>
          {menu && <div className="border-t border-line px-4 py-2 sm:hidden">{links}</div>}
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print hidden border-r border-line bg-slab lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-line px-5 py-5">
          <Link href={items[0]?.href ?? '/'}>
            <Brand name={me.organization.name} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3">{links}</div>
        <p className="border-t border-line px-5 py-4 text-[12px] text-rebar">Powered by <span className="font-semibold text-ink">BuildTrack</span></p>
      </aside>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 border-t-[3px] border-t-[var(--brand-accent)] items-center gap-3 border-b border-line bg-slab/95 px-4 backdrop-blur lg:px-8">
          <button className="rounded p-2 lg:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
            {menu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="lg:hidden">
            <Brand name={me.organization.name} />
          </span>
          <div className="ml-auto">{account}</div>
        </header>
        {menu && <div className="no-print border-b border-line bg-slab px-3 py-2 lg:hidden">{links}</div>}
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
