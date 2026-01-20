'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, GraduationCap } from 'lucide-react';
import { useEducationProviders } from '@/lib/hooks';
import { CardSkeleton } from '@/components/ui/loading';

export default function EducationProvidersPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');

  const params = useMemo(
    () => ({
      page: 1,
      limit: 20,
      search: search || undefined,
      type: type || undefined,
    }),
    [search, type]
  );

  const { data, isLoading } = useEducationProviders(params);

  const providers = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Education Providers</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Universities and TAFEs</p>
        </div>
        <Link href="/dashboard/learn/applications" className="btn-outline px-6 py-2.5 text-center">
          My Applications
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search providers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>

        <div className="relative">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input pr-10 appearance-none"
          >
            <option value="">All Types</option>
            <option value="university">University</option>
            <option value="tafe">TAFE</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
            <GraduationCap className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </div>
          <p className="text-gray-900 dark:text-white font-medium">No providers found</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try a different search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/learn/providers/${p.slug}`}
              className="card group hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                  {p.logo ? (
                    <img src={p.logo} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <GraduationCap className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 transition truncate">
                      {p.name}
                    </h3>
                    {p.isVerified ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200 rounded-full">
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {[p.city, p.state, p.country].filter(Boolean).join(', ') || 'Australia'}
                  </p>
                  {p.description ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                      {p.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
