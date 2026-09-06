'use client';

/**
 * The course catalogue, in public.
 *
 * Every course here is one a provider has listed through the platform, read
 * from GET /api/courses with the same search and type filters the signed-in
 * learning pages use. Nothing is seeded for show: an empty result says so.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, GraduationCap, Search } from 'lucide-react';
import { courseApi } from '@/lib/api';
import { EmptyState, FilterPill, PageHero, PageShell, Section, TileSkeleton } from '@/components/layout/PageShell';

type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  providerName?: string | null;
  type?: string | null;
  durationMonths?: number | null;
  studyMode?: string[] | null;
  cost?: number | null;
  fundingOptions?: string[] | null;
  organization?: { name: string; logo?: string | null } | null;
};

const PAGE_SIZE = 24;
const TYPES = ['certificate', 'short_course', 'diploma', 'bootcamp', 'degree'];

const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${new Intl.NumberFormat('en-AU').format(n)}`);

function label(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function duration(months?: number | null): string | null {
  if (!months) return null;
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return Number.isInteger(years) ? `${years} yr` : `${years.toFixed(1)} yr`;
}

export default function CoursesPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Search as the person types, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(() => ({ page, limit: PAGE_SIZE, ...(query ? { search: query } : {}), ...(type ? { type } : {}) }), [page, query, type]);

  const courses = useQuery({
    queryKey: ['courses', params],
    queryFn: () => courseApi.getAll(params),
    select: (r) => ({
      items: (Array.isArray(r.data?.data) ? r.data.data : []) as Course[],
      total: (r.data?.pagination?.total as number | undefined) ?? 0,
      pages: (r.data?.pagination?.pages as number | undefined) ?? 1,
    }),
  });

  const filtersOn = query !== '' || type !== null;
  const items = courses.data?.items ?? [];

  return (
    <PageShell width="wide">
      <PageHero
        kicker="Learning"
        title="Courses"
        description="Short courses, certificates, diplomas, bootcamps and degrees, listed by the providers who run them. Search, filter by type, and enrol from the course page."
        primaryAction={{ label: 'Your certificates', href: '/certifications' }}
        secondaryAction={{ label: 'Apprenticeships', href: '/apprenticeships' }}
        facts={courses.data ? [`${courses.data.total.toLocaleString('en-AU')} ${courses.data.total === 1 ? 'course' : 'courses'} listed`] : undefined}
      />

      <Section icon={GraduationCap} title="Find a course">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or description" aria-label="Search courses" className="input w-full pl-9" />
          </label>
          <FilterPill
            active={type === null}
            onClick={() => {
              setType(null);
              setPage(1);
            }}
          >
            All types
          </FilterPill>
          {TYPES.map((t) => (
            <FilterPill
              key={t}
              active={type === t}
              onClick={() => {
                setType(type === t ? null : t);
                setPage(1);
              }}
            >
              {label(t)}
            </FilterPill>
          ))}
        </div>

        {courses.isLoading ? (
          <TileSkeleton count={6} />
        ) : courses.isError ? (
          <EmptyState icon={BookOpen} reason="empty" title="The catalogue did not load" description="Try again in a moment." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            reason={filtersOn ? 'filtered' : 'empty'}
            title={filtersOn ? 'No courses match' : 'No courses listed yet'}
            description={filtersOn ? 'Loosen the search or pick another type.' : 'Providers list their own courses. Education providers can add theirs from their dashboard.'}
            onClear={
              filtersOn
                ? () => {
                    setSearch('');
                    setType(null);
                    setPage(1);
                  }
                : undefined
            }
          />
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((course) => (
                <li key={course.id}>
                  <Link href={`/dashboard/learn/${course.id}`} className="surface block h-full p-5 transition hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{course.title}</h3>
                      {course.type && <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{label(course.type)}</span>}
                    </div>
                    <p className="text-sm text-slate-500">{course.providerName || course.organization?.name || 'Provider not stated'}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{course.description}</p>
                    <p className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      {duration(course.durationMonths) && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {duration(course.durationMonths)}
                        </span>
                      )}
                      {Array.isArray(course.studyMode) && course.studyMode.length > 0 && <span>{course.studyMode.map(label).join(', ')}</span>}
                      <span className={course.cost === 0 ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''}>{course.cost == null ? 'Cost on enquiry' : course.cost === 0 ? 'Fee-free' : money(course.cost)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            {(courses.data?.pages ?? 1) > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3 text-sm">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-outline disabled:opacity-50">
                  Previous
                </button>
                <span className="text-slate-500">
                  Page {page} of {courses.data?.pages}
                </span>
                <button type="button" onClick={() => setPage((p) => Math.min(courses.data?.pages ?? p, p + 1))} disabled={page >= (courses.data?.pages ?? 1)} className="btn-outline disabled:opacity-50">
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </Section>
    </PageShell>
  );
}
