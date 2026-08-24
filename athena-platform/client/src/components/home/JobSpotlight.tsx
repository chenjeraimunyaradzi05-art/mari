'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Briefcase, MapPin, Wifi } from 'lucide-react';
import { jobApi } from '@/lib/api';

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
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : new Intl.NumberFormat('en-AU').format(n);

  if (typeof min === 'number' && typeof max === 'number') return `$${fmt(min)} – $${fmt(max)}`;
  if (typeof min === 'number') return `From $${fmt(min)}`;
  if (typeof max === 'number') return `Up to $${fmt(max)}`;
  return null;
}

function locationLabel(job: Job): string {
  const parts = [job.city, job.state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : job.country || 'Location flexible';
}

function initials(name?: string | null): string {
  if (!name) return 'ATH';
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
      .search({ limit: 4 })
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
    <section className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-rose-500" />
            <h2 className="rail-title">Jobs worth a look</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {total !== null
              ? `${total} of them right now — and every one shows the salary.`
              : 'From employers who tell you the salary up front.'}
          </p>
        </div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
        >
          Browse all jobs <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {jobs === null
          ? [0, 1, 2, 3].map((i) => (
              <li
                key={i}
                className="h-[92px] animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
              />
            ))
          : jobs.map((job) => {
              const salary = salaryLabel(job);
              return (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="tile-soft flex h-full gap-3 p-4"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-purple-600 text-[11px] font-bold text-white">
                      {initials(job.organization?.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {job.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {job.organization?.name || 'ATHENA employer'}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
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
                        {salary && (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {salary}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
      </ul>
    </section>
  );
}
