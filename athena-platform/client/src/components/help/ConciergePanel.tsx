'use client';

/**
 * The help concierge: ask a question in plain words and get an answer from the
 * knowledge base or the assistant, with the things it suggests you do next as
 * links. Proactive suggestions (finish your profile, set job alerts) show as
 * chips. The routes have existed since the AI work; this is the first screen
 * that reaches them.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Action = { type: string; label: string; target: string };
type Reply = { message: string; suggestions?: string[]; actions?: Action[]; quickReplies?: string[] };
type Turn = { role: 'user' | 'assistant'; content: string; actions?: Action[]; quickReplies?: string[] };

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

// An action's target is a path on this site; anything else is shown as text.
function actionHref(action: Action): string | null {
  return action.target && action.target.startsWith('/') ? action.target : null;
}

export default function ConciergePanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const proactive = useQuery({
    queryKey: ['concierge-suggestions'],
    queryFn: () => api.get('/concierge/suggestions'),
    select: (r) => r.data?.suggestions as Reply | undefined,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns]);

  const ask = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setProblem(null);
    setBusy(true);
    setDraft('');
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: 'user', content: message }]);
    try {
      const res = await api.post('/concierge/chat', {
        message,
        conversationHistory: history,
        currentPage: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
      const reply = res.data as Reply;
      setTurns((prev) => [...prev, { role: 'assistant', content: reply.message, actions: reply.actions, quickReplies: reply.quickReplies }]);
    } catch (e) {
      setProblem(errorMessage(e) || 'The assistant is not available right now. The answers below still are.');
      setTurns((prev) => prev.slice(0, -1));
      setDraft(message);
    } finally {
      setBusy(false);
    }
  };

  const chips = [...(proactive.data?.suggestions ?? [])].slice(0, 3);
  const chipActions = proactive.data?.actions ?? [];

  return (
    <section aria-label="Ask ATHENA" className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5 dark:border-primary-900/40 dark:from-primary-900/20 dark:to-slate-900">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-500" />
        <h2 className="font-semibold text-slate-900 dark:text-white">Ask ATHENA</h2>
        <span className="text-xs text-slate-500">Plain words are fine: “how do I find a mentor?”</span>
      </div>

      {(chips.length > 0 || chipActions.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chipActions.slice(0, 3).map((a) =>
            actionHref(a) ? (
              <Link key={a.label} href={actionHref(a)!} className="rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 dark:border-primary-800 dark:bg-slate-900 dark:text-primary-200">
                {a.label}
              </Link>
            ) : null
          )}
          {chips.map((s) => (
            <span key={s} className="rounded-full bg-white/70 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {s}
            </span>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
          {turns.map((t, i) => (
            <div key={i} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', t.role === 'user' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100')}>
                <p className="whitespace-pre-wrap">{t.content}</p>
                {t.actions && t.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t.actions.map((a) =>
                      actionHref(a) ? (
                        <Link key={a.label} href={actionHref(a)!} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-primary-700 hover:underline dark:bg-slate-900 dark:text-primary-200">
                          {a.label}
                        </Link>
                      ) : null
                    )}
                  </div>
                )}
                {t.quickReplies && t.quickReplies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t.quickReplies.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {problem && <p className="mt-3 text-sm text-red-600">{problem}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask anything about using ATHENA"
          aria-label="Your question"
          maxLength={1000}
          className="input flex-1 text-sm"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="btn-primary inline-flex items-center gap-1 px-3 text-sm" aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
