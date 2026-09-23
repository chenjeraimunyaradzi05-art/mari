'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAIChat, useAIChatUsage, type AIChatUsage } from '@/lib/hooks';

/**
 * AI chat.
 *
 * Free-tier chat is capped (20 messages per 24 hours by default) and the cap
 * used to arrive as a 429 in the middle of a conversation, because nothing read
 * GET /ai/chat/usage before she typed or the `usage` object every reply
 * carries. Now one line under the composer says how many messages are left and
 * when the window resets, follows each reply, and offers the upgrade only once
 * there are none left. Paid tiers have no cap and see no line.
 *
 * The second thing this page had to learn is what to do when the conversation
 * stops being about work. The server screens every message and every reply now,
 * and when it reads crisis language it answers with the crisis lines itself
 * rather than sending the exchange to a model (see ai-safety.service). This
 * page renders that answer as something she can act on — numbers she can press
 * — and keeps the disclaimer above the composer where she is actually looking,
 * rather than in a footer she will never scroll to.
 */

/** A line as the server sends it, from the wellness library's crisis list. */
type CrisisLine = {
  key: string;
  name: string;
  phone: string;
  url: string;
  when: string;
  who: string;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** Present only on a crisis reply, and then rendered as call links. */
  crisisLines?: CrisisLine[];
};

/**
 * The three numbers that stay on screen the whole time she is here.
 *
 * BEFORE LAUNCH: 000, Lifeline and 1800RESPECT are the nationally published
 * Australian numbers, and they are repeated in several places in this app — the
 * site footer, the housing and safety pages, the wellness library on the
 * server. Every one of them must be checked against the publisher's own current
 * page before launch. Do not add a number here that was not copied from a
 * publisher.
 */
const ALWAYS_ON_LINES: Array<{ name: string; phone: string; dial: string }> = [
  { name: 'Emergency', phone: '000', dial: '000' },
  { name: 'Lifeline', phone: '13 11 14', dial: '131114' },
  { name: '1800RESPECT', phone: '1800 737 732', dial: '1800737732' },
];

/** "13 11 14" is how a number is read; "131114" is how it is dialled. */
const dialable = (phone: string) => phone.replace(/[^\d+]/g, '');

type Usage = NonNullable<AIChatUsage['usage']>;

/** "3h 20m", "45 min", "under a minute": the wait until the window resets. */
function formatReset(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 60) return 'under a minute';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const DAY_SECONDS = 24 * 60 * 60;

export default function AIChatPage() {
  const chat = useAIChat();
  const usageQuery = useAIChatUsage();
  // Every reply carries the same usage object the query does, so the line
  // under the composer follows the conversation rather than the page load.
  const [liveUsage, setLiveUsage] = useState<Usage | null>(null);
  const usage = liveUsage ?? usageQuery.data?.usage ?? null;
  const exhausted = usage !== null && usage.remaining <= 0;
  const windowLabel = usage?.windowSeconds === DAY_SECONDS ? 'today' : 'in this window';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hi — I’m ATHENA. Ask me anything about jobs, resumes, interviews, or career strategy.',
    },
  ]);

  const context = useMemo(() => {
    // The backend expects context optionally; keep it small and structured.
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const pendingRef = useRef(false);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || pendingRef.current || exhausted) return;

    pendingRef.current = true;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const data = await chat.mutateAsync({ message: text, context });
      const assistantText =
        typeof data === 'string'
          ? data
          : data?.response || data?.data?.response || data?.message || data?.content || JSON.stringify(data);

      // A crisis reply carries its lines with it. They are rendered from the
      // server's list rather than from anything held here, so there is one
      // place a number can be corrected.
      const crisisLines: CrisisLine[] | undefined =
        data && typeof data === 'object' && data.crisis?.flagged && Array.isArray(data.crisis.lines)
          ? (data.crisis.lines as CrisisLine[])
          : undefined;

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantText, crisisLines }]);
      if (data && typeof data === 'object' && data.usage) {
        setLiveUsage(data.usage as Usage);
      }
    } catch (error) {
      // The hook has already said so in a toast. A 429 means the window is
      // used up: reflect that under the composer and hand her text back.
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } })
        ?.response;
      if (response?.status === 429) {
        const retryAfter = Number(response.headers?.['retry-after']);
        const known = liveUsage ?? usageQuery.data?.usage ?? null;
        setLiveUsage({
          limit: known?.limit ?? 0,
          remaining: 0,
          resetIn: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : known?.resetIn ?? 0,
          windowSeconds: known?.windowSeconds ?? DAY_SECONDS,
        });
        setInput(text);
        setMessages((prev) => prev.filter((m, idx) => !(idx === prev.length - 1 && m.role === 'user' && m.content === text)));
      }
    } finally {
      pendingRef.current = false;
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Chat</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Ask ATHENA for career guidance.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
        <div className="p-4 max-h-[60vh] overflow-auto space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={
                m.role === 'user'
                  ? 'flex justify-end'
                  : 'flex justify-start'
              }
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] rounded-lg bg-primary-500 text-white px-4 py-2'
                    : m.crisisLines
                      ? 'max-w-[90%] rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-slate-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-slate-100'
                      : 'max-w-[80%] rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-2'
                }
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>

                {/* The numbers as buttons. The reply above already lists them in
                    words, for anyone reading it aloud or copying it out; these
                    are for the woman holding a phone right now. */}
                {m.crisisLines && m.crisisLines.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {m.crisisLines.map((line) => (
                      <a
                        key={line.key}
                        href={`tel:${dialable(line.phone)}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-rose-100 dark:bg-slate-950 dark:hover:bg-slate-900"
                      >
                        <span className="font-medium text-slate-900 dark:text-white">{line.name}</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-300">{line.phone}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {chat.isPending && (
            <div className="text-sm text-slate-500 dark:text-slate-400">ATHENA is thinking…</div>
          )}
        </div>

        {/* Above the composer, not below the fold: this is the last thing on
            screen before she types, and it stays there for every message. */}
        <div className="border-t border-slate-200 bg-rose-50/60 px-3 py-2.5 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-rose-500/10 dark:text-slate-300">
          <p>
            ATHENA AI is an automated assistant — not a counsellor, doctor, lawyer or financial
            adviser. Nothing it says is professional advice, and it can be wrong.
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {ALWAYS_ON_LINES.map((line) => (
              <a
                key={line.name}
                href={`tel:${line.dial}`}
                className="font-medium text-rose-700 hover:underline dark:text-rose-300"
              >
                {line.name} {line.phone}
              </a>
            ))}
            <Link href="/help/safety-center" className="text-slate-500 hover:underline dark:text-slate-400">
              Safety centre
            </Link>
          </p>
        </div>

        <form onSubmit={onSend} className="border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2">
          <label htmlFor="ai-chat-input" className="sr-only">
            Your message
          </label>
          <input
            id="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={exhausted ? 'Back when the window resets…' : 'Type your message…'}
            disabled={exhausted}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          />
          <button type="submit" className="btn-primary" disabled={chat.isPending || exhausted}>
            Send
          </button>
        </form>

        {usage && (
          <p
            className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
            aria-live="polite"
          >
            {exhausted ? (
              <>
                That is all {usage.limit} messages {windowLabel}. More in {formatReset(usage.resetIn)}, or{' '}
                <Link
                  href="/dashboard/settings/billing"
                  className="font-medium text-rose-600 hover:underline dark:text-rose-400"
                >
                  upgrade for unlimited chat
                </Link>
                .
              </>
            ) : (
              <>
                {usage.remaining} of {usage.limit} messages left {windowLabel}, resets in{' '}
                {formatReset(usage.resetIn)}
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
