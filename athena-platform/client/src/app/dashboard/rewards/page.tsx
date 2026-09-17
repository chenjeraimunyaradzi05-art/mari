'use client';

/**
 * Rewards: her level, her streak and the achievements she has collected.
 *
 * The engagement engine has kept XP, streaks and achievements since it was
 * built and nothing ever showed them to her. This is that surface. It leads
 * with where she is now rather than with a table of figures, and the
 * achievements she has not earned yet are written as invitations rather than
 * as a list of things she has failed to do.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Flame, Loader2, Sparkles, Trophy } from 'lucide-react';
import { engagementApi } from '@/lib/api';

type Level = { level: number; currentXp: number; nextLevelXp: number; progress: number };

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  category: string;
  earned: boolean;
  earnedAt?: string | null;
};

type AchievementStats = { earned: number; total: number; progress: number; totalXpEarned: number };

type Streak = { current: number; longest: number; lastActivity: string | null };

/** Reads as a sentence rather than a category key. */
const CATEGORY_LABELS: Record<string, string> = {
  content: 'Sharing your work',
  social: 'Building your circle',
  career: 'Moving your career',
  learning: 'Learning something new',
  community: 'Showing up for others',
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

function checkedInToday(lastActivity: string | null): boolean {
  if (!lastActivity) return false;
  const last = new Date(lastActivity);
  if (Number.isNaN(last.getTime())) return false;
  const today = new Date();
  return (
    last.getFullYear() === today.getFullYear() &&
    last.getMonth() === today.getMonth() &&
    last.getDate() === today.getDate()
  );
}

export default function RewardsPage() {
  const queryClient = useQueryClient();

  const { data: xpResponse, isLoading: xpLoading } = useQuery({
    queryKey: ['engagement-xp'],
    queryFn: () => engagementApi.xp(),
  });

  const { data: streakResponse, isLoading: streaksLoading } = useQuery({
    queryKey: ['engagement-streaks'],
    queryFn: () => engagementApi.streaks(),
  });

  const { data: achievementResponse, isLoading: achievementsLoading } = useQuery({
    queryKey: ['engagement-achievements'],
    queryFn: () => engagementApi.achievements(),
  });

  const checkIn = useMutation({
    mutationFn: () => engagementApi.checkIn(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['engagement-streaks'] });
      void queryClient.invalidateQueries({ queryKey: ['engagement-xp'] });
    },
  });

  const level: Level | undefined = xpResponse?.data;
  const streaks: Record<string, Streak> = streakResponse?.data?.streaks ?? {};
  const achievements: Achievement[] = achievementResponse?.data?.achievements ?? [];
  const stats: AchievementStats | undefined = achievementResponse?.data?.stats;

  const loginStreak = streaks.login;
  const alreadyCheckedIn = checkedInToday(loginStreak?.lastActivity ?? null);

  const earned = useMemo(() => achievements.filter((a) => a.earned), [achievements]);
  const toCome = useMemo(() => achievements.filter((a) => !a.earned), [achievements]);

  const byCategory = useMemo(() => {
    return toCome.reduce<Record<string, Achievement[]>>((acc, achievement) => {
      (acc[achievement.category] ||= []).push(achievement);
      return acc;
    }, {});
  }, [toCome]);

  const isLoading = xpLoading || streaksLoading || achievementsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Your rewards</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Everything you have built here so far, and what is close.
        </p>
      </header>

      {/* The one focal point: where she is now. */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-rose-400 to-amber-400 p-8 text-white shadow-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-2xl"
        />
        <div className="relative space-y-6">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-white/80">
            <Sparkles className="h-4 w-4" /> Level {level?.level ?? 1}
          </div>

          <p className="max-w-md text-2xl font-semibold leading-snug">
            {level && level.progress >= 80
              ? 'You are nearly at your next level.'
              : level && level.level > 1
                ? 'You are well on your way.'
                : 'Every step from here earns something.'}
          </p>

          <div className="space-y-2">
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{ width: `${Math.max(2, Math.min(100, level?.progress ?? 0))}%` }}
              />
            </div>
            <p className="text-sm text-white/85">
              {Math.round(level?.progress ?? 0)}% of the way to level {(level?.level ?? 1) + 1}
            </p>
          </div>
        </div>
      </section>

      {/* Streak, kept beside the level rather than stacked into a metrics row. */}
      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <Flame className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {loginStreak?.current
                ? `${loginStreak.current} ${loginStreak.current === 1 ? 'day' : 'days'} in a row`
                : 'Start a streak today'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {loginStreak?.longest
                ? `Your longest run so far is ${loginStreak.longest} ${loginStreak.longest === 1 ? 'day' : 'days'}.`
                : 'Come back tomorrow and it becomes two.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => checkIn.mutate()}
          disabled={checkIn.isPending || alreadyCheckedIn}
          className="btn-primary px-5 py-2.5 disabled:opacity-60"
        >
          {alreadyCheckedIn ? 'Checked in today' : checkIn.isPending ? 'Checking in…' : 'Check in'}
        </button>
      </section>

      {/* What she has already collected. */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Trophy className="h-5 w-5 text-rose-500" /> Earned
          </h2>
          {stats && (
            <Link
              href="/dashboard/rewards/leaderboard"
              className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400"
            >
              See the leaderboards
            </Link>
          )}
        </div>

        {earned.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-600 dark:text-slate-300">
              Nothing here yet, and that is exactly where everyone starts.
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your first post earns one. So does your first saved job.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {earned.map((achievement) => (
              <article
                key={achievement.id}
                className="flex items-start gap-4 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-950/20"
              >
                <span aria-hidden className="text-2xl">
                  {achievement.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{achievement.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{achievement.description}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* What is still ahead, written as an invitation. */}
      {toCome.length > 0 && (
        <section className="space-y-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Award className="h-5 w-5 text-slate-400" /> Still to come
          </h2>

          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {categoryLabel(category)}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((achievement) => (
                  <article
                    key={achievement.id}
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <span aria-hidden className="text-2xl opacity-40">
                      {achievement.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 dark:text-slate-200">{achievement.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{achievement.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
