'use client';

/**
 * Car insurance, in public: an estimate for each cover type from the
 * things that move a premium, the factors shown with their weight, the
 * quotes she collected ranked by what each would really cost in a year,
 * the claims process step by step, the notes for women (cover in your
 * own name, continuous cover through a career break, the family violence
 * team every insurer has to run), and extended warranties explained
 * beside the consumer guarantee that already covers a dealer's car.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { FileCheck2, Scale, ShieldCheck, Umbrella } from 'lucide-react';
import { PageHero, PageShell, Section } from '@/components/layout/PageShell';
import { autoApi, autoError, aud0, type QuoteComparison } from '@/lib/automotive-api';
import { AutoDisclaimer, Chip, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, Panel, Pending, SelectInput, Stat, inputClass, num, useCalc } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Estimate = { covers: Array<{ key: string; label: string; covers: string; suits: string; annualLow: number; annual: number; annualHigh: number; monthly: number; recommended: boolean }>; factors: Array<{ key: string; label: string; effect: string; multiplier: number }>; multiPolicySaving: number; ctpNote: string; notes: string[] };
type Compare = { quotes: QuoteComparison[]; cheapest: string | null; bestValue: string | null; spreadPct: number; notes: string[] };

const EMPTY_QUOTE = { insurer: '', annual: '', monthlyTotal: '', excess: '800', hireCar: false, choiceOfRepairer: false, newForOld: false, roadside: false, windscreen: false };
type QuoteRow = typeof EMPTY_QUOTE;

/** The quotes she was given, typed in as they came, and ranked by what each really costs. */
function QuoteCompare({ vehicleValue }: { vehicleValue: number }) {
  const [rows, setRows] = useState<QuoteRow[]>([{ ...EMPTY_QUOTE }, { ...EMPTY_QUOTE }]);
  const [result, setResult] = useState<Compare | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = rows.filter((r) => r.insurer.trim() && num(r.annual) > 0);
  const set = (i: number, k: keyof QuoteRow, v: string | boolean) => setRows((x) => x.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const compare = async () => {
    setBusy(true);
    try {
      const res = await autoApi.insurance.compare({ vehicleValue: vehicleValue || null, quotes: ready.map((r) => ({ insurer: r.insurer, annual: num(r.annual), monthlyTotal: r.monthlyTotal ? num(r.monthlyTotal) : null, excess: num(r.excess), hireCar: r.hireCar, choiceOfRepairer: r.choiceOfRepairer, newForOld: r.newForOld, roadside: r.roadside, windscreen: r.windscreen })) });
      setResult(res.data.data);
    } catch (err) { toast.error(autoError(err, 'That could not be compared.')); } finally { setBusy(false); }
  };
  return (
    <Panel icon={Scale} title="Compare the quotes you were given" intro="Type each quote in as the insurer gave it. The comparison weighs the excess and prices what has been left out, so the cheapest premium and the best value are told apart.">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Insurer"><input value={r.insurer} onChange={(e) => set(i, 'insurer', e.target.value)} className={inputClass} placeholder="Who quoted" /></Field>
              <Field label="A year"><NumberInput value={r.annual} onChange={(v) => set(i, 'annual', v)} prefix="$" /></Field>
              <Field label="Paid monthly, the year's total" hint="Blank if you would pay yearly"><NumberInput value={r.monthlyTotal} onChange={(v) => set(i, 'monthlyTotal', v)} prefix="$" /></Field>
              <Field label="Excess"><NumberInput value={r.excess} onChange={(v) => set(i, 'excess', v)} prefix="$" /></Field>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Check checked={r.hireCar} onChange={(v) => set(i, 'hireCar', v)} label="Hire car" />
              <Check checked={r.choiceOfRepairer} onChange={(v) => set(i, 'choiceOfRepairer', v)} label="Choice of repairer" />
              <Check checked={r.newForOld} onChange={(v) => set(i, 'newForOld', v)} label="New for old" />
              <Check checked={r.roadside} onChange={(v) => set(i, 'roadside', v)} label="Roadside" />
              <Check checked={r.windscreen} onChange={(v) => set(i, 'windscreen', v)} label="Windscreen, no excess" />
              {rows.length > 2 && <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="text-xs text-slate-500 hover:text-rose-600">Remove</button>}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {rows.length < 6 && <button type="button" onClick={() => setRows((x) => [...x, { ...EMPTY_QUOTE }])} className="btn-ghost text-sm">Another quote</button>}
          <button type="button" onClick={compare} disabled={busy || ready.length < 2} className="btn-primary text-sm disabled:opacity-50">{ready.length >= 2 ? `Compare ${ready.length} quotes` : 'Two quotes at least'}</button>
        </div>
        {result && result.quotes.length > 0 && (
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {result.bestValue === result.cheapest ? <><span className="font-semibold text-slate-900 dark:text-white">{result.bestValue}</span> is both the cheapest premium and the best value.</> : <><span className="font-semibold text-slate-900 dark:text-white">{result.cheapest}</span> has the cheapest premium; <span className="font-semibold text-slate-900 dark:text-white">{result.bestValue}</span> is the better value once the excess and the extras are counted.</>}
              {result.spreadPct > 0 ? ` The premiums are ${result.spreadPct}% apart.` : ''}
            </p>
            <ul className="mt-3 space-y-2">
              {result.quotes.map((q) => (
                <li key={q.insurer} className={cn('rounded-xl border p-3 text-sm', q.bestValue ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800')}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-900 dark:text-white">{q.insurer} <span className="text-xs font-normal text-slate-500">{q.cover}</span></span><span className="flex items-center gap-2">{q.cheapest && <Chip tone="sky">Cheapest premium</Chip>}{q.bestValue && <Chip tone="emerald">Best value</Chip>}</span></div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{aud0(q.paidYearly)} a year as you would pay it{q.monthlyLoading ? ` (${aud0(q.monthlyLoading)} of that is the monthly loading)` : ''} · excess {aud0(q.excess)}, weighted {aud0(q.expectedExcess)} · left out: {q.missing.length ? `${q.missing.join(', ')}, about ${aud0(q.missingValue)} to buy separately` : 'nothing'}</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-white">All in, about {aud0(q.allIn)} a year{q.moreThanBest ? `, ${aud0(q.moreThanBest)} more than the best` : ''}</p>
                  {q.flags.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{q.flags.map((f) => <li key={f}>{f}</li>)}</ul>}
                </li>
              ))}
            </ul>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-500">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Insurance() {
  const search = useSearchParams();
  const ref = useReference();
  const [f, setF] = useState({ vehicleValue: search.get('value') ?? '25000', driverAge: '35', state: 'QLD', area: 'METRO', garaging: 'GARAGE', kmPerYear: '15000', excess: '800', claimsFreeYears: '3', youngDrivers: false, fuelType: search.get('fuel') ?? 'PETROL', multiPolicy: false, financed: false, vehicleAgeYears: '3' });
  const est = useCalc<Estimate>(autoApi.insurance.estimate, { ...f, vehicleValue: num(f.vehicleValue), driverAge: num(f.driverAge), kmPerYear: num(f.kmPerYear), excess: num(f.excess), claimsFreeYears: num(f.claimsFreeYears), vehicleAgeYears: num(f.vehicleAgeYears) }, num(f.vehicleValue) > 0 && num(f.driverAge) >= 16);
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const r = ref.data?.insurance;
  const w = ref.data?.warranty;

  return (
    <PageShell width="wide" backTo={{ href: '/cars', label: 'Back to cars' }}>
      <PageHero kicker="Car insurance" title="A fair premium, and what moves it" description="An estimate for each kind of cover from the things insurers actually price: your age and record, the car, where it lives and sleeps, how far it goes, the excess. Then three quotes, because the spread between insurers is wider than any one factor, and a way to tell the cheapest from the best." primaryAction={{ label: 'Put your car in the garage for renewal reminders', href: '/dashboard/cars/garage' }} secondaryAction={{ label: 'Car finance', href: '/cars/finance' }} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Panel icon={Umbrella} title="About you and the car">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Car's value"><NumberInput value={f.vehicleValue} onChange={(v) => set('vehicleValue', v)} prefix="$" /></Field>
            <Field label="Car's age"><NumberInput value={f.vehicleAgeYears} onChange={(v) => set('vehicleAgeYears', v)} suffix="yrs" /></Field>
            <Field label="Your age"><NumberInput value={f.driverAge} onChange={(v) => set('driverAge', v)} /></Field>
            <Field label="Claim-free years"><NumberInput value={f.claimsFreeYears} onChange={(v) => set('claimsFreeYears', v)} /></Field>
            <Field label="State"><SelectInput value={f.state} onChange={(v) => set('state', v)} options={['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))} /></Field>
            <Field label="Where it lives"><SelectInput value={f.area} onChange={(v) => set('area', v)} options={[{ value: 'METRO', label: 'City' }, { value: 'REGIONAL', label: 'Regional' }, { value: 'REMOTE', label: 'Remote' }]} /></Field>
            <Field label="Where it sleeps"><SelectInput value={f.garaging} onChange={(v) => set('garaging', v)} options={[{ value: 'GARAGE', label: 'Locked garage' }, { value: 'CARPORT', label: 'Carport or driveway' }, { value: 'STREET', label: 'Street' }]} /></Field>
            <Field label="Fuel"><SelectInput value={f.fuelType} onChange={(v) => set('fuelType', v)} options={(ref.data?.fuelTypes ?? []).map((t) => ({ value: t.key, label: t.label }))} /></Field>
            <Field label="Kilometres a year"><NumberInput value={f.kmPerYear} onChange={(v) => set('kmPerYear', v)} /></Field>
            <Field label="Excess you would choose"><NumberInput value={f.excess} onChange={(v) => set('excess', v)} prefix="$" /></Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><Check checked={f.youngDrivers} onChange={(v) => set('youngDrivers', v)} label="A driver under 25 will be listed" /><Check checked={f.multiPolicy} onChange={(v) => set('multiPolicy', v)} label="Home or contents with the same insurer" /><Check checked={f.financed} onChange={(v) => set('financed', v)} label="Under finance" /></div>
        </Panel>

        <div className="space-y-4">
          <Pending loading={est.loading} error={est.error}>
            {est.result && (
              <>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {est.result.covers.map((c) => (
                    <li key={c.key} className={cn('rounded-2xl border p-4', c.recommended ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20' : 'border-slate-200 dark:border-slate-800')}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}{c.recommended ? ' · suggested' : ''}</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{aud0(c.annual)}<span className="text-sm font-normal text-slate-500"> a year</span></p>
                      <p className="text-xs text-slate-500">{aud0(c.annualLow)} to {aud0(c.annualHigh)} · about {aud0(c.monthly)} a month</p>
                      <p className="mt-2 text-xs leading-5 text-slate-700 dark:text-slate-300">{c.covers}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Suits: {c.suits}</p>
                    </li>
                  ))}
                </ul>
                <Panel title="What moved it" intro={est.result.ctpNote}>
                  <ul className="grid gap-2 sm:grid-cols-2">{est.result.factors.map((x) => <li key={x.key} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800/60"><span><span className="font-medium text-slate-900 dark:text-white">{x.label}</span><span className="block text-xs text-slate-500">{x.effect}</span></span><span className={cn('shrink-0 tabular-nums text-xs font-semibold', x.multiplier > 1 ? 'text-rose-600' : x.multiplier < 1 ? 'text-emerald-600' : 'text-slate-500')}>×{x.multiplier}</span></li>)}</ul>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600 dark:text-slate-400">{est.result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </Panel>
              </>
            )}
          </Pending>
        </div>
      </div>

      <div className="mt-8" id="compare"><QuoteCompare vehicleValue={num(f.vehicleValue)} /></div>

      {r && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Section icon={ShieldCheck} title="If you have to claim" description="The order of things on the day, and after.">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{r.claims.map((s) => <li key={s}>{s}</li>)}</ol>
          </Section>
          <Section title="For women, specifically" description="The things a brochure leaves out.">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{r.women.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="mt-3 text-sm"><Link href="/safety-center" className="font-semibold text-rose-600">The safety centre</Link> has the family violence support lines and how to keep an address private.</p>
          </Section>
        </div>
      )}

      {w && (
        <div className="mt-8" id="warranty">
          <Section icon={FileCheck2} title="Extended warranties, and whether to buy one" description={w.what}>
            <div className="grid gap-4 md:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usually covers</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{w.covers.map((s) => <li key={s}>{s}</li>)}</ul></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usually does not</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{w.doesNotCover.map((s) => <li key={s}>{s}</li>)}</ul></div>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Is it worth it</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{w.worthIt.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Typically {aud0(w.costRange.low)} to {aud0(w.costRange.high)}. {w.rights}</p>
            {ref.data?.referralFees && <p className="mt-3 text-xs leading-5 text-slate-500">How ATHENA is paid, so the introduction is never a secret: {ref.data.referralFees.insurance.words} {ref.data.referralFees.warranty.words} You pay neither, and the estimate above comes from no insurer's rates.</p>}
          </Section>
        </div>
      )}

      <div className="mt-6"><Stat label="A second policy" value={est.result ? `about ${aud0(est.result.multiPolicySaving)} a year off` : 'about 10% off'} sub="home or contents cover with the same insurer usually earns a discount on each" /></div>
      {/* Checked against the finance flow's failure and clean: this page estimates and compares, it never quotes, binds or approves. ATHENA is not an insurer or an insurance broker, and saying so keeps it that way. */}
      <div className="mt-4"><AutoDisclaimer what="The estimate is built from typical Australian pricing factors, not from any insurer's rates. ATHENA is not an insurer or an insurance broker: nothing here is a quote and no cover is arranged. Only an insurer can quote you." /></div>
    </PageShell>
  );
}

export default function InsurancePage() {
  return <Suspense fallback={<PageShell width="wide"><div className="text-sm text-slate-500">Loading</div></PageShell>}><Insurance /></Suspense>;
}
