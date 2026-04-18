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

const FALLBACK_JOBS: Job[] = [
  {
    id: 'spotlight-product-ops',
    title: 'Product Operations Lead',
    slug: 'product-operations-lead',
    description:
      'Build launch systems, close feedback loops, and coordinate cross-functional delivery across product, support, and growth teams.',
    postedById: 'athena-demo',
    type: 'FULL_TIME',
    status: 'ACTIVE',
    city: 'Perth',
    state: 'WA',
    country: 'Australia',
    isRemote: true,
    salaryMin: 120000,
    salaryMax: 145000,
    showSalary: true,
    viewCount: 0,
    applicationCount: 0,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    publishedAt: '2026-04-12T08:00:00.000Z',
    organization: {
      id: 'org-athena',
      name: 'ATHENA Labs',
      slug: 'athena-labs',
      country: 'Australia',
      industry: 'Career Technology',
      isVerified: true,
      safetyScore: 98,
    },
  },
  {
    id: 'spotlight-growth-marketing',
    title: 'Growth Marketing Strategist',
    slug: 'growth-marketing-strategist',
    description:
      'Own lifecycle campaigns, referral experiments, and creator partnerships focused on women building long-term career momentum.',
    postedById: 'athena-demo',
    type: 'CONTRACT',
    status: 'ACTIVE',
    city: 'Sydney',
    state: 'NSW',
    country: 'Australia',
    isRemote: true,
    salaryMin: 90000,
    salaryMax: 115000,
    showSalary: true,
    viewCount: 0,
    applicationCount: 0,
    createdAt: '2026-04-02T08:00:00.000Z',
    updatedAt: '2026-04-02T08:00:00.000Z',
    publishedAt: '2026-04-10T08:00:00.000Z',
    organization: {
      id: 'org-lighthouse',
      name: 'Lighthouse Studio',
      slug: 'lighthouse-studio',
      country: 'Australia',
      industry: 'Digital Strategy',
      isVerified: true,
      safetyScore: 94,
    },
  },
  {
    id: 'spotlight-community-partnerships',
    title: 'Community Partnerships Manager',
    slug: 'community-partnerships-manager',
    description:
      'Shape partner activations, mentorship experiences, and regional events that bring trusted opportunities into the ATHENA ecosystem.',
    postedById: 'athena-demo',
    type: 'PART_TIME',
    status: 'ACTIVE',
    city: 'Melbourne',
    state: 'VIC',
    country: 'Australia',
    isRemote: false,
    salaryMin: 70000,
    salaryMax: 90000,
    showSalary: true,
    viewCount: 0,
    applicationCount: 0,
    createdAt: '2026-04-03T08:00:00.000Z',
    updatedAt: '2026-04-03T08:00:00.000Z',
    publishedAt: '2026-04-08T08:00:00.000Z',
    organization: {
      id: 'org-rise',
      name: 'Rise Collective',
      slug: 'rise-collective',
      country: 'Australia',
      industry: 'Community & Partnerships',
      isVerified: true,
      safetyScore: 96,
    },
  },
];

function filterFallbackJobs(
  jobs: Job[],
  params: { search: string; location: string; type: string; isRemote: boolean }
) {
  const searchNeedle = params.search.trim().toLowerCase();
  const locationNeedle = params.location.trim().toLowerCase();

  return jobs.filter((job) => {
    if (params.type && job.type !== params.type) {
      return false;
    }

    if (params.isRemote && !job.isRemote) {
      return false;
    }

    if (
      searchNeedle &&
      !`${job.title} ${job.description} ${job.organization?.name || ''}`
        .toLowerCase()
        .includes(searchNeedle)
    ) {
      return false;
    }

    if (
      locationNeedle &&
      !`${job.city || ''} ${job.state || ''} ${job.country}`
        .toLowerCase()
        .includes(locationNeedle)
    ) {
      return false;
    }

    return true;
  });
}

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

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('loc') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [isRemote, setIsRemote] = useState(searchParams.get('remote') === 'true');

  const fetchJobs = async () => {
    setLoading(true);
    setLoadMessage(null);

    try {
      const response = await jobApi.search({
        page,
        limit: 10,
        search,
        city: location,
        type: type || undefined,
        remote: isRemote || undefined,
      });

      setJobs(response.data.data);
      setTotal(response.data.pagination.total);
      setUsingFallbackData(false);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_40%,#ffffff_100%)] px-4 py-8 text-slate-900 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_42%,#111827_100%)] dark:text-slate-100">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-8 rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-900/75 dark:shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-sm font-medium text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                <Briefcase className="h-4 w-4" />
                Career moves, curated with a dark-first public shell
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
                Explore roles without losing momentum.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                Search open jobs, narrow by location and work style, and keep
                moving even while live data sync catches up.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Search
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Keyword, role, company
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Filter
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Type, city, remote
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Fallback
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Spotlight roles stay visible
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="w-full flex-shrink-0 space-y-6 md:w-64">
            <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/75">
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
            <div className="mb-6 rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/75">
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
              <div className="mb-6 rounded-[1.5rem] border border-amber-200 bg-amber-50/90 p-5 text-amber-950 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
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
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      Curated fallback mode
                    </div>
                  )}
                </div>

                {jobs.length > 0 ? (
                  jobs.map((job) => <JobCard key={job.id} job={job} />)
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/90 py-12 text-center dark:border-white/15 dark:bg-slate-900/70">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      No jobs found
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      Try adjusting your filters or search terms.
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
