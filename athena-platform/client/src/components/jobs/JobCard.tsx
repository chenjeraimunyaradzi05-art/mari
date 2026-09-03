'use client';

import Link from 'next/link';
import { Briefcase, Clock, MapPin, Wallet } from 'lucide-react';
import { Job, JobType } from '@/lib/types';
import { Avatar } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';

/**
 * The six types the `JobType` enum actually has. The old card and the old
 * filter select offered "freelance", which is not one of them, so choosing it
 * always returned nothing.
 */
export const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'APPRENTICESHIP', label: 'Apprenticeship' },
];

export function jobTypeLabel(type: string): string {
  return JOB_TYPES.find((t) => t.value === type)?.label ?? type.toLowerCase().replace(/_/g, ' ');
}

/** Pay on ATHENA is Australian dollars, so it is formatted as Australian. */
const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

function shortAud(amount: number): string {
  /* Only shorten a figure that is exactly that many thousands. Rounding
     $95,500 up to "$96k" quotes a wage the employer did not offer. */
  return amount >= 10000 && amount % 1000 === 0 ? `$${amount / 1000}k` : aud.format(amount);
}

/**
 * Salary only appears when the employer chose to show it — `showSalary` is a
 * real column and quietly ignoring it publishes pay the employer withheld.
 */
function payLine(job: Job): string | null {
  if (!job.showSalary) return null;
  const { salaryMin, salaryMax, salaryType } = job;
  if (!salaryMin && !salaryMax) return null;

  const hourly = salaryType === 'hourly';
  const format = (n: number) => (hourly ? aud.format(n) : shortAud(n));
  const suffix = hourly ? ' an hour' : ' a year';

  if (salaryMin && salaryMax) return `${format(salaryMin)} – ${format(salaryMax)}${suffix}`;
  if (salaryMin) return `From ${format(salaryMin)}${suffix}`;
  return `Up to ${format(salaryMax as number)}${suffix}`;
}

/** `city` / `state` / `country` and `isRemote` — the columns the model has. */
function placeLine(job: Job): string {
  const place = [job.city, job.state].filter(Boolean).join(', ') || job.country;
  if (job.isRemote) return place ? `Remote · ${place}` : 'Remote';
  return place || 'Location not listed';
}

const chip =
  'rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300';

export default function JobCard({ job }: { job: Job }) {
  const isNew = job.publishedAt
    ? new Date(job.publishedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    : false;

  const pay = payLine(job);
  const skills = (job.skills ?? [])
    .slice()
    .sort((a, b) => Number(b.required) - Number(a.required))
    .slice(0, 4);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="focusable tile-soft flex h-full gap-4 p-4 sm:p-5"
    >
      <Avatar
        src={job.organization?.logo || null}
        alt=""
        fallback={job.organization?.name?.slice(0, 2).toUpperCase() || 'AT'}
        size="lg"
        className="hidden shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 sm:flex"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">
              {job.title}
            </h3>
            <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400">
              {job.organization?.name || 'Employer not named'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-1.5">
            {job.hasApplied && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Applied
              </span>
            )}
            {isNew && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                New
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {placeLine(job)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
            {jobTypeLabel(job.type)}
          </span>
          {pay && (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              {pay}
            </span>
          )}
          {job.publishedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Posted {formatRelativeTime(job.publishedAt)}
            </span>
          )}
        </div>

        {skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span key={s.id} className={chip}>
                {s.skill?.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
