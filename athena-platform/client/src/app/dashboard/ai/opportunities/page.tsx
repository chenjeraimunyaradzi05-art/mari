'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Briefcase, CalendarDays, LucideIcon, Radar, Target } from 'lucide-react';
import { algorithmApi } from '@/lib/algorithm-api';

/**
 * What is new on ATHENA.
 *
 * This page used to read /api/ai-algorithms/opportunity-scan, whose
 * opportunityMatch table nothing wrote, so it was a permanently empty list with
 * "interested" and "not relevant" buttons under nothing. It now reads
 * /api/algorithms/opportunity-scan: the newest active roles and courses and the
 * next events. It is not personalised and says so; the viewed and feedback
 * controls went with the scores they belonged to. The personalised scan is
 * Opportunity Radar, linked from the top.
 */

function locationOf(job: { city: string | null; state: string | null; country: string | null }) {
  return [job.city, job.state, job.country].filter(Boolean).join(', ');
}

function whenIs(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function Rail({
  icon: Icon,
  title,
  action,
  isEmpty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action: { label: string; href: string };
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-rose-500" />
          <h2 className="rail-title">{title}</h2>
        </div>
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
        >
          {action.label} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {isEmpty ? (
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Nothing new here just now.
        </p>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  );
}

const tileClass = 'tile-soft block p-4';
const tileTitle = 'text-sm font-semibold text-slate-900 dark:text-white';
const tileNote = 'mt-1 text-xs text-slate-500 dark:text-slate-400';

export default function OpportunityScanPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['opportunity-scan'],
    queryFn: algorithmApi.opportunityScan,
    select: (response) => response.data.data,
  });

  const jobs = data?.jobs ?? [];
  const courses = data?.courses ?? [];
  const events = data?.events ?? [];
  const nothingNew = Boolean(data) && jobs.length + courses.length + events.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Radar className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">New this week</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
          What is new on ATHENA
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          The latest roles, courses and events, newest first. These are the newest listings, not a
          match to your profile.
        </p>
      </div>

      <div className="tile-soft flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Looking for roles matched to you? Opportunity Radar reads your skills and goals.
          </p>
        </div>
        <Link
          href="/dashboard/ai/opportunity-radar"
          className="focusable rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Open Opportunity Radar
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="surface p-6">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            We could not load the latest listings just now. Please try again shortly.
          </p>
        </div>
      )}

      {nothingNew && (
        <div className="surface px-6 py-12 text-center">
          <Radar className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">A quiet week</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
            No new roles, courses or events have been listed. Opportunity Radar can still look
            across everything that is live.
          </p>
        </div>
      )}

      {data && !nothingNew && (
        <>
          <Rail
            icon={Briefcase}
            title="Roles"
            action={{ label: 'All roles', href: '/dashboard/jobs' }}
            isEmpty={jobs.length === 0}
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/dashboard/jobs/${job.id}`} className={tileClass}>
                    <p className={tileTitle}>{job.title}</p>
                    <p className={tileNote}>
                      {[job.organizationName, locationOf(job)].filter(Boolean).join(' · ') ||
                        'Details on the listing'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Rail>

          <Rail
            icon={BookOpen}
            title="Courses"
            action={{ label: 'All courses', href: '/dashboard/learn' }}
            isEmpty={courses.length === 0}
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {courses.map((course) => (
                <li key={course.id}>
                  <Link href={`/dashboard/learn/${course.id}`} className={tileClass}>
                    <p className={tileTitle}>{course.title}</p>
                    <p className={tileNote}>
                      {[course.providerName, course.type].filter(Boolean).join(' · ') || 'On ATHENA'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Rail>

          <Rail
            icon={CalendarDays}
            title="Events"
            action={{ label: 'All events', href: '/dashboard/events' }}
            isEmpty={events.length === 0}
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {events.map((event) => (
                <li key={event.id} className="tile-soft p-4">
                  <p className={tileTitle}>{event.title}</p>
                  <p className={tileNote}>
                    {[whenIs(event.date), event.location].filter(Boolean).join(' · ') || 'Date on the event page'}
                  </p>
                </li>
              ))}
            </ul>
          </Rail>
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
