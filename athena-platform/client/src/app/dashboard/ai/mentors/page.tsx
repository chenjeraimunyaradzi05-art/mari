'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Sparkles, Users } from 'lucide-react';
import { algorithmApi } from '@/lib/algorithm-api';
import { useMySkills } from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';

/**
 * Mentor Match.
 *
 * This page used to read /api/ai-algorithms/mentor-match, whose
 * mentorMatchScore table nothing on the server ever wrote, so every member saw
 * "no matches" behind a filter bar. It now reads /api/algorithms/mentor-match:
 * the mentors taking new mentees, ranked by the skills they share with her
 * profile, their rating and their years of experience, each with the reasons
 * spelled out.
 *
 * The ranking is a heuristic, not a percentage, so the number stays off the
 * page; the reasons are the honest part and they are what she sees. Shared
 * skills drive the order, so a profile with no skills is nudged to add some.
 */

function initialsOf(name: string) {
  const parts = name.split(' ').filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'M';
}

export default function MentorMatchPage() {
  const { data: mentors, isLoading, isError } = useQuery({
    queryKey: ['mentor-match'],
    queryFn: algorithmApi.mentorMatch,
    select: (response) => response.data.data.mentors,
  });
  const { data: mySkills } = useMySkills();
  const hasNoSkills = Array.isArray(mySkills) && mySkills.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Users className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Mentor Match</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
          Mentors who could be a good fit
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          The mentors taking new mentees right now, with the ones who share your skills first.
          Each card says why she is here.
        </p>
      </div>

      {hasNoSkills && (
        <div className="tile-soft flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Add a few skills to your profile and these matches get sharper. Shared skills are
              what puts a mentor at the top of this list.
            </p>
          </div>
          <Link
            href="/dashboard/settings/profile"
            className="focusable rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Add skills
          </Link>
        </div>
      )}

      {isLoading && (
        <ul className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
            />
          ))}
        </ul>
      )}

      {isError && (
        <div className="surface p-6">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            We could not load the mentors just now. Please try again shortly, or browse them
            directly.{' '}
            <Link href="/dashboard/mentors" className="font-semibold text-rose-600 hover:underline dark:text-rose-400">
              All mentors
            </Link>
          </p>
        </div>
      )}

      {mentors && mentors.length === 0 && (
        <div className="surface px-6 py-12 text-center">
          <Users className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            No mentors are taking new mentees right now
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
            Availability changes week to week. Have a look at the full list, or come back soon.
          </p>
          <Link
            href="/dashboard/mentors"
            className="focusable mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            See all mentors
          </Link>
        </div>
      )}

      {mentors && mentors.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {mentors.map((mentor) => (
            <li key={mentor.id} className="surface p-5">
              <div className="flex items-start gap-3">
                <Avatar src={mentor.avatar} alt={mentor.name} fallback={initialsOf(mentor.name)} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900 dark:text-white">{mentor.name}</h2>
                  {mentor.headline && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">{mentor.headline}</p>
                  )}
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Why ${mentor.name} is suggested`}>
                {(mentor.matchReasons.length > 0 ? mentor.matchReasons : ['Taking new mentees']).map(
                  (reason) => (
                    <li
                      key={reason}
                      className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                    >
                      {reason}
                    </li>
                  )
                )}
              </ul>
              <Link
                href={`/dashboard/mentors/${mentor.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400"
              >
                See profile <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-rose-600 hover:underline dark:text-rose-400">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
