'use client';

/**
 * The new-car browser. Filters for the things that matter to a woman
 * buying with her eyes open (a current safety rating, a hybrid or
 * electric drivetrain, seven seats, a price ceiling), each card showing
 * the rating with its year and what the car costs to run, and a compare
 * tray for up to four side by side.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CarFront, Scale, Search } from 'lucide-react';
import { PageHero, PageShell } from '@/components/layout/PageShell';
import { ELECTRIFIED_FUELS, autoApi, aud0, type CarCard } from '@/lib/automotive-api';
import { AncapBadge, AutoDisclaimer, Empty, ErrorBox, Loading, Stars, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, SelectInput, inputClass } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

function Browser() {
  const search = useSearchParams();
  const ref = useReference();
  const [f, setF] = useState({ q: search.get('q') ?? '', make: search.get('make') ?? '', bodyType: search.get('bodyType') ?? '', fuelType: search.get('fuelType') ?? '', electrified: false, currentRating: false, minStars: '', maxPrice: '', sevenSeats: false, lowEmissions: false, sort: search.get('sort') ?? 'name' });
  const [tray, setTray] = useState<string[]>([]);
  const data = useLoad<{ cars: CarCard[]; total: number; makes: string[]; asAt: string }>(() => autoApi.catalogue({ ...f, electrified: f.electrified ? 'true' : undefined, currentRating: f.currentRating ? 'true' : undefined, sevenSeats: f.sevenSeats ? 'true' : undefined, lowEmissions: f.lowEmissions ? 'true' : undefined, minStars: f.minStars || undefined, maxPrice: f.maxPrice || undefined }), [JSON.stringify(f)]);
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (slug: string) => setTray((t) => (t.includes(slug) ? t.filter((s) => s !== slug) : t.length >= 4 ? t : [...t, slug]));

  return (
    <PageShell width="wide" backTo={{ href: '/cars', label: 'Back to cars' }}>
      <PageHero kicker="New cars" title="The catalogue, with the rating's year on every card" description="Indicative list prices before on-road costs, published consumption, the maker's warranty, and what a year of fuel and servicing costs. Reviews come from women who own one." primaryAction={{ label: 'Safety, explained', href: '/cars/safety' }} secondaryAction={{ label: 'What can I carry?', href: '/cars/finance#afford' }} />
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Search"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={f.q} onChange={(e) => set('q', e.target.value)} className={`${inputClass} pl-8`} placeholder="Make or model" /></div></Field>
          <Field label="Make"><SelectInput value={f.make} onChange={(v) => set('make', v)} options={[{ value: '', label: 'Any' }, ...(data.data?.makes ?? []).map((m) => ({ value: m, label: m }))]} /></Field>
          <Field label="Body"><SelectInput value={f.bodyType} onChange={(v) => set('bodyType', v)} options={[{ value: '', label: 'Any' }, ...(ref.data?.bodyTypes ?? []).map((b) => ({ value: b.key, label: b.label }))]} /></Field>
          <Field label="Fuel"><SelectInput value={f.fuelType} onChange={(v) => set('fuelType', v)} options={[{ value: '', label: f.electrified ? 'Any hybrid or electric' : 'Any' }, ...(ref.data?.fuelTypes ?? []).filter((b) => !f.electrified || ELECTRIFIED_FUELS.includes(b.key)).map((b) => ({ value: b.key, label: b.label }))]} /></Field>
          <Field label="Up to"><NumberInput value={f.maxPrice} onChange={(v) => set('maxPrice', v)} prefix="$" placeholder="45000" /></Field>
          <Field label="Order by"><SelectInput value={f.sort} onChange={(v) => set('sort', v)} options={[{ value: 'name', label: 'Make and model' }, { value: 'price', label: 'Price, low to high' }, { value: 'running', label: 'Cheapest to run' }, { value: 'efficiency', label: 'Most efficient' }, { value: 'safety', label: 'Safest, current ratings first' }, { value: 'rating', label: 'Best reviewed' }, { value: 'reliability', label: 'Most reliable, say the owners' }, { value: 'emissions', label: 'Lowest emissions' }]} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><Check checked={f.currentRating} onChange={(v) => set('currentRating', v)} label="Current ANCAP rating only" /><Check checked={f.minStars === '5'} onChange={(v) => set('minStars', v ? '5' : '')} label="Five stars" /><Check checked={f.electrified} onChange={(v) => setF((x) => ({ ...x, electrified: v, fuelType: v && x.fuelType && !ELECTRIFIED_FUELS.includes(x.fuelType) ? '' : x.fuelType }))} label="Hybrid or electric" /><Check checked={f.lowEmissions} onChange={(v) => set('lowEmissions', v)} label="Low emissions (under 120 g/km)" /><Check checked={f.sevenSeats} onChange={(v) => set('sevenSeats', v)} label="Seven seats" /></div>
      </div>
      {tray.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm dark:bg-rose-900/20"><Scale className="h-4 w-4 text-rose-600" /><span className="font-medium text-rose-900 dark:text-rose-100">Comparing {tray.length} of 4:</span>{tray.map((s) => <button key={s} type="button" onClick={() => toggle(s)} className="rounded-full bg-white px-2 py-0.5 text-xs dark:bg-slate-900">{s.replace(/-/g, ' ')} ×</button>)}{tray.length >= 2 && <Link href={`/cars/new/compare?slugs=${tray.join(',')}`} className="btn-primary ml-auto text-xs">Compare side by side</Link>}</div>}
      {data.loading && <div className="mt-6"><Loading /></div>}
      <ErrorBox error={data.error} />
      {data.data && data.data.cars.length === 0 && <div className="mt-6"><Empty title="Nothing matches" body="Loosen a filter. The current-rating filter alone removes every car whose test is more than six years old." /></div>}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data.data?.cars ?? []).map((c) => (
          <li key={c.id} className={cn('rounded-2xl border bg-white p-4 dark:bg-slate-900', tray.includes(c.slug) ? 'border-rose-400' : 'border-slate-200 dark:border-slate-800')}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{c.bodyLabel} · {c.fuelLabel} · {c.seats} seats</span><AncapBadge ancap={c.ancap} stars={c.ancapStars} compact /></div>
            <Link href={`/cars/new/${c.slug}`} className="mt-1 block text-lg font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{c.make} {c.model}</Link>
            <p className="text-xs text-slate-500">{c.variant}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">From</dt><dd className="font-semibold text-slate-900 dark:text-white">{aud0(c.priceFrom)}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">To run, a year</dt><dd className="font-semibold text-slate-900 dark:text-white">{aud0(c.runningCostYear)}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Consumption</dt><dd className="text-slate-800 dark:text-slate-200">{c.energy ?? 'Not published'}{c.co2GramsKm !== null && <span className="block text-xs text-slate-500">{c.co2GramsKm === 0 ? 'No tailpipe CO2' : `${c.co2GramsKm} g/km CO2`}</span>}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Warranty</dt><dd className="text-slate-800 dark:text-slate-200">{c.warranty}</dd></div>
            </dl>
            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{c.highlights[0]}</p>
            <div className="mt-3 flex items-center justify-between gap-2"><Stars value={c.ratingAvg} count={c.ratingCount || undefined} label="No reviews yet" /><button type="button" onClick={() => toggle(c.slug)} className={cn('rounded-md px-2 py-1 text-xs font-semibold', tray.includes(c.slug) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>{tray.includes(c.slug) ? 'In the tray' : 'Compare'}</button></div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-slate-500">{data.data?.asAt ?? ref.data?.catalogueAsAt}. Prices and equipment change; the spec sheet for the grade you buy decides.</p>
      <div className="mt-2"><AutoDisclaimer /></div>
    </PageShell>
  );
}

export default function NewCarsPage() {
  return <Suspense fallback={<PageShell width="wide"><div className="flex items-center gap-2 text-sm text-slate-500"><CarFront className="h-4 w-4" /> Loading the catalogue</div></PageShell>}><Browser /></Suspense>;
}
