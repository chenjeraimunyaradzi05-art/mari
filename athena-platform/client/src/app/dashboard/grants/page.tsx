'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { businessApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const providerTypes = [
  { value: '', label: 'All providers' },
  { value: 'FEDERAL', label: 'Federal' },
  { value: 'STATE', label: 'State' },
  { value: 'PRIVATE_FOUNDATION', label: 'Private foundation' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'INTERNATIONAL', label: 'International' },
];

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
  deadline?: string | null;
  isRolling?: boolean;
  isActive?: boolean;
};

type GrantApplication = {
  id: string;
  status: string;
  grant: Grant;
  createdAt: string;
};

export default function GrantsPage() {
  const [providerType, setProviderType] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [applications, setApplications] = useState<GrantApplication[]>([]);

  const loadData = async () => {
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
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load grants.');
      setGrants([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [providerType, industry, region, activeOnly]);

  const handleApply = async (grantId: string) => {
    setSavingId(grantId);
    setError(null);
    try {
      await businessApi.applyForGrant(grantId, {
        applicationData: {
          submittedVia: 'dashboard',
        },
      });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to start grant application.');
    } finally {
      setSavingId(null);
    }
  };

  const activeLabel = useMemo(() => (activeOnly ? 'Active grants' : 'All grants'), [activeOnly]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <BadgeCheck className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Grants</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Funding programs for women-led businesses
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{activeLabel} tailored to your growth stage.</p>
        </div>
        <Link href="/dashboard/investors" className="btn-primary inline-flex items-center gap-2">
          Meet investors <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 grid gap-4 md:grid-cols-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Provider</label>
          <select
            value={providerType}
            onChange={(event) => setProviderType(event.target.value)}
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            {providerTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Industry</label>
          <input
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            placeholder="e.g. Fintech"
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
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-6">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(event) => setActiveOnly(event.target.checked)}
            className="rounded border-gray-300"
          />
          Active only
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading grants...
        </div>
      ) : grants.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-sm text-gray-500">
          No grants found. Try different filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grants.map((grant) => (
            <div key={grant.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{grant.name}</h3>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                    {grant.providerType.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{grant.provider}</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{grant.description}</p>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Funding: {grant.minFunding || grant.maxFunding
                  ? `${formatCurrency(toNumber(grant.minFunding))} - ${formatCurrency(toNumber(grant.maxFunding))}`
                  : 'Varies'}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Calendar className="w-4 h-4" />
                {grant.isRolling ? 'Rolling applications' : grant.deadline ? `Deadline ${formatDate(grant.deadline)}` : 'Deadline TBD'}
              </div>
              <button
                onClick={() => handleApply(grant.id)}
                disabled={savingId === grant.id}
                className="btn-primary"
              >
                {savingId === grant.id ? 'Starting...' : 'Start application'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your applications</h2>
        {applications.length === 0 ? (
          <p className="text-sm text-gray-500">No grant applications yet.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{app.grant.name}</div>
                    <div className="text-xs text-gray-500">{app.grant.provider}</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                    {app.status.replace('_', ' ')}
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
