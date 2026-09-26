'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Rocket, Users, BadgeCheck, Loader2 } from 'lucide-react';
import { businessApi } from '@/lib/api';
import { formatCurrency, formatDate, pluralize } from '@/lib/utils';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'ENROLLING', label: 'Enrolling' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const toNumber = (value: any) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type AcceleratorCohort = {
  id: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  priceAud?: string | number | null;
  status: string;
  enrollmentCount?: number;
  sessionCount?: number;
  spotsRemaining?: number;
};

type AcceleratorEnrollment = {
  id: string;
  status: string;
  paymentStatus: string;
  enrolledAt: string;
  cohort: AcceleratorCohort;
};

// What a place means to her, in words. The row used to print the raw enum —
// "Status DROPPED" beside a green "PAID" — which after a cancellation read as
// though she still had a paid place in a cohort that was not going to run.
function placeLabel(e: AcceleratorEnrollment): { text: string; tone: 'ok' | 'wait' | 'ended' } {
  if (e.status === 'COMPLETED' || e.status === 'GRADUATED') return { text: 'Completed', tone: 'ok' };
  if (e.status === 'DROPPED') {
    if (e.paymentStatus === 'PAID') return { text: 'Place ended · payment still to be returned', tone: 'wait' };
    if (e.paymentStatus === 'REFUNDED') return { text: 'Place ended · payment returned', tone: 'ended' };
    return { text: 'Place ended', tone: 'ended' };
  }
  if (e.paymentStatus === 'PAID') return { text: 'Paid · place confirmed', tone: 'ok' };
  return { text: 'Not paid yet · place not confirmed', tone: 'wait' };
}

const toneClass = {
  ok: 'bg-emerald-50 text-emerald-700',
  wait: 'bg-amber-50 text-amber-800',
  ended: 'bg-slate-100 text-slate-600',
} as const;

export default function AcceleratorPage() {
  const [status, setStatus] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [cohorts, setCohorts] = useState<AcceleratorCohort[]>([]);
  const [enrollments, setEnrollments] = useState<AcceleratorEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept apart from `error`, which an enrolment attempt also sets: only a failed
  // load means the lists below are not an answer.
  const [loadFailed, setLoadFailed] = useState(false);

  const headerLabel = useMemo(() => {
    if (upcomingOnly) return 'Upcoming cohorts';
    if (status) return `${status.replace('_', ' ').toLowerCase()} cohorts`;
    return 'All cohorts';
  }, [status, upcomingOnly]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const [cohortsRes, enrollmentsRes] = await Promise.all([
        businessApi.getAccelerators({ status: status || undefined, upcoming: upcomingOnly || undefined }),
        businessApi.getMyAcceleratorEnrollments(),
      ]);
      setCohorts(cohortsRes.data?.data || []);
      setEnrollments(enrollmentsRes.data?.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load accelerator cohorts.');
      setLoadFailed(true);
      setCohorts([]);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [status, upcomingOnly]);

  const handleEnroll = async (cohortId: string) => {
    setSavingId(cohortId);
    setError(null);
    try {
      await businessApi.enrollInAccelerator(cohortId);
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to enroll in cohort.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Rocket className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Accelerators</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
            Scale your business with expert-led cohorts
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {headerLabel}. Learn, build, and graduate alongside founders.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/grants" className="btn-secondary inline-flex items-center gap-2">
            Explore grants
          </Link>
          <Link href="/dashboard/rfps" className="btn-primary inline-flex items-center gap-2">
            Post an RFP
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Status</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(event) => setUpcomingOnly(event.target.checked)}
            className="rounded border-slate-300"
          />
          Show only upcoming cohorts
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading accelerator cohorts...
        </div>
      ) : loadFailed ? null : cohorts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-slate-500">
          No cohorts found. Adjust your filters or check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cohorts.map((cohort) => (
            <div
              key={cohort.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{cohort.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {cohort.description || 'Founder-friendly cohort with structured mentorship.'}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                  {cohort.status.replace('_', ' ')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(cohort.startDate)} → {formatDate(cohort.endDate)}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {cohort.enrollmentCount ?? 0} enrolled · {cohort.spotsRemaining ?? 0} spots left
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4" />
                  {pluralize(cohort.sessionCount ?? 0, 'session')}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(toNumber(cohort.priceAud))}
                </div>
              </div>
              <button
                onClick={() => handleEnroll(cohort.id)}
                disabled={savingId === cohort.id}
                className="btn-primary w-full"
              >
                {savingId === cohort.id ? 'Enrolling...' : 'Enroll in cohort'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your enrollments</h2>
        {loading ? null : loadFailed ? (
          <p className="text-sm text-slate-500">Your enrolments could not be loaded just now, so they are not shown.</p>
        ) : enrollments.length === 0 ? (
          <p className="text-sm text-slate-500">No enrollments yet.</p>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => (
              <div key={enrollment.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {enrollment.cohort.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Enrolled {formatDate(enrollment.enrolledAt)}
                      {enrollment.cohort.status === 'CANCELLED' ? ' · this cohort was cancelled' : ''}
                    </div>
                    <Link href={`/dashboard/accelerator/${enrollment.id}`} className="mt-1 mr-3 inline-block text-xs font-medium text-primary-600 hover:underline">Week by week</Link>
                    {enrollment.status === 'COMPLETED' && (
                      <Link href={`/certificates/accelerator/${enrollment.id}`} className="mt-1 inline-block text-xs font-medium text-primary-600 hover:underline">Certificate of completion</Link>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${toneClass[placeLabel(enrollment).tone]}`}>
                    {placeLabel(enrollment).text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
