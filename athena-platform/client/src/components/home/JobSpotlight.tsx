'use client';

/**
 * Finding work, in one rail with two tabs: open roles (every one shows the
 * pay) and paid apprenticeships (the wage, the level, the training package).
 * Both come from the platform's own tables; a tab with nothing in it is not
 * offered, and the rail renders nothing when neither has anything.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Briefcase, Clock, Hammer, MapPin, Wifi } from 'lucide-react';
import { jobApi } from '@/lib/api';
import { apprenticeshipApi } from '@/lib/api-extensions';
import { cn } from '@/lib/utils';
import { GoButton, Rail, SkeletonTiles, StaggerItem, StaggerList, TILE_GRADIENTS } from './RailShell';

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

type Apprenticeship = {
  id: string;
  title: string;
  framework?: string | null;
  level?: string | null;
  durationMonths?: number | null;
  wageMin?: number | null;
  wageMax?: number | null;
  city?: string | null;
  state?: string | null;
  isRemote?: boolean;
  rto?: { name?: string | null; logo?: string | null } | null;
  hostEmployer?: { name?: string | null; logo?: string | null } | null;
};

const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : new Intl.NumberFormat('en-AU').format(n));

function range(min?: number | null, max?: number | null): string | null {
  if (typeof min === 'number' && typeof max === 'number') return `$${fmt(min)} – $${fmt(max)}`;
  if (typeof min === 'number') return `From $${fmt(min)}`;
  if (typeof max === 'number') return `Up to $${fmt(max)}`;
  return null;
}

const place = (x: { city?: string | null; state?: string | null; country?: string | null }) => {
  const parts = [x.city, x.state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : x.country || 'Location flexible';
};

const titleCase = (v?: string | null) =>
  v
    ? v
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bIii\b/g, 'III')
        .replace(/\bIi\b/g, 'II')
        .replace(/\bIv\b/g, 'IV')
    : null;

function initials(name?: string | null): string {
  if (!name) return 'A';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function Mark({ name, logo, index }: { name?: string | null; logo?: string | null; index: number }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element -- employer and provider logos come from the media store
    return <img src={logo} alt="" className="h-11 w-11 rounded-xl object-cover" />;
  }
  return <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white', TILE_GRADIENTS[index % TILE_GRADIENTS.length])}>{initials(name)}</span>;
}

type Tab = 'jobs' | 'apprenticeships';

export function JobSpotlight() {
  const reduce = useReducedMotion();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [apprenticeships, setApprenticeships] = useState<Apprenticeship[] | null>(null);
  const [tab, setTab] = useState<Tab>('jobs');

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
    // Featured ones first; when nothing is flagged, the newest open listings.
    const rows = (response: { data?: { data?: unknown } }) => (Array.isArray(response.data?.data) ? (response.data.data as Apprenticeship[]) : []);
    apprenticeshipApi
      .getFeatured()
      .then(async (response) => {
        const featured = rows(response);
        if (featured.length > 0) return featured;
        return rows(await apprenticeshipApi.getAll({ limit: 3 }));
      })
      .then((list) => {
        if (!cancelled) setApprenticeships(list.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setApprenticeships([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasJobs = jobs === null || jobs.length > 0;
  const hasApprenticeships = apprenticeships !== null && apprenticeships.length > 0;
  if (jobs !== null && jobs.length === 0 && !hasApprenticeships) return null;
  const showTabs = hasJobs && hasApprenticeships;
  const current: Tab = showTabs ? tab : hasJobs ? 'jobs' : 'apprenticeships';

  const TABS: Array<{ id: Tab; label: string; icon: typeof Briefcase }> = [
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'apprenticeships', label: 'Apprenticeships', icon: Hammer },
  ];

  return (
    <Rail
      icon={Briefcase}
      tone="rose"
      kicker="for your working life"
      title={current === 'jobs' ? 'Roles that could be yours' : 'Learn on the job, and be paid for it'}
      titleId="home-jobs-title"
      description={current === 'jobs' ? (total !== null ? `${total.toLocaleString('en-AU')} open right now, every one with the pay shown, so you never have to ask.` : 'From employers who tell you the pay up front.') : 'Apprenticeships and traineeships with a registered provider, the wage shown.'}
      cta={current === 'jobs' ? { href: '/jobs', label: 'Browse all jobs' } : { href: '/apprenticeships', label: 'All apprenticeships' }}
    >
      {showTabs && (
        <div role="tablist" aria-label="Kind of work" className="mb-4 inline-flex rounded-full border border-rose-100/80 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
          {TABS.map((t) => {
            const on = current === t.id;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)} className={cn('focusable relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition', on ? 'text-white' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white')}>
                {on && <motion.span layoutId={reduce ? undefined : 'work-tab-active'} aria-hidden className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)]" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                <t.icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={current} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
          {current === 'jobs' ? (
            <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {jobs === null ? (
                <SkeletonTiles count={3} height="h-44" />
              ) : (
                jobs.map((job, index) => {
                  const salary = job.showSalary === false ? null : range(job.salaryMin, job.salaryMax);
                  return (
                    <StaggerItem key={job.id}>
                      <Link href={`/jobs/${job.id}`} className="tile-glass group flex h-full flex-col p-4">
                        <span className="flex items-start justify-between gap-3">
                          <Mark name={job.organization?.name} logo={job.organization?.logo} index={index} />
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {job.isRemote ? (
                              <>
                                <Wifi className="h-3 w-3" /> Remote
                              </>
                            ) : (
                              <>
                                <MapPin className="h-3 w-3" /> {place(job)}
                              </>
                            )}
                          </span>
                        </span>
                        <span className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">{job.title}</span>
                        <span className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{job.organization?.name || 'ATHENA employer'}</span>
                        <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                          {salary ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{salary}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="h-3 w-3" /> Pay on the listing
                            </span>
                          )}
                          <GoButton />
                        </span>
                      </Link>
                    </StaggerItem>
                  );
                })
              )}
            </StaggerList>
          ) : (
            <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(apprenticeships ?? []).map((a, index) => {
                const wage = range(a.wageMin, a.wageMax);
                const who = a.hostEmployer?.name || a.rto?.name;
                return (
                  <StaggerItem key={a.id}>
                    <Link href={`/apprenticeships/${a.id}`} className="tile-glass group flex h-full flex-col p-4">
                      <span className="flex items-start justify-between gap-3">
                        <Mark name={who} logo={a.hostEmployer?.logo || a.rto?.logo} index={index + 2} />
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {a.isRemote ? (
                            <>
                              <Wifi className="h-3 w-3" /> Remote
                            </>
                          ) : (
                            <>
                              <MapPin className="h-3 w-3" /> {place(a)}
                            </>
                          )}
                        </span>
                      </span>
                      <span className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">{a.title}</span>
                      <span className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {who || 'Registered provider'}
                        {a.level ? ` · ${titleCase(a.level)}` : ''}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {a.framework && <span className="truncate">{a.framework}</span>}
                        {a.durationMonths ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {a.durationMonths} months
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                        {wage ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{wage} while you train</span> : <span className="text-xs text-slate-400">Wage on the listing</span>}
                        <GoButton />
                      </span>
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </motion.div>
      </AnimatePresence>
    </Rail>
  );
}
