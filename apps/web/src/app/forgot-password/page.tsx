'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { post } from '@/lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-[28px] font-semibold">Reset your password</h1>
        <div className="mt-6 rounded-[var(--radius-panel)] border border-line bg-slab p-5">
          {sent ? (
            <p>If an account exists for <strong>{email}</strong>, we have sent a link to set a new password. It works for one hour.</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
              <Button type="submit" loading={busy} disabled={!email}>Send reset link</Button>
            </form>
          )}
        </div>
        <Link href="/login" className="mt-4 inline-block text-sm text-rebar hover:text-ink">‹ Back to sign in</Link>
      </div>
    </div>
  );
}
