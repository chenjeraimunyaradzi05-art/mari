'use client';

import { ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  Clock,
  FileText,
  GraduationCap,
  Hammer,
  Library,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useCourses } from '@/lib/hooks';
import {
  EmptyState,
  FilterPill,
  PageHero,
  PageShell,
  Section,
  TileSkeleton,
} from '@/components/layout/PageShell';

/**
 * The learning hub.
 *
 * This page used to be four static link tiles that showed no courses at all,
 * while the catalogue behind it held real ones. It now lists the actual
 * courses — fee, length, study mode and the outcome figures each provider
 * reports — and keeps the four links as a secondary section.
 */

type Course = {
  id: string;
  title: string;
  providerName?: string | null;
  organization?: { name?: string | null } | null;
  type?: string | null;
  durationMonths?: number | null;
  studyMode?: unknown;
  cost?: number | null;
  fundingOptions?: unknown;
  employmentRate?: number | null;
  avgStartingSalary?: number | null;
};

/* Formatting is lifted from the homepage LearningRail so a course reads the
   same wherever it turns up. */
const money = (n: number) =>
  n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${new Intl.NumberFormat('en-AU').format(n)}`;

function duration(months?: number | null): string | null {
  if (!months) return null;
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return years === 1 ? '1 yr' : `${Number.isInteger(years) ? years : years.toFixed(1)} yrs`;
}

/** `studyMode` and `fundingOptions` are Json columns, so they arrive as an
 *  array or as a JSON string depending on the driver. Same tolerance as the
 *  course detail page. */
function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        );
      }
    } catch {
      return [value];
    }
  }
  return [];
}

/** "short_course" -> "Short course". */
function label(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Chip({ children, free = false }: { children: ReactNode; free?: boolean }) {
  return (
    <span
      className={
        free
          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }
    >
      {children}
    </span>
  );
}

function CourseTile({ course }: { course: Course }) {
  const free = course.cost === 0;
  const dur = duration(course.durationMonths);
  const modes = toStringList(course.studyMode);
  const funding = toStringList(course.fundingOptions);
  const provider = course.providerName || course.organization?.name;

  return (
    <li>
      {/* The course detail view lives under the learning dashboard. */}
      <Link
        href={`/dashboard/learn/${course.id}`}
        className="tile-soft focusable flex h-full flex-col p-4"
      >
        <span className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
          {course.title}
        </span>
        {provider && (
          <span className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{provider}</span>
        )}

        <span className="mt-3 flex flex-wrap gap-1.5">
          {free ? (
            <Chip free>Free</Chip>
          ) : (
            typeof course.cost === 'number' && <Chip>{money(course.cost)}</Chip>
          )}
          {dur && (
            <Chip>
              <Clock className="h-2.5 w-2.5" />
              {dur}
            </Chip>
          )}
          {modes[0] && <Chip>{label(modes[0])}</Chip>}
          {course.type && <Chip>{label(course.type)}</Chip>}
        </span>

        {funding.length > 0 && (
          <span className="mt-2 block text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            Funding: {funding.slice(0, 2).join(', ')}
          </span>
        )}

        {/* Outcomes are the reason to pick one of these over a free video course. */}
        {(typeof course.employmentRate === 'number' ||
          typeof course.avgStartingSalary === 'number') && (
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
}

/* Each of these has to go somewhere that actually does what the line says. */
const MORE_WAYS = [
  {
    href: '/certifications',
    icon: Award,
    title: 'Your certificates',
    copy: 'The ones you have earned, each with a code an employer can check.',
  },
  {
    href: '/dashboard/learn/my-courses',
    icon: BookOpen,
    title: 'Courses you have started',
    copy: 'Pick one back up where you left it, and see how far through you are.',
  },
  {
    href: '/dashboard/learn',
    icon: Search,
    title: 'Search the catalogue',
    copy: 'The same courses, with a search box and filters for type and study mode.',
  },
  {
    href: '/dashboard/learn/applications',
    icon: FileText,
    title: 'Your applications',
    copy: 'Where each course application you have sent has got to.',
  },
  {
    href: '/apprenticeships',
    icon: Hammer,
    title: 'Apprenticeships',
    copy: 'Train on the job, with an employer paying you while you learn.',
  },
];

export default function LearningPage() {
  const [type, setType] = useState<string | null>(null);
  const [feeFreeOnly, setFeeFreeOnly] = useState(false);

  const { data, isLoading, isError, isFetching, refetch } = useCourses({ limit: 24 });

  const courses: Course[] = useMemo(
    () => (Array.isArray(data?.courses) ? (data.courses as Course[]) : []),
    [data]
  );
  const total: number = data?.totalCourses ?? courses.length;

  const types = useMemo(() => {
    const seen: string[] = [];
    for (const course of courses) {
      const value = typeof course.type === 'string' ? course.type.trim() : '';
      if (value && !seen.includes(value)) seen.push(value);
    }
    return seen.sort((a, b) => label(a).localeCompare(label(b)));
  }, [courses]);

  const hasFeeFree = courses.some((course) => course.cost === 0);
  const filtersOn = type !== null || feeFreeOnly;

  const visible = courses.filter((course) => {
    if (type && course.type !== type) return false;
    if (feeFreeOnly && course.cost !== 0) return false;
    return true;
  });

  const clearFilters = () => {
    setType(null);
    setFeeFreeOnly(false);
  };

  return (
    <PageShell width="wide">
      <div className="space-y-5">
        <PageHero
          kicker="Learning"
          title="Learn something new, without guessing where it leads"
          description="Every course here comes with its fee, how long it runs, how you study it and what happened to the people who finished. Whatever you are working towards, you do not have to work it out alone."
          primaryAction={{ label: 'Courses you have started', href: '/dashboard/learn/my-courses' }}
          secondaryAction={{ label: 'Apprenticeships', href: '/apprenticeships' }}
          facts={!isLoading && !isError && total > 0 ? [`${total} courses listed`] : undefined}
        />

        <Section
          icon={GraduationCap}
          title="Courses you can start from here"
          description="Fees, study modes and outcomes, as each provider reports them."
        >
          {isError ? (
            <div className="surface px-6 py-12 text-center">
              <RefreshCw className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                We could not load the courses
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
                Something went wrong between here and the catalogue. Have another go, or come back
                in a minute.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="focusable mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {isFetching ? 'Trying again' : 'Try again'}
              </button>
            </div>
          ) : (
            <>
              {!isLoading && courses.length > 0 && (types.length > 1 || hasFeeFree) && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <FilterPill active={!filtersOn} onClick={clearFilters}>
                    All courses
                  </FilterPill>
                  {types.map((value) => (
                    <FilterPill
                      key={value}
                      active={type === value}
                      onClick={() => setType(type === value ? null : value)}
                    >
                      {label(value)}
                    </FilterPill>
                  ))}
                  {hasFeeFree && (
                    <FilterPill active={feeFreeOnly} onClick={() => setFeeFreeOnly((on) => !on)}>
                      No course fee
                    </FilterPill>
                  )}
                </div>
              )}

              {isLoading ? (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <TileSkeleton count={6} className="h-44" />
                </ul>
              ) : visible.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((course) => (
                    <CourseTile key={course.id} course={course} />
                  ))}
                </ul>
              ) : filtersOn ? (
                <EmptyState
                  icon={GraduationCap}
                  reason="filtered"
                  title="No courses match that"
                  description="Nothing in the catalogue fits the study type and fee you picked. Clear it and the full list comes back."
                  onClear={clearFilters}
                />
              ) : (
                <EmptyState
                  icon={GraduationCap}
                  reason="empty"
                  title="No courses are listed yet"
                  description="Nothing has been added to the catalogue so far. Apprenticeships are another way in while this fills up, and anything you have already started is still under your own courses."
                  primaryAction={{ label: 'Browse apprenticeships', href: '/apprenticeships' }}
                  secondaryAction={{ label: 'Courses you have started', href: '/dashboard/learn/my-courses' }}
                />
              )}
            </>
          )}
        </Section>

        <Section
          icon={Library}
          title="More ways to learn"
          description="The rest of the learning side of ATHENA, in one place."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {MORE_WAYS.map(({ href, icon: Icon, title, copy }) => (
              <li key={href}>
                <Link href={href} className="tile-soft focusable flex h-full gap-3 p-4">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {copy}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </PageShell>
  );
}
