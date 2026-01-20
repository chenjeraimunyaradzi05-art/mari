'use client';

import { useMemo, useRef, useState } from 'react';
import { useAIChat } from '@/lib/hooks';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AIChatPage() {
  const chat = useAIChat();
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
    if (!text || pendingRef.current) return;

    pendingRef.current = true;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const data = await chat.mutateAsync({ message: text, context });
      const assistantText =
        typeof data === 'string'
          ? data
          : data?.message || data?.content || JSON.stringify(data);

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);
    } finally {
      pendingRef.current = false;
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Chat</h1>
      <p className="mt-1 text-gray-500 dark:text-gray-400">
        Ask ATHENA for career guidance.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
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
                    : 'max-w-[80%] rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-2'
                }
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}

          {chat.isPending && (
            <div className="text-sm text-gray-500 dark:text-gray-400">ATHENA is thinking…</div>
          )}
        </div>

        <form onSubmit={onSend} className="border-t border-gray-200 dark:border-gray-800 p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button type="submit" className="btn-primary" disabled={chat.isPending}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
