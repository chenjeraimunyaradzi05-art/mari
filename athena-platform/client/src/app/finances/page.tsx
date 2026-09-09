'use client';

/**
 * Finances, in public. It used to be three cards that all pointed at the
 * dashboard root. Now it is the map of the money side: the safety net,
 * super, tax, investing, housing, insurance, and the books for a business,
 * each opening the page that does the work, and one small calculator a
 * visitor can try before she signs up.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, BookOpen, Calculator, Home, Landmark, LifeBuoy, PiggyBank, Receipt, Shield, TrendingUp, type LucideIcon } from 'lucide-react';
import { PageHero, PageShell, Section } from '@/components/layout/PageShell';
import { strategyApi } from '@/lib/strategy-api';
import { Disclaimer, Field, NumberInput, Pending, Stat, aud, num, pct, useCalc } from '@/components/strategy/StrategyUi';

type Estimate = { monthlyTakeHome: number; totalTax: number; effectiveRate: number; employerSuper: number; asAt: string };

const TILES: Array<{ href: string; title: string; blurb: string; icon: LucideIcon; gated?: boolean }> = [
  { href: '/dashboard/finance/invest#emergency', title: 'The safety net', blurb: 'Three to six months of expenses, sized for your income and tracked as a goal.', icon: LifeBuoy, gated: true },
  { href: '/dashboard/finance/savings', title: 'Savings goals', blurb: 'A deposit, a course, a trip, a business. One bar each, filling up.', icon: PiggyBank, gated: true },
  { href: '/dashboard/finance/tax/plan', title: 'Tax plan', blurb: 'What this year will cost, the deductions worth the receipts, and what a sole trader puts aside.', icon: Receipt, gated: true },
  { href: '/dashboard/finance/super', title: 'Super', blurb: 'Track the balance, and the contributions that close the gap a career break opens.', icon: Landmark, gated: true },
  { href: '/dashboard/finance/invest', title: 'Investing', blurb: 'Your mix from six questions, what you own against it, and where it goes over the years.', icon: TrendingUp, gated: true },
  { href: '/housing', title: 'Housing', blurb: 'Rent you can carry, the deposit and the loan, and safe places to live.', icon: Home },
  { href: '/dashboard/finance/insurance', title: 'Insurance', blurb: 'Income protection and the other covers, compared plainly.', icon: Shield, gated: true },
  { href: '/dashboard/finance/health', title: 'Financial health', blurb: 'One score from the pieces above, and the next thing to fix.', icon: Activity, gated: true },
  { href: '/dashboard/finance', title: 'The books', blurb: 'Bank feeds, a ledger you can read, invoices, and the BAS worked out from it.', icon: BookOpen, gated: true },
];

export default function FinancesPage() {
  const [income, setIncome] = useState('');
  const estimate = useCalc<Estimate>(strategyApi.tax.estimate, { grossIncome: num(income) }, num(income) > 0);

  return (
    <PageShell width="wide">
      <PageHero
        kicker="Finances"
        title="Money, without the dread"
        description="The safety net first, then super, tax and investing in plain words, with the numbers worked out for you and saved where you left them."
        primaryAction={{ label: 'Start with the safety net', href: '/dashboard/finance/invest#emergency' }}
        secondaryAction={{ label: 'Housing, rent or buy', href: '/housing' }}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="tile-soft group flex h-full flex-col p-4">
                <t.icon className="h-5 w-5 text-rose-500" />
                <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">{t.title}</h2>
                <p className="mt-1 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{t.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {t.gated ? 'Sign in and open' : 'Open'} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Section icon={Calculator} title="What you take home" description="Try it now. The full tax plan does the deductions and super too.">
          <Field label="Salary, a year"><NumberInput value={income} onChange={setIncome} prefix="$" placeholder="75000" /></Field>
          {num(income) > 0 && (
            <Pending loading={estimate.loading} error={estimate.error}>
              {estimate.result && (
                <div className="mt-4 space-y-3">
                  <Stat label="Each month, after tax" value={aud(estimate.result.monthlyTakeHome)} tone="good" big />
                  <Stat label="Tax for the year" value={aud(estimate.result.totalTax)} sub={`${pct(estimate.result.effectiveRate, 1)} of what you earn`} />
                  <Stat label="Super your employer adds" value={aud(estimate.result.employerSuper)} sub="12%, on top" />
                </div>
              )}
            </Pending>
          )}
          <div className="mt-4">
            <Link href="/dashboard/finance/tax/plan" className="text-sm font-semibold text-rose-600 dark:text-rose-400">The whole tax plan</Link>
          </div>
        </Section>
      </div>

      <div className="mt-6"><Disclaimer asAt={estimate.result?.asAt} advice /></div>
    </PageShell>
  );
}
