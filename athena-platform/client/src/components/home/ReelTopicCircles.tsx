'use client';

import Link from 'next/link';
import { Briefcase, Coins, Mic, Rocket, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Instagram's story circles, but each one opens a themed slice of the reel feed
 * rather than a single person's story. These are navigation, not content, so
 * they stay meaningful even before any reels are published. The ring turns and
 * the circle lifts on hover; a glass inner disc keeps them light in both themes.
 */
const TOPICS = [
  { label: 'Career wins', href: '/explore?topic=career-wins', icon: Sparkles, ring: 'from-rose-400 via-pink-500 to-purple-600', glow: 'group-hover:shadow-[0_12px_30px_-12px_rgba(236,72,153,0.7)]' },
  { label: 'Salary talk', href: '/explore?topic=salary', icon: Coins, ring: 'from-amber-400 via-orange-500 to-rose-500', glow: 'group-hover:shadow-[0_12px_30px_-12px_rgba(249,115,22,0.7)]' },
  { label: 'Founders', href: '/explore?topic=founders', icon: Rocket, ring: 'from-fuchsia-500 via-purple-500 to-indigo-500', glow: 'group-hover:shadow-[0_12px_30px_-12px_rgba(168,85,247,0.7)]' },
  { label: 'Interviews', href: '/explore?topic=interviews', icon: Mic, ring: 'from-sky-400 via-cyan-500 to-teal-500', glow: 'group-hover:shadow-[0_12px_30px_-12px_rgba(14,165,233,0.7)]' },
  { label: 'Day in the life', href: '/explore?topic=day-in-the-life', icon: Briefcase, ring: 'from-emerald-400 via-teal-500 to-cyan-500', glow: 'group-hover:shadow-[0_12px_30px_-12px_rgba(16,185,129,0.7)]' },
];

export function ReelTopicCircles() {
  return (
    <nav aria-label="Reel topics" className="no-scrollbar flex gap-4 overflow-x-auto px-1 pb-1 pt-1">
      {TOPICS.map((topic) => (
        <Link key={topic.label} href={topic.href} className="focusable group flex min-w-[80px] flex-col items-center gap-2 rounded-2xl">
          <span className={cn('relative rounded-full p-[3px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105', topic.glow)}>
            <span aria-hidden className={cn('absolute inset-0 rounded-full bg-gradient-to-tr transition-transform duration-700 ease-out group-hover:rotate-180', topic.ring)} />
            <span className="relative block rounded-full border-2 border-white dark:border-slate-950">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-slate-700 backdrop-blur transition-colors group-hover:text-rose-600 dark:bg-slate-900/90 dark:text-slate-200 dark:group-hover:text-rose-300">
                <topic.icon className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.75} />
              </span>
            </span>
          </span>
          <span className="line-clamp-1 max-w-[80px] text-center text-xs font-medium text-slate-600 transition-colors group-hover:text-slate-950 dark:text-slate-400 dark:group-hover:text-white">{topic.label}</span>
        </Link>
      ))}
    </nav>
  );
}
