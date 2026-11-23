'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { post } from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && password !== confirm;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!token) return <p>This link is missing its code. Ask for a new link from the sign-in page.</p>;
  if (done) return <p>Your password is set. <Link href="/login" className="font-medium underline">Sign in</Link></p>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input label="Type it again" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? 'The passwords do not match.' : error} />
      <Button type="submit" loading={busy} disabled={password.length < 8 || password !== confirm}>Set password</Button>
    </form>
  );
}

export default function ResetPassword() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-[28px] font-semibold">Set a new password</h1>
        <div className="mt-6 rounded-[var(--radius-panel)] border border-line bg-slab p-5">
          <Suspense><ResetForm /></Suspense>
        </div>
      </div>
    </div>
  );
}
