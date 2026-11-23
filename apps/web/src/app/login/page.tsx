'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { Button } from '@/components/ui';
import { post } from '@/lib/api';
import { HOME } from '@/lib/session';
import type { Me } from '@/lib/types';

const DEMO = [
  { label: 'Buyer', email: 'buyer1@pipra.test' },
  { label: 'Engineer', email: 'engineer@pipra.test' },
  { label: 'Manager', email: 'manager@pipra.test' },
  { label: 'Admin', email: 'admin@pipra.test' },
];

const FIELD =
  'h-12 w-full rounded-[10px] border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-rebar/50 hover:border-rebar/40 focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent)]/20';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Read the real field values: browser autofill does not always trigger onChange.
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user } = await post<{ user: Me }>('/auth/login', { email, password });
      qc.setQueryData(['me'], user);
      const next = params.get('next');
      // Only follow internal links, never another website.
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : HOME[user.role]);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
          Email address
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="password" className="text-sm font-semibold text-ink">
            Password
          </label>
          <Link href="/forgot-password" className="text-sm text-rebar underline-offset-4 hover:text-ink hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${FIELD} pr-16`} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-rebar hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--brand-accent)]"
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {error && (
        <p className="rounded-[10px] border border-overdue/20 bg-overdue-soft px-4 py-3 text-[15px] text-overdue" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={busy}>
        Sign in
      </Button>

      {process.env.NODE_ENV !== 'production' && (
        <fieldset className="mt-1 border-t border-line pt-5">
          <legend className="pr-3 text-[13px] text-rebar">Try a demo account</legend>
          <div className="flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword('Demo@12345');
                }}
                className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-[var(--brand-accent)] hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-[var(--brand-accent)]"
              >
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </form>
  );
}

/** A residential tower under construction, with a crane. */
function Tower() {
  const built = 8;
  const floors = 10;
  const top = 350;
  const h = 26;
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label="A residential tower rising floor by floor under a crane">
      {/* ground */}
      <line x1="20" y1="380" x2="380" y2="380" stroke="#2D3A42" strokeWidth="2" />
      {/* podium */}
      <g>
        <rect x="95" y="352" width="210" height="28" fill="#2D3A42" />
        <rect x="185" y="362" width="30" height="18" fill="#A68B55" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={110 + i * 22} y="360" width="14" height="10" fill="#E9E1CF" />
        ))}
        {[0, 1, 2].map((i) => (
          <rect key={i} x={232 + i * 22} y="360" width="14" height="10" fill="#E9E1CF" />
        ))}
      </g>
      {/* tower floors */}
      {Array.from({ length: floors }).map((_, i) => {
        const y = top - (i + 1) * h;
        const done = i < built;
        return (
          <g key={i}>
            {done ? (
              <>
                <rect x="125" y={y} width="150" height={h} fill="#2D3A42" />
                <rect x="125" y={y} width="150" height="2.5" fill="#A68B55" />
                {[0, 1, 2, 3].map((w) => (
                  <rect key={w} x={135 + w * 35} y={y + 7} width="22" height="13" fill="#E9D7A8" />
                ))}
              </>
            ) : (
              <>
                <rect x="125" y={y} width="150" height={h} fill="none" stroke="#2D3A42" strokeOpacity=".45" strokeDasharray="4 4" />
                {[125, 175, 225, 275].map((x) => (
                  <line key={x} x1={x} y1={y} x2={x} y2={y + h} stroke="#2D3A42" strokeOpacity=".45" />
                ))}
              </>
            )}
          </g>
        );
      })}
      {/* crane: mast, jib, counterweight */}
      <g stroke="#A68B55" strokeWidth="2.5" fill="none">
        <path d="M330 380V40" />
        <path d="M330 40H120M330 40h40" />
        <path d="M330 18l-50 22M330 18l40 22M330 18V40" strokeWidth="1.5" />
        {Array.from({ length: 17 }).map((_, i) => (
          <path key={i} d={"M330 " + (380 - i * 21) + "l" + (i % 2 ? "-9" : "9") + " -21"} strokeWidth="1" />
        ))}
      </g>
      <rect x="360" y="40" width="16" height="14" fill="#2D3A42" />
      {/* hook with a beam, lowering to the open floor and rising again */}
      <g>
        <line x1="170" y1="40" x2="170" y2="76" stroke="#2D3A42" strokeWidth="1.5" />
        <path d="M170 76l-14 14M170 76l14 14M156 90h28" stroke="#2D3A42" strokeWidth="1.5" fill="none" />
        <rect x="150" y="90" width="40" height="7" fill="#A91E2C" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          backgroundColor: "#EFE8D6",
          backgroundImage:
            "linear-gradient(rgba(45,58,66,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(45,58,66,.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        <Link href="/" aria-label="Pipra Estate home" className="w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.png" alt="Pipra Estate" className="h-14 w-auto" />
        </Link>

        <div className="mx-auto my-6 h-[min(46vh,420px)] w-full max-w-[460px]">
          <Tower />
        </div>

        <div>
          <h2 className="max-w-md text-[38px] font-bold leading-[1.1] tracking-tight text-[#2D3A42]">Your home, floor by floor.</h2>
          <p className="mt-3 max-w-md text-[17px] leading-relaxed text-[#2D3A42]/70">Dated site photos, an honest handover date and every payment receipt, in one private place.</p>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-white px-5 py-12">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="mb-8 block lg:hidden" aria-label="Pipra Estate home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horizontal.png" alt="Pipra Estate" className="h-14 w-auto" />
          </Link>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">Sign in to your account</h1>
          <p className="mb-8 mt-2 text-[16px] text-rebar">Buyers, site engineers and staff all use this page.</p>
          <div className="rounded-[16px] border border-line bg-slab p-7 shadow-[0_1px_2px_rgba(45,58,66,.06),0_18px_40px_-18px_rgba(45,58,66,.25)]">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
          <p className="mt-6 text-center text-[15px] text-rebar">
            Bought a flat and new here?{" "}
            <Link href="/register" className="font-semibold text-ink underline underline-offset-4">
              Create a buyer account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
