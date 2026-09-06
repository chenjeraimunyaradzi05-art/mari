'use client';

/**
 * Three open roles, as cards someone would want to tap: the employer's mark,
 * the title, where it is, and the pay in a pill because every job here shows
 * it. Renders nothing at all when there are no jobs, rather than a promise.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Briefcase, Clock, MapPin, Wifi } from 'lucide-react';
import { jobApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Rail, SkeletonTiles, StaggerItem, StaggerList, TILE_GRADIENTS } from './RailShell';

type Job = {
  id: string;
  title: string;
  type?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isRemote?: boolean;
  salaryMin?: number | null;
  salaryMax?: number | null;
  showSalary?: boolean;
  organization?: { id: string; name?: string | null; logo?: string | null } | null;
};

function salaryLabel(job: Job): string | null {
  if (job.showSalary === false) return null;
  const { salaryMin: min, salaryMax: max } = job;
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : new Intl.NumberFormat('en-AU').format(n));
  if (typeof min === 'number' && typeof max === 'number') return `$${fmt(min)} – $${fmt(max)}`;
  if (typeof min === 'number') return `From $${fmt(min)}`;
  if (typeof max === 'number') return `Up to $${fmt(max)}`;
  return null;
}

function locationLabel(job: Job): string {
  const parts = [job.city, job.state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : job.country || 'Location flexible';
}

const typeLabel = (type?: string | null) => (type ? type.replace(/[_-]+/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null);

function initials(name?: string | null): string {
  if (!name) return 'A';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function JobSpotlight() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    jobApi
      .search({ limit: 3 })
      .then((response) => {
        if (cancelled) return;
        const data = response.data?.data;
        setJobs(Array.isArray(data) ? data : []);
        setTotal(response.data?.pagination?.total ?? null);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (jobs !== null && jobs.length === 0) return null;

  return (
    <Rail
      icon={Briefcase}
      tone="rose"
      kicker="Jobs"
      title="Jobs worth a look"
      titleId="home-jobs-title"
      description={total !== null ? `${total.toLocaleString('en-AU')} open right now, and every one shows the pay.` : 'From employers who tell you the pay up front.'}
      cta={{ href: '/jobs', label: 'Browse all jobs' }}
    >
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {jobs === null ? (
          <SkeletonTiles count={3} height="h-44" />
        ) : (
          jobs.map((job, index) => {
            const salary = salaryLabel(job);
            const type = typeLabel(job.type);
            return (
              <StaggerItem key={job.id}>
                <Link href={`/jobs/${job.id}`} className="tile-glass group flex h-full flex-col p-4">
                  <span className="flex items-start justify-between gap-3">
                    {job.organization?.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- employer logos come from the media store
                      <img src={job.organization.logo} alt="" className="h-11 w-11 rounded-xl object-cover" />
                    ) : (
                      <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white', TILE_GRADIENTS[index % TILE_GRADIENTS.length])}>{initials(job.organization?.name)}</span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {job.isRemote ? (
                        <>
                          <Wifi className="h-3 w-3" /> Remote
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3 w-3" /> {locationLabel(job)}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">{job.title}</span>
                  <span className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {job.organization?.name || 'ATHENA employer'}
                    {type ? ` · ${type}` : ''}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                    {salary ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{salary}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" /> Pay on the listing
                      </span>
                    )}
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition-colors group-hover:bg-rose-500 dark:bg-white dark:text-slate-900 dark:group-hover:bg-rose-400">
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
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
