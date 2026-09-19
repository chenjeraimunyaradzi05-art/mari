'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, Loader2, Mail, Sparkles } from 'lucide-react';
import { businessApi } from '@/lib/api';

const investorTypes = [
  { value: '', label: 'All types' },
  { value: 'ANGEL', label: 'Angel' },
  { value: 'VC', label: 'Venture Capital' },
  { value: 'CORPORATE_VC', label: 'Corporate VC' },
  { value: 'FAMILY_OFFICE', label: 'Family Office' },
  { value: 'ACCELERATOR', label: 'Accelerator' },
  { value: 'GOVERNMENT', label: 'Government' },
];

type Investor = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  stages: string[];
  industries: string[];
  regions: string[];
  thesis?: string | null;
  website?: string | null;
  isVerified?: boolean;
};

type InvestorIntro = {
  id: string;
  status: string;
  investor: Investor;
  requestedAt: string;
  introducedAt?: string | null;
  respondedAt?: string | null;
  /** The note ATHENA staff wrote when they moved the request along. */
  outcome?: string | null;
};

/** How many of this month's warm introductions are used, from the server. */
type IntroAllowance = { limit: number; used: number; remaining: number; resetsAt: string };

// What each state means to the founder, in her words rather than the enum's.
const INTRO_STATE: Record<string, { label: string; meaning: string; tone: string }> = {
  REQUESTED: { label: 'Waiting for review', meaning: 'We are looking at your request.', tone: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Approved', meaning: 'We are arranging the introduction.', tone: 'bg-primary-50 text-primary-700' },
  INTRODUCED: { label: 'Introduced', meaning: 'Keep an eye on your inbox.', tone: 'bg-emerald-50 text-emerald-700' },
  MEETING_SCHEDULED: { label: 'Meeting scheduled', meaning: 'A meeting is on the calendar.', tone: 'bg-emerald-50 text-emerald-700' },
  DECLINED: { label: 'Not this time', meaning: 'This investor is not taking the introduction right now.', tone: 'bg-slate-100 text-slate-600' },
  EXPIRED: { label: 'Expired', meaning: 'This request lapsed without a reply.', tone: 'bg-slate-100 text-slate-600' },
};
const introState = (status: string) => INTRO_STATE[status] ?? { label: status.replace(/_/g, ' ').toLowerCase(), meaning: '', tone: 'bg-slate-100 text-slate-600' };
const onDay = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
const apiMessage = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;

export default function InvestorsPage() {
  const [type, setType] = useState('');
  const [stage, setStage] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [minCheck, setMinCheck] = useState('');
  const [maxCheck, setMaxCheck] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [introMessage, setIntroMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [introductions, setIntroductions] = useState<InvestorIntro[]>([]);
  const [allowance, setAllowance] = useState<IntroAllowance | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [investorsRes, introsRes] = await Promise.all([
        businessApi.getInvestors({
          type: type || undefined,
          stage: stage || undefined,
          industry: industry || undefined,
          region: region || undefined,
          minCheck: minCheck ? Number(minCheck) : undefined,
          maxCheck: maxCheck ? Number(maxCheck) : undefined,
        }),
        businessApi.getMyInvestorIntroductions(),
      ]);
      setInvestors(investorsRes.data?.data || []);
      setIntroductions(introsRes.data?.data || []);
      setAllowance(introsRes.data?.allowance ?? null);
    } catch (err: any) {
      setError(apiMessage(err, 'Failed to load investors.'));
      setInvestors([]);
      setIntroductions([]);
      setAllowance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [type, stage, industry, region, minCheck, maxCheck]);

  const handleRequestIntro = async (investorId: string) => {
    setSavingId(investorId);
    setError(null);
    try {
      await businessApi.requestInvestorIntro(investorId, {
        message: introMessage || undefined,
      });
      setIntroMessage('');
      setActiveRequestId(null);
      await loadData();
    } catch (err: any) {
      setError(apiMessage(err, 'Unable to request intro.'));
    } finally {
      setSavingId(null);
    }
  };

  const headerLabel = useMemo(() => {
    if (type) return `${type.replace('_', ' ').toLowerCase()} investors`;
    return 'All investors';
  }, [type]);

  const introFor = (investorId: string) => introductions.find((intro) => intro.investor?.id === investorId);
  const noneLeft = allowance !== null && allowance.remaining === 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Investors</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
            Pitch to aligned capital partners
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {headerLabel} ready to back women-led ventures.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/business/strategy#raise" className="btn-secondary inline-flex items-center gap-2">
            Model a raise
          </Link>
          <Link href="/dashboard/accelerator" className="btn-primary inline-flex items-center gap-2">
            Join an accelerator <Sparkles className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid gap-4 md:grid-cols-4">
        <div>
          <label htmlFor="investor-type" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Type</label>
          <select
            id="investor-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="mt-2 w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
          >
            {investorTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="investor-stage" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Stage</label>
          <input
            id="investor-stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            placeholder="e.g. Seed"
            className="mt-2 w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="investor-industry" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Industry</label>
          <input
            id="investor-industry"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            placeholder="e.g. Health"
            className="mt-2 w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="investor-region" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Region</label>
          <input
            id="investor-region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="e.g. ANZ"
            className="mt-2 w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="investor-min-check" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Smallest cheque</label>
          <input
            id="investor-min-check"
            type="number"
            min={0}
            inputMode="numeric"
            value={minCheck}
            onChange={(event) => setMinCheck(event.target.value)}
            placeholder="e.g. 50000"
            className="mt-2 w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="investor-max-check" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Largest cheque</label>
          <input
            id="investor-max-check"
            type="number"
            min={0}
            inputMode="numeric"
            value={maxCheck}
            onChange={(event) => setMaxCheck(event.target.value)}
            placeholder="e.g. 250000"
            className="mt-2 w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading investors...
        </div>
      ) : investors.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-slate-500">
          No investors found. Update your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {investors.map((investor) => (
            <div key={investor.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{investor.name}</h3>
                  {investor.isVerified && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Verified</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{investor.type.replace('_', ' ')}</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {investor.description || investor.thesis || 'Investment thesis available upon request.'}
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <div>Stages: {investor.stages?.length ? investor.stages.join(', ') : 'Flexible'}</div>
                <div>Industries: {investor.industries?.length ? investor.industries.join(', ') : 'Multi-sector'}</div>
                <div>Regions: {investor.regions?.length ? investor.regions.join(', ') : 'Global'}</div>
              </div>
              {introFor(investor.id) ? (
                <div className={`rounded-md px-3 py-2 text-sm ${introState(introFor(investor.id)!.status).tone}`}>
                  <span className="font-semibold">{introState(introFor(investor.id)!.status).label}</span>
                  <span className="block text-xs opacity-80">{introState(introFor(investor.id)!.status).meaning}</span>
                </div>
              ) : noneLeft ? (
                <p className="text-sm text-slate-500">
                  You have used this month&apos;s {allowance!.limit} warm introductions. The next one opens on {onDay(allowance!.resetsAt)}.
                </p>
              ) : activeRequestId === investor.id ? (
                <div className="space-y-3">
                  <textarea
                    value={introMessage}
                    onChange={(event) => setIntroMessage(event.target.value)}
                    placeholder="Add a short intro message"
                    className="w-full min-h-[90px] bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRequestIntro(investor.id)}
                      disabled={savingId === investor.id}
                      className="btn-primary flex-1"
                    >
                      {savingId === investor.id ? 'Requesting...' : 'Send request'}
                    </button>
                    <button
                      onClick={() => setActiveRequestId(null)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setActiveRequestId(investor.id)}
                  className="btn-primary w-full inline-flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" /> Request intro
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your introductions</h2>
          {allowance && (
            <p className="text-sm text-slate-500">
              {allowance.remaining === 0
                ? `All ${allowance.limit} used this month. More open on ${onDay(allowance.resetsAt)}.`
                : `${allowance.remaining} of ${allowance.limit} warm introductions left this month.`}
            </p>
          )}
        </div>
        {introductions.length === 0 ? (
          <p className="text-sm text-slate-500">No intro requests yet. Ask for up to three warm introductions a month.</p>
        ) : (
          <div className="space-y-3">
            {introductions.map((intro) => {
              const state = introState(intro.status);
              return (
                <div key={intro.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{intro.investor.name}</div>
                      <div className="text-xs text-slate-500">{intro.investor.type.replace('_', ' ')}</div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${state.tone}`}>{state.label}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {state.meaning}
                    {intro.introducedAt ? ` Introduced on ${onDay(intro.introducedAt)}.` : ''}
                  </p>
                  {intro.outcome && (
                    <p className="rounded-md bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">From the ATHENA team · </span>
                      {intro.outcome}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
