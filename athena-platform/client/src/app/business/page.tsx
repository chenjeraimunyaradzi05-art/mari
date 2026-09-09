'use client';

/**
 * Business, in public. The page used to sell Delaware LLCs and EIN
 * registration under invented figures, to an Australian audience. It now
 * describes the four ways an Australian business trades, the order the
 * platform's business tools come in, and where each of them is.
 */

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Building2, Compass, Landmark, Receipt, Rocket, Store, Users, type LucideIcon } from 'lucide-react';
import { PageHero, PageShell, Section } from '@/components/layout/PageShell';

const STRUCTURES = [
  { name: 'Sole trader', cost: 'Free with an ABN', line: 'The simplest. Profit goes on your own tax return, and so does the risk.' },
  { name: 'Partnership', cost: '$100 to $500', line: 'Two or more of you, sharing profit and liability under a written agreement.' },
  { name: 'Company', cost: '$600 to $1,500', line: 'A separate legal entity. 25% tax on profit kept in, shares for investors, ASIC every year.' },
  { name: 'Trust', cost: '$1,500 to $3,000', line: 'Profit streamed to family at their rates and assets held apart. An accountant, every year.' },
];

const STEPS: Array<{ title: string; copy: string; href: string; icon: LucideIcon; gated?: boolean }> = [
  { title: 'Choose the structure', copy: 'The same profit through all four, on this year’s tax scale, with what each gives you beyond tax.', href: '/dashboard/business/strategy#structure', icon: Compass, gated: true },
  { title: 'Register it', copy: 'ABN and business name, and ASIC for a company, with the register checked as you type.', href: '/formation', icon: Building2 },
  { title: 'Tax from day one', copy: 'What to put aside each quarter, when GST starts, and the BAS worked out from the ledger.', href: '/dashboard/finance/tax/plan#set-aside', icon: Receipt, gated: true },
  { title: 'Grants that fit', copy: 'Federal, state and foundation programs, scored against your stage, industry and state.', href: '/grants', icon: BadgeCheck },
  { title: 'Know what it is worth', copy: 'A valuation range from three methods, what a raise costs you, and how long the cash lasts.', href: '/dashboard/business/strategy#valuation', icon: Landmark, gated: true },
  { title: 'Investors and the cohort', copy: 'Angels and funds with a warm introduction, and the twelve-week accelerator with founders at your stage.', href: '/capital', icon: Users },
  { title: 'The accelerator', copy: 'Market validation to launch, in twelve weeks, with a mentor and a room of women doing the same.', href: '/accelerator', icon: Rocket },
  { title: 'Hire the help', copy: 'Vetted accountants, lawyers, designers and developers, and requests for proposals they answer.', href: '/vendors', icon: Store },
];

export default function BusinessPage() {
  return (
    <PageShell width="wide">
      <PageHero
        kicker="Business"
        title="Start it, fund it, run it"
        description="Registering a business in Australia takes a morning once the decisions are made. This is where the decisions get made, and where every tool for the years after lives."
        primaryAction={{ label: 'Compare the structures', href: '/dashboard/business/strategy' }}
        secondaryAction={{ label: 'Formation studio', href: '/formation' }}
      />

      <div className="mt-8">
        <Section icon={Compass} title="Four ways to trade" description="Which one depends on the profit, who shares it, and how much of your own life you want between you and the business." action={{ label: 'Compare on your numbers', href: '/dashboard/business/strategy#structure' }}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STRUCTURES.map((s) => (
              <li key={s.name} className="tile-soft p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white">{s.name}</h3>
                <p className="text-xs font-medium text-rose-500">{s.cost} to set up</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{s.line}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="mt-6">
        <Section icon={Rocket} title="From idea to funded" description="In the order a founder meets them.">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Link href={s.href} className="tile-soft group flex h-full flex-col p-4">
                  <div className="flex items-center justify-between">
                    <s.icon className="h-5 w-5 text-rose-500" />
                    <span className="text-xs text-slate-400">{i + 1}</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                  <p className="mt-1 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{s.copy}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {s.gated ? 'Sign in and open' : 'Open'} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section icon={Receipt} title="The books, without an accountant on speed dial" description="Bank feeds by consent, a ledger, invoices, inventory, and the BAS worked out from what was posted.">
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/finance" className="focusable rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900">Open the books</Link>
            <Link href="/dashboard/finance/tax" className="focusable rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">The BAS worksheet</Link>
          </div>
        </Section>
        <Section icon={Users} title="Not on your own" description="Founders at the same stage in the communities, mentors who have run the numbers before, and requests for proposals that vendors answer.">
          <div className="flex flex-wrap gap-2">
            <Link href="/communities" className="focusable rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900">Founder communities</Link>
            <Link href="/rfps" className="focusable rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">Requests for proposals</Link>
          </div>
        </Section>
      </div>

      <p className="mt-6 text-xs leading-5 text-slate-500 dark:text-slate-400">Set-up costs are typical ranges for Australian registrations and agreements, not quotes. The comparison tool estimates tax from the published scale; a registered tax agent confirms the choice before you register.</p>
    </PageShell>
  );
}
