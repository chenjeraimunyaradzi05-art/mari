'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ShieldCheck,
  MapPin,
  Users,
  Search,
  ArrowUpRight,
  Filter,
  Globe,
} from 'lucide-react';
import { organizationApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const types = [
  { id: 'all', label: 'All' },
  { id: 'company', label: 'Companies' },
  { id: 'university', label: 'Universities' },
  { id: 'tafe', label: 'TAFE' },
  { id: 'government', label: 'Government' },
  { id: 'ngo', label: 'Non-profit' },
] as const;

type Organization = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  type?: string | null;
  industry?: string | null;
  size?: string | null;
  isVerified?: boolean | null;
  followerCount?: number | null;
};

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<(typeof types)[number]['id']>('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['organizations', { search, activeType }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (activeType !== 'all') params.type = activeType;
      const response = await organizationApi.getAll(params);
      return response.data;
    },
  });

  const organizations: Organization[] = data?.data || [];

  const totalLabel = useMemo(() => {
    if (!data?.pagination?.total) return 'Explore organizations';
    return `${data.pagination.total} organizations`;
  }, [data?.pagination?.total]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Building2 className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Companies</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Discover hiring teams, schools, and verified partners
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {totalLabel}. Follow organizations to get tailored updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/jobs" className="btn-secondary inline-flex items-center gap-2">
            <Search className="w-4 h-4" />
            Find roles
          </Link>
          <Link href="/dashboard/community" className="btn-primary inline-flex items-center gap-2">
            <Users className="w-4 h-4" />
            Join community
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Search</label>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, industry, or city"
                  className="w-full bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Filter className="w-4 h-4" />
              Filter by type
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition',
                  activeType === type.id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-500'
                )}
              >
                {type.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 animate-pulse"
                >
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="mt-3 h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="mt-2 h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">
              Failed to load organizations. Please try again later.
            </div>
          ) : organizations.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
              No organizations found. Try adjusting your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{org.name}</h3>
                          {org.isVerified && (
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {org.industry || 'General'} · {org.size || 'Growing team'}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/organizations/${org.slug}`}
                      className="text-primary-600 hover:text-primary-700 text-sm font-semibold inline-flex items-center gap-1"
                    >
                      View <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {org.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                      {org.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {org.city || org.state ? `${org.city || ''}${org.city && org.state ? ', ' : ''}${org.state || ''}` : org.country || 'Remote'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {org.followerCount ?? 0} followers
                    </div>
                    {org.website && (
                      <div className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[160px]">{org.website}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Why follow companies?</h2>
            <ul className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary-600" />
                Get early access to hiring updates and role alerts.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary-600" />
                See culture insights, benefits, and employee wins.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary-600" />
                Track employer verification and trust scores.
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-primary-600 to-primary-500 text-white rounded-xl p-5">
            <h3 className="text-base font-semibold">Looking to hire?</h3>
            <p className="text-sm text-primary-100 mt-2">
              Create your organization profile and start attracting verified talent.
            </p>
            <Link
              href="/dashboard/creator"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg"
            >
              Get started <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
