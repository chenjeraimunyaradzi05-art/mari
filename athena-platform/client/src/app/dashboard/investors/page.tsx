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
};

export default function InvestorsPage() {
  const [type, setType] = useState('');
  const [stage, setStage] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [introMessage, setIntroMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [introductions, setIntroductions] = useState<InvestorIntro[]>([]);

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
        }),
        businessApi.getMyInvestorIntroductions(),
      ]);
      setInvestors(investorsRes.data?.data || []);
      setIntroductions(introsRes.data?.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load investors.');
      setInvestors([]);
      setIntroductions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [type, stage, industry, region]);

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
      setError(err?.response?.data?.error || 'Unable to request intro.');
    } finally {
      setSavingId(null);
    }
  };

  const headerLabel = useMemo(() => {
    if (type) return `${type.replace('_', ' ').toLowerCase()} investors`;
    return 'All investors';
  }, [type]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Investors</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Pitch to aligned capital partners
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {headerLabel} ready to back women-led ventures.
          </p>
        </div>
        <Link href="/dashboard/accelerator" className="btn-primary inline-flex items-center gap-2">
          Join an accelerator <Sparkles className="w-4 h-4" />
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 grid gap-4 md:grid-cols-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Type</label>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            {investorTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Stage</label>
          <input
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            placeholder="e.g. Seed"
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Industry</label>
          <input
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            placeholder="e.g. Health"
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Region</label>
          <input
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="e.g. ANZ"
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading investors...
        </div>
      ) : investors.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-sm text-gray-500">
          No investors found. Update your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {investors.map((investor) => (
            <div key={investor.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{investor.name}</h3>
                  {investor.isVerified && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Verified</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{investor.type.replace('_', ' ')}</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {investor.description || investor.thesis || 'Investment thesis available upon request.'}
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Stages: {investor.stages?.length ? investor.stages.join(', ') : 'Flexible'}</div>
                <div>Industries: {investor.industries?.length ? investor.industries.join(', ') : 'Multi-sector'}</div>
                <div>Regions: {investor.regions?.length ? investor.regions.join(', ') : 'Global'}</div>
              </div>
              {activeRequestId === investor.id ? (
                <div className="space-y-3">
                  <textarea
                    value={introMessage}
                    onChange={(event) => setIntroMessage(event.target.value)}
                    placeholder="Add a short intro message"
                    className="w-full min-h-[90px] bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
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

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your introductions</h2>
        {introductions.length === 0 ? (
          <p className="text-sm text-gray-500">No intro requests yet.</p>
        ) : (
          <div className="space-y-3">
            {introductions.map((intro) => (
              <div key={intro.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{intro.investor.name}</div>
                    <div className="text-xs text-gray-500">{intro.investor.type.replace('_', ' ')}</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                    {intro.status.replace('_', ' ')}
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
