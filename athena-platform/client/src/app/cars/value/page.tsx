'use client';

/**
 * What a car is worth: a private-sale range and the lower trade-in figure
 * from the year, kilometres, condition and make, with the assumptions
 * written down; then the changeover to the next car, selling privately or
 * trading in, with any loan paid out; and, signed in, a trade-in request
 * that dealerships on ATHENA can quote against.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BadgeDollarSign, Store } from 'lucide-react';
import { PageHero, PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/lib/hooks';
import { autoApi, autoError, aud0 } from '@/lib/automotive-api';
import { AutoDisclaimer, useReference } from '@/components/automotive/AutoUi';
import { Field, Notes, NumberInput, Panel, Pending, SelectInput, Stat, num, opt, useCalc } from '@/components/strategy/StrategyUi';

type Valuation = { low: number; mid: number; high: number; tradeIn: number; privateSale: number; ageYears: number; retainedPct: number; newPriceUsed: number; newPriceAssumed: boolean; assumptions: string[]; newPriceFromCatalogue?: boolean };
type Upgrade = { current: Valuation; changeoverPrivate: number; changeoverTradeIn: number; privateAdvantage: number; equity: number; negativeEquity: boolean; monthsToSave: number | null; steps: string[] };

export default function ValuePage() {
  const ref = useReference();
  const { isAuthenticated } = useAuth();
  const [f, setF] = useState({ make: 'Toyota', model: '', year: '2020', odometerKm: '', bodyType: '', fuelType: '', condition: 'GOOD', newPrice: '' });
  const [up, setUp] = useState({ targetPrice: '', loanBalance: '', savings: '', monthlySaving: '' });
  const [busy, setBusy] = useState(false);
  const input = { make: f.make, model: f.model || undefined, year: num(f.year), odometerKm: num(f.odometerKm), bodyType: f.bodyType || null, fuelType: f.fuelType || null, condition: f.condition, newPrice: opt(f.newPrice) };
  const ok = num(f.odometerKm) > 0 && num(f.year) > 1980;
  const val = useCalc<Valuation>(autoApi.valuation.estimate, input, ok);
  const upgrade = useCalc<Upgrade>(autoApi.valuation.upgrade, { ...input, targetPrice: num(up.targetPrice), loanBalance: opt(up.loanBalance), savings: opt(up.savings), monthlySaving: opt(up.monthlySaving) }, ok && num(up.targetPrice) > 0);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const requestQuotes = async () => {
    setBusy(true);
    try {
      const res = await autoApi.requestTradeIn({ make: f.make, model: f.model, year: num(f.year), odometerKm: num(f.odometerKm), condition: f.condition, newPrice: opt(f.newPrice) });
      toast.success(res.data?.data?.dealersAsked ? `Sent to ${res.data.data.dealersAsked} dealership${res.data.data.dealersAsked === 1 ? '' : 's'}. Quotes land on your requests page.` : 'Saved. No dealership on ATHENA carries this make yet; your request waits for the first that does.');
    } catch (err) { toast.error(autoError(err, 'That could not be sent.')); } finally { setBusy(false); }
  };

  return (
    <PageShell width="wide" backTo={{ href: '/cars', label: 'Back to cars' }}>
      <PageHero kicker="Valuation" title="What is it worth, and what would the next one cost you?" description="A guide from the year, the kilometres, the condition and the make, with every assumption written down. Then the changeover: what you would need on top of your car to drive away in the next one." primaryAction={{ label: 'Sell it with buyer protection', href: '/dashboard/cars/sell' }} secondaryAction={{ label: 'Browse pre-loved', href: '/cars/preloved' }} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel icon={BadgeDollarSign} title="Your car" intro="The catalogue supplies the new price for a make and model it knows; give the real one if you have it.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Make"><SelectInput value={f.make} onChange={(v) => set('make', v)} options={(ref.data?.makes ?? ['Toyota']).map((m) => ({ value: m, label: m }))} /></Field>
            <Field label="Model"><input value={f.model} onChange={(e) => set('model', e.target.value)} className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" placeholder="Corolla" /></Field>
            <Field label="Year"><NumberInput value={f.year} onChange={(v) => set('year', v)} /></Field>
            <Field label="Kilometres"><NumberInput value={f.odometerKm} onChange={(v) => set('odometerKm', v)} suffix="km" placeholder="85000" /></Field>
            <Field label="Body"><SelectInput value={f.bodyType} onChange={(v) => set('bodyType', v)} options={[{ value: '', label: 'From the catalogue' }, ...(ref.data?.bodyTypes ?? []).map((b) => ({ value: b.key, label: b.label }))]} /></Field>
            <Field label="Fuel"><SelectInput value={f.fuelType} onChange={(v) => set('fuelType', v)} options={[{ value: '', label: 'From the catalogue' }, ...(ref.data?.fuelTypes ?? []).map((b) => ({ value: b.key, label: b.label }))]} /></Field>
            <Field label="Condition" className="sm:col-span-2"><SelectInput value={f.condition} onChange={(v) => set('condition', v)} options={(ref.data?.conditions ?? []).map((c) => ({ value: c.key, label: `${c.label}: ${c.blurb}` }))} /></Field>
            <Field label="New price, if known"><NumberInput value={f.newPrice} onChange={(v) => set('newPrice', v)} prefix="$" /></Field>
          </div>
          <Pending loading={val.loading} error={val.error}>
            {val.result && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2"><Stat label="Private sale" value={`${aud0(val.result.low)} to ${aud0(val.result.high)}`} sub={`about ${aud0(val.result.mid)}`} tone="good" big /><Stat label="Trade-in, about" value={aud0(val.result.tradeIn)} sub="a dealer's offer, no advertising or strangers" /></div>
                <Notes items={val.result.assumptions} />
                {isAuthenticated ? <button type="button" onClick={requestQuotes} disabled={busy || !f.model} className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"><Store className="h-4 w-4" /> Ask dealerships on ATHENA for a trade-in quote</button> : <Link href="/login?redirect=/cars/value" className="btn-secondary text-sm">Sign in to ask dealerships for quotes</Link>}
              </div>
            )}
          </Pending>
        </Panel>

        <Panel title="The changeover" intro="Selling privately or trading in, with any loan paid out, and when your savings cover it.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="The next car's price"><NumberInput value={up.targetPrice} onChange={(v) => setUp((x) => ({ ...x, targetPrice: v }))} prefix="$" placeholder="42000" /></Field>
            <Field label="Owing on this car"><NumberInput value={up.loanBalance} onChange={(v) => setUp((x) => ({ ...x, loanBalance: v }))} prefix="$" /></Field>
            <Field label="Savings set aside"><NumberInput value={up.savings} onChange={(v) => setUp((x) => ({ ...x, savings: v }))} prefix="$" /></Field>
            <Field label="Saving each month"><NumberInput value={up.monthlySaving} onChange={(v) => setUp((x) => ({ ...x, monthlySaving: v }))} prefix="$" /></Field>
          </div>
          {!ok && <p className="mt-3 text-sm text-slate-500">Fill in your car on the left first.</p>}
          <Pending loading={upgrade.loading} error={upgrade.error}>
            {upgrade.result && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2"><Stat label="Selling privately, you need" value={aud0(upgrade.result.changeoverPrivate)} tone="good" big /><Stat label="Trading in, you need" value={aud0(upgrade.result.changeoverTradeIn)} sub={`${aud0(upgrade.result.privateAdvantage)} more by selling it yourself`} /></div>
                {upgrade.result.negativeEquity && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">You owe {aud0(Math.abs(upgrade.result.equity))} more than the car is worth. Rolling that into the next loan is possible and expensive; paying it down first is cheaper.</p>}
                <Notes items={upgrade.result.steps} title="The path" />
                <div className="flex flex-wrap gap-2"><Link href={`/cars/finance?price=${num(up.targetPrice)}`} className="btn-secondary text-sm">What the loan would cost</Link><Link href="/dashboard/cars/finance" className="btn-ghost text-sm">Get pre-approved first</Link></div>
              </div>
            )}
          </Pending>
        </Panel>
      </div>
      <div className="mt-6"><AutoDisclaimer what="A guide from typical depreciation, not a valuation. Comparable listings and a dealer's written offer are the real test." /></div>
    </PageShell>
  );
}
