'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { post } from '@/lib/api';
import type { Me } from '@/lib/types';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PHONE_RULE = /^\+?8801[3-9]\d{8}$/;

export default function RegisterPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const problems = {
    name: form.name.trim().length < 2 ? 'Enter your full name.' : null,
    email: /\S+@\S+\.\S+/.test(form.email) ? null : 'Enter a valid email address.',
    phone:
      form.phone && !PHONE_RULE.test(form.phone.replace(/[\s-]/g, '')) ? 'Use a Bangladeshi mobile number, for example 01712345678.' : null,
    password: PASSWORD_RULE.test(form.password) ? null : 'At least 8 characters, with a letter and a number.',
  };
  const valid = !Object.values(problems).some(Boolean);
  const show = (k: keyof typeof problems) => (touched[k] ? (problems[k] ?? undefined) : undefined);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, password: true });
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const raw = form.phone.replace(/[\s-]/g, '');
      const phone = raw ? (raw.startsWith('+') ? raw : `+88${raw.replace(/^88/, '')}`) : undefined;
      const { user } = await post<{ user: Me }>('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone,
      });
      qc.setQueryData(['me'], user);
      router.replace('/portal');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label="Pipra Estate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.png" alt="Pipra Estate" className="h-11 w-auto" />
        </Link>
        <h1 className="mt-6 text-[28px] font-semibold">Create a buyer account</h1>
        <p className="mb-6 mt-1 text-rebar">
          Use the email you gave the developer. When they record your booking, your flat appears here automatically.
        </p>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-line bg-slab p-5">
          <Input
            label="Full name"
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
            onBlur={blur('name')}
            error={show('name')}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            onBlur={blur('email')}
            error={show('email')}
          />
          <Input
            label="Mobile (optional, for payment reminders by SMS)"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01712345678"
            value={form.phone}
            onChange={set('phone')}
            onBlur={blur('phone')}
            error={show('phone')}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            onBlur={blur('password')}
            error={show('password')}
            hint={touched.password ? undefined : 'At least 8 characters, with a letter and a number.'}
          />
          {error && (
            <p className="rounded-[var(--radius-control)] bg-overdue-soft px-3 py-2 text-[15px] text-overdue" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" loading={busy}>
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-rebar">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-ink underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
