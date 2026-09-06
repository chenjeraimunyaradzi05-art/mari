'use client';

/**
 * Referral performance: how many referrals exist, how many completed, how
 * many earned a reward, and who is bringing people in.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Gift, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type Overview = { referrals: { total: number; completed: number; rewarded: number } };
type Row = { rank?: number; userId?: string; id?: string; name?: string; displayName?: string; firstName?: string; lastName?: string; avatar?: string | null; count?: number; referrals?: number; total?: number };

const nameOf = (r: Row) => r.name || r.displayName || [r.firstName, r.lastName].filter(Boolean).join(' ') || 'A member';
const countOf = (r: Row) => r.count ?? r.referrals ?? r.total ?? 0;

export default function ReferralsPage() {
  const overview = useQuery({ queryKey: ['admin-marketing-overview'], queryFn: () => api.get('/admin/marketing/overview'), select: (r) => r.data?.data as Overview });
  const leaderboard = useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn: () => api.get('/referrals/leaderboard'),
    select: (r) => {
      const d = r.data?.data ?? r.data;
      return (Array.isArray(d) ? d : Array.isArray(d?.leaderboard) ? d.leaderboard : []) as Row[];
    },
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link href="/admin/marketing" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Marketing hub
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
        <Gift className="h-7 w-7 text-primary-600" /> Referrals
      </h1>
      <p className="mt-1 mb-6 text-slate-600 dark:text-slate-400">From the referral programme's own records.</p>
      {overview.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            ['Referrals', overview.data?.referrals.total ?? 0],
            ['Completed', overview.data?.referrals.completed ?? 0],
            ['Rewarded', overview.data?.referrals.rewarded ?? 0],
          ].map(([l, v]) => (
            <div key={String(l)} className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{l}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{v as number}</p>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Top referrers</h2>
        {leaderboard.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : (leaderboard.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500">No completed referrals yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {leaderboard.data!.slice(0, 20).map((r, i) => (
              <li key={r.userId ?? r.id ?? i} className="flex items-center gap-3 py-2">
                <span className="w-6 text-slate-400">{r.rank ?? i + 1}</span>
                <span className="flex-1 text-slate-800 dark:text-slate-200">{nameOf(r)}</span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-white">{countOf(r)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
