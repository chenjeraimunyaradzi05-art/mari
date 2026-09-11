'use client';

/**
 * Find care: GPs, psychologists, gynaecologists, dietitians and the rest,
 * filtered by what matters (telehealth, Medicare, modality, specialty,
 * language, where), with ratings that come only from completed visits.
 * The services that open the directory are real Australian ones reached
 * by phone or their own site.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Star, Stethoscope, Video } from 'lucide-react';
import { wellnessApi } from '@/lib/wellness-api';
import { Chip, Empty, ErrorBox, HealthDisclaimer, Loading, PageTitle, WellnessNav, useLoad } from '@/components/wellness/WellnessUi';
import { Check, Field, SelectInput, inputClass } from '@/components/strategy/StrategyUi';

type Practitioner = { id: string; slug: string; name: string; kind: string; kindLabel: string; headline: string; modalities: string[]; specialties: string[]; languages: string[]; suburb: string | null; city: string | null; state: string | null; telehealth: boolean; inPerson: boolean; bulkBilling: boolean; medicareRebate: boolean; feeFrom: number | null; feeNote: string | null; phone: string | null; website: string | null; acceptsBookings: boolean; isVerified: boolean; ratingAvg: number; ratingCount: number };
type Data = { practitioners: Practitioner[]; total: number; page: number; kinds: Array<{ key: string; label: string; plural: string }>; modalities: string[]; specialties: string[] };
const STATES = ['', 'QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

function Directory() {
  const search = useSearchParams();
  const [f, setF] = useState({ kind: search.get('kind') ?? '', state: '', city: '', q: search.get('q') ?? '', telehealth: false, bulkBilling: false, modality: '', specialty: search.get('specialty') ?? '' });
  const [page, setPage] = useState(1);
  const data = useLoad<Data>(() => wellnessApi.practitioners({ ...f, telehealth: f.telehealth ? 'true' : undefined, bulkBilling: f.bulkBilling ? 'true' : undefined, page }), [JSON.stringify(f), page]);
  const set = (k: string, v: string | boolean) => { setPage(1); setF((x) => ({ ...x, [k]: v })); };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Stethoscope} kicker="Wellness" title="Find care" blurb="Women's health practitioners and the services that answer the phone. Telehealth marked, Medicare marked, and ratings only from visits that happened." action={<Link href="/dashboard/wellness/practice" className="btn-ghost text-sm">Are you a practitioner?</Link>} />
      <WellnessNav current="/dashboard/wellness/practitioners" />
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Looking for"><SelectInput value={f.kind} onChange={(v) => set('kind', v)} options={[{ value: '', label: 'Anyone' }, ...(data.data?.kinds ?? []).map((k) => ({ value: k.key, label: k.plural }))]} /></Field>
          <Field label="Specialty"><SelectInput value={f.specialty} onChange={(v) => set('specialty', v)} options={[{ value: '', label: 'Any' }, ...(data.data?.specialties ?? []).map((s) => ({ value: s, label: s }))]} /></Field>
          <Field label="Approach"><SelectInput value={f.modality} onChange={(v) => set('modality', v)} options={[{ value: '', label: 'Any' }, ...(data.data?.modalities ?? []).map((s) => ({ value: s, label: s }))]} /></Field>
          <Field label="State"><SelectInput value={f.state} onChange={(v) => set('state', v)} options={STATES.map((s) => ({ value: s, label: s || 'Anywhere' }))} /></Field>
          <Field label="City or suburb"><input value={f.city} onChange={(e) => set('city', e.target.value)} className={inputClass} placeholder="Brisbane" /></Field>
          <Field label="Search"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={f.q} onChange={(e) => set('q', e.target.value)} className={`${inputClass} pl-8`} placeholder="Name or words" /></div></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4"><Check checked={f.telehealth} onChange={(v) => set('telehealth', v)} label="Telehealth" /><Check checked={f.bulkBilling} onChange={(v) => set('bulkBilling', v)} label="Bulk billing or Medicare rebate" /></div>
      </div>
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && data.data.practitioners.length === 0 && <Empty title="Nobody matches yet" body="Widen the filters, or search the national registers linked in the library. Practitioners are added as they join and are verified." />}
      <ul className="grid gap-4 md:grid-cols-2">
        {(data.data?.practitioners ?? []).map((p) => (
          <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2"><Chip tone="rose">{p.kindLabel}</Chip>{p.telehealth && <Chip tone="sky"><Video className="mr-1 inline h-3 w-3" />Telehealth</Chip>}{p.inPerson && <Chip>In person</Chip>}{(p.bulkBilling || p.medicareRebate) && <Chip tone="emerald">{p.bulkBilling ? 'Bulk billing' : 'Medicare rebate'}</Chip>}{p.acceptsBookings && <Chip tone="amber">Book here</Chip>}</div>
            <Link href={`/dashboard/wellness/practitioners/${p.slug}`} className="mt-2 block text-lg font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{p.name}</Link>
            <p className="text-sm text-slate-600 dark:text-slate-400">{p.headline}</p>
            <p className="mt-2 text-xs text-slate-500">{[p.suburb || p.city, p.state].filter(Boolean).join(', ') || 'National'}{p.specialties.length ? ` · ${p.specialties.slice(0, 3).join(', ')}` : ''}{p.feeNote ? ` · ${p.feeNote}` : p.feeFrom !== null ? ` · from $${p.feeFrom}` : ''}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">{p.ratingCount > 0 ? <span className="inline-flex items-center gap-1 text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> {p.ratingAvg} from {p.ratingCount} visit{p.ratingCount === 1 ? '' : 's'}</span> : <span>No ratings yet; only completed visits count</span>}{p.phone && <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="hover:text-rose-600">{p.phone}</a>}</div>
          </li>
        ))}
      </ul>
      {data.data && data.data.total > 20 && <div className="flex justify-between text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost disabled:opacity-40">Previous</button><span className="self-center text-xs text-slate-500">{data.data.total} in all</span><button type="button" disabled={page * 20 >= data.data.total} onClick={() => setPage((p) => p + 1)} className="btn-ghost disabled:opacity-40">Next</button></div>}
      <HealthDisclaimer />
    </div>
  );
}

export default function PractitionersPage() {
  return <Suspense fallback={<div className="p-6"><Loading /></div>}><Directory /></Suspense>;
}
