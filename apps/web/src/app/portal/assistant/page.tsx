'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { Button, cx, ErrorState, PageHeader, Select, Spinner, useErrorToast, useToast } from '@/components/ui';
import { get, post } from '@/lib/api';
import type { PurchaseDetail } from '@/lib/types';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Array<{ type: string; label: string; ref?: string }> | null;
  unsure?: boolean;
  helpful?: boolean | null;
  pending?: boolean;
}

const SUGGESTIONS = ['When is my next payment?', 'How much have I paid so far?', 'When will I get my flat?', 'What is happening on site now?', 'Is car parking included?'];

function Chat() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const onError = useErrorToast();
  const purchases = useQuery({ queryKey: ['my-purchases'], queryFn: () => get<PurchaseDetail[]>('/my/purchases') });
  const purchaseId = params.get('purchase') ?? purchases.data?.[0]?.id ?? '';
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setConversationId(undefined);
  }, [purchaseId]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const ask = useMutation({
    mutationFn: (q: string) =>
      post<{ conversationId: string; message: Msg; notice?: string }>('/assistant/ask', { purchaseId, question: q, conversationId }),
    onMutate: (q) => setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: q }, { id: 'pending', role: 'assistant', text: '', pending: true }]),
    onSuccess: (r) => {
      setConversationId(r.conversationId);
      setNotice(r.notice ?? null);
      setMessages((m) => [...m.filter((x) => !x.pending), r.message]);
    },
    onError: (err) => {
      setMessages((m) => m.filter((x) => !x.pending));
      onError(err);
    },
  });
  const rate = useMutation({
    mutationFn: ({ id, helpful }: { id: string; helpful: boolean }) => post(`/assistant/messages/${id}/rate`, { helpful }),
    onSuccess: (_r, v) => setMessages((m) => m.map((x) => (x.id === v.id ? { ...x, helpful: v.helpful } : x))),
  });
  const escalate = useMutation({
    mutationFn: () => post<{ id: string }>(`/assistant/conversations/${conversationId}/escalate`),
    onSuccess: (t) => {
      toast('Sent to the developer’s team. You will get a reply in Support.');
      router.push(`/portal/support/${t.id}`);
    },
    onError,
  });

  function submit(e?: FormEvent, text?: string) {
    e?.preventDefault();
    const q = (text ?? question).trim();
    if (q.length < 2 || ask.isPending || !purchaseId) return;
    setQuestion('');
    ask.mutate(q);
  }

  if (purchases.isLoading) return <Spinner />;
  if (purchases.error) return <ErrorState error={purchases.error} onRetry={() => purchases.refetch()} />;
  if (!purchases.data?.length) return <p className="text-rebar">The assistant becomes available once a flat is linked to your account.</p>;

  return (
    <div className="flex flex-col gap-4">
      {purchases.data.length > 1 && (
        <div className="max-w-xs">
          <Select label="Asking about" value={purchaseId} onChange={(e) => router.replace(`/portal/assistant?purchase=${e.target.value}`)}>
            {purchases.data.map((p) => (
              <option key={p.id} value={p.id}>
                Flat {p.unit.code}, {p.unit.project.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex min-h-[420px] flex-col rounded-[var(--radius-panel)] border border-line bg-slab">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
          {messages.length === 0 && (
            <div>
              <p className="text-rebar">Ask about your payments, the construction progress, your handover date or your documents. Answers come only from your own records.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => submit(undefined, s)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-rebar">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cx(
                  'max-w-[85%] rounded-[var(--radius-panel)] px-4 py-3 leading-relaxed',
                  m.role === 'user' ? 'bg-[var(--brand-ink)] text-white' : 'bg-concrete text-ink',
                )}
              >
                {m.pending ? (
                  <span className="inline-flex gap-1" aria-label="Thinking">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="size-2 animate-bounce rounded-full bg-rebar" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </span>
                ) : (
                  <p className="whitespace-pre-line">{m.text}</p>
                )}
                {m.role === 'assistant' && !m.pending && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-rebar">
                    {m.sources?.length ? <span>From: {m.sources.map((s) => s.label).join(', ')}</span> : null}
                    <span className="ml-auto flex gap-1">
                      <button aria-label="Helpful" onClick={() => rate.mutate({ id: m.id, helpful: true })} className={cx('rounded p-1 hover:bg-concrete-deep', m.helpful === true && 'text-done')}>
                        <ThumbsUp className="size-4" />
                      </button>
                      <button aria-label="Not helpful" onClick={() => rate.mutate({ id: m.id, helpful: false })} className={cx('rounded p-1 hover:bg-concrete-deep', m.helpful === false && 'text-overdue')}>
                        <ThumbsDown className="size-4" />
                      </button>
                    </span>
                  </div>
                )}
                {m.unsure && (
                  <Button size="sm" variant="secondary" className="mt-3" loading={escalate.isPending} onClick={() => escalate.mutate()}>
                    Ask the developer’s team
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
          <label htmlFor="q" className="sr-only">
            Your question
          </label>
          <input
            id="q"
            value={question}
            maxLength={500}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question"
            className="h-11 flex-1 rounded-[var(--radius-control)] border border-line px-3 focus:border-[var(--brand-ink)] focus:outline-none"
          />
          <Button type="submit" size="lg" loading={ask.isPending} disabled={question.trim().length < 2} aria-label="Send">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
      </div>
      <p className="text-[13px] text-rebar">
        {notice ?? 'The assistant uses AI and can make mistakes. It does not give legal or financial advice.'}{' '}
        {conversationId && (
          <button className="underline underline-offset-2" onClick={() => escalate.mutate()}>
            Send this conversation to the team
          </button>
        )}
        {!conversationId && <Link href="/portal/support" className="underline underline-offset-2">Contact the team directly</Link>}
      </p>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <div>
      <PageHeader title="Ask a question" subtitle="Get instant answers about your flat, any time." />
      <Suspense fallback={<Spinner />}>
        <Chat />
      </Suspense>
    </div>
  );
}
