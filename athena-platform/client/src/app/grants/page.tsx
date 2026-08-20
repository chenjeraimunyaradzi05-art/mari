'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Award,
  CheckCircle,
  Clock,
  DollarSign,
  Gift,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { businessApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const providerTypes = [
  { id: '', name: 'All providers' },
  { id: 'FEDERAL', name: 'Federal' },
  { id: 'STATE', name: 'State' },
  { id: 'PRIVATE_FOUNDATION', name: 'Foundation' },
  { id: 'CORPORATE', name: 'Corporate' },
  { id: 'INTERNATIONAL', name: 'International' },
];

type Grant = {
  id: string;
  name: string;
  description?: string | null;
  provider: string;
  providerType: string;
  minFunding?: string | number | null;
  maxFunding?: string | number | null;
  industries?: string[];
  stages?: string[];
  regions?: string[];
  deadline?: string | null;
  isRolling?: boolean;
  isActive?: boolean;
};

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function formatProviderType(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFunding(grant: Grant) {
  const min = toNumber(grant.minFunding);
  const max = toNumber(grant.maxFunding);

  if (min && max) return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  if (min) return `From ${formatCurrency(min)}`;
  if (max) return `Up to ${formatCurrency(max)}`;
  return 'Funding varies';
}

export default function GrantsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviderType, setSelectedProviderType] = useState('');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadGrants = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await businessApi.getGrants({
          providerType: selectedProviderType || undefined,
          active: true,
        });

        if (!cancelled) {
          setGrants(response.data?.data || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setGrants([]);
          setError(err?.response?.data?.error || 'Unable to load grants right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGrants();

    return () => {
      cancelled = true;
    };
  }, [selectedProviderType]);

  const filteredGrants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return grants.filter((grant) => {
      if (!query) return true;

      return [
        grant.name,
        grant.description,
        grant.provider,
        formatProviderType(grant.providerType),
        ...(grant.industries || []),
        ...(grant.stages || []),
        ...(grant.regions || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [grants, searchQuery]);

  const stats = useMemo(() => {
    const providerCount = new Set(grants.map((grant) => grant.provider)).size;
    const rollingCount = grants.filter((grant) => grant.isRolling).length;
    const regionCount = new Set(grants.flatMap((grant) => grant.regions || [])).size;
    const totalMaxFunding = grants.reduce((total, grant) => total + toNumber(grant.maxFunding), 0);

    return [
      { value: grants.length.toString(), label: 'Active Grants', icon: Gift },
      { value: providerCount.toString(), label: 'Providers', icon: Users },
      { value: rollingCount.toString(), label: 'Rolling Programs', icon: Clock },
      { value: totalMaxFunding ? formatCurrency(totalMaxFunding) : 'Varies', label: 'Listed Funding', icon: DollarSign },
      { value: regionCount.toString(), label: 'Regions', icon: Award },
    ];
  }, [grants]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white overflow-hidden">
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-8 h-8" />
              <span className="text-purple-200 font-medium">ATHENA Grants</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Non-Dilutive Funding for Innovators
            </h1>
            <p className="text-xl text-purple-100 mb-8">
              Browse active grant programs published through ATHENA and continue applications from your dashboard.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="#grants"
                className="px-6 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-slate-100 transition"
              >
                Browse Grants
              </Link>
              <Link
                href="/contact-sales"
                className="px-6 py-3 bg-purple-700 text-white font-semibold rounded-lg hover:bg-purple-800 transition"
              >
                Partner With Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg text-center">
                <Icon className="w-5 h-5 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">{stat.value}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="grants" className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search grants..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {providerTypes.map((providerType) => (
              <button
                key={providerType.id || 'all'}
                onClick={() => setSelectedProviderType(providerType.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  selectedProviderType === providerType.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {providerType.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading grants...
          </div>
        ) : filteredGrants.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <Gift className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No active grants available</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {searchQuery || selectedProviderType
                ? 'Try adjusting your search or provider filter.'
                : 'No published grant programs are accepting applications yet.'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredGrants.map((grant) => (
              <div
                key={grant.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700"
              >
                <span className="inline-flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full mb-3">
                  <Award className="w-3 h-3" />
                  {formatProviderType(grant.providerType)}
                </span>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{grant.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{grant.provider}</p>
                  </div>
                  <span className="text-lg font-bold text-purple-600 text-right">{formatFunding(grant)}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
                  {grant.description || 'No public description has been provided yet.'}
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                  <Clock className="w-4 h-4" />
                  <span>
                    {grant.isRolling
                      ? 'Rolling applications'
                      : grant.deadline
                        ? `Deadline: ${formatDate(grant.deadline)}`
                        : 'Deadline to be announced'}
                  </span>
                </div>
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Eligibility signals:</h4>
                  <div className="flex flex-wrap gap-2">
                    {[...(grant.industries || []), ...(grant.stages || []), ...(grant.regions || [])].slice(0, 6).map((item) => (
                      <span key={item} className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                        <CheckCircle className="w-3 h-3 text-purple-500" />
                        {item}
                      </span>
                    ))}
                    {!grant.industries?.length && !grant.stages?.length && !grant.regions?.length && (
                      <span className="text-sm text-slate-500">Eligibility details are not published yet.</span>
                    )}
                  </div>
                </div>
                <Link
                  href="/dashboard/grants"
                  className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
                >
                  Start in dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-12 text-center">
            How to Apply
          </h2>
          <div className="max-w-4xl mx-auto grid md:grid-cols-4 gap-8">
            {[
              { step: 1, title: 'Find a Grant', description: 'Browse programs that match your venture' },
              { step: 2, title: 'Check Eligibility', description: 'Review the live provider criteria' },
              { step: 3, title: 'Start Application', description: 'Continue from your ATHENA dashboard' },
              { step: 4, title: 'Track Status', description: 'Monitor updates as providers review applications' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Fund a Grant</h2>
          <p className="text-purple-100 mb-8 max-w-2xl mx-auto">
            Partner with ATHENA to publish a grant program for the founders and operators you want to support.
          </p>
          <Link
            href="/contact-sales"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-slate-100 transition"
          >
            Become a Grant Partner <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
