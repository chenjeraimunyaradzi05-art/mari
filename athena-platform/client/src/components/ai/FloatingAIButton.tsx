'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  MessageSquare,
  Send,
  Sparkles,
  X,
  Briefcase,
  GraduationCap,
  Users,
  Heart,
} from 'lucide-react';

const hiddenPrefixes = ['/api', '/maintenance'];
const hiddenExactMatches = ['/dashboard/ai/chat'];

const quickPrompts = [
  { icon: Briefcase, label: 'Find roles that match my skills', prompt: 'Help me find roles that match my current skills and career goals.' },
  { icon: GraduationCap, label: 'Build a learning plan', prompt: 'Build me a 4-week learning plan to level up in my field.' },
  { icon: Users, label: 'Connect me with a mentor', prompt: 'Suggest mentors I should reach out to and draft an intro message.' },
  { icon: Heart, label: 'Boost my confidence', prompt: 'Give me a short pep talk and 3 grounding actions for today.' },
];

export default function FloatingAIButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Close on escape + on outside click
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  // Close when navigating to the full chat page
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!pathname) return null;
  if (hiddenExactMatches.includes(pathname)) return null;
  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) return null;

  const openChatWithPrompt = (prompt: string) => {
    const encoded = encodeURIComponent(prompt);
    if (typeof window !== 'undefined') {
      window.location.href = `/dashboard/ai/chat?q=${encoded}`;
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-[1600] md:bottom-8 md:right-8">
      {/* Popup panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="ATHENA AI assistant"
          className="mb-3 w-[20rem] origin-bottom-right overflow-hidden rounded-2xl border border-rose-200/60 bg-white shadow-[0_30px_60px_-15px_rgba(244,63,94,0.35)] animate-scale-in dark:border-rose-400/20 dark:bg-slate-900 sm:w-[22rem]"
        >
          <div className="relative bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80">
                    ATHENA AI
                  </div>
                  <div className="text-sm font-semibold">Your career copilot</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-white/90">
              Ask about jobs, learning, mentors, or life momentum. I&apos;ll guide you to the next best step.
            </p>
          </div>

          <div className="space-y-2 p-3">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Quick starts
            </div>
            {quickPrompts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => openChatWithPrompt(item.prompt)}
                className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-900 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-rose-400/30 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 shadow-sm ring-1 ring-rose-100 dark:bg-slate-900 dark:text-rose-300 dark:ring-rose-400/20">
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 font-medium">{item.label}</span>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-600 dark:group-hover:text-rose-300" />
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const value = String(data.get('prompt') || '').trim();
              if (!value) return;
              openChatWithPrompt(value);
            }}
            className="border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-200 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-rose-400 dark:focus-within:ring-rose-400/20">
              <MessageSquare className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <input
                name="prompt"
                type="text"
                placeholder="Ask anything..."
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white dark:placeholder-slate-500"
                autoComplete="off"
              />
              <button
                type="submit"
                aria-label="Send"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white transition hover:bg-rose-700"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <Link
              href="/dashboard/ai/chat"
              className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-rose-600 transition hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
            >
              Open full chat
              <ArrowRight className="h-3 w-3" />
            </Link>
          </form>
        </div>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close ATHENA AI assistant' : 'Open ATHENA AI assistant'}
        className="group inline-flex items-center gap-3 rounded-full border border-white/20 bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] px-3 py-3 text-white shadow-[0_18px_40px_-12px_rgba(244,63,94,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-10px_rgba(244,63,94,0.6)] md:px-4"
      >
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          <Sparkles className="h-5 w-5" />
          {!open && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
          )}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-white/85">
            ATHENA AI
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
            {open ? 'Close' : 'Ask the copilot'}
            <MessageSquare className="h-4 w-4 text-white/90 transition group-hover:translate-x-0.5" />
          </span>
        </span>
      </button>
    </div>
  );
}
