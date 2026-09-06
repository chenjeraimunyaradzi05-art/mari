'use client';

/**
 * The marketing hub: the numbers at the top, live from the platform, and a
 * door to each part of the work. Partnerships, press, influencers and the
 * waitlist are the lead register filtered by source.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Gift, Loader2, Megaphone, Target, TrendingUp, Users } from 'lucide-react';
import { api } from '@/lib/api';

type Overview = {
  funnel: { waitlist: number; registered30d: number; verified30d: number; active30d: number; paid: number };
  leads: { bySource: Record<string, number>; byStatus: Record<string, number> };
  campaigns: { active: number; total: number };
  referrals: { total: number; completed: number; rewarded: number };
};

const sections = [
  { title: 'Campaigns', description: 'Channels, budgets, utm names and the leads they bring.', href: '/admin/marketing/campaigns', icon: Megaphone, key: 'campaigns' },
  { title: 'Funnel', description: 'Waitlist to sign-up to verified to active to paying.', href: '/admin/marketing/funnel', icon: TrendingUp, key: 'funnel' },
  { title: 'Leads', description: 'Every enquiry the site captures, with a status and an owner.', href: '/admin/marketing/leads', icon: Users, key: 'leads' },
  { title: 'Waitlist', description: 'Pre-launch signups in order.', href: '/admin/marketing/leads?source=WAITLIST', icon: Users, key: 'WAITLIST' },
  { title: 'Sales enquiries', description: 'From the contact-sales page.', href: '/admin/marketing/leads?source=CONTACT_SALES', icon: Users, key: 'CONTACT_SALES' },
  { title: 'Partnerships', description: 'Strategic partners and co-marketing.', href: '/admin/marketing/leads?source=PARTNER', icon: Users, key: 'PARTNER' },
  { title: 'Press', description: 'Media enquiries.', href: '/admin/marketing/leads?source=PRESS', icon: Users, key: 'PRESS' },
  { title: 'Influencers', description: 'Creator partnerships.', href: '/admin/marketing/leads?source=INFLUENCER', icon: Users, key: 'INFLUENCER' },
  { title: 'Referrals', description: 'Referral performance and who is bringing people in.', href: '/admin/marketing/referrals', icon: Gift, key: 'referrals' },
  { title: 'Go-to-market board', description: 'Launch initiatives by area and state.', href: '/admin/gtm', icon: Target, key: 'gtm' },
];

export default function AdminMarketingPage() {
  const overview = useQuery({
    queryKey: ['admin-marketing-overview'],
    queryFn: () => api.get('/admin/marketing/overview'),
    select: (r) => r.data?.data as Overview,
  });
  const o = overview.data;
  const countFor = (key: string): string | null => {
    if (!o) return null;
    if (key === 'campaigns') return `${o.campaigns.active} active of ${o.campaigns.total}`;
    if (key === 'leads') return `${Object.values(o.leads.bySource).reduce((n, v) => n + v, 0)} leads`;
    if (key === 'referrals') return `${o.referrals.completed} completed`;
    if (key === 'funnel') return `${o.funnel.paid} paying`;
    if (key === 'gtm') return null;
    const n = o.leads.bySource[key];
    return n != null ? `${n}` : '0';
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Megaphone className="h-7 w-7 text-primary-600" /> Marketing hub
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Campaigns, leads, the funnel and referrals, counted live.</p>
      </div>

      {overview.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : o ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-5">
          {[
            ['Waitlist', o.funnel.waitlist],
            ['Signed up, 30d', o.funnel.registered30d],
            ['Active, 30d', o.funnel.active30d],
            ['Paying', o.funnel.paid],
            ['Active campaigns', o.campaigns.active],
          ].map(([l, v]) => (
            <div key={String(l)} className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{l}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{v as number}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => {
          const count = countFor(s.key);
          return (
            <Link key={s.title} href={s.href} className="card hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/20">
                  <s.icon className="h-5 w-5 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {s.title}
                    {count && <span className="ml-2 text-sm font-normal text-slate-500">{count}</span>}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{s.description}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600">
                    Open <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
