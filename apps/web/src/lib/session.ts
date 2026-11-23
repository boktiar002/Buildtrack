'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError, get, post } from './api';
import type { Me, Role } from './types';

export const HOME: Record<Role, string> = { ORG_ADMIN: '/admin', MANAGER: '/manager', ENGINEER: '/site', BUYER: '/portal' };

export function useMe() {
  return useQuery<Me, ApiError>({ queryKey: ['me'], queryFn: () => get<Me>('/auth/me'), staleTime: 5 * 60_000, retry: false });
}

/** Protects an area: sends people who are signed out to the login page, and people with the wrong role to their own area. */
export function useRequireRole(roles: Role[]) {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.error?.status === 401) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`);
    else if (me.data && !roles.includes(me.data.role)) router.replace(HOME[me.data.role]);
  }, [me.data, me.error, roles, router]);
  useEffect(() => {
    if (me.data) {
      document.documentElement.style.setProperty('--brand-ink', me.data.organization.primaryColor);
      document.documentElement.style.setProperty('--brand-accent', me.data.organization.accentColor);
    }
  }, [me.data]);
  const allowed = !!me.data && roles.includes(me.data.role);
  return { ...me, allowed };
}

export function useSignOut() {
  const qc = useQueryClient();
  return async () => {
    await post('/auth/logout').catch(() => undefined);
    qc.clear();
    location.href = '/login';
  };
}
