'use client';

/**
 * The XP and creator leaderboards.
 *
 * Kept off the rewards page on purpose: her own progress should not be read
 * next to a ranking of everyone else. Someone who wants to compare can come
 * here, and the copy stays encouraging for the people who are not near the top.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Sparkles, Users } from 'lucide-react';
import { engagementApi } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';

type Period = 'daily' | 'weekly' | 'monthly' | 'alltime';

type Ranked = {
  id: string;
  displayName: string | null;
  avatar: string | null;
  xp?: number;
  _count?: { followers?: number };
};

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This week' },
  { value: 'monthly', label: 'This month' },
  { value: 'alltime', label: 'All time' },
];

const BOARDS = [
  { value: 'xp' as const, label: 'Momentum', icon: Sparkles },
  { value: 'creators' as const, label: 'Creators', icon: Users },
];

export default function LeaderboardPage() {
  const [board, setBoard] = useState<'xp' | 'creators'>('xp');
  const [period, setPeriod] = useState<Period>(board === 'xp' ? 'alltime' : 'weekly');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['engagement-leaderboard', board, period],
    queryFn: () =>
      board === 'xp'
        ? engagementApi.xpLeaderboard(period)
        : engagementApi.creatorLeaderboard(period),
  });

  const rows: Ranked[] = data?.data?.leaderboard ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="space-y-4">
        <Link
          href="/dashboard/rewards"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Your rewards
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Leaderboards</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Who has been building here lately. A good place to find someone to follow.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {BOARDS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setBoard(value)}
            aria-pressed={board === value}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
              board === value
                ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            aria-pressed={period === option.value}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              period === option.value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
        </div>
      ) : isError ? (
        <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
          The leaderboard could not be loaded just now.
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-slate-600 dark:text-slate-300">Nobody has placed in this window yet.</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Try a longer period, or be the first.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, index) => {
            const score = board === 'xp' ? row.xp : row._count?.followers;
            return (
              <li
                key={row.id}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-400">
                  {index + 1}
                </span>
                <Avatar src={row.avatar ?? undefined} alt={row.displayName ?? 'Member'} size="sm" />
                <Link
                  href={`/dashboard/profile/${row.id}`}
                  className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline dark:text-white"
                >
                  {row.displayName || 'An ATHENA member'}
                </Link>
                {typeof score === 'number' && (
                  <span className="shrink-0 text-sm tabular-nums text-slate-500 dark:text-slate-400">
                    {score.toLocaleString()} {board === 'xp' ? 'XP' : 'followers'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
