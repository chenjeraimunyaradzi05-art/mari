'use client';

/**
 * Find a mechanic: women-owned workshops and women mechanics marked, the
 * kind of work, the make, where, a ceiling on the labour rate or the
 * job's price, whether they come to you, a loan car, after hours,
 * electric cars, inspections; each card with the price for the job you
 * picked (theirs, or the typical range), the warranty on the work,
 * ratings only from completed jobs, and a way to message the workshop.
 * At the foot, the fleet programme for a business with a few vehicles.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Building2, MessageSquare, Search, Star, Wrench } from 'lucide-react';
import { PageHero, PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/lib/hooks';
import { autoApi, autoError, aud0, type MechanicCard } from '@/lib/automotive-api';
import { AutoDisclaimer, Chip, Empty, ErrorBox, Loading, fmtDay, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';

type Data = { mechanics: MechanicCard[]; total: number; page: number; serviceKinds: Array<{ key: string; label: string; from: number; to: number }> };
type Programme = { what: string; includes: string[]; suits: string; note: string };

const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const FLEET_WANTS = ['Servicing', 'Repairs', 'Tyres', 'Inspections', 'Reminders', 'One monthly statement'];

/** A business with a few vehicles asks about the programme; the enquiry lands with the team, not in a void. */
function FleetPanel({ programme }: { programme: Programme | undefined }) {
  const [f, setF] = useState({ business: '', contactName: '', email: '', phone: '', vehicles: '5', state: 'QLD', needs: '' });
  const [wants, setWants] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (w: string) => setWants((x) => (x.includes(w) ? x.filter((y) => y !== w) : [...x, w]));
  const send = async () => {
    setBusy(true);
    try {
      await autoApi.fleetEnquiry({ ...f, vehicles: num(f.vehicles), phone: f.phone || undefined, needs: f.needs || undefined, wants });
      setSent(true);
      toast.success('Sent. Someone from ATHENA will be in touch.');
    } catch (err) { toast.error(autoError(err, 'That could not be sent.')); } finally { setBusy(false); }
  };
  return (
    <div id="fleet">
      <Panel icon={Building2} title="For a business with a few vehicles" intro={programme?.what ?? 'One account for every vehicle, one statement a month, and the workshops in the directory at a fleet rate.'}>
        <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
          <div>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{(programme?.includes ?? []).map((s) => <li key={s}>{s}</li>)}</ul>
            {programme && <p className="mt-3 text-xs leading-5 text-slate-500">{programme.suits} {programme.note}</p>}
          </div>
          {sent ? <p className="text-sm text-emerald-700 dark:text-emerald-300">Thank you. The enquiry is with the team; expect a reply within two working days.</p> : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Business"><input value={f.business} onChange={(e) => set('business', e.target.value)} className={inputClass} /></Field>
                <Field label="Your name"><input value={f.contactName} onChange={(e) => set('contactName', e.target.value)} className={inputClass} /></Field>
                <Field label="Email"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={inputClass} /></Field>
                <Field label="Phone"><input value={f.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass} /></Field>
                <Field label="Vehicles"><NumberInput value={f.vehicles} onChange={(v) => set('vehicles', v)} /></Field>
                <Field label="State"><SelectInput value={f.state} onChange={(v) => set('state', v)} options={STATES.map((s) => ({ value: s, label: s }))} /></Field>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">{FLEET_WANTS.map((w) => <Check key={w} checked={wants.includes(w)} onChange={() => toggle(w)} label={w} />)}</div>
              <Field label="Anything else"><textarea value={f.needs} onChange={(e) => set('needs', e.target.value)} rows={2} maxLength={2000} className={inputClass} /></Field>
              <button type="button" onClick={send} disabled={busy || f.business.trim().length < 2 || f.contactName.trim().length < 2 || !f.email.includes('@') || num(f.vehicles) < 1} className="btn-primary text-sm disabled:opacity-50">Ask about the programme</button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Directory() {
  const search = useSearchParams();
  const ref = useReference();
  const { isAuthenticated } = useAuth();
  const [f, setF] = useState({ q: '', state: search.get('state') ?? '', city: '', service: search.get('service') ?? '', make: search.get('make') ?? '', maxRate: '', maxPrice: '', womenOwned: false, womenMechanics: false, evCapable: false, mobile: false, loanCar: false, afterHours: false, doesInspections: false, acceptsBookings: false });
  const [page, setPage] = useState(1);
  const flag = (v: boolean) => (v ? 'true' : undefined);
  const data = useLoad<Data>(() => autoApi.mechanics({ ...f, maxRate: f.maxRate || undefined, maxPrice: f.service && f.maxPrice ? f.maxPrice : undefined, womenOwned: flag(f.womenOwned), womenMechanics: flag(f.womenMechanics), evCapable: flag(f.evCapable), mobile: flag(f.mobile), loanCar: flag(f.loanCar), afterHours: flag(f.afterHours), doesInspections: flag(f.doesInspections), acceptsBookings: flag(f.acceptsBookings), page }), [JSON.stringify(f), page]);
  const set = (k: string, v: string | boolean) => { setPage(1); setF((x) => ({ ...x, [k]: v })); };
  const vehicle = search.get('vehicle');

  return (
    <PageShell width="wide" backTo={{ href: '/cars', label: 'Back to cars' }}>
      <PageHero kicker="Mechanics" title="A workshop that explains the bill" description="Women-owned workshops and women mechanics marked. Prices shown before you book, the warranty on the work written down, and ratings only from jobs that actually happened, with a second mark for whether the charges were explained." primaryAction={{ label: 'Own a workshop? List it', href: '/dashboard/cars/workshop' }} secondaryAction={{ label: 'The maintenance guide', href: '/cars/safety#maintenance' }} />
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="What needs doing"><SelectInput value={f.service} onChange={(v) => set('service', v)} options={[{ value: '', label: 'Anything' }, ...(data.data?.serviceKinds ?? ref.data?.serviceKinds ?? []).map((s) => ({ value: s.key, label: s.label }))]} /></Field>
          <Field label="Make"><SelectInput value={f.make} onChange={(v) => set('make', v)} options={[{ value: '', label: 'Any make' }, ...(ref.data?.makes ?? []).map((m) => ({ value: m, label: m }))]} /></Field>
          <Field label="State"><SelectInput value={f.state} onChange={(v) => set('state', v)} options={[{ value: '', label: 'Anywhere' }, ...STATES.map((s) => ({ value: s, label: s }))]} /></Field>
          <Field label="City or suburb"><input value={f.city} onChange={(e) => set('city', e.target.value)} className={inputClass} placeholder="Brisbane" /></Field>
          <Field label="Labour up to, an hour"><NumberInput value={f.maxRate} onChange={(v) => set('maxRate', v)} prefix="$" placeholder="150" /></Field>
          <Field label="That job up to" hint={f.service ? 'Their price, or the typical range' : 'Pick a job first'}><NumberInput value={f.maxPrice} onChange={(v) => set('maxPrice', v)} prefix="$" placeholder="400" /></Field>
          <Field label="Search" className="sm:col-span-2"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={f.q} onChange={(e) => set('q', e.target.value)} className={`${inputClass} pl-8`} placeholder="Name or words" /></div></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><Check checked={f.womenOwned} onChange={(v) => set('womenOwned', v)} label="Women-owned" /><Check checked={f.womenMechanics} onChange={(v) => set('womenMechanics', v)} label="Women mechanics" /><Check checked={f.mobile} onChange={(v) => set('mobile', v)} label="Comes to you" /><Check checked={f.loanCar} onChange={(v) => set('loanCar', v)} label="Loan car" /><Check checked={f.afterHours} onChange={(v) => set('afterHours', v)} label="After hours" /><Check checked={f.evCapable} onChange={(v) => set('evCapable', v)} label="Electric and hybrid" /><Check checked={f.doesInspections} onChange={(v) => set('doesInspections', v)} label="Pre-purchase inspections" /><Check checked={f.acceptsBookings} onChange={(v) => set('acceptsBookings', v)} label="Book here" /></div>
      </div>
      {data.loading && <div className="mt-6"><Loading /></div>}
      <ErrorBox error={data.error} />
      {data.data && data.data.mechanics.length === 0 && <div className="mt-6"><Empty title="No workshop matches yet" body="Widen the filters. Workshops are added as they join and are verified; if you know a good one, tell them ATHENA lists women-owned workshops free." action={<Link href="/dashboard/cars/workshop" className="btn-primary text-sm">List a workshop</Link>} /></div>}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {(data.data?.mechanics ?? []).map((m) => (
          <li key={m.id} className={`rounded-2xl border bg-white p-4 dark:bg-slate-900 ${m.isFeatured ? 'border-amber-300' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="flex flex-wrap items-center gap-1.5">{m.womenOwned && <Chip tone="rose">Women-owned</Chip>}{m.womenMechanics && <Chip tone="rose">Women mechanics</Chip>}{m.mobile && <Chip tone="sky">Comes to you</Chip>}{m.loanCar && <Chip>Loan car</Chip>}{m.afterHours && <Chip>After hours</Chip>}{m.evCapable && <Chip tone="emerald">EV and hybrid</Chip>}{m.doesInspections && <Chip>Inspections</Chip>}{m.acceptsBookings && <Chip tone="amber">{m.nextFree ? `Next free ${fmtDay(m.nextFree)}` : 'Book here'}</Chip>}{m.isFeatured && <Chip tone="amber">Featured</Chip>}</div>
            <Link href={`/cars/mechanics/${m.slug}${vehicle ? `?vehicle=${vehicle}` : ''}${f.service ? `${vehicle ? '&' : '?'}service=${f.service}` : ''}`} className="mt-2 block text-lg font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{m.name}</Link>
            <p className="text-sm text-slate-600 dark:text-slate-400">{m.headline}</p>
            <p className="mt-2 text-xs text-slate-500">{[m.suburb || m.city, m.state].filter(Boolean).join(', ') || 'Location on request'}{m.makes.length ? ` · ${m.makes.slice(0, 4).join(', ')}` : ' · all makes'}{m.labourRateHour ? ` · ${aud0(m.labourRateHour)} an hour` : ''}</p>
            {m.price && <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{m.price.from !== null ? `${aud0(m.price.from)}${m.price.to ? ` to ${aud0(m.price.to)}` : ''}` : 'Quoted'} for that job{m.price.own ? ', their price' : ', typical range'}</p>}
            {(m.partsWarrantyMonths || m.labourWarrantyMonths) && <p className="mt-1 text-xs text-slate-500">Warranty: {[m.partsWarrantyMonths ? `${m.partsWarrantyMonths} months parts` : null, m.labourWarrantyMonths ? `${m.labourWarrantyMonths} months labour` : null].filter(Boolean).join(', ')}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">{m.ratingCount > 0 ? <span className="inline-flex items-center gap-1 text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> {m.ratingAvg} from {m.ratingCount} job{m.ratingCount === 1 ? '' : 's'} · charges explained {m.transparencyAvg}/5</span> : <span>No ratings yet; only completed jobs count</span>}{m.phone && <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="hover:text-rose-600">{m.phone}</a>}{m.contactUserId && isAuthenticated && <a href={`/dashboard/messages?user=${m.contactUserId}`} className="inline-flex items-center gap-1 font-semibold text-rose-600"><MessageSquare className="h-3.5 w-3.5" /> Message</a>}</div>
          </li>
        ))}
      </ul>
      {data.data && data.data.total > 20 && <div className="mt-4 flex justify-between text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost disabled:opacity-40">Previous</button><span className="self-center text-xs text-slate-500">{data.data.total} workshops</span><button type="button" disabled={page * 20 >= data.data.total} onClick={() => setPage((p) => p + 1)} className="btn-ghost disabled:opacity-40">Next</button></div>}
      <div className="mt-8"><FleetPanel programme={ref.data?.fleet} /></div>
      <div className="mt-6"><AutoDisclaimer what="Typical price ranges are indicative; the workshop's own quote is the number." /></div>
    </PageShell>
  );
}

export default function MechanicsPage() {
  return <Suspense fallback={<PageShell width="wide"><div className="flex items-center gap-2 text-sm text-slate-500"><Wrench className="h-4 w-4" /> Loading</div></PageShell>}><Directory /></Suspense>;
}
