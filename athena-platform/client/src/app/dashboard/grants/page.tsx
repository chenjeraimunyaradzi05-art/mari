'use client';

/**
 * Grants for the member: browse what is listed, apply with the few answers
 * the match score actually reads (industry, stage, amount, state and a
 * paragraph), see why it scored what it did and what was left out, then mark
 * it submitted so the outcome can be tracked.
 *
 * The answers are prefilled from the saved business strategy plan and the
 * account, and the strategy page's ranked matches link here with the profile
 * in the URL, so nothing is typed twice. The score is the server's; this page
 * only shows the breakdown it returns, never a number of its own.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { BadgeCheck, Calendar, ChevronRight, ExternalLink, Loader2, X } from 'lucide-react';
import { businessApi } from '@/lib/api';
import { strategyApi, apiMessage } from '@/lib/strategy-api';
import { useAuthStore } from '@/lib/hooks';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

const providerTypes = [
  { value: '', label: 'All providers' },
  { value: 'FEDERAL', label: 'Federal' },
  { value: 'STATE', label: 'State' },
  { value: 'PRIVATE_FOUNDATION', label: 'Private foundation' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'INTERNATIONAL', label: 'International' },
];

const STAGES = ['Idea', 'Startup', 'Early', 'Growth', 'Established'];
const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const CRITERIA: Record<string, string> = {
  industry: 'Industry',
  stage: 'Stage',
  region: 'Where you are',
  funding: 'Amount',
  timing: 'Timing',
};

const toNumber = (value: any) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type Grant = {
  id: string;
  name: string;
  description: string;
  provider: string;
  providerType: string;
  minFunding?: string | number | null;
  maxFunding?: string | number | null;
  industries: string[];
  stages: string[];
  regions: string[];
  applicationUrl?: string | null;
  deadline?: string | null;
  isRolling?: boolean;
  isActive?: boolean;
};

type Answers = {
  industry: string;
  stage: string;
  requestedAmount: string;
  state: string;
  summary: string;
};

type MatchComponent = { criterion: string; weight: number; earned: number; detail: string };
type Match = { score: number | null; breakdown: MatchComponent[]; notScored: string[] };

type GrantApplication = {
  id: string;
  status: string;
  matchScore?: number | null;
  applicationData?: Partial<Answers> & Record<string, unknown> | null;
  amountAwarded?: string | number | null;
  notes?: string | null;
  grant: Grant;
  createdAt: string;
};

const EMPTY_ANSWERS: Answers = { industry: '', stage: '', requestedAmount: '', state: '', summary: '' };

const answersFrom = (data: GrantApplication['applicationData']): Answers => ({
  industry: typeof data?.industry === 'string' ? data.industry : '',
  stage: typeof data?.stage === 'string' ? data.stage : '',
  requestedAmount: data?.requestedAmount != null && data.requestedAmount !== '' ? String(data.requestedAmount) : '',
  state: typeof data?.state === 'string' ? data.state : '',
  summary: typeof data?.summary === 'string' ? data.summary : '',
});

const matchFrom = (data: any): Match | null =>
  Array.isArray(data?.matchBreakdown)
    ? { score: typeof data.matchScore === 'number' ? data.matchScore : null, breakdown: data.matchBreakdown, notScored: Array.isArray(data.matchNotScored) ? data.matchNotScored : [] }
    : null;

const statusLabel = (status: string) => status.replace(/_/g, ' ').toLowerCase();

function GrantsPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [providerType, setProviderType] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [applications, setApplications] = useState<GrantApplication[]>([]);

  // The application being worked on: which grant, the answers, and what the
  // server said about them once saved.
  const [applyingTo, setApplyingTo] = useState<Grant | null>(null);
  const [draft, setDraft] = useState<GrantApplication | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [match, setMatch] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);

  // What the strategy plan and the account already know, so the form starts filled.
  const [prefill, setPrefill] = useState<Partial<Answers>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [grantsRes, appsRes] = await Promise.all([
        businessApi.getGrants({
          providerType: providerType || undefined,
          industry: industry || undefined,
          region: region || undefined,
          active: activeOnly || undefined,
        }),
        businessApi.getMyGrantApplications(),
      ]);
      setGrants(grantsRes.data?.data || []);
      setApplications(appsRes.data?.data || []);
    } catch (err) {
      setError(apiMessage(err, 'Failed to load grants.'));
      setGrants([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [providerType, industry, region, activeOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    strategyApi
      .getPlans()
      .then((res) => {
        if (cancelled) return;
        const plans: Array<{ area: string; inputs?: Record<string, unknown> }> = res.data?.data ?? [];
        const inputs = plans.find((p) => p.area === 'BUSINESS')?.inputs ?? {};
        const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : '');
        setPrefill({
          industry: str(inputs.grantIndustry),
          stage: str(inputs.stage),
          requestedAmount: str(inputs.amountNeeded),
          state: str(inputs.state) || (user?.state ?? ''),
        });
      })
      .catch(() => {
        if (!cancelled) setPrefill({ state: user?.state ?? '' });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.state]);

  const applicationFor = useCallback((grantId: string) => applications.find((a) => a.grant?.id === grantId) ?? null, [applications]);

  const openForm = useCallback(
    (grant: Grant, existing: GrantApplication | null, fromUrl?: Partial<Answers>) => {
      setApplyingTo(grant);
      setDraft(existing);
      setMatch(null);
      const saved = existing ? answersFrom(existing.applicationData) : EMPTY_ANSWERS;
      const pick = (key: keyof Answers) => fromUrl?.[key] || saved[key] || prefill[key] || '';
      setAnswers({ industry: pick('industry'), stage: pick('stage'), requestedAmount: pick('requestedAmount'), state: pick('state'), summary: saved.summary });
    },
    [prefill]
  );

  // Arriving from the strategy page's ranked matches: ?apply=<grant> with the
  // profile alongside. The grant is fetched on its own in case the filters
  // above would have hidden it.
  const applyParam = searchParams.get('apply');
  const [consumedParam, setConsumedParam] = useState<string | null>(null);
  useEffect(() => {
    if (!applyParam || applyParam === consumedParam || loading) return;
    setConsumedParam(applyParam);
    const fromUrl: Partial<Answers> = {
      stage: searchParams.get('stage') ?? '',
      industry: searchParams.get('industry') ?? '',
      state: searchParams.get('state') ?? '',
      requestedAmount: searchParams.get('amount') ?? '',
    };
    const listed = grants.find((g) => g.id === applyParam);
    if (listed) {
      openForm(listed, applicationFor(listed.id), fromUrl);
      return;
    }
    businessApi
      .getGrant(applyParam)
      .then((res) => {
        const grant = res.data?.data as Grant | undefined;
        if (grant) openForm(grant, applicationFor(grant.id), fromUrl);
      })
      .catch(() => toast.error('That programme is no longer listed.'));
  }, [applyParam, consumedParam, loading, grants, applicationFor, openForm, searchParams]);

  const closeForm = () => {
    setApplyingTo(null);
    setDraft(null);
    setMatch(null);
  };

  const saveAnswers = async () => {
    if (!applyingTo) return;
    setBusy(true);
    try {
      const applicationData = {
        industry: answers.industry.trim(),
        stage: answers.stage,
        requestedAmount: answers.requestedAmount.trim() ? Number(answers.requestedAmount) : null,
        state: answers.state,
        summary: answers.summary.trim(),
        submittedVia: 'dashboard',
      };
      const res = draft ? await businessApi.updateGrantApplication(draft.id, { applicationData }) : await businessApi.applyForGrant(applyingTo.id, { applicationData });
      const saved = res.data?.data as GrantApplication & Record<string, unknown>;
      setDraft({ ...saved, grant: saved.grant ?? applyingTo });
      setMatch(matchFrom(saved));
      await loadData();
    } catch (err) {
      toast.error(apiMessage(err, 'Your answers could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await businessApi.updateGrantApplication(draft.id, { status: 'SUBMITTED' });
      toast.success('Marked as submitted. We will tell you when the funder decides.');
      closeForm();
      await loadData();
    } catch (err) {
      toast.error(apiMessage(err, 'That could not be submitted.'));
    } finally {
      setBusy(false);
    }
  };

  const activeLabel = useMemo(() => (activeOnly ? 'Active grants' : 'All grants'), [activeOnly]);
  const inputClass = 'mt-1 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:text-white';
  const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <BadgeCheck className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Grants</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
            Funding programs for women-led businesses
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{activeLabel} tailored to your growth stage.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/business/strategy#grants" className="btn-secondary inline-flex items-center gap-2">
            Find my matches
          </Link>
          <Link href="/dashboard/investors" className="btn-primary inline-flex items-center gap-2">
            Meet investors <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid gap-4 md:grid-cols-4">
        <div>
          <label htmlFor="grants-provider" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Provider</label>
          <select id="grants-provider" value={providerType} onChange={(event) => setProviderType(event.target.value)} className={inputClass}>
            {providerTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="grants-industry" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Industry</label>
          <input id="grants-industry" value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="e.g. Fintech" className={inputClass} />
        </div>
        <div>
          <label htmlFor="grants-region" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Region</label>
          <input id="grants-region" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="e.g. QLD" className={inputClass} />
        </div>
        <label htmlFor="grants-active" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mt-6">
          <input id="grants-active" type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} className="rounded border-slate-300" />
          Active only
        </label>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>}

      {applyingTo && (
        <section className="relative rounded-xl border border-primary-200 bg-primary-50/40 p-5 dark:border-primary-900/40 dark:bg-primary-900/10" aria-labelledby="grant-apply-heading">
          <button type="button" onClick={closeForm} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{applyingTo.provider}</p>
          <h2 id="grant-apply-heading" className="text-lg font-semibold text-slate-900 dark:text-white">{applyingTo.name}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">A few answers, so the score means something. They come from your strategy plan where you have one.</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveAnswers();
            }}
            className="mt-4 grid gap-3 md:grid-cols-2"
          >
            <div>
              <label htmlFor="apply-industry" className={labelClass}>Your industry</label>
              <input id="apply-industry" value={answers.industry} onChange={(e) => setAnswers({ ...answers, industry: e.target.value })} placeholder="e.g. Technology" maxLength={80} className={inputClass} />
            </div>
            <div>
              <label htmlFor="apply-stage" className={labelClass}>Stage</label>
              <select id="apply-stage" value={answers.stage} onChange={(e) => setAnswers({ ...answers, stage: e.target.value })} className={inputClass}>
                <option value="">Choose</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="apply-amount" className={labelClass}>Amount you are asking for (AUD)</label>
              <input id="apply-amount" type="number" min={0} step={1} value={answers.requestedAmount} onChange={(e) => setAnswers({ ...answers, requestedAmount: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="apply-state" className={labelClass}>State</label>
              <select id="apply-state" value={answers.state} onChange={(e) => setAnswers({ ...answers, state: e.target.value })} className={inputClass}>
                <option value="">Choose</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="apply-summary" className={labelClass}>What the money would do, in a paragraph</label>
              <textarea id="apply-summary" rows={4} maxLength={1500} value={answers.summary} onChange={(e) => setAnswers({ ...answers, summary: e.target.value })} className={inputClass} />
            </div>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button type="submit" disabled={busy} className="btn-primary text-sm">
                {busy ? 'Saving…' : draft ? 'Save answers' : 'Check my fit'}
              </button>
              {applyingTo.applicationUrl && (
                <a href={applyingTo.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
                  Open the funder&apos;s page <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </form>

          {match && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">How you match</h3>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{match.score === null ? 'Not enough to score yet' : `${match.score}% fit`}</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {match.breakdown.map((part) => {
                  const full = part.earned === part.weight;
                  const some = part.earned > 0 && !full;
                  return (
                    <li key={part.criterion} className="flex items-start gap-2">
                      <span className={cn('mt-0.5 text-xs font-bold', full ? 'text-emerald-600' : some ? 'text-amber-600' : 'text-slate-400')} aria-hidden="true">
                        {full ? '✓' : some ? '~' : '–'}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium text-slate-900 dark:text-white">{CRITERIA[part.criterion] ?? part.criterion}:</span> {part.detail}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {match.notScored.length > 0 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Left out of the score: {match.notScored.map((c) => (CRITERIA[c] ?? c).toLowerCase()).join(', ')}. Either the funder did not say, or you have not yet.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={submit} disabled={busy} className="btn-primary text-sm">
                  Mark as submitted
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">Most funders take the application on their own site. Mark it once it has gone, and we will track the outcome.</span>
              </div>
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading grants...
        </div>
      ) : grants.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-slate-500">
          {providerType || industry || region ? 'Nothing matches those filters yet.' : 'No programmes are listed yet. The directory fills as real programmes are added.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grants.map((grant) => {
            const existing = applicationFor(grant.id);
            return (
              <div key={grant.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{grant.name}</h3>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      {grant.providerType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{grant.provider}</p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{grant.description}</p>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Funding: {grant.minFunding || grant.maxFunding
                    ? `${formatCurrency(toNumber(grant.minFunding))} - ${formatCurrency(toNumber(grant.maxFunding))}`
                    : 'Varies'}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Calendar className="w-4 h-4" />
                  {grant.isRolling ? 'Rolling applications' : grant.deadline ? `Deadline ${formatDate(grant.deadline)}` : 'Deadline to be announced'}
                </div>
                {existing && existing.status !== 'DRAFT' ? (
                  <span className="inline-flex w-fit items-center rounded-full bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
                    {statusLabel(existing.status)}
                  </span>
                ) : (
                  <button type="button" onClick={() => openForm(grant, existing)} disabled={busy} className="btn-primary">
                    {existing ? 'Continue application' : 'Apply'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your applications</h2>
        {applications.length === 0 ? (
          <p className="text-sm text-slate-500">No grant applications yet.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{app.grant.name}</div>
                    <div className="text-xs text-slate-500">
                      {app.grant.provider}
                      {typeof app.matchScore === 'number' ? ` · ${app.matchScore}% fit` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.status === 'DRAFT' && (
                      <button type="button" onClick={() => openForm(app.grant, app)} className="text-xs font-medium text-primary-600 hover:underline">
                        Continue
                      </button>
                    )}
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">{statusLabel(app.status)}</span>
                  </div>
                </div>
                {(app.amountAwarded || app.notes) && (
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {app.amountAwarded ? <p className="font-medium text-emerald-700 dark:text-emerald-300">Awarded {formatCurrency(toNumber(app.amountAwarded))}</p> : null}
                    {app.notes ? <p className="whitespace-pre-wrap">{app.notes}</p> : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary above it.
export default function GrantsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-6 text-slate-500">Loading...</div>}>
      <GrantsPageContent />
    </Suspense>
  );
}
