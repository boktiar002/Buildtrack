'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Input, PageHeader, Panel, useErrorToast, useToast } from '@/components/ui';
import { patch, post } from '@/lib/api';
import { label } from '@/lib/format';
import { useMe } from '@/lib/session';
import type { Me } from '@/lib/types';

export function ProfileForms() {
  const me = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  useEffect(() => {
    if (me.data) setProfile({ name: me.data.name, phone: me.data.phone ?? '' });
  }, [me.data]);
  const save = useMutation({
    mutationFn: () => patch<Me>('/auth/me', { name: profile.name, phone: profile.phone || undefined }),
    onSuccess: (m) => { qc.setQueryData(['me'], m); toast('Profile saved'); },
    onError,
  });
  const change = useMutation({
    mutationFn: () => post('/auth/change-password', pw),
    onSuccess: () => { setPw({ currentPassword: '', newPassword: '' }); toast('Password changed'); },
    onError,
  });
  return (
    <div className="grid max-w-3xl gap-6 md:grid-cols-2">
      <Panel title="Your details">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="flex flex-col gap-4">
          <Input label="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <Input label="Mobile number" hint="Used for payment reminders by SMS." value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          <p className="text-sm text-rebar">{me.data?.email} · {label(me.data?.role)}</p>
          <div><Button type="submit" loading={save.isPending}>Save details</Button></div>
        </form>
      </Panel>
      <Panel title="Change password">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); change.mutate(); }} className="flex flex-col gap-4">
          <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          <div><Button type="submit" loading={change.isPending} disabled={!pw.currentPassword || pw.newPassword.length < 8}>Change password</Button></div>
        </form>
      </Panel>
    </div>
  );
}

