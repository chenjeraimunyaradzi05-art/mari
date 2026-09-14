'use client';

/**
 * Pre-loved cars. Filters that matter (price, kilometres, year, fuel,
 * state, a PPSR certificate, a full history, an inspection already done,
 * a warranty), every card carrying its price against the guide, and the
 * promise on the way in: the money is held until she has the keys.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Heart, Search, ShieldCheck, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHero, PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/lib/hooks';
import { autoApi, autoError, aud0, km, type ListingCard } from '@/lib/automotive-api';
import { AutoDisclaimer, Chip, Empty, ErrorBox, Loading, VerdictChip, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, SelectInput, inputClass } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

function Listings() {
  const search = useSearchParams();
  const ref = useReference();
  const { isAuthenticated } = useAuth();
  const [f, setF] = useState({ q: search.get('q') ?? '', make: search.get('make') ?? '', bodyType: '', fuelType: '', state: search.get('state') ?? '', minPrice: '', maxPrice: search.get('maxPrice') ?? '', maxKm: '', minYear: '', sellerKind: '', ppsr: false, fullHistory: false, inspected: false, warranty: false, electrified: false, sort: 'newest' });
  const [page, setPage] = useState(1);
  const flag = (v: boolean) => (v ? 'true' : undefined);
  const data = useLoad<{ listings: ListingCard[]; total: number; page: number }>(() => autoApi.listings({ ...f, ppsr: flag(f.ppsr), fullHistory: flag(f.fullHistory), inspected: flag(f.inspected), warranty: flag(f.warranty), electrified: flag(f.electrified), page }), [JSON.stringify(f), page]);
  const set = (k: string, v: string | boolean) => { setPage(1); setF((x) => ({ ...x, [k]: v })); };
  const save = async (l: ListingCard) => {
    if (!isAuthenticated) { toast('Sign in to save a listing'); return; }
    try { if (l.saved) await autoApi.unsaveListing(l.id); else await autoApi.saveListing(l.id); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); }
  };

  return (
    <PageShell width="wide" backTo={{ href: '/cars', label: 'Back to cars' }}>
      <PageHero kicker="Pre-loved" title="Used cars, bought with the money held" description={`Every listing carries a price guide, the checks to run before you pay, and buyer protection: you pay through ATHENA, the money is held, and it goes to the seller only after ${ref.data?.buyerProtection.inspectionDays ?? 14} days with the car in your hands.`} primaryAction={{ label: 'Sell a car', href: '/dashboard/cars/sell' }} secondaryAction={{ label: 'How buyer protection works', href: '#protection' }} />
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Search"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={f.q} onChange={(e) => set('q', e.target.value)} className={`${inputClass} pl-8`} placeholder="Make, model, suburb" /></div></Field>
          <Field label="Make"><SelectInput value={f.make} onChange={(v) => set('make', v)} options={[{ value: '', label: 'Any' }, ...(ref.data?.makes ?? []).map((m) => ({ value: m, label: m }))]} /></Field>
          <Field label="Body"><SelectInput value={f.bodyType} onChange={(v) => set('bodyType', v)} options={[{ value: '', label: 'Any' }, ...(ref.data?.bodyTypes ?? []).map((b) => ({ value: b.key, label: b.label }))]} /></Field>
          <Field label="State"><SelectInput value={f.state} onChange={(v) => set('state', v)} options={[{ value: '', label: 'Anywhere' }, ...['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))]} /></Field>
          <Field label="Up to"><NumberInput value={f.maxPrice} onChange={(v) => set('maxPrice', v)} prefix="$" placeholder="25000" /></Field>
          <Field label="Order by"><SelectInput value={f.sort} onChange={(v) => set('sort', v)} options={[{ value: 'newest', label: 'Newest' }, { value: 'price_asc', label: 'Price, low to high' }, { value: 'price_desc', label: 'Price, high to low' }, { value: 'km', label: 'Fewest kilometres' }, { value: 'year', label: 'Newest year' }]} /></Field>
          <Field label="From"><NumberInput value={f.minPrice} onChange={(v) => set('minPrice', v)} prefix="$" /></Field>
          <Field label="Kilometres up to"><NumberInput value={f.maxKm} onChange={(v) => set('maxKm', v)} suffix="km" /></Field>
          <Field label="Year from"><NumberInput value={f.minYear} onChange={(v) => set('minYear', v)} /></Field>
          <Field label="Fuel"><SelectInput value={f.fuelType} onChange={(v) => set('fuelType', v)} options={[{ value: '', label: 'Any' }, ...(ref.data?.fuelTypes ?? []).map((b) => ({ value: b.key, label: b.label }))]} /></Field>
          <Field label="Seller"><SelectInput value={f.sellerKind} onChange={(v) => set('sellerKind', v)} options={[{ value: '', label: 'Anyone' }, { value: 'PRIVATE', label: 'Private' }, { value: 'DEALER', label: 'Dealer' }]} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><Check checked={f.ppsr} onChange={(v) => set('ppsr', v)} label="PPSR certificate attached" /><Check checked={f.fullHistory} onChange={(v) => set('fullHistory', v)} label="Full service history" /><Check checked={f.inspected} onChange={(v) => set('inspected', v)} label="Already inspected" /><Check checked={f.warranty} onChange={(v) => set('warranty', v)} label="With a warranty" /><Check checked={f.electrified} onChange={(v) => set('electrified', v)} label="Hybrid or electric" /></div>
      </div>
      {data.loading && <div className="mt-6"><Loading /></div>}
      <ErrorBox error={data.error} />
      {data.data && data.data.listings.length === 0 && <div className="mt-6"><Empty title="Nothing here yet" body="Loosen a filter, or be the first to list. Every listing gets a price guide and buyer protection from day one." action={<Link href="/dashboard/cars/sell" className="btn-primary text-sm">Sell a car</Link>} /></div>}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data.data?.listings ?? []).map((l) => (
          <li key={l.id} className={cn('overflow-hidden rounded-2xl border bg-white dark:bg-slate-900', l.isFeatured ? 'border-amber-300' : 'border-slate-200 dark:border-slate-800')}>
            <Link href={`/cars/preloved/${l.id}`} className="block">
              {l.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.photos[0]} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-rose-100 via-purple-50 to-amber-50 text-xs text-slate-500 dark:from-rose-900/20 dark:via-purple-900/10 dark:to-amber-900/10">No photos</div>}
            </Link>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2"><span className="text-lg font-semibold text-slate-900 dark:text-white">{aud0(l.price)}</span><VerdictChip verdict={l.priceVerdict} /></div>
              <Link href={`/cars/preloved/${l.id}`} className="mt-0.5 block font-medium text-slate-900 hover:text-rose-600 dark:text-white">{l.year} {l.make} {l.model}{l.variant ? ` ${l.variant}` : ''}</Link>
              <p className="text-xs text-slate-500">{km(l.odometerKm)} · {l.fuelLabel} · {l.transmission === 'MANUAL' ? 'manual' : 'auto'} · {[l.suburb || l.city, l.state].filter(Boolean).join(', ')}</p>
              <div className="mt-2 flex flex-wrap gap-1">{l.sellerKind === 'DEALER' && <Chip tone="sky">Dealer</Chip>}{l.ppsrChecked && <Chip tone="emerald">PPSR</Chip>}{l.serviceHistory === 'FULL' && <Chip tone="emerald">Full history</Chip>}{l.inspected && <Chip tone={l.inspected === 'PASS' ? 'emerald' : 'amber'}>Inspected: {l.inspected.toLowerCase()}</Chip>}{l.warranty !== 'NONE' && <Chip>Warranty</Chip>}{l.status === 'UNDER_OFFER' && <Chip tone="amber">Under offer</Chip>}{l.isFeatured && <Chip tone="amber">Featured</Chip>}</div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{l.seller.name}</span><button type="button" onClick={() => save(l)} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold', l.saved ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}><Heart className={cn('h-3.5 w-3.5', l.saved && 'fill-current')} /> {l.saved ? 'Saved' : 'Save'}</button></div>
            </div>
          </li>
        ))}
      </ul>
      {data.data && data.data.total > 20 && <div className="mt-4 flex justify-between text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost disabled:opacity-40">Previous</button><span className="self-center text-xs text-slate-500">{data.data.total} listings</span><button type="button" disabled={page * 20 >= data.data.total} onClick={() => setPage((p) => p + 1)} className="btn-ghost disabled:opacity-40">Next</button></div>}

      <section id="protection" className="mt-10 scroll-mt-24 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="surface p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-rose-500" /><h2 className="rail-title">How buyer protection works</h2></div>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{(ref.data?.buyerProtection.steps ?? []).map((s) => <li key={s}>{s}</li>)}</ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">It covers</p><ul className="mt-1 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">{(ref.data?.buyerProtection.covers ?? []).map((s) => <li key={s}>{s}</li>)}</ul></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">It does not cover</p><ul className="mt-1 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">{(ref.data?.buyerProtection.doesNotCover ?? []).map((s) => <li key={s}>{s}</li>)}</ul></div></div>
          <p className="mt-3 text-xs text-slate-500">ATHENA's fee is {ref.data?.fees.purchasePercent.PRIVATE ?? 6}% on a private sale and {ref.data?.fees.purchasePercent.DEALER ?? 4}% from a dealer, taken from the seller's side when the money is released. {ref.data?.buyerProtection.note}</p>
        </div>
        <div className="surface p-5"><div className="flex items-center gap-2"><Tag className="h-4 w-4 text-rose-500" /><h2 className="rail-title">Before you pay for any used car</h2></div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{(ref.data?.fraudSigns ?? []).map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="mt-3 text-sm"><Link href="/cars/safety" className="font-semibold text-rose-600">What an inspection covers</Link></p>
        </div>
      </section>
      <div className="mt-4"><AutoDisclaimer what="Price guides are estimates from typical depreciation, not valuations." /></div>
    </PageShell>
  );
}

export default function PrelovedPage() {
  return <Suspense fallback={<PageShell width="wide"><Loading /></PageShell>}><Listings /></Suspense>;
}
