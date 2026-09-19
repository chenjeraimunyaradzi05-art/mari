'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  HeartHandshake,
  MessageSquare,
  Sparkles,
  Users,
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StartHerePick, StartHerePickType } from '@/lib/hooks';

/**
 * "New here? Start with these": a short rail above the feed for a member who
 * has little history yet, built from GET /feed/cold-start (real posts,
 * courses, jobs, mentors, members and groups for her persona and city). It
 * shows only while GET /feed/cold-start/score says she is still cold start,
 * and disappears on its own once she has settled in.
 *
 * Presentational on purpose: useStartHere in lib/hooks.ts does the fetching
 * and strips the per-type `score` constant the server attaches, so nothing
 * here can print a number that was never measured.
 */

// One group per pick type, in the order shown. Two per group keeps the rail
// a nudge while her feed fills up, not a directory.
const GROUPS: Array<{ type: StartHerePickType; heading: string; icon: LucideIcon }> = [
  { type: 'USER', heading: 'People to meet', icon: Users },
  { type: 'MENTOR', heading: 'A mentor in your field', icon: HeartHandshake },
  { type: 'GROUP', heading: 'A circle to join', icon: Waypoints },
  { type: 'COURSE', heading: 'Something to learn', icon: BookOpen },
  { type: 'JOB', heading: 'A role to look at', icon: Briefcase },
  { type: 'POST', heading: 'Worth reading', icon: MessageSquare },
];

const PER_GROUP = 2;

type Props = {
  isColdStart: boolean;
  picks: StartHerePick[];
};

export default function StartHereRail({ isColdStart, picks }: Props) {
  if (!isColdStart) return null;

  const groups = GROUPS.map((group) => ({
    ...group,
    items: picks.filter((pick) => pick.type === group.type).slice(0, PER_GROUP),
  })).filter((group) => group.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <section
      aria-labelledby="start-here-heading"
      className="rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-pink-50 p-5 dark:border-primary-900/40 dark:from-primary-950/30 dark:via-slate-800 dark:to-slate-800"
    >
      <div className="flex items-center gap-2 text-primary-600 dark:text-primary-300">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        <h2 id="start-here-heading" className="font-semibold text-slate-900 dark:text-white">
          New here? Start with these
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        A few real people and places to look at while your feed fills up.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.type}>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {group.heading}
              </h3>
              <ul className="mt-2 space-y-2">
                {group.items.map((pick) => (
                  <li key={`${pick.type}-${pick.id}`}>
                    <Link
                      href={pick.href}
                      className="group flex items-start justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-300">
                          {pick.title}
                        </span>
                        {pick.reason && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {pick.reason}
                          </span>
                        )}
                      </span>
                      <ArrowRight
                        className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:text-primary-600"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
