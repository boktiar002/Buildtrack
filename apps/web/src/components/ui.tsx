'use client';

import { AlertTriangle, Loader2, RotateCw, X } from 'lucide-react';
import Link from 'next/link';
import {
  ButtonHTMLAttributes,
  createContext,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { ApiError } from '@/lib/api';
import { label } from '@/lib/format';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

// ------------------------------------------------------------------ buttons

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-[var(--brand-ink)] text-white shadow-sm hover:bg-[#3b4b56] disabled:bg-[#9aa1a6] disabled:shadow-none',
  secondary: 'bg-slab text-ink border border-line shadow-sm hover:border-[var(--brand-accent)] disabled:text-rebar',
  ghost: 'text-ink hover:bg-concrete-deep disabled:text-rebar',
  danger: 'bg-overdue text-white hover:bg-[#8a1824] disabled:opacity-60',
};

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-[background-color,border-color,transform] active:translate-y-px disabled:cursor-not-allowed',
        size === 'sm' && 'h-9 px-3.5 text-sm',
        size === 'md' && 'h-11 px-5 text-[15px]',
        size === 'lg' && 'h-12 px-6 text-base',
        VARIANT[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = 'secondary', className, children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx('inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 text-[15px] font-semibold transition-colors active:translate-y-px', VARIANT[variant], className)}
    >
      {children}
    </Link>
  );
}

// ------------------------------------------------------------------- fields

export function Field({ label: text, hint, error, children, id }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {text}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-rebar">{hint}</p>}
      {error && (
        <p className="text-[13px] text-overdue" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  'w-full rounded-[var(--radius-control)] border border-[#d6ccb5] bg-slab px-3.5 text-[15px] text-ink placeholder:text-[#9a9a90] transition-shadow focus:border-[var(--brand-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-accent)]/20 disabled:bg-concrete';

export function Input({ label: text, hint, error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field id={id} label={text} hint={hint} error={error}>
      <input id={id} aria-invalid={!!error} {...props} className={cx(control, 'h-11', className)} />
    </Field>
  );
}

export function Textarea({ label: text, hint, error, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field id={id} label={text} hint={hint} error={error}>
      <textarea id={id} aria-invalid={!!error} {...props} className={cx(control, 'min-h-24 py-2 leading-relaxed', className)} />
    </Field>
  );
}

export function Select({
  label: text,
  hint,
  error,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field id={id} label={text} hint={hint} error={error}>
      <select id={id} {...props} className={cx(control, 'h-11', className)}>
        {children}
      </select>
    </Field>
  );
}

// ------------------------------------------------------------------- layout

export function Panel({ title, action, children, className, flush }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cx('rounded-[var(--radius-panel)] border border-line bg-slab shadow-[var(--shadow-card)]', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          {title && <h2 className="text-[17px] font-bold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, action, back }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-sm text-rebar hover:text-ink">
            ‹ {back.label}
          </Link>
        )}
        <h1 className="text-[28px] font-extrabold sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[60ch] text-[16px] text-rebar">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Stat({ label: text, value, note, tone, icon }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'overdue' | 'done'; icon?: ReactNode }) {
  const rule = tone === 'overdue' ? 'bg-overdue' : tone === 'done' ? 'bg-done' : 'bg-[var(--brand-accent)]';
  const chip = tone === 'overdue' ? 'bg-overdue-soft text-overdue' : tone === 'done' ? 'bg-done-soft text-done' : 'bg-brass-soft text-[#7d6736]';
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-line bg-slab p-5 shadow-[var(--shadow-card)]">
      <span className={cx('absolute inset-y-0 left-0 w-1', rule)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-medium text-rebar">{text}</p>
        {icon && <span className={cx('grid size-9 shrink-0 place-items-center rounded-lg', chip)}>{icon}</span>}
      </div>
      <p className={cx('figure mt-2 text-[30px] font-bold leading-none', tone === 'overdue' && 'text-overdue', tone === 'done' && 'text-done')}>{value}</p>
      {note && <p className="mt-2 text-[13px] text-rebar">{note}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ status

const TONE: Record<string, string> = {
  PAID: 'bg-done-soft text-done',
  COMPLETED: 'bg-done-soft text-done',
  PUBLISHED: 'bg-done-soft text-done',
  ANSWERED: 'bg-done-soft text-done',
  SOLD: 'bg-done-soft text-done',
  INDEXED: 'bg-done-soft text-done',
  LOW: 'bg-done-soft text-done',
  DUE: 'bg-brass-soft text-[#7d6736]',
  PARTIALLY_PAID: 'bg-brass-soft text-[#7d6736]',
  IN_PROGRESS: 'bg-brass-soft text-[#7d6736]',
  PENDING_REVIEW: 'bg-brass-soft text-[#7d6736]',
  BOOKED: 'bg-brass-soft text-[#7d6736]',
  OPEN: 'bg-brass-soft text-[#7d6736]',
  MEDIUM: 'bg-brass-soft text-[#7d6736]',
  UNDER_CONSTRUCTION: 'bg-brass-soft text-[#7d6736]',
  OVERDUE: 'bg-overdue-soft text-overdue',
  REJECTED: 'bg-overdue-soft text-overdue',
  HIGH: 'bg-overdue-soft text-overdue',
  FAILED: 'bg-overdue-soft text-overdue',
  CANCELLED: 'bg-overdue-soft text-overdue',
};

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold', TONE[status] ?? 'bg-concrete-deep text-rebar')}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {children ?? label(status)}
    </span>
  );
}

export function ProgressBar({ value, tone = 'brass', className, labelText }: { value: number; tone?: 'brass' | 'done' | 'ink'; className?: string; labelText?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={labelText ?? 'Progress'}
      className={cx('h-2.5 w-full overflow-hidden rounded-full bg-concrete-deep', className)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-700 ease-out', tone === 'brass' && 'bg-[var(--brand-accent)]', tone === 'done' && 'bg-done', tone === 'ink' && 'bg-[var(--brand-ink)]')}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------- loading and errors

export function Spinner({ label: text = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-rebar" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{text}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-[var(--radius-control)] bg-concrete-deep', className)} />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error as ApiError;
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] border border-[#e8c3be] bg-overdue-soft p-5" role="alert">
      <div className="flex items-center gap-2 font-medium text-overdue">
        <AlertTriangle className="size-5" aria-hidden />
        {e?.status === 404 ? 'Not found' : e?.status === 403 ? 'No access' : 'This could not be loaded'}
      </div>
      <p className="text-ink">{e?.message ?? 'Something went wrong.'}</p>
      {e?.requestId && <p className="text-[13px] text-rebar">Reference: {e.requestId}</p>}
      {onRetry && e?.status !== 404 && e?.status !== 403 && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="size-4" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[var(--radius-panel)] border border-dashed border-line px-5 py-8">
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-prose text-rebar">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ dialog

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-[var(--radius-panel)] border border-line bg-slab p-0 text-ink shadow-[0_24px_60px_-20px_rgba(24,33,43,0.45)] backdrop:bg-[rgba(24,33,43,0.45)]',
        wide ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div>
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded p-1 text-rebar hover:bg-concrete hover:text-ink" aria-label="Close">
              <X className="size-5" />
            </button>
          </header>
          <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

// ------------------------------------------------------------------ toasts

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto max-w-md rounded-[var(--radius-control)] px-4 py-2.5 text-[15px] shadow-lg',
              t.tone === 'ok' ? 'bg-[var(--brand-ink)] text-white' : 'bg-overdue text-white',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Shows an API error as a toast. */
export function useErrorToast() {
  const toast = useToast();
  return (err: unknown) => toast((err as Error)?.message ?? 'Something went wrong.', 'error');
}

// --------------------------------------------------------------------- tabs

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: ReactNode }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[15px] font-medium transition-colors',
            value === t.id ? 'border-[var(--brand-accent)] text-ink' : 'border-transparent text-rebar hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b border-line bg-concrete/60 text-[13px] text-rebar">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line/70 [&>tr]:transition-colors [&>tr:hover]:bg-concrete/50 [&>tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
