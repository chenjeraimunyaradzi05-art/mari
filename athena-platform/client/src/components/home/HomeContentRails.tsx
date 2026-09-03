'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, GraduationCap, Users } from 'lucide-react';
import { courseApi, groupsApi } from '@/lib/api';

/* ------------------------------------------------------------------ courses */

type Course = {
  id: string;
  title: string;
  providerName?: string | null;
  type?: string | null;
  durationMonths?: number | null;
  studyMode?: string[] | null;
  cost?: number | null;
  employmentRate?: number | null;
  avgStartingSalary?: number | null;
};

const money = (n: number) =>
  n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${new Intl.NumberFormat('en-AU').format(n)}`;

function duration(months?: number | null): string | null {
  if (!months) return null;
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return years === 1 ? '1 yr' : `${Number.isInteger(years) ? years : years.toFixed(1)} yrs`;
}

export function LearningRail() {
  const [courses, setCourses] = useState<Course[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    courseApi
      .getAll({ limit: 3 })
      .then((r) => {
        if (cancelled) return;
        const data = r.data?.data;
        setCourses(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (courses !== null && courses.length === 0) return null;

  return (
    <section className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-rose-500" />
            <h2 className="rail-title">Learn something new</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Real courses, and what happened to the people who finished them.
          </p>
        </div>
        <Link
          href="/learning"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
        >
          See all courses <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {courses === null
          ? [0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
              />
            ))
          : courses.map((course) => {
              const free = course.cost === 0;
              const dur = duration(course.durationMonths);
              return (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.id}`}
                    className="tile-soft flex h-full flex-col p-4"
                  >
                    <span className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {course.title}
                    </span>
                    <span className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {course.providerName || 'ATHENA provider'}
                    </span>

                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {free ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          Free
                        </span>
                      ) : (
                        typeof course.cost === 'number' && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {money(course.cost)}
                          </span>
                        )
                      )}
                      {dur && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <Clock className="h-2.5 w-2.5" />
                          {dur}
                        </span>
                      )}
                      {course.studyMode?.[0] && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {course.studyMode[0].replace('-', ' ')}
                        </span>
                      )}
                    </span>

                    {/* Outcomes are the reason to pick one of these over a MOOC. */}
                    {(course.employmentRate || course.avgStartingSalary) && (
                      <span className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {typeof course.employmentRate === 'number' && (
                          <span>
                            <strong className="text-sm font-semibold text-slate-900 dark:text-white">
                              {course.employmentRate}%
                            </strong>{' '}
                            employed
                          </span>
                        )}
                        {typeof course.avgStartingSalary === 'number' && (
                          <span>
                            <strong className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              {money(course.avgStartingSalary)}
                            </strong>{' '}
                            median start
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- communities */

type Group = {
  id: string;
  name: string;
  description?: string | null;
  memberCount?: number | null;
  privacy?: string | null;
};

const GROUP_TINTS = [
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
  'from-violet-500 to-indigo-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-fuchsia-500 to-purple-500',
];

export function CommunityRail() {
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    groupsApi
      .list()
      .then((r) => {
        if (cancelled) return;
        const data = r.data?.data;
        setGroups(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (groups !== null && groups.length === 0) return null;

  return (
    <section className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-500" />
            <h2 className="rail-title">Find your people</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Smaller rooms, for wherever you happen to be right now.
          </p>
        </div>
        <Link
          href="/communities"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
        >
          See them all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups === null
          ? [0, 1, 2, 3].map((i) => (
              <li
                key={i}
                className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
              />
            ))
          : groups.slice(0, 4).map((group, index) => (
              <li key={group.id}>
                <Link
                  href={`/dashboard/groups/${group.id}`}
                  className="tile-soft flex h-full gap-3 p-4"
                >
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${
                      GROUP_TINTS[index % GROUP_TINTS.length]
                    } text-xs font-bold text-white`}
                  >
                    {group.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {group.name}
                    </span>
                    {group.description && (
                      <span className="mt-0.5 line-clamp-1 block text-xs leading-4 text-slate-500 dark:text-slate-400">
                        {group.description}
                      </span>
                    )}
                    {/* A "1 member" badge reads worse than no badge at all. */}
                    {typeof group.memberCount === 'number' && group.memberCount > 1 && (
                      <span className="mt-1.5 block text-[11px] text-slate-400">
                        {group.memberCount.toLocaleString()} members
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
