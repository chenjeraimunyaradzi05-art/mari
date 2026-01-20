'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ShieldCheck, FileText, Users, Globe, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GdprSummary {
  totalUsers: number;
  ukUsers: number;
  euUsers: number;
  dsarExportsLastWindow: number;
  accountDeletesLastWindow: number;
  consentUpdatesLastWindow: number;
  lastWindowDays: number;
  consentCounts: {
    consentMarketing: number;
    consentDataProcessing: number;
    consentCookies: number;
    consentDoNotSell: number;
  };
}

interface ConsentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  region: string;
  preferredLocale?: string | null;
  preferredCurrency?: string | null;
  consentMarketing: boolean;
  consentDataProcessing: boolean;
  consentCookies: boolean;
  consentDoNotSell: boolean;
  consentUpdatedAt: string | null;
}

interface ConsentListResponse {
  users: ConsentUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminCompliancePage() {
  const [days, setDays] = useState(30);
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(1);

  const summaryQuery = useQuery<GdprSummary>({
    queryKey: ['gdpr-summary', days],
    queryFn: async () => {
      const response = await api.get(`/admin/gdpr/summary?days=${days}`);
      return response.data;
    },
  });

  const consentsQuery = useQuery<ConsentListResponse>({
    queryKey: ['gdpr-consents', region, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });
      if (region) params.append('region', region);
      const response = await api.get(`/admin/gdpr/consents?${params.toString()}`);
      return response.data;
    },
  });

  const summary = summaryQuery.data;
  const consentUsers = consentsQuery.data?.users || [];

  const cards = useMemo(() => (
    [
      { label: 'Total Users', value: summary?.totalUsers ?? 0, icon: Users },
      { label: 'UK Users', value: summary?.ukUsers ?? 0, icon: Globe },
      { label: 'EU Users', value: summary?.euUsers ?? 0, icon: Globe },
      { label: `DSAR Exports (${days}d)`, value: summary?.dsarExportsLastWindow ?? 0, icon: FileText },
      { label: `Account Deletes (${days}d)`, value: summary?.accountDeletesLastWindow ?? 0, icon: ShieldCheck },
      { label: `Consent Updates (${days}d)`, value: summary?.consentUpdatesLastWindow ?? 0, icon: Clock },
    ]
  ), [summary, days]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GDPR & UK Compliance</h1>
              <p className="text-gray-600 dark:text-gray-400">Consent audits, DSAR activity, and region readiness</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Window (days)</span>
            <Input
              type="number"
              value={days}
              min={7}
              max={365}
              className="w-28"
              onChange={(e) => {
                setDays(Number(e.target.value));
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary-100 dark:bg-primary-900/30 p-3 rounded-lg">
                  <card.icon className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {card.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Consent Ledger</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recent consent records by user</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Regions</option>
                <option value="UK">United Kingdom</option>
                <option value="EU">European Union</option>
                <option value="US">United States</option>
                <option value="ANZ">Australia / NZ</option>
                <option value="SEA">Southeast Asia</option>
                <option value="MEA">Middle East & Africa</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Consents</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {consentUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      <div className="font-medium">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{user.region}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex flex-wrap gap-2">
                        <span className={user.consentDataProcessing ? 'text-emerald-600' : 'text-gray-400'}>Data</span>
                        <span className={user.consentCookies ? 'text-emerald-600' : 'text-gray-400'}>Cookies</span>
                        <span className={user.consentMarketing ? 'text-emerald-600' : 'text-gray-400'}>Marketing</span>
                        <span className={user.consentDoNotSell ? 'text-amber-600' : 'text-gray-400'}>DNT</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {user.consentUpdatedAt ? new Date(user.consentUpdatedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">Page {page} of {consentsQuery.data?.pagination.totalPages || 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= (consentsQuery.data?.pagination.totalPages || 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
