'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Briefcase, History, Lock, Scale, Search, Send } from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { EmptyState, PageHero, PageShell, Section } from '@/components/layout/PageShell';

/**
 * Salary insights.
 *
 * Everything here comes from pay that people on ATHENA have actually shared
 * (`SalaryDataPoint`), read back through `/api/ai-algorithms/salary-equity/*`.
 * No seeded figures, no modelled ranges, no illustrative pay gaps: the server
 * refuses to return a benchmark until at least five people have shared pay for
 * a role, and only reports a gender gap once at least three women and three men
 * are in that sample. Where there is not enough, we say so and ask the reader to
 * add the first data point rather than showing a number we invented.
 *
 * Note for future work: the older `/api/salary/*` routes read from a hardcoded
 * in-memory table the service itself labels "simulated". They are deliberately
 * not used here.
 */

type SalaryBands = {
  p10?: number | string | null;
  p25?: number | string | null;
  p50?: number | string | null;
  p75?: number | string | null;
  p90?: number | string | null;
};

type SalaryAnalysis = {
  id: string;
  targetRole: string;
  targetLocation?: string | null;
  marketMedian: number | string;
  genderGapAmount?: number | string | null;
  genderGapPercent?: number | null;
  sampleSize: number;
  salaryBands?: SalaryBands | null;
  generatedAt?: string;
};

type BenchmarkState = 'idle' | 'loading' | 'ready' | 'thin' | 'error';

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NON_BINARY', label: 'Non-binary' },
];

const EDUCATION_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'HIGH_SCHOOL', label: 'High school' },
  { value: 'BACHELOR', label: 'Bachelor' },
  { value: 'MASTER', label: 'Master' },
  { value: 'PHD', label: 'PhD' },
  { value: 'OTHER', label: 'Other' },
];

const fieldClass =
  'focusable w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500';
const labelClass = 'mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300';

const currencyFormat = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

function money(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount)) return null;
  return currencyFormat.format(amount);
}

function errorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string; error?: string } } })
    ?.response;
  return response?.data?.message || response?.data?.error || fallback;
}

/* ----------------------------------------------------------------- results */

const BAND_ROWS: { key: keyof SalaryBands; label: string; note: string }[] = [
  { key: 'p10', label: '10th percentile', note: 'The lowest end of what was shared' },
  { key: 'p25', label: '25th percentile', note: 'A quarter reported less than this' },
  { key: 'p50', label: 'Median', note: 'The middle of the shared figures' },
  { key: 'p75', label: '75th percentile', note: 'A quarter reported more than this' },
  { key: 'p90', label: '90th percentile', note: 'The top end of what was shared' },
];

function BenchmarkResult({ analysis }: { analysis: SalaryAnalysis }) {
  const bands = analysis.salaryBands ?? {};
  const gapPercent = analysis.genderGapPercent;
  const gapAmount = money(analysis.genderGapAmount);

  return (
    <div className="space-y-4">
      <div className="tile-soft p-4">
        <p className="kicker">Median base salary</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {money(analysis.marketMedian) ?? 'Not available'}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          From {analysis.sampleSize}{' '}
          {analysis.sampleSize === 1 ? 'salary shared' : 'salaries shared'} for{' '}
          {analysis.targetRole}
          {analysis.targetLocation ? ` in ${analysis.targetLocation}` : ''}. Base salary only, in
          Australian dollars, before bonus or equity.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {BAND_ROWS.map((row) => {
          const amount = money(bands[row.key]);
          if (!amount) return null;
          return (
            <li key={row.key} className="tile-soft p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{row.label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{amount}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-500">{row.note}</p>
            </li>
          );
        })}
      </ul>

      <div className="tile-soft p-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Gender pay gap</h3>
        </div>
        {typeof gapPercent === 'number' ? (
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            In this sample the median for men sits {gapPercent.toFixed(1)}%
            {gapAmount ? ` (${gapAmount})` : ''} above the median for women. It is a straight
            comparison of medians, not adjusted for experience or seniority.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Not enough to say. A gap is only reported once at least three women and three men have
            shared pay for this role, so no one can be identified from it.
          </p>
        )}
      </div>

      <p className="text-xs leading-5 text-slate-500 dark:text-slate-500">
        These are figures members chose to share. They are not checked against payslips, and a small
        sample can move a long way when one more person adds theirs.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- the page */

export default function SalaryInsightsPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.isLoading);

  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [benchmarkState, setBenchmarkState] = useState<BenchmarkState>('idle');
  const [analysis, setAnalysis] = useState<SalaryAnalysis | null>(null);
  const [benchmarkError, setBenchmarkError] = useState('');
  const [askedFor, setAskedFor] = useState('');

  const [form, setForm] = useState({
    jobTitle: '',
    baseSalary: '',
    bonus: '',
    company: '',
    industry: '',
    city: '',
    yearsExperience: '',
    educationLevel: '',
    gender: '',
    isRemote: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [history, setHistory] = useState<SalaryAnalysis[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);

  const loadHistory = useCallback(() => {
    if (!isAuthenticated) {
      setHistory(null);
      setHistoryFailed(false);
      return;
    }
    aiAlgorithmsApi
      .getMySalaryAnalyses()
      .then((response) => {
        const data = response.data?.data;
        setHistoryFailed(false);
        setHistory(Array.isArray(data) ? (data as SalaryAnalysis[]) : []);
      })
      .catch(() => {
        setHistoryFailed(true);
        setHistory([]);
      });
  }, [isAuthenticated]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runBenchmark = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedRole = role.trim();
    const trimmedLocation = location.trim();
    if (!trimmedRole) return;

    setBenchmarkState('loading');
    setBenchmarkError('');
    setAnalysis(null);
    setAskedFor(trimmedLocation ? `${trimmedRole} in ${trimmedLocation}` : trimmedRole);

    try {
      const response = await aiAlgorithmsApi.analyzeSalary({
        role: trimmedRole,
        ...(trimmedLocation ? { location: trimmedLocation } : {}),
      });
      const data = response.data?.data as SalaryAnalysis | null | undefined;
      if (data) {
        setAnalysis(data);
        setBenchmarkState('ready');
        loadHistory();
      } else {
        setBenchmarkState('thin');
      }
    } catch (error) {
      setBenchmarkError(errorMessage(error, 'We could not reach the salary data just now.'));
      setBenchmarkState('error');
    }
  };

  const shareSalary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const baseSalary = Number(form.baseSalary);
    if (!form.jobTitle.trim() || !Number.isFinite(baseSalary) || baseSalary <= 0) {
      setSubmitError('A job title and a base salary are needed before this can be counted.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const bonus = Number(form.bonus);
      const years = Number(form.yearsExperience);
      await aiAlgorithmsApi.submitSalaryData({
        jobTitle: form.jobTitle.trim(),
        baseSalary,
        currency: 'AUD',
        isRemote: form.isRemote,
        ...(form.bonus && Number.isFinite(bonus) ? { bonus } : {}),
        ...(form.company.trim() ? { company: form.company.trim() } : {}),
        ...(form.industry.trim() ? { industry: form.industry.trim() } : {}),
        ...(form.city.trim() ? { city: form.city.trim() } : {}),
        ...(form.yearsExperience && Number.isFinite(years) ? { yearsExperience: years } : {}),
        ...(form.educationLevel ? { educationLevel: form.educationLevel } : {}),
        ...(form.gender ? { gender: form.gender } : {}),
      });
      setSubmitted(true);
      setForm({
        jobTitle: '',
        baseSalary: '',
        bonus: '',
        company: '',
        industry: '',
        city: '',
        yearsExperience: '',
        educationLevel: '',
        gender: '',
        isRemote: false,
      });
    } catch (error) {
      setSubmitError(errorMessage(error, 'That did not save. Please try again in a moment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const signedOut = !authLoading && !isAuthenticated;

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHero
          kicker="Pay transparency"
          title="Know what the work is worth before you ask for it"
          description="Every figure here was shared by someone on ATHENA. Nothing is estimated or filled in for effect, and where there is not enough data yet we say so."
          primaryAction={{ label: 'Add your salary', href: '#share' }}
          secondaryAction={{ label: 'Roles with pay listed', href: '/jobs' }}
        />

        {signedOut && (
          <div className="surface flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                Pay data stays behind a sign-in, inside the community that built it. Sign in to look
                up a role or to add your own.
              </p>
            </div>
            <Link
              href="/login"
              className="focusable rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Sign in
            </Link>
          </div>
        )}

        <Section
          icon={Search}
          title="Look up a role"
          description="A benchmark appears once five or more people have shared pay for that role. Below five there is nothing honest to show."
        >
          <form onSubmit={runBenchmark} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className={labelClass} htmlFor="benchmark-role">
                Role
              </label>
              <input
                id="benchmark-role"
                className={fieldClass}
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="Product designer"
                disabled={signedOut}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="benchmark-location">
                City (optional)
              </label>
              <input
                id="benchmark-location"
                className={fieldClass}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Brisbane"
                disabled={signedOut}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={signedOut || benchmarkState === 'loading' || !role.trim()}
                className="focusable w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {benchmarkState === 'loading' ? 'Looking' : 'Look up'}
              </button>
            </div>
          </form>

          <div className="mt-4">
            {benchmarkState === 'idle' && (
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                Type a role to see the spread of what people have reported. Leave the city blank to
                include every location.
              </p>
            )}

            {benchmarkState === 'loading' && (
              <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
            )}

            {benchmarkState === 'ready' && analysis && <BenchmarkResult analysis={analysis} />}

            {benchmarkState === 'thin' && (
              <EmptyState
                icon={BarChart3}
                reason="empty"
                title="Not enough pay data for that role yet"
                description={`Fewer than five people have shared pay for ${
                  askedFor || 'that role'
                }, so there is no benchmark we would stand behind. If you know the number, yours could be the one that starts it.`}
                primaryAction={{ label: 'Add your salary', href: '#share' }}
                secondaryAction={{ label: 'See roles with pay listed', href: '/jobs' }}
              />
            )}

            {benchmarkState === 'error' && (
              <EmptyState
                icon={BarChart3}
                reason="empty"
                title="We could not load the pay data"
                description={benchmarkError}
                secondaryAction={{ label: 'See roles with pay listed', href: '/jobs' }}
              />
            )}
          </div>
        </Section>

        <div id="share" className="scroll-mt-24" />

        <Section
          icon={Send}
          title="Add your salary"
          description="Shared without your name attached. Only the role, the pay and whatever else you choose to add go into a benchmark."
        >
          {submitted ? (
            <div className="tile-soft p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Thank you, that is counted
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Your figure joins the pool for that role. It shows up in a benchmark once five people
                have shared pay for the same title.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="focusable mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Add another
              </button>
            </div>
          ) : (
            <form onSubmit={shareSalary} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="share-title">
                  Job title
                </label>
                <input
                  id="share-title"
                  className={fieldClass}
                  value={form.jobTitle}
                  onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
                  placeholder="Product designer"
                  disabled={signedOut}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="share-base">
                  Base salary (AUD a year)
                </label>
                <input
                  id="share-base"
                  className={fieldClass}
                  type="number"
                  min={0}
                  step={1000}
                  inputMode="numeric"
                  value={form.baseSalary}
                  onChange={(event) => setForm({ ...form, baseSalary: event.target.value })}
                  disabled={signedOut}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="share-bonus">
                  Bonus (optional)
                </label>
                <input
                  id="share-bonus"
                  className={fieldClass}
                  type="number"
                  min={0}
                  step={500}
                  inputMode="numeric"
                  value={form.bonus}
                  onChange={(event) => setForm({ ...form, bonus: event.target.value })}
                  disabled={signedOut}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="share-city">
                  City (optional)
                </label>
                <input
                  id="share-city"
                  className={fieldClass}
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  placeholder="Brisbane"
                  disabled={signedOut}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="share-industry">
                  Industry (optional)
                </label>
                <input
                  id="share-industry"
                  className={fieldClass}
                  value={form.industry}
                  onChange={(event) => setForm({ ...form, industry: event.target.value })}
                  disabled={signedOut}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="share-company">
                  Employer (optional)
                </label>
                <input
                  id="share-company"
                  className={fieldClass}
                  value={form.company}
                  onChange={(event) => setForm({ ...form, company: event.target.value })}
                  disabled={signedOut}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="share-years">
                  Years of experience (optional)
                </label>
                <input
                  id="share-years"
                  className={fieldClass}
                  type="number"
                  min={0}
                  max={60}
                  inputMode="numeric"
                  value={form.yearsExperience}
                  onChange={(event) => setForm({ ...form, yearsExperience: event.target.value })}
                  disabled={signedOut}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="share-education">
                  Highest qualification (optional)
                </label>
                <select
                  id="share-education"
                  className={fieldClass}
                  value={form.educationLevel}
                  onChange={(event) => setForm({ ...form, educationLevel: event.target.value })}
                  disabled={signedOut}
                >
                  {EDUCATION_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="share-gender">
                  Gender (optional)
                </label>
                <select
                  id="share-gender"
                  className={fieldClass}
                  value={form.gender}
                  onChange={(event) => setForm({ ...form, gender: event.target.value })}
                  disabled={signedOut}
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-500">
                  Used only to work out a pay gap, and only once at least three women and three men
                  have shared pay for the same role.
                </p>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="share-remote"
                  type="checkbox"
                  className="focusable h-4 w-4 rounded border-slate-300 text-rose-600 dark:border-slate-700"
                  checked={form.isRemote}
                  onChange={(event) => setForm({ ...form, isRemote: event.target.checked })}
                  disabled={signedOut}
                />
                <label htmlFor="share-remote" className="text-sm text-slate-700 dark:text-slate-300">
                  This role is remote
                </label>
              </div>

              {submitError && (
                <p className="text-sm leading-6 text-rose-600 dark:text-rose-400 sm:col-span-2">
                  {submitError}
                </p>
              )}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={signedOut || submitting}
                  className="focusable rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Saving' : 'Share my salary'}
                </button>
              </div>
            </form>
          )}
        </Section>

        {isAuthenticated && (
          <Section
            icon={History}
            title="Roles you have looked up"
            description="Kept so you can watch a benchmark shift as more people add theirs."
          >
            {history === null ? (
              <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
            ) : historyFailed ? (
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                We could not load your past lookups just now. They have not been lost, so please try
                again shortly.
              </p>
            ) : history.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                Nothing yet. Look up a role above and it will be kept here.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {history.map((item) => (
                  <li key={item.id} className="tile-soft p-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.targetRole}
                      {item.targetLocation ? ` · ${item.targetLocation}` : ''}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      Median {money(item.marketMedian) ?? 'not available'}, from {item.sampleSize}{' '}
                      {item.sampleSize === 1 ? 'salary' : 'salaries'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <Section
          icon={Briefcase}
          title="Pay you can see without asking"
          description="Roles on ATHENA carry a salary range wherever the employer has published one."
          action={{ label: 'Browse roles', href: '/jobs' }}
        >
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            A listed range is the employer&apos;s own figure, not a benchmark from this page. Reading
            both together is the point: one tells you what is on offer, the other what people already
            in the job are paid.
          </p>
        </Section>
      </div>
    </PageShell>
  );
}
