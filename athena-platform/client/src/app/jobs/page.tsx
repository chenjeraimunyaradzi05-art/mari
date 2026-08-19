'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Briefcase,
  Filter,
  MapPin,
  Search,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { jobApi } from '@/lib/api';
import { Job } from '@/lib/types';
import JobCard from '@/components/jobs/JobCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner as LoadingSpinner } from '@/components/ui/loading';
import {
  FALLBACK_JOBS,
  filterFallbackJobs,
  isFallbackJobId,
} from '@/lib/public-fallbacks';
import { arePublicFallbacksEnabled } from '@/lib/runtime-config';

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

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('loc') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [isRemote, setIsRemote] = useState(searchParams.get('remote') === 'true');

  const fetchJobs = async () => {
    setLoading(true);
    setLoadMessage(null);
    setLoadError(null);

    try {
      const response = await jobApi.search({
        page,
        limit: 10,
        search,
        city: location,
        type: type || undefined,
        remote: isRemote || undefined,
      });
      const nextJobs = response.data.data as Job[];
      const fallbackMode =
        arePublicFallbacksEnabled() &&
        (Boolean(response.data.meta?.fallback) ||
          nextJobs.some((job) => isFallbackJobId(job.id)));

      setJobs(fallbackMode ? nextJobs : nextJobs.filter((job) => !isFallbackJobId(job.id)));
      setTotal(fallbackMode ? response.data.pagination.total : nextJobs.filter((job) => !isFallbackJobId(job.id)).length);
      setUsingFallbackData(fallbackMode);
      setLoadMessage(
        fallbackMode
          ? 'Live roles are reconnecting. Showing curated spotlight opportunities in the meantime.'
          : null
      );
    } catch (error) {
      console.error('Failed to fetch jobs:', error);

      if (arePublicFallbacksEnabled()) {
        const fallbackJobs = filterFallbackJobs(FALLBACK_JOBS, {
          search,
          location,
          type,
          isRemote,
        });

        setJobs(fallbackJobs);
        setTotal(fallbackJobs.length);
        setUsingFallbackData(true);
        setLoadMessage(
          'Live roles are reconnecting. Showing curated spotlight opportunities in the meantime.'
        );
      } else {
        setJobs([]);
        setTotal(0);
        setUsingFallbackData(false);
        setLoadError('Live job listings are temporarily unavailable. Please try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchParams]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    fetchJobs();

    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (location) params.set('loc', location);
    if (type) params.set('type', type);
    if (isRemote) params.set('remote', 'true');
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-aurora px-4 py-8 text-slate-900 dark:text-slate-100">
      <div aria-hidden="true" className="cyber-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative container mx-auto max-w-7xl">
        <div className="mb-8 overflow-hidden rounded-2xl border border-primary-100/60 bg-white/90 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/85">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary-200/70 bg-primary-50/80 px-3 py-1 text-xs font-semibold text-primary-700 backdrop-blur dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-300">
                <span className="status-dot status-dot-online h-1.5 w-1.5" />
                <Briefcase className="h-3.5 w-3.5" />
                Careers intelligence
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
                <span className="gradient-text-cyber">Explore roles</span> without losing momentum.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                Search open jobs, narrow by location and work style, and keep
                moving even while live data sync catches up.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[{label:'Search',sub:'Keyword, role, company'},{label:'Filter',sub:'Type, city, remote'},{label:'Live',sub:'Current roles from ATHENA'}].map((item)=>(
                <div key={item.label} className="metric-card-futuristic rounded-xl px-4 py-4">
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">{item.label}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="w-full flex-shrink-0 space-y-6 md:w-64">
            <div className="glass-card rounded-xl p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Filter className="h-4 w-4" /> Filters
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Job Type
                  </label>
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERNSHIP">Internship</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remote"
                    checked={isRemote}
                    onChange={(event) => setIsRemote(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="remote" className="text-sm">
                    Remote Only
                  </label>
                </div>

                <Button onClick={() => { setPage(1); fetchJobs(); }} className="w-full">
                  Apply Filters
                </Button>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <div className="mb-6 overflow-hidden rounded-xl border border-primary-100/50 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
              <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search job titles or keywords..."
                    className="pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="relative w-full md:w-48">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Location"
                    className="pl-9"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                  />
                </div>
                <Button type="submit">Search</Button>
              </form>
            </div>

            {usingFallbackData && loadMessage && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                <div className="flex items-start gap-3">
                  <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Live sync temporarily unavailable
                    </div>
                    <p className="mt-1 text-sm leading-6 opacity-90">
                      {loadMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!usingFallbackData && loadError && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5 text-red-950 shadow-sm dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
                <div className="flex items-start gap-3">
                  <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Live jobs unavailable</div>
                    <p className="mt-1 text-sm leading-6 opacity-90">{loadError}</p>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Found {total} {usingFallbackData ? 'spotlight roles' : 'jobs'}
                  </div>
                  {usingFallbackData && (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      Curated spotlight mode
                    </div>
                  )}
                </div>

                {jobs.length > 0 ? (
                  jobs.map((job) => <JobCard key={job.id} job={job} />)
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center dark:border-slate-700 dark:bg-slate-900">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      No jobs found
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      {loadError || 'Try adjusting your filters or search terms.'}
                    </p>
                    <Button
                      variant="link"
                      onClick={() => {
                        setSearch('');
                        setLocation('');
                        setType('');
                        setIsRemote(false);
                        setPage(1);
                        setTimeout(fetchJobs, 100);
                      }}
                    >
                      Clear all filters
                    </Button>
                  </div>
                )}

                {!usingFallbackData && total > 10 && (
                  <div className="mt-8 flex justify-center gap-2">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((currentPage) => currentPage - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={page * 10 >= total}
                      onClick={() => setPage((currentPage) => currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
