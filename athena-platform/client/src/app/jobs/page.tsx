'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, MapPin, Search } from 'lucide-react';
import { jobApi } from '@/lib/api';
import { Job } from '@/lib/types';
import JobCard, { JOB_TYPES } from '@/components/jobs/JobCard';
import {
  EmptyState,
  FilterPill,
  PageHero,
  PageShell,
  Section,
  TileSkeleton,
} from '@/components/layout/PageShell';

const PAGE_SIZE = 10;

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsContent />
    </Suspense>
  );
}

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* The URL is the single source of truth for the filters. Before this, the
     pills and the fetch both read component state, so applying a filter raced
     the state update and searched with the previous value. */
  const query = searchParams.get('q') ?? '';
  const city = searchParams.get('loc') ?? '';
  /* An unknown ?type= — a hand-edited or stale URL — would filter every job
     out while no pill looked selected, so it is dropped rather than sent. */
  const typeParam = searchParams.get('type') ?? '';
  const type = JOB_TYPES.some((t) => t.value === typeParam) ? typeParam : '';
  const remoteOnly = searchParams.get('remote') === 'true';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const hasFilters = Boolean(query || city || type || remoteOnly);

  /* Draft values for the two text inputs, which only commit on submit. */
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftCity, setDraftCity] = useState(city);
  useEffect(() => setDraftQuery(query), [query]);
  useEffect(() => setDraftCity(city), [city]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      router.push(qs ? `/jobs?${qs}` : '/jobs');
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    jobApi
      .search({
        page,
        limit: PAGE_SIZE,
        search: query || undefined,
        city: city || undefined,
        type: type || undefined,
        remote: remoteOnly || undefined,
      })
      .then((response) => {
        if (cancelled) return;
        const data = response.data?.data;
        setJobs(Array.isArray(data) ? data : []);
        setTotal(response.data?.pagination?.total ?? 0);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setJobs([]);
        setTotal(0);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, city, type, remoteOnly, page, reloadKey]);

  const clearFilters = () => router.push('/jobs');

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* Back to page one of the same search, for a ?page= past the last result. */
  const firstPageHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const qs = params.toString();
    return qs ? `/jobs?${qs}` : '/jobs';
  })();

  return (
    <PageShell width="wide">
      <div className="space-y-6">
        <PageHero
          kicker="Jobs"
          title="Find work that fits the life you're building"
          description="Every role here was listed by an employer on ATHENA, with the pay they're offering and where the work actually happens. Whatever you're working towards, you don't have to do it alone."
          primaryAction={{ label: 'Your applications', href: '/dashboard/applications' }}
          secondaryAction={{ label: 'Hiring? List a role', href: '/employer' }}
        />

        {/* Search and filters */}
        <section className="surface p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setParams({ q: draftQuery.trim(), loc: draftCity.trim(), page: null });
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                aria-label="Search job titles and descriptions"
                placeholder="Job title, skill or keyword"
                className="focusable w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            <div className="relative sm:w-56">
              <MapPin
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={draftCity}
                onChange={(e) => setDraftCity(e.target.value)}
                aria-label="Filter by city"
                placeholder="City"
                className="focusable w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            <button
              type="submit"
              className="focusable rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Search
            </button>
          </form>

          <div className="mt-5 space-y-3">
            <div>
              <p className="kicker mb-2">Type of work</p>
              <div className="flex flex-wrap gap-2">
                <FilterPill active={!type} onClick={() => setParams({ type: null, page: null })}>
                  Any type
                </FilterPill>
                {JOB_TYPES.map((option) => (
                  <FilterPill
                    key={option.value}
                    active={type === option.value}
                    onClick={() =>
                      setParams({
                        type: type === option.value ? null : option.value,
                        page: null,
                      })
                    }
                  >
                    {option.label}
                  </FilterPill>
                ))}
              </div>
            </div>

            <div>
              <p className="kicker mb-2">Where you work</p>
              <FilterPill
                active={remoteOnly}
                onClick={() => setParams({ remote: remoteOnly ? null : 'true', page: null })}
              >
                Remote only
              </FilterPill>
            </div>
          </div>
        </section>

        <Section
          icon={Briefcase}
          title="Open roles"
          description={resultLine({ loading, failed, total, shown: jobs.length, hasFilters })}
        >
          {failed ? (
            <div className="rounded-xl border border-slate-200 px-6 py-10 text-center dark:border-slate-800">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                Something went wrong loading the jobs. Your filters are still here, so try again in
                a moment.
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="focusable mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <ul className="grid gap-3 lg:grid-cols-2">
              <TileSkeleton count={6} className="h-40" />
            </ul>
          ) : jobs.length === 0 ? (
            total > 0 ? (
              /* Results exist, this page number is simply past the end of them.
                 Neither empty state below is true here, and saying "nothing
                 listed" to someone on ?page=9 of a real result set is a lie. */
              <EmptyState
                icon={Briefcase}
                reason="empty"
                title="That page is past the last result"
                description={`This search has ${lastPage} ${lastPage === 1 ? 'page' : 'pages'} of results, and you are past the end of them.`}
                primaryAction={{ label: 'Back to the first page', href: firstPageHref }}
              />
            ) : hasFilters ? (
              <EmptyState
                icon={Search}
                reason="filtered"
                title="No roles match those filters"
                description="Nothing open fits that combination right now. Widening the search, or dropping the city, usually turns something up."
                onClear={clearFilters}
              />
            ) : (
              <EmptyState
                icon={Briefcase}
                reason="empty"
                title="No roles have been listed yet"
                description="No employer has posted a job on ATHENA so far. If you are hiring, yours would be the first one people see."
                primaryAction={{ label: 'List a role', href: '/employer' }}
              />
            )
          ) : (
            <>
              <ul className="grid gap-3 lg:grid-cols-2">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>

              {total > PAGE_SIZE && (
                <nav
                  aria-label="Job results pages"
                  className="mt-6 flex items-center justify-center gap-3"
                >
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setParams({ page: page > 2 ? String(page - 1) : null })}
                    className="focusable rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Page {page} of {lastPage}
                  </span>
                  <button
                    type="button"
                    disabled={page >= lastPage}
                    onClick={() => setParams({ page: String(page + 1) })}
                    className="focusable rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </Section>
      </div>
    </PageShell>
  );
}

/**
 * The count line under the section heading. It says which of the four states
 * the list is in, so "0 roles" never reads as a failure and a failure never
 * reads as an empty marketplace.
 */
function resultLine({
  loading,
  failed,
  total,
  shown,
  hasFilters,
}: {
  loading: boolean;
  failed: boolean;
  total: number;
  shown: number;
  hasFilters: boolean;
}): string {
  if (loading) return 'Loading roles.';
  if (failed) return 'We could not reach the job listings just now.';
  if (total === 0) return hasFilters ? 'Nothing matched.' : 'Nothing listed so far.';
  if (shown === 0) return 'That page is past the end of the results.';
  const noun = total === 1 ? 'role' : 'roles';
  return hasFilters
    ? `${total} ${noun} match what you asked for.`
    : `${total} ${noun} open right now.`;
}
