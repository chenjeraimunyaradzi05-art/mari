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
 */

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

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

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);
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
                    : 'max-w-[80%] rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-2'
                }
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}

          {chat.isPending && (
            <div className="text-sm text-slate-500 dark:text-slate-400">ATHENA is thinking…</div>
          )}
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
