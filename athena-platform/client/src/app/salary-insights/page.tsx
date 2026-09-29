'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Briefcase,
  Building2,
  History,
  Lock,
  MessageSquare,
  Scale,
  Search,
  Send,
} from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';
import {
  algorithmApi,
  salaryApi,
  type NegotiationScenario,
  type NegotiationScript,
  type SalaryEquityResult,
} from '@/lib/algorithm-api';
import { useAuthStore } from '@/lib/store';
import { EmptyState, PageHero, PageShell, Section } from '@/components/layout/PageShell';

/**
 * Salary insights.
 *
 * The benchmark comes from pay that people on ATHENA have actually shared
 * (`SalaryDataPoint`), read back through `/api/ai-algorithms/salary-equity/*`.
 * No seeded figures, no modelled ranges, no illustrative pay gaps. The server
 * publishes a cut point only with at least five contributors on either side of
 * it, so a median needs ten people, the quartiles twenty and the 10th and 90th
 * percentiles fifty, and every figure it publishes is rounded to the nearest
 * thousand dollars. A gender gap needs ten women and ten men, the same rule
 * applied to each side's median. Where there is not enough, we say so and ask
 * the reader to add a data point rather than showing a number we invented.
 *
 * This page used to say five people and "three women and three men". Those
 * were the floors two changes ago; the server raised them because a median of
 * three or five reports is close enough to one person's pay to name her, and
 * the page went on promising members a smaller crowd than the one their figure
 * actually hides in. The numbers below mirror the server's, and where the
 * server says in its own words why something is withheld, that is what is
 * shown.
 *
 * Two more sources sit beside it, each labelled as what it is:
 *   - `/api/algorithms/salary-equity` is the median of the ranges employers
 *     advertise on active listings with that title, quoted only from three
 *     listings up. It is the employer's own figure, not member-reported pay,
 *     and the page says which is which. Its canned `tips` are not shown.
 *   - `POST /api/salary/negotiation-script` is a coaching template per
 *     scenario, filled in only with what the member typed. It is presented as
 *     a template to adapt, never as advice about what she is owed.
 *
 * On `/api/salary/*` generally: the simulated table and the benchmark, range,
 * pay-gap and submit routes that sat on it are gone (see the header of server
 * salary.routes.ts), because they had fallen behind the privacy floors above.
 * What remains there is the negotiation template and the company transparency
 * measure, which counts only the share of an employer's roles that publish a
 * range.
 */

/**
 * The server's publication floors, from ai-algorithms.routes.ts: five
 * contributors either side of any published cut point.
 */
const MEDIAN_MIN_CONTRIBUTORS = 10;
const RANGE_MIN_CONTRIBUTORS = 20;
const GAP_MIN_PER_GENDER = 10;

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

type AdvertisedState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: SalaryEquityResult }
  | { status: 'error' };

/** Three listings with a published range is the floor the server holds too. */
const MIN_ADVERTISED_LISTINGS = 3;

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

// The 10th and 90th used to be described as "the lowest end" and "the top end
// of what was shared", which reads as the lowest and highest salary anyone
// reported. They are not, and could not be without publishing two people's pay:
// a tenth of the sample sits beyond each of them.
const BAND_ROWS: { key: keyof SalaryBands; label: string; note: string }[] = [
  { key: 'p10', label: '10th percentile', note: 'A tenth reported less than this' },
  { key: 'p25', label: '25th percentile', note: 'A quarter reported less than this' },
  { key: 'p50', label: 'Median', note: 'The middle of the shared figures' },
  { key: 'p75', label: '75th percentile', note: 'A quarter reported more than this' },
  { key: 'p90', label: '90th percentile', note: 'A tenth reported more than this' },
];

/**
 * The gap in words, by its sign. The server computes it as the men's median
 * less the women's, so a negative figure means women's pay sits higher. The
 * sentence used to say "above" whatever the sign, which described a gap in
 * women's favour as one against them and printed a minus sign in the amount.
 */
function describeGap(percent: number, amount: number | null): string {
  if (percent === 0 || amount === 0) {
    return 'In this sample the medians for men and for women are the same, to the nearest thousand dollars.';
  }
  const share = Math.abs(percent) < 0.1 ? 'less than 0.1%' : `${Math.abs(percent).toFixed(1)}%`;
  const dollars = amount !== null && Number.isFinite(amount) ? money(Math.abs(amount)) : null;
  const inBrackets = dollars ? ` (${dollars})` : '';
  const direction = percent > 0 ? 'above' : 'below';
  return `In this sample the median for men sits ${share}${inBrackets} ${direction} the median for women.`;
}

function BenchmarkResult({
  analysis,
  gapWithheld,
  bandWithheld,
}: {
  analysis: SalaryAnalysis;
  /** The server's own reason a gap is not shown, when it gave one. */
  gapWithheld?: string | null;
  /** The server's own reason the range is not shown, when it gave one. */
  bandWithheld?: string | null;
}) {
  const bands = analysis.salaryBands ?? {};
  const gapPercent = analysis.genderGapPercent;
  const gapAmountValue =
    analysis.genderGapAmount === null || analysis.genderGapAmount === undefined || analysis.genderGapAmount === ''
      ? null
      : Number(analysis.genderGapAmount);

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
          Australian dollars, before bonus or equity, and rounded to the nearest thousand so that no
          figure is any one person&apos;s pay to the dollar.
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

      {bands.p25 === null || bands.p25 === undefined ? (
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          {bandWithheld ||
            `A salary range is published once ${RANGE_MIN_CONTRIBUTORS} members have reported pay for this role; until then only the median is shown.`}
        </p>
      ) : null}

      <div className="tile-soft p-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Gender pay gap</h3>
        </div>
        {typeof gapPercent === 'number' ? (
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {describeGap(gapPercent, gapAmountValue)} It is a straight comparison of medians, not
            adjusted for experience or seniority.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Not enough to say.{' '}
            {gapWithheld ||
              `A gap is only reported once at least ${GAP_MIN_PER_GENDER} women and ${GAP_MIN_PER_GENDER} men have shared pay for this role, so no one can be identified from it.`}
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

/* ------------------------------------------------ what employers advertise */

function AdvertisedRange({ state }: { state: AdvertisedState }) {
  if (state.status === 'idle') return null;

  const ready = state.status === 'ready' ? state.data : null;
  const median =
    ready && ready.marketMedian !== null && ready.sampleSize >= MIN_ADVERTISED_LISTINGS
      ? money(ready.marketMedian)
      : null;

  return (
    <div className="tile-soft mt-4 p-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-rose-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          What employers here advertise
        </h3>
      </div>
      {state.status === 'loading' && (
        <div className="mt-2 h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      )}
      {state.status === 'error' && (
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          We could not read the listings just now. The benchmark above does not depend on them.
        </p>
      )}
      {ready && median && (
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Employers on ATHENA advertise a median of{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{median}</span> across{' '}
          {ready.sampleSize} active listings titled {ready.targetRole}. That is the employers&apos;
          own figure, a different source from the pay members report.
        </p>
      )}
      {ready && !median && (
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Fewer than three active listings titled {ready.targetRole} publish a range, so there is
          no advertised median we would quote.{' '}
          <Link href="/jobs" className="font-semibold text-rose-600 hover:underline dark:text-rose-400">
            See the roles that do list pay
          </Link>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------ prepare the conversation */

const SCENARIOS: { value: NegotiationScenario; label: string }[] = [
  { value: 'new_job', label: 'A new job offer' },
  { value: 'raise', label: 'A raise where I am' },
  { value: 'promotion', label: 'A promotion' },
  { value: 'counter_offer', label: 'A counter offer' },
];

/** 'budget_constraints' -> 'budget constraints' */
const humanise = (key: string) => key.replace(/_/g, ' ');

/**
 * The script is a coaching template with her figures dropped in. Its `tips`
 * are generic lines (one quotes an unsourced percentage), so they stay off the
 * page; the opening, points, counters and close are what she can adapt.
 */
function NegotiationPrep({ role }: { role: string }) {
  const [form, setForm] = useState({
    scenario: 'new_job' as NegotiationScenario,
    role,
    targetSalary: '',
    currentSalary: '',
    yearsAtCompany: '',
    achievements: '',
  });
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [script, setScript] = useState<NegotiationScript | null>(null);

  const needsCurrent = form.scenario === 'counter_offer';

  const prepare = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetSalary = Number(form.targetSalary);
    const currentSalary = form.currentSalary ? Number(form.currentSalary) : undefined;
    const yearsAtCompany = form.yearsAtCompany ? Number(form.yearsAtCompany) : undefined;
    const achievements = form.achievements
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!form.role.trim() || !Number.isFinite(targetSalary) || targetSalary <= 0) {
      setError('A role and the figure you are asking for are needed first.');
      return;
    }
    if (needsCurrent && (!currentSalary || !Number.isFinite(currentSalary) || currentSalary <= 0)) {
      setError('A counter offer is measured against what you earn now, so that figure is needed too.');
      return;
    }

    setBuilding(true);
    setError('');
    try {
      const response = await salaryApi.negotiationScript({
        scenario: form.scenario,
        role: form.role.trim(),
        targetSalary,
        ...(currentSalary && currentSalary > 0 ? { currentSalary } : {}),
        ...(yearsAtCompany && yearsAtCompany > 0 ? { yearsAtCompany } : {}),
        ...(achievements.length ? { achievements } : {}),
      });
      setScript(response.data);
    } catch (err) {
      setError(errorMessage(err, 'We could not build the template just now.'));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={prepare} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="neg-scenario">
            The conversation
          </label>
          <select
            id="neg-scenario"
            className={fieldClass}
            value={form.scenario}
            onChange={(event) =>
              setForm({ ...form, scenario: event.target.value as NegotiationScenario })
            }
          >
            {SCENARIOS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="neg-role">
            Role
          </label>
          <input
            id="neg-role"
            className={fieldClass}
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="neg-target">
            What you are asking for (AUD a year)
          </label>
          <input
            id="neg-target"
            className={fieldClass}
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={form.targetSalary}
            onChange={(event) => setForm({ ...form, targetSalary: event.target.value })}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="neg-current">
            What you earn now {needsCurrent ? '' : '(optional)'}
          </label>
          <input
            id="neg-current"
            className={fieldClass}
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={form.currentSalary}
            onChange={(event) => setForm({ ...form, currentSalary: event.target.value })}
            required={needsCurrent}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="neg-years">
            Years with this employer (optional)
          </label>
          <input
            id="neg-years"
            className={fieldClass}
            type="number"
            min={0}
            max={60}
            inputMode="numeric"
            value={form.yearsAtCompany}
            onChange={(event) => setForm({ ...form, yearsAtCompany: event.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="neg-achievements">
            Things you have delivered, one per line (optional)
          </label>
          <textarea
            id="neg-achievements"
            className={fieldClass}
            rows={3}
            value={form.achievements}
            onChange={(event) => setForm({ ...form, achievements: event.target.value })}
            placeholder={'Cut onboarding time from six weeks to two\nBrought in the Brisbane City Council account'}
          />
        </div>

        {error && (
          <p className="text-sm leading-6 text-rose-600 dark:text-rose-400 sm:col-span-2">{error}</p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={building}
            className="focusable rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {building ? 'Building' : 'Build my template'}
          </button>
        </div>
      </form>

      {script && (
        <div className="tile-soft space-y-4 p-5">
          <div>
            <p className="kicker">A template to adapt, not a script to read out</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
              {script.situation}
            </h3>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Open with
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {script.openingStatement}
            </p>
          </div>
          {script.keyPoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Make these points
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">
                {script.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {Object.keys(script.counterResponses).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                If they say
              </p>
              <dl className="mt-1 space-y-2">
                {Object.entries(script.counterResponses).map(([key, reply]) => (
                  <div key={key}>
                    <dt className="text-sm font-medium capitalize text-slate-900 dark:text-white">
                      {humanise(key)}
                    </dt>
                    <dd className="text-sm leading-6 text-slate-700 dark:text-slate-300">{reply}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Close with
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {script.closingStatement}
            </p>
          </div>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-500">
            The figures in it are the ones you typed. Anything in square brackets is for you to fill
            in, and the benchmark above is the number to stand behind.
          </p>
        </div>
      )}
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
  // The server's own sentences for what it held back and why, so the page
  // cannot drift from its floors again.
  const [withheld, setWithheld] = useState<{ thin: string; gap: string | null; band: string | null }>({
    thin: '',
    gap: null,
    band: null,
  });
  const [askedFor, setAskedFor] = useState('');
  // The title as it was looked up, so the template below follows the lookup
  // rather than whatever is in the box now.
  const [lookedUpRole, setLookedUpRole] = useState('');
  const [advertised, setAdvertised] = useState<AdvertisedState>({ status: 'idle' });

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
    setLookedUpRole(trimmedRole);

    // The advertised median is a separate source and a separate call; a
    // failure here must not take the member benchmark down with it.
    setAdvertised({ status: 'loading' });
    algorithmApi
      .salaryEquity(trimmedRole)
      .then((response) => setAdvertised({ status: 'ready', data: response.data.data }))
      .catch(() => setAdvertised({ status: 'error' }));

    try {
      const response = await aiAlgorithmsApi.analyzeSalary({
        role: trimmedRole,
        ...(trimmedLocation ? { location: trimmedLocation } : {}),
      });
      const body = (response.data ?? {}) as {
        data?: SalaryAnalysis | null;
        message?: unknown;
        genderGapWithheld?: unknown;
        bandWithheld?: unknown;
      };
      const data = body.data;
      const said = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
      setWithheld({
        thin: said(body.message) ?? '',
        gap: said(body.genderGapWithheld),
        band: said(body.bandWithheld),
      });
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
          description={`A median appears once ${MEDIAN_MIN_CONTRIBUTORS} people have shared pay for that role, and a range once ${RANGE_MIN_CONTRIBUTORS} have. Below that there is nothing we could show without pointing at someone.`}
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

            {benchmarkState === 'ready' && analysis && (
              <BenchmarkResult analysis={analysis} gapWithheld={withheld.gap} bandWithheld={withheld.band} />
            )}

            {benchmarkState === 'thin' && (
              <EmptyState
                icon={BarChart3}
                reason="empty"
                title="Not enough pay data for that role yet"
                description={`${withheld.thin || `Fewer than ${MEDIAN_MIN_CONTRIBUTORS} people have shared pay for ${
                  askedFor || 'that role'
                }, so there is no benchmark we would stand behind.`} If you know the number, yours could help get it there.`}
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

            {(benchmarkState === 'ready' || benchmarkState === 'thin') && (
              <AdvertisedRange state={advertised} />
            )}
          </div>
        </Section>

        {isAuthenticated && (benchmarkState === 'ready' || benchmarkState === 'thin') && (
          <Section
            icon={MessageSquare}
            title="Prepare the conversation"
            description="A coaching template for the conversation itself, built from what you type here. It is not a benchmark; the figures in it are yours."
          >
            <NegotiationPrep key={lookedUpRole} role={lookedUpRole} />
          </Section>
        )}

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
                Your figure joins the pool for that role. A median is published for it once{' '}
                {MEDIAN_MIN_CONTRIBUTORS} people have shared pay for the same title, rounded to the
                nearest thousand.
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
                  Used only to work out a pay gap, and only once at least {GAP_MIN_PER_GENDER} women and{' '}
                  {GAP_MIN_PER_GENDER} men have shared pay for the same role.
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
