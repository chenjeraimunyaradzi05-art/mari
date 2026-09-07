'use client';

/**
 * Two rails of live rows: courses from the providers who run them, with what
 * happened to the people who finished; and the communities, as rooms someone
 * might want to walk into.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, GraduationCap, Sparkles, Users } from 'lucide-react';
import { courseApi, groupsApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { GoButton, Rail, SkeletonTiles, StaggerItem, StaggerList, TILE_GRADIENTS } from './RailShell';

/* ------------------------------------------------------------------ courses */

type Course = {
  id: string;
  slug?: string;
  title: string;
  providerName?: string | null;
  organization?: { name?: string | null } | null;
  type?: string | null;
  durationMonths?: number | null;
  studyMode?: string[] | null;
  cost?: number | null;
  employmentRate?: number | null;
  avgStartingSalary?: number | null;
};

const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${new Intl.NumberFormat('en-AU').format(n)}`);

function duration(months?: number | null): string | null {
  if (!months) return null;
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return years === 1 ? '1 yr' : `${Number.isInteger(years) ? years : years.toFixed(1)} yrs`;
}

/** A colour per kind of course, so a glance tells a short course from a degree. */
const TYPE_STRIPE: Record<string, string> = {
  certificate: 'from-violet-500 to-indigo-500',
  short_course: 'from-amber-400 to-orange-500',
  diploma: 'from-rose-500 to-pink-500',
  degree: 'from-sky-400 to-cyan-500',
  bootcamp: 'from-emerald-400 to-teal-500',
};
const typeLabel = (t?: string | null) => (t ? t.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Course');

export function LearningRail() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  // True when the rows are the member's own recommendations rather than the catalogue.
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const rows = (r: { data?: { data?: unknown } }) => (Array.isArray(r.data?.data) ? (r.data.data as Course[]) : []);
    const load = async () => {
      if (isAuthenticated) {
        try {
          const picks = rows(await courseApi.getRecommendations());
          if (picks.length > 0) {
            if (!cancelled) {
              setCourses(picks.slice(0, 3));
              setPicked(true);
            }
            return;
          }
        } catch {
          // The catalogue is the fallback.
        }
      }
      const list = rows(await courseApi.getAll({ limit: 3 }));
      if (!cancelled) {
        setCourses(list);
        setPicked(false);
      }
    };
    load().catch(() => {
      if (!cancelled) setCourses([]);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  if (courses !== null && courses.length === 0) return null;

  return (
    <Rail icon={GraduationCap} tone="violet" kicker="for your mind" title={picked ? 'Picked for you' : 'Grow into something new'} titleId="home-learning-title" description={picked ? 'Chosen from what you have done here so far.' : 'Real courses from real providers, and what happened to the women who finished them.'} cta={{ href: '/courses', label: 'Browse courses' }}>
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {courses === null ? (
          <SkeletonTiles count={3} height="h-52" />
        ) : (
          courses.map((course) => {
            const free = course.cost === 0;
            const dur = duration(course.durationMonths);
            const stripe = TYPE_STRIPE[course.type ?? ''] ?? 'from-slate-400 to-slate-500';
            const employed = typeof course.employmentRate === 'number' ? Math.max(0, Math.min(100, course.employmentRate)) : null;
            return (
              <StaggerItem key={course.id}>
                <Link href={`/courses/${course.slug ?? course.id}`} className="tile-glass group flex h-full flex-col overflow-hidden">
                  <span aria-hidden className={cn('block h-1.5 w-full bg-gradient-to-r', stripe)} />
                  <span className="flex flex-1 flex-col p-4">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{typeLabel(course.type)}</span>
                      {free ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Fee-free</span>
                      ) : (
                        typeof course.cost === 'number' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">{money(course.cost)}</span>
                      )}
                    </span>
                    <span className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">{course.title}</span>
                    <span className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{course.providerName || course.organization?.name || 'ATHENA provider'}</span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {dur && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {dur}
                        </span>
                      )}
                      {course.studyMode?.[0] && <span className="capitalize">{course.studyMode[0].replace(/-/g, ' ')}</span>}
                    </span>

                    {/* One soft line on outcomes, the reason to pick one of these over a video course. */}
                    <span className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <span className="min-w-0 text-xs leading-5 text-slate-600 dark:text-slate-400">
                        {employed !== null && (
                          <>
                            <span className="font-display text-base font-semibold not-italic text-slate-900 dark:text-white">{employed}%</span> in work after
                          </>
                        )}
                        {employed !== null && typeof course.avgStartingSalary === 'number' && ' · '}
                        {typeof course.avgStartingSalary === 'number' && (
                          <>
                            <span className="font-display text-base font-semibold text-emerald-600 dark:text-emerald-400">{money(course.avgStartingSalary)}</span> to start
                          </>
                        )}
                        {employed === null && typeof course.avgStartingSalary !== 'number' && 'Outcomes not stated yet'}
                      </span>
                      <GoButton />
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            );
          })
        )}
      </StaggerList>
    </Rail>
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
    <Rail icon={Users} tone="amber" kicker="for your people" title="Find your people" titleId="home-communities-title" description="Small rooms for wherever you happen to be right now. Pull up a chair." cta={{ href: '/communities', label: 'See every room' }}>
      <StaggerList className="grid gap-3 sm:grid-cols-2">
        {groups === null ? (
          <SkeletonTiles count={4} height="h-28" />
        ) : (
          groups.slice(0, 4).map((group, index) => (
            <StaggerItem key={group.id}>
              <Link href={`/dashboard/groups/${group.id}`} className="tile-glass group flex h-full gap-3 p-4">
                <span className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-bold text-white', TILE_GRADIENTS[index % TILE_GRADIENTS.length])}>{group.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{group.name}</span>
                    <GoButton className="h-7 w-7" />
                  </span>
                  {group.description && <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600 dark:text-slate-400">{group.description}</span>}
                  <span className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    {/* A "1 member" badge reads worse than no badge at all. */}
                    {typeof group.memberCount === 'number' && group.memberCount > 1 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" /> {group.memberCount.toLocaleString('en-AU')} members
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-rose-500 dark:text-rose-300">
                      <Sparkles className="h-3 w-3" /> You are welcome here
                    </span>
                  </span>
                </span>
              </Link>
            </StaggerItem>
          ))
        )}
      </StaggerList>
    </Rail>
  );
}
