'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Sparkles } from 'lucide-react';

const hiddenPrefixes = ['/api', '/maintenance'];
const hiddenExactMatches = ['/dashboard/ai/chat'];

export default function FloatingAIButton() {
  const pathname = usePathname();

  if (!pathname) return null;
  if (hiddenExactMatches.includes(pathname)) return null;
  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <Link
      href="/dashboard/ai/chat"
      aria-label="Open ATHENA AI assistant"
      className="group fixed bottom-24 right-4 z-[1600] inline-flex items-center gap-3 rounded-full border border-sky-400/20 bg-slate-950/92 px-3 py-3 text-white shadow-[0_16px_40px_rgba(2,6,23,0.35)] transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-slate-900 md:bottom-8 md:right-8 md:px-4"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#14b8a6_100%)] text-white shadow-[0_10px_24px_rgba(56,189,248,0.35)]">
        <Sparkles className="h-5 w-5" />
      </span>
      <span className="hidden sm:block">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-200/90">
          ATHENA AI
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
          Ask the career copilot
          <MessageSquare className="h-4 w-4 text-sky-200 transition group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}
