'use client';

import Link from 'next/link';
import { Briefcase, Coins, Mic, Rocket, Sparkles } from 'lucide-react';

/**
 * Instagram's story circles, but each one opens a themed slice of the reel feed
 * rather than a single person's story. These are navigation, not content, so
 * they stay meaningful even before any reels are published.
 */
const TOPICS = [
  {
    label: 'Career wins',
    href: '/explore?topic=career-wins',
    icon: Sparkles,
    ring: 'from-rose-400 via-pink-500 to-purple-600',
  },
  {
    label: 'Salary talk',
    href: '/explore?topic=salary',
    icon: Coins,
    ring: 'from-amber-400 via-orange-500 to-rose-500',
  },
  {
    label: 'Founders',
    href: '/explore?topic=founders',
    icon: Rocket,
    ring: 'from-fuchsia-500 via-purple-500 to-indigo-500',
  },
  {
    label: 'Interviews',
    href: '/explore?topic=interviews',
    icon: Mic,
    ring: 'from-sky-400 via-cyan-500 to-teal-500',
  },
  {
    label: 'Day in the life',
    href: '/explore?topic=day-in-the-life',
    icon: Briefcase,
    ring: 'from-emerald-400 via-teal-500 to-cyan-500',
  },
];

export function ReelTopicCircles() {
  return (
    <nav aria-label="Reel topics" className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
      {TOPICS.map((topic) => (
        <Link
          key={topic.label}
          href={topic.href}
          className="group flex min-w-[76px] flex-col items-center gap-2"
        >
          <span
            className={`rounded-full bg-gradient-to-tr ${topic.ring} p-[2.5px] transition group-hover:scale-105`}
          >
            <span className="block rounded-full border-2 border-white dark:border-slate-950">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <topic.icon className="h-6 w-6" strokeWidth={1.75} />
              </span>
            </span>
          </span>
          <span className="line-clamp-1 max-w-[76px] text-center text-xs text-slate-600 dark:text-slate-400">
            {topic.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
