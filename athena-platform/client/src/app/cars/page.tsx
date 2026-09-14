'use client';

/**
 * Cars, in public. The map of the area first, because a visitor came for
 * one thing (a mechanic, a price, a loan); then the two questions asked
 * most (what will it cost a month, what is mine worth) answered before she
 * signs up; the catalogue's safest picks; the latest pre-loved listings;
 * and the sources every number on these pages leans on.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Banknote, ShieldCheck, Tag } from 'lucide-react';
import { PageHero, PageShell, Section } from '@/components/layout/PageShell';
import { AUTO_GROUPS, AUTO_TONES } from '@/lib/automotive-nav';
import { autoApi, aud0, km, type CarCard, type ListingCard } from '@/lib/automotive-api';
import { AncapBadge, AutoDisclaimer, Stars, VerdictChip, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Field, NumberInput, Pending, SelectInput, Stat, num, useCalc } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';
import { safeHref } from '@/lib/safe-href';

type Repayment = { repayment: number; totalInterest: number; weekly: number };
type Valuation = { low: number; mid: number; high: number; tradeIn: number; newPriceAssumed: boolean };

export default function CarsPage() {
  const ref = useReference();
  const picks = useLoad<{ cars: CarCard[] }>(() => autoApi.catalogue({ currentRating: 'true', sort: 'running' }));
  const latest = useLoad<{ listings: ListingCard[] }>(() => autoApi.listings({ sort: 'newest' }));
  const [amount, setAmount] = useState('30000');
  const [rate, setRate] = useState('8.49');
  const [term, setTerm] = useState('60');
  const [year, setYear] = useState('2020');
  const [kms, setKms] = useState('');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('');
  const rep = useCalc<Repayment>(autoApi.finance.repayment, { amount: num(amount), ratePct: num(rate), termMonths: num(term) }, num(amount) > 0);
  const val = useCalc<Valuation>(autoApi.valuation.estimate, { year: num(year), odometerKm: num(kms), make, model: model || undefined }, num(kms) > 0 && num(year) > 1980);

  return (
    <PageShell width="wide">
      <PageHero
        kicker="Cars"
        title="A car bought with the right questions asked"
        description="Safety before the badge, running costs before the sticker, a mechanic who explains the bill, and a used car bought with the money held until the keys are in your hand."
        primaryAction={{ label: 'Browse new cars', href: '/cars/new' }}
        secondaryAction={{ label: 'Find a mechanic', href: '/cars/mechanics' }}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {AUTO_GROUPS.map((g) => (
            <section key={g.key} aria-labelledby={`cars-${g.key}`}>
              <h2 id={`cars-${g.key}`} className="rail-title">{g.title}</h2>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{g.intro}</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {g.items.map((t) => (
                  <li key={t.href}>
                    <Link href={t.href} className="tile-soft group flex h-full items-start gap-3 p-4">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', AUTO_TONES[g.tone])}><t.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900 dark:text-white">{t.label}</span>
                        <span className="mt-0.5 block text-sm leading-6 text-slate-600 dark:text-slate-400">{t.blurb}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-400">{t.gated ? 'Sign in and open' : 'Open'} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="space-y-6">
          <Section icon={Banknote} title="What would it cost a month?" description="A secured car loan, before anyone has your details.">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Borrow"><NumberInput value={amount} onChange={setAmount} prefix="$" /></Field>
              <Field label="Rate"><NumberInput value={rate} onChange={setRate} suffix="%" step={0.1} /></Field>
              <Field label="Months"><NumberInput value={term} onChange={setTerm} /></Field>
            </div>
            <Pending loading={rep.loading} error={rep.error}>
              {rep.result && <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="A month" value={aud0(rep.result.repayment)} tone="rose" big /><Stat label="Interest over the loan" value={aud0(rep.result.totalInterest)} sub={`${aud0(rep.result.weekly)} a week`} /></div>}
            </Pending>
            <Link href="/cars/finance" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-600">Compare loans and check what you can carry <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Section>

          <Section icon={Tag} title="What is your car worth?" description="A guide from the year, kilometres and make. Not a valuation, a starting point.">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Make"><SelectInput value={make} onChange={setMake} options={(ref.data?.makes ?? ['Toyota']).map((m) => ({ value: m, label: m }))} /></Field>
              <Field label="Model"><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Corolla" className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" /></Field>
              <Field label="Year"><NumberInput value={year} onChange={setYear} /></Field>
              <Field label="Kilometres"><NumberInput value={kms} onChange={setKms} suffix="km" placeholder="85000" /></Field>
            </div>
            <Pending loading={val.loading} error={val.error}>
              {val.result && <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="Private sale" value={`${aud0(val.result.low)} to ${aud0(val.result.high)}`} tone="good" /><Stat label="Trade-in, about" value={aud0(val.result.tradeIn)} sub={val.result.newPriceAssumed ? 'from a typical new price' : 'from the catalogue price'} /></div>}
            </Pending>
            <Link href="/cars/value" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-600">The full estimate, and the changeover to the next car <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Section>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-rose-500" /><h2 className="rail-title">Safe and cheap to run</h2></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Current five-star ratings, ordered by what they cost to run in a year. Every rating shows its year; ANCAP ratings lapse after six.</p></div><Link href="/cars/new" className="text-sm font-semibold text-rose-600">The whole catalogue</Link></div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(picks.data?.cars ?? []).slice(0, 6).map((c) => (
            <li key={c.id}><Link href={`/cars/new/${c.slug}`} className="tile-soft block h-full p-4">
              <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{c.bodyLabel} · {c.fuelLabel}</span><AncapBadge ancap={c.ancap} stars={c.ancapStars} compact /></div>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">{c.make} {c.model}</p>
              <p className="text-xs text-slate-500">{c.variant}</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">From {aud0(c.priceFrom)} · about {aud0(c.runningCostYear)} a year to run{c.energy ? ` · ${c.energy}` : ''}</p>
              <div className="mt-2"><Stars value={c.ratingAvg} count={c.ratingCount || undefined} label="No reviews from women yet" /></div>
            </Link></li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><div className="flex items-center gap-2"><Tag className="h-4 w-4 text-rose-500" /><h2 className="rail-title">Just listed, pre-loved</h2></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Every listing carries a price guide, the checks to run, and buyer protection: the money is held for {ref.data?.buyerProtection.inspectionDays ?? 14} days after you have the car.</p></div><Link href="/cars/preloved" className="text-sm font-semibold text-rose-600">All listings</Link></div>
        {latest.data && latest.data.listings.length === 0 && <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Nothing listed yet. Be the first: <Link href="/dashboard/cars/sell" className="font-semibold text-rose-600">sell a car</Link> with a price guide and a safe handover.</p>}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(latest.data?.listings ?? []).slice(0, 6).map((l) => (
            <li key={l.id}><Link href={`/cars/preloved/${l.id}`} className="tile-soft block h-full overflow-hidden">
              {l.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.photos[0]} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : <div className="aspect-[4/3] w-full bg-gradient-to-br from-rose-100 via-purple-50 to-amber-50 dark:from-rose-900/20 dark:via-purple-900/10 dark:to-amber-900/10" />}
              <div className="p-4"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900 dark:text-white">{aud0(l.price)}</span><VerdictChip verdict={l.priceVerdict} /></div><p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{l.year} {l.make} {l.model}{l.variant ? ` ${l.variant}` : ''}</p><p className="text-xs text-slate-500">{km(l.odometerKm)} · {l.fuelLabel} · {[l.suburb || l.city, l.state].filter(Boolean).join(', ')}</p></div>
            </Link></li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-rose-500" /><h2 className="rail-title">Where the numbers come from</h2></div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(ref.data?.sources ?? []).slice(0, 8).map((s) => <li key={s.key} className="surface p-3"><a href={safeHref(s.url)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{s.name}</a><p className="mt-0.5 text-xs leading-5 text-slate-500">{s.what}</p></li>)}
        </ul>
        <div className="mt-4"><AutoDisclaimer /></div>
      </section>
    </PageShell>
  );
}
