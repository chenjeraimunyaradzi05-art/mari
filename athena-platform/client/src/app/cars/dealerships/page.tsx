'use client';

/**
 * Dealerships on ATHENA: verified showrooms, women-led ones marked, the
 * brands each carries and how much stock is listed, with test drives and
 * trade-in quotes booked from their pages.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Store } from 'lucide-react';
import { PageHero, PageShell } from '@/components/layout/PageShell';
import { autoApi, type DealershipCard } from '@/lib/automotive-api';
import { Chip, Empty, ErrorBox, Loading, Stars, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, SelectInput, inputClass } from '@/components/strategy/StrategyUi';

export default function DealershipsPage() {
  const ref = useReference();
  const [f, setF] = useState({ q: '', state: '', brand: '', womenLed: false });
  const data = useLoad<{ dealerships: DealershipCard[] }>(() => autoApi.dealerships({ ...f, womenLed: f.womenLed ? 'true' : undefined }), [JSON.stringify(f)]);
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  return (
    <PageShell width="wide" backTo={{ href: '/cars', label: 'Back to cars' }}>
      <PageHero kicker="Dealerships" title="Showrooms that take a test drive request and quote a trade-in" description="Verified dealerships on ATHENA, women-led ones marked. Book a drive from a car's page, ask for a trade-in quote against the guide, and see the used stock they list under buyer protection." primaryAction={{ label: 'Run a dealership? Join', href: '/dashboard/cars/dealership' }} secondaryAction={{ label: 'What is my car worth?', href: '/cars/value' }} />
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Brand"><SelectInput value={f.brand} onChange={(v) => set('brand', v)} options={[{ value: '', label: 'Any' }, ...(ref.data?.makes ?? []).map((m) => ({ value: m, label: m }))]} /></Field>
          <Field label="State"><SelectInput value={f.state} onChange={(v) => set('state', v)} options={[{ value: '', label: 'Anywhere' }, ...['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))]} /></Field>
          <Field label="Search"><input value={f.q} onChange={(e) => set('q', e.target.value)} className={inputClass} placeholder="Name or suburb" /></Field>
          <div className="flex items-end pb-2"><Check checked={f.womenLed} onChange={(v) => set('womenLed', v)} label="Women-led" /></div>
        </div>
      </div>
      {data.loading && <div className="mt-6"><Loading /></div>}
      <ErrorBox error={data.error} />
      {data.data && data.data.dealerships.length === 0 && <div className="mt-6"><Empty title="No dealership has joined yet" body="When one does, test drives and trade-in quotes are booked from here. Trade-in requests you make now wait for the first dealership that carries your make." action={<Link href="/dashboard/cars/dealership" className="btn-primary text-sm">Join as a dealership</Link>} /></div>}
      <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data.data?.dealerships ?? []).map((d) => (
          <li key={d.id} className={`rounded-2xl border bg-white p-4 dark:bg-slate-900 ${d.isFeatured ? 'border-amber-300' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="flex flex-wrap gap-1.5">{d.womenLed && <Chip tone="rose">Women-led</Chip>}{d.financeAvailable && <Chip tone="emerald">Finance on site</Chip>}{d.isFeatured && <Chip tone="amber">Featured</Chip>}</div>
            <Link href={`/cars/dealerships/${d.slug}`} className="mt-2 block text-lg font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{d.name}</Link>
            <p className="text-sm text-slate-600 dark:text-slate-400">{d.headline}</p>
            <p className="mt-2 text-xs text-slate-500">{[d.suburb || d.city, d.state].filter(Boolean).join(', ')}{d.brands.length ? ` · ${d.brands.join(', ')}` : ''}{d.stock ? ` · ${d.stock} in stock` : ''}</p>
            <div className="mt-2"><Stars value={d.ratingAvg} count={d.ratingCount || undefined} label="No buyer ratings yet" /></div>
          </li>
        ))}
      </ul>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Store className="h-3.5 w-3.5" /> A dealership is verified by ATHENA before it appears; its ratings come from purchases completed here.</p>
    </PageShell>
  );
}
