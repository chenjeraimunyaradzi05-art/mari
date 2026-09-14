'use client';

/**
 * A workshop: who they are, what they do and for which makes, their
 * prices for each job (theirs, or the typical range), the warranty on the
 * work, ratings from completed jobs with the transparency mark, and the
 * booking: pick the job, a day with a slot, the slot, the car from your
 * garage, what is worrying you, and any parts you want sourced.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { CalendarCheck, Globe, MessageSquare, Phone, Star, Wrench } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/lib/hooks';
import { autoApi, autoError, aud0, type MechanicCard, type VehicleCard } from '@/lib/automotive-api';
import { AutoDisclaimer, Chip, ErrorBox, Loading, PageTitle, fmtDay, useLoad } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Detail = MechanicCard & { about: string; address: string | null; licenceNumber: string | null; isOwner: boolean; canModerate: boolean; timezone: string; prices: Array<{ kind: string; label: string; from: number | null; to: number | null; note: string | null; own: boolean }>; reviews: Array<{ id: string; rating: number; transparency: number; comment: string | null; isHidden: boolean; by: string; job: string; createdAt: string }>; nextAvailable: Array<{ day: string; slots: number }> };
type Slots = { day: string; slots: Array<{ start: string; end: string; label: string }>; timezone: string; minutes: number };

function Workshop() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const data = useLoad<Detail>(() => autoApi.mechanic(params.slug), [params.slug]);
  const garage = useLoad<{ vehicles: VehicleCard[] }>(() => (isAuthenticated ? autoApi.garage() : Promise.resolve({ data: { data: { vehicles: [] } } } as never)), [isAuthenticated]);
  const [kind, setKind] = useState(search.get('service') ?? 'logbook');
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState(search.get('vehicle') ?? '');
  const [concern, setConcern] = useState('');
  const [odo, setOdo] = useState('');
  const [mobile, setMobile] = useState(false);
  const [address, setAddress] = useState('');
  const [parts, setParts] = useState('');
  const [busy, setBusy] = useState(false);
  const m = data.data;
  const slots = useLoad<Slots>(() => (day && m ? autoApi.mechanicSlots(m.id, day, kind) : Promise.resolve({ data: { data: null } } as never)), [day, m?.id, kind]);

  const book = async () => {
    if (!m || !slot) return;
    setBusy(true);
    try {
      await autoApi.book(m.id, { kind, scheduledAt: slot, vehicleId: vehicleId || null, concern: concern || null, odometerKm: odo ? num(odo) : null, dropOff: !mobile, address: mobile ? address : null, parts: parts.trim() ? parts.split('\n').map((p) => p.trim()).filter(Boolean).map((name) => ({ name })) : undefined });
      toast.success('Requested. The workshop will quote or confirm.');
      router.push('/dashboard/cars/bookings');
    } catch (err) { toast.error(autoError(err, 'That could not be booked.')); } finally { setBusy(false); }
  };
  const moderate = async (id: string, isHidden: boolean) => { try { await autoApi.admin.mechanicReview(id, isHidden); data.reload(); } catch (err) { toast.error(autoError(err, 'That could not be changed.')); } };
  const price = m?.prices.find((p) => p.kind === kind);

  return (
    <PageShell width="wide" backTo={{ href: '/cars/mechanics', label: 'Back to mechanics' }}>
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {m && (
        <div className="space-y-6">
          <PageTitle icon={Wrench} kicker={[m.suburb || m.city, m.state].filter(Boolean).join(', ') || 'Workshop'} title={m.name} blurb={m.headline} action={m.isOwner ? <Link href="/dashboard/cars/workshop" className="btn-secondary text-sm">Edit your workshop</Link> : undefined} />
          <div className="flex flex-wrap items-center gap-2">{m.womenOwned && <Chip tone="rose">Women-owned</Chip>}{m.womenMechanics && <Chip tone="rose">Women mechanics</Chip>}{m.mobile && <Chip tone="sky">Comes to you</Chip>}{m.loanCar && <Chip>Loan car</Chip>}{m.afterHours && <Chip>After hours</Chip>}{m.evCapable && <Chip tone="emerald">EV and hybrid</Chip>}{m.doesInspections && <Chip>Pre-purchase inspections</Chip>}{m.isVerified && <Chip tone="amber">Verified</Chip>}{m.ratingCount > 0 && <span className="inline-flex items-center gap-1 text-sm text-amber-600"><Star className="h-4 w-4 fill-current" /> {m.ratingAvg} from {m.ratingCount} job{m.ratingCount === 1 ? '' : 's'} · charges explained {m.transparencyAvg}/5</span>}</div>
          <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
            <div className="space-y-4">
              <Panel title="About">
                <p className="whitespace-pre-line text-sm leading-7 text-slate-800 dark:text-slate-200">{m.about}</p>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Makes</dt><dd className="text-slate-800 dark:text-slate-200">{m.makes.length ? m.makes.join(', ') : 'All makes'}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Languages</dt><dd className="text-slate-800 dark:text-slate-200">{m.languages.join(', ')}</dd></div>
                  {m.labourRateHour && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Labour</dt><dd className="text-slate-800 dark:text-slate-200">{aud0(m.labourRateHour)} an hour</dd></div>}
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Warranty on the work</dt><dd className="text-slate-800 dark:text-slate-200">{[m.partsWarrantyMonths ? `${m.partsWarrantyMonths} months on parts` : null, m.labourWarrantyMonths ? `${m.labourWarrantyMonths} months on labour` : null].filter(Boolean).join(', ') || 'Ask when booking'}{m.warrantyNote ? `. ${m.warrantyNote}` : ''}</dd></div>
                  {m.address && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Address</dt><dd className="text-slate-800 dark:text-slate-200">{m.address}</dd></div>}
                  {m.licenceNumber && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Licence</dt><dd className="text-slate-800 dark:text-slate-200">{m.licenceNumber}</dd></div>}
                </dl>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">{m.phone && <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 text-rose-600"><Phone className="h-4 w-4" /> {m.phone}</a>}{m.website && <a href={m.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-rose-600"><Globe className="h-4 w-4" /> Website</a>}{m.contactUserId && !m.isOwner && (isAuthenticated ? <a href={`/dashboard/messages?user=${m.contactUserId}`} className="inline-flex items-center gap-1.5 text-rose-600"><MessageSquare className="h-4 w-4" /> Message the workshop</a> : <Link href={`/login?redirect=/cars/mechanics/${m.slug}`} className="inline-flex items-center gap-1.5 text-slate-500"><MessageSquare className="h-4 w-4" /> Sign in to message them</Link>)}</div>
              </Panel>
              <Panel title="Prices" intro="Theirs where they have given one, the typical range where they have not. The quote before the work is the number.">
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">{m.prices.map((p) => <li key={p.kind} className="flex items-center justify-between gap-2 py-2"><span className="text-slate-800 dark:text-slate-200">{p.label}</span><span className="text-right"><span className="font-medium text-slate-900 dark:text-white">{p.from !== null ? `${aud0(p.from)}${p.to ? ` to ${aud0(p.to)}` : '+'}` : 'Quoted'}</span><span className="block text-[11px] text-slate-500">{p.own ? p.note ?? 'their price' : 'typical range'}</span></span></li>)}</ul>
              </Panel>
              {m.reviews.length > 0 && <Panel title="From women who booked" intro="Only a completed job can leave one of these. The second mark is whether the charges were explained before the work.">
                <ul className="space-y-3">{m.reviews.map((r) => <li key={r.id} className={cn('text-sm', r.isHidden && 'opacity-60')}><p className="inline-flex flex-wrap items-center gap-1 text-amber-600">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}<span className="ml-2 text-xs text-slate-500">{r.by} · {r.job} · charges explained {r.transparency}/5 · {new Date(r.createdAt).toLocaleDateString('en-AU')}</span>{r.isHidden && <Chip tone="rose">Hidden</Chip>}{m.canModerate && <button type="button" onClick={() => moderate(r.id, !r.isHidden)} className="ml-2 text-xs text-slate-500 underline-offset-2 hover:underline">{r.isHidden ? 'Show it' : 'Hide it'}</button>}</p>{r.comment && <p className="mt-1 text-slate-700 dark:text-slate-300">{r.comment}</p>}</li>)}</ul>
              </Panel>}
            </div>
            <div>
              {m.acceptsBookings && !m.isOwner ? (
                <Panel icon={CalendarCheck} title="Book" intro={`Times in ${m.timezone.replace('_', ' ')}. Requested first; the workshop quotes or confirms.`}>
                  {!isAuthenticated ? <Link href={`/login?redirect=/cars/mechanics/${m.slug}`} className="btn-primary inline-block text-sm">Sign in to book</Link> : (
                    <div className="space-y-4">
                      <Field label="What needs doing"><SelectInput value={kind} onChange={(v) => { setKind(v); setSlot(null); }} options={m.prices.map((p) => ({ value: p.kind, label: `${p.label}${p.from !== null ? ` · from ${aud0(p.from)}` : ''}` }))} /></Field>
                      {price && <p className="text-xs text-slate-500">{price.own ? 'Their price' : 'Typical range'}: {price.from !== null ? `${aud0(price.from)}${price.to ? ` to ${aud0(price.to)}` : '+'}` : 'quoted'}. A quote comes before any work.</p>}
                      {m.nextAvailable.length === 0 ? <p className="text-sm text-slate-500">Nothing free in the next two weeks. Try the phone.</p> : (
                        <>
                          <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">A day</span><div className="mt-1.5 flex flex-wrap gap-1.5">{m.nextAvailable.map((d) => <button key={d.day} type="button" onClick={() => { setDay(d.day); setSlot(null); }} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium', day === d.day ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>{fmtDay(d.day)}</button>)}</div></div>
                          {day && <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">A time{slots.data ? ` (${slots.data.minutes} minutes)` : ''}</span>{slots.loading ? <Loading label="Finding the free times" /> : <div className="mt-1.5 flex flex-wrap gap-1.5">{(slots.data?.slots ?? []).map((s) => <button key={s.start} type="button" onClick={() => setSlot(s.start)} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium', slot === s.start ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>{s.label}</button>)}{slots.data && slots.data.slots.length === 0 && <span className="text-xs text-slate-500">Nothing long enough that day for this job; try another.</span>}</div>}</div>}
                        </>
                      )}
                      {slot && (
                        <>
                          <Field label="Which car" hint={garage.data?.vehicles.length ? 'From your garage; the job is written into its history when it is done.' : 'Add your car to the garage to keep its history.'}><SelectInput value={vehicleId} onChange={setVehicleId} options={[{ value: '', label: 'Not in my garage' }, ...(garage.data?.vehicles ?? []).map((v) => ({ value: v.id, label: v.name }))]} /></Field>
                          <Field label="Kilometres now"><NumberInput value={odo} onChange={setOdo} suffix="km" /></Field>
                          <Field label="What is going on" hint="A noise, a light, a feeling. The more you say, the better the quote."><textarea value={concern} onChange={(e) => setConcern(e.target.value)} rows={3} maxLength={2000} className={inputClass} /></Field>
                          <Field label="Parts you want sourced" hint="One per line. They quote them with the labour."><textarea value={parts} onChange={(e) => setParts(e.target.value)} rows={2} maxLength={800} className={inputClass} placeholder="Cabin filter&#10;Wiper blades" /></Field>
                          {m.mobile && <><Check checked={mobile} onChange={setMobile} label="Come to me instead" />{mobile && <Field label="Address"><input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className={inputClass} /></Field>}</>}
                          <button type="button" onClick={book} disabled={busy || (mobile && !address.trim())} className="btn-primary w-full text-sm disabled:opacity-50">Request this booking</button>
                        </>
                      )}
                    </div>
                  )}
                </Panel>
              ) : (
                <Panel title={m.isOwner ? 'This is you' : 'Reach them directly'} intro={m.isOwner ? 'Members see the booking panel here.' : 'This workshop takes bookings by phone or on its own site.'}>
                  {m.phone && <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="btn-primary inline-flex items-center gap-2 text-sm"><Phone className="h-4 w-4" /> Call {m.phone}</a>}
                  {m.bookingUrl && <div className="mt-2"><a href={m.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">Open their booking page</a></div>}
                </Panel>
              )}
            </div>
          </div>
          <AutoDisclaimer what="Prices shown are the workshop's own or typical ranges." />
        </div>
      )}
    </PageShell>
  );
}

export default function MechanicPage() {
  return <Suspense fallback={<PageShell width="wide"><Loading /></PageShell>}><Workshop /></Suspense>;
}
