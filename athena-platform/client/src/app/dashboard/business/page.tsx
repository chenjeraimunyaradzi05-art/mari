'use client';

/**
 * The business hub. The business tools were scattered across formation,
 * grants, investors, the accelerator, vendors and finance with no page that
 * put them in order; this one does, in the order a founder meets them.
 */

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Building2, Compass, FileText, Landmark, Receipt, Rocket, Store, Users } from 'lucide-react';
import { useFormations } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const steps = [
  { title: 'Decide the structure', description: 'Sole trader, partnership, company or trust, compared on this year’s profit and what you care about.', href: '/dashboard/business/strategy#structure', icon: Compass, highlight: true },
  { title: 'Register it', description: 'ABN, business name and, for a company, ASIC, through the formation studio.', href: '/dashboard/formation', icon: Building2, highlight: true },
  { title: 'Set up tax from day one', description: 'What to put aside each quarter, GST, and the BAS worked out from the ledger.', href: '/dashboard/finance/tax/plan#set-aside', icon: Receipt },
  { title: 'Find the grants that fit', description: 'Every listed grant scored against your stage, industry, state and the amount you need.', href: '/dashboard/business/strategy#grants', icon: BadgeCheck },
  { title: 'Know what it is worth', description: 'A valuation range, what a raise costs you in ownership, and how long the cash lasts.', href: '/dashboard/business/strategy#valuation', icon: Landmark },
  { title: 'Meet investors', description: 'Angels, funds and government programs, with a warm introduction when there is a fit.', href: '/dashboard/investors', icon: Users },
  { title: 'Join a cohort', description: 'The twelve-week accelerator with founders at the same stage.', href: '/dashboard/accelerator', icon: Rocket },
  { title: 'Hire the help', description: 'Vetted vendors for accounting, legal, design and development, and requests for proposals.', href: '/dashboard/rfps', icon: Store },
  { title: 'Keep the books', description: 'Accounts, journals, invoices, inventory and bank feeds.', href: '/dashboard/finance', icon: FileText },
];

export default function BusinessHubPage() {
  const { data: formations, isLoading } = useFormations();
  const list = Array.isArray(formations) ? (formations as Array<{ id: string; businessName?: string | null; type: string; status: string }>) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Building2 className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Business</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">Start it, fund it, run it</h1>
        <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">Everything for the business side, in the order you meet it.</p>
      </div>

      {!isLoading && list.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Your registrations</h2>
            <Link href="/dashboard/formation" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Formation studio</Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {list.slice(0, 3).map((f) => (
              <li key={f.id}>
                <Link href={`/dashboard/formation/${f.id}`} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-800 dark:text-slate-200">{f.businessName || 'Untitled registration'} <span className="text-slate-400">· {f.type.replace(/_/g, ' ').toLowerCase()}</span></span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{f.status.replace(/_/g, ' ').toLowerCase()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="grid gap-4 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className={cn('card group flex h-full items-start gap-4 p-5 transition hover:border-rose-300', s.highlight && 'border-rose-200 dark:border-rose-900/50')}>
              <div className={cn('rounded-xl p-3', s.highlight ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-slate-100 dark:bg-slate-800')}>
                <s.icon className={cn('h-6 w-6', s.highlight ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300')} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">Step {i + 1}</p>
                <h2 className="font-semibold text-slate-900 dark:text-white">{s.title}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-rose-500" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
