'use client';

/**
 * The funnel, counted from the platform's own tables: waitlist, sign-ups in
 * the last 30 days, verified, active, paying. Conversion between each step
 * is shown as a rate so the weakest step is obvious.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';

type Overview = {
  funnel: { waitlist: number; registered30d: number; verified30d: number; active30d: number; paid: number };
  leads: { bySource: Record<string, number>; byStatus: Record<string, number> };
  campaigns: { active: number; total: number };
  referrals: { total: number; completed: number; rewarded: number };
};

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '–');

export default function FunnelPage() {
  const overview = useQuery({
    queryKey: ['admin-marketing-overview'],
    queryFn: () => api.get('/admin/marketing/overview'),
    select: (r) => r.data?.data as Overview,
  });

  const f = overview.data?.funnel;
  const steps = f
    ? [
        ['Waitlist leads (all time)', f.waitlist, null],
        ['Signed up (30 days)', f.registered30d, pct(f.registered30d, f.waitlist)],
        ['Verified email (30 days)', f.verified30d, pct(f.verified30d, f.registered30d)],
        ['Active in the last 30 days (all members)', f.active30d, null],
        ['Paying members (now)', f.paid, pct(f.paid, f.active30d)],
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link href="/admin/marketing" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Marketing hub
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
        <TrendingUp className="h-7 w-7 text-primary-600" /> Funnel
      </h1>
      <p className="mt-1 mb-6 text-slate-600 dark:text-slate-400">Counted live from members, subscriptions and leads. Rates are step over the step above.</p>
      {overview.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="card">
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {steps.map(([name, value, rate], i) => (
              <li key={String(name)} className="flex items-center gap-4 py-3">
                <span className="w-6 text-sm text-slate-400">{i + 1}</span>
                <span className="flex-1 text-slate-800 dark:text-slate-200">{name}</span>
                <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value as number}</span>
                <span className="w-14 text-right text-sm tabular-nums text-slate-500">{(rate as string | null) ?? ''}</span>
              </li>
            ))}
          </ol>
          {overview.data && (
            <p className="mt-4 text-xs text-slate-500">
              Leads by status: {Object.entries(overview.data.leads.byStatus).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(' · ') || 'none yet'}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
