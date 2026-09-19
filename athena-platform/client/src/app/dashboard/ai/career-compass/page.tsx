'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Briefcase, Compass, Sparkles } from 'lucide-react';
import { algorithmApi } from '@/lib/algorithm-api';

/**
 * Career Compass.
 *
 * This page used to read /api/ai-algorithms/career-compass, a table that only
 * a development placeholder ever wrote: in production the generate call throws
 * 503, and elsewhere it stored 'Senior Software Engineer', '$150,000 -
 * $180,000' and a 75% probability for everyone. A member saw an error or a
 * forecast nobody had made.
 *
 * It now reads /api/algorithms/career-compass, which compares the skills that
 * active roles carrying her title ask for against the skills on her profile,
 * finds courses on ATHENA that teach the missing ones, and lists those roles.
 * A comparison against real listings, not a prediction: there is no
 * probability, salary or risk here, and when nothing is missing it says so
 * rather than inventing a forecast.
 */

const fieldClass =
  'focusable w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500';

function locationOf(job: { city: string | null; state: string | null; country: string | null }) {
  return [job.city, job.state, job.country].filter(Boolean).join(', ');
}

export default function CareerCompassPage() {
  const [draft, setDraft] = useState('');
  // Empty means "the title on her profile"; the server fills that in.
  const [role, setRole] = useState('');

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['career-compass', role],
    queryFn: () => algorithmApi.careerCompass(role || undefined),
    select: (response) => response.data.data,
  });

  const lookUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRole(draft.trim());
  };

  const roles = data?.suggestedJobs ?? [];
  const gaps = data?.skillGaps ?? [];
  const courses = data?.recommendedCourses ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Compass className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Career Compass</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
          What the roles you want are asking for
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          We read the active roles on ATHENA whose title matches yours and compare what they ask
          for with the skills on your profile. A comparison, not a forecast.
        </p>
      </div>

      <form onSubmit={lookUp} className="surface p-5">
        <label htmlFor="compass-role" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Role title to look at
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="compass-role"
            className={fieldClass}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={data?.targetRole || 'Product designer'}
          />
          <button
            type="submit"
            disabled={isFetching}
            className="focusable rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFetching ? 'Looking' : 'Look up'}
          </button>
        </div>
        {data && (
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-500">
            Looking at roles titled {data.targetRole}. Leave the box empty to use the title on your
            profile.
          </p>
        )}
      </form>

      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
          <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
        </div>
      )}

      {isError && (
        <div className="surface p-6">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            We could not read the roles just now. Nothing about your profile has changed; please try
            again shortly.
          </p>
        </div>
      )}

      {data && roles.length === 0 && (
        <div className="surface px-6 py-12 text-center">
          <Briefcase className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            No active roles titled &ldquo;{data.targetRole}&rdquo; right now
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
            There is nothing to compare against yet, so we will not guess. Try a broader title, or
            browse every role on ATHENA.
          </p>
          <Link
            href="/dashboard/jobs"
            className="focusable mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Browse roles
          </Link>
        </div>
      )}

      {data && roles.length > 0 && (
        <>
          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-rose-500" />
              <h2 className="rail-title">Skills these roles ask for that you have not listed</h2>
            </div>
            {gaps.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Skills to consider">
                {gaps.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full bg-rose-50 px-3 py-1 text-sm capitalize text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Every skill these roles list is already on your profile. Keep it current and this
                stays true.{' '}
                <Link
                  href="/dashboard/settings/profile"
                  className="font-semibold text-rose-600 hover:underline dark:text-rose-400"
                >
                  Review your skills
                </Link>
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-500">
              Taken from the skills employers wrote on {roles.length}{' '}
              {roles.length === 1 ? 'active listing' : 'active listings'}. A gap here is a gap in the
              listing&apos;s words, not a verdict on you.
            </p>
          </section>

          {gaps.length > 0 && (
            <section className="surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-rose-500" />
                  <h2 className="rail-title">Courses that teach them</h2>
                </div>
                <Link
                  href="/dashboard/learn"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
                >
                  All courses <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {courses.length > 0 ? (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {courses.map((course) => (
                    <li key={course.id}>
                      <Link href={`/dashboard/learn/${course.id}`} className="tile-soft block p-4">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {course.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {[course.providerName, course.type].filter(Boolean).join(' · ') ||
                            'On ATHENA'}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  No course on ATHENA covers these yet. The catalogue grows; it is worth a look
                  next month.
                </p>
              )}
            </section>
          )}

          <section className="surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-rose-500" />
                <h2 className="rail-title">Roles to look at</h2>
              </div>
              <Link
                href="/dashboard/jobs"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
              >
                All roles <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {roles.map((job) => (
                <li key={job.id}>
                  <Link href={`/dashboard/jobs/${job.id}`} className="tile-soft block p-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{job.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {[job.organizationName, locationOf(job)].filter(Boolean).join(' · ') ||
                        'Details on the listing'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-rose-600 hover:underline dark:text-rose-400">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
