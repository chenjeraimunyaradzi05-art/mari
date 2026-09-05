'use client';

/**
 * Level, streak and this week's top members, on the community rail. XP,
 * streaks and leaderboards have been computed on the server since the
 * gamification work landed; only achievements ever had a screen. The daily
 * check-in is here too, once a day.
 */

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Flame, Loader2, Trophy } from 'lucide-react';
import { engagementApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type Summary = {
  xp: { level: number; currentXp: number; nextLevelXp: number; progress: number };
  streaks: Record<string, { current: number; longest: number; lastActivity: string }>;
  achievements: { earned: number; total: number };
};
type Leader = { id: string; displayName: string | null; avatar: string | null; xp?: number };

/** The server counts days in UTC; so does the button that says whether today is done. */
function isUtcToday(iso: string | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export function EngagementStrip({ className }: { className?: string }) {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const queryClient = useQueryClient();

  const summary = useQuery({
    queryKey: ['engagement', 'summary'],
    queryFn: engagementApi.summary,
    enabled: isAuthenticated && !isLoading,
    select: (response) => response.data as Summary,
  });
  const leaders = useQuery({
    queryKey: ['engagement', 'leaderboard', 'xp'],
    queryFn: () => engagementApi.leaderboard({ type: 'xp', period: 'weekly', limit: 5 }),
    enabled: isAuthenticated && !isLoading,
    select: (response) => ({
      leaderboard: (Array.isArray(response.data?.leaderboard) ? response.data.leaderboard : []) as Leader[],
      userRank: (response.data?.userRank ?? null) as number | null,
    }),
  });

  const checkIn = useMutation({
    mutationFn: engagementApi.checkIn,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
      const streak = Number(response.data?.currentStreak ?? 0);
      toast.success(streak > 1 ? `Checked in. ${streak} days in a row.` : 'Checked in for today.');
    },
    onError: () => toast.error('Could not check in just now'),
  });

  if (!isAuthenticated) return null;

  const xp = summary.data?.xp;
  const login = summary.data?.streaks?.login;
  const doneToday = isUtcToday(login?.lastActivity);

  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900', className)} aria-label="Your progress">
      {summary.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Level {xp?.level ?? 1}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {xp ? `${Math.round(xp.currentXp).toLocaleString()} of ${Math.round(xp.nextLevelXp).toLocaleString()} XP` : 'Earn XP by posting, commenting and showing up.'}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-200">
              <Flame className="h-3.5 w-3.5" /> {login?.current ?? 0} day{(login?.current ?? 0) === 1 ? '' : 's'}
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xp?.progress ?? 0)}>
            <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-purple-600" style={{ width: `${Math.min(100, Math.max(2, xp?.progress ?? 0))}%` }} />
          </div>
          <button
            type="button"
            onClick={() => checkIn.mutate()}
            disabled={doneToday || checkIn.isPending}
            className={cn('mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium', doneToday ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'btn-primary')}
          >
            {doneToday ? 'Checked in today' : checkIn.isPending ? 'Checking in…' : 'Check in for today'}
          </button>
          {login && login.longest > 0 && <p className="mt-1 text-center text-xs text-slate-400">Longest streak: {login.longest} days</p>}

          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Trophy className="h-3.5 w-3.5 text-amber-500" /> Top members
            </p>
            {leaders.isLoading ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
            ) : (leaders.data?.leaderboard.length ?? 0) === 0 ? (
              <p className="text-xs text-slate-500">Nobody on the board yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {leaders.data!.leaderboard.map((leader, index) => {
                  const name = leader.displayName?.trim() || 'Member';
                  return (
                    <li key={leader.id} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-right font-mono text-xs text-slate-400">{index + 1}</span>
                      <Avatar src={leader.avatar || undefined} alt={name} fallback={name.slice(0, 2).toUpperCase()} size="sm" />
                      <Link href={`/profile/${leader.id}`} className={cn('min-w-0 flex-1 truncate hover:underline', leader.id === user?.id ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200')}>
                        {name}
                        {leader.id === user?.id && ' (you)'}
                      </Link>
                      {typeof leader.xp === 'number' && <span className="text-xs text-slate-500">{leader.xp.toLocaleString()} XP</span>}
                    </li>
                  );
                })}
              </ol>
            )}
            {leaders.data?.userRank && leaders.data.userRank > 5 && <p className="mt-2 text-xs text-slate-500">You are #{leaders.data.userRank}.</p>}
          </div>
        </>
      )}
    </section>
  );
}
