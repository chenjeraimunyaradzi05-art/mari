'use client';

/**
 * The workshop page: a mechanic's own entry in the directory (women-owned
 * and women mechanics marked, services, makes, prices from, the warranty
 * on the work, hours), the bookings that have come in with the quote
 * written line by line, and the pre-purchase inspections open nearby.
 * A new profile waits for verification before members can find it.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Save, Wrench } from 'lucide-react';
import { autoApi, autoError, aud0, type BookingCard, type InspectionCard, type MechanicCard } from '@/lib/automotive-api';
import { AutoNav, Chip, ErrorBox, Loading, PageTitle, StatusChip, fmtWhen, useLoad } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Profile = MechanicCard & { about: string; address: string | null; licenceNumber: string | null; priceList: Array<{ kind: string; from: number; to: number | null; note: string | null }>; availability: Record<string, Array<[string, string]>> | null; isActive: boolean };
type Data = { profile: Profile | null; counts: Record<string, number>; openInspections: number; serviceKinds: Array<{ key: string; label: string; from: number; to: number }>; makes: string[] };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = { '1': [['08:00', '17:00']], '2': [['08:00', '17:00']], '3': [['08:00', '17:00']], '4': [['08:00', '17:00']], '5': [['08:00', '17:00']] } as Record<string, Array<[string, string]>>;
const EMPTY = { name: '', headline: '', about: '', womenOwned: false, womenMechanics: false, services: [] as string[], makes: [] as string[], evCapable: false, mobile: false, loanCar: false, afterHours: false, doesInspections: false, languages: 'English', suburb: '', city: '', state: 'QLD', postcode: '', address: '', phone: '', website: '', bookingUrl: '', licenceNumber: '', priceList: {} as Record<string, { from: string; to: string }>, labourRateHour: '', partsWarrantyMonths: '', labourWarrantyMonths: '', warrantyNote: '', slotMinutes: '60', acceptsBookings: true, availability: HOURS };

export default function WorkshopPage() {
  const data = useLoad<Data>(() => autoApi.workshop());
  const bookings = useLoad<BookingCard[]>(() => (data.data?.profile ? autoApi.workshopBookings() : Promise.resolve({ data: { data: [] } } as never)), [data.data?.profile?.id]);
  const open = useLoad<InspectionCard[]>(() => (data.data?.profile?.doesInspections ? autoApi.openInspections() : Promise.resolve({ data: { data: [] } } as never)), [data.data?.profile?.id, data.data?.profile?.doesInspections]);
  const mine = useLoad<InspectionCard[]>(() => (data.data?.profile ? autoApi.inspections() : Promise.resolve({ data: { data: [] } } as never)), [data.data?.profile?.id]);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Record<string, { lines: Array<{ label: string; amount: string; kind: string }>; note: string }>>({});
  const [report, setReport] = useState<Record<string, { sections: Array<{ key: string; label: string; result: string; notes: string }>; summary: string; scheduledAt: string }>>({});
  const p = data.data?.profile;

  useEffect(() => { if (p) setF({ name: p.name, headline: p.headline, about: p.about, womenOwned: p.womenOwned, womenMechanics: p.womenMechanics, services: p.services, makes: p.makes, evCapable: p.evCapable, mobile: p.mobile, loanCar: p.loanCar, afterHours: p.afterHours, doesInspections: p.doesInspections, languages: p.languages.join(', '), suburb: p.suburb ?? '', city: p.city ?? '', state: p.state ?? 'QLD', postcode: p.postcode ?? '', address: p.address ?? '', phone: p.phone ?? '', website: p.website ?? '', bookingUrl: p.bookingUrl ?? '', licenceNumber: p.licenceNumber ?? '', priceList: Object.fromEntries(p.priceList.map((x) => [x.kind, { from: String(x.from), to: x.to ? String(x.to) : '' }])), labourRateHour: p.labourRateHour ? String(p.labourRateHour) : '', partsWarrantyMonths: p.partsWarrantyMonths ? String(p.partsWarrantyMonths) : '', labourWarrantyMonths: p.labourWarrantyMonths ? String(p.labourWarrantyMonths) : '', warrantyNote: p.warrantyNote ?? '', slotMinutes: String(p.slotMinutes), acceptsBookings: p.acceptsBookings, availability: p.availability ?? HOURS }); }, [p]);

  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  const save = async () => {
    setBusy(true);
    try {
      const res = await autoApi.saveWorkshop({ ...f, languages: f.languages.split(',').map((s) => s.trim()).filter(Boolean), suburb: orNull(f.suburb), city: orNull(f.city), state: f.state || null, postcode: orNull(f.postcode), address: orNull(f.address), phone: orNull(f.phone), website: orNull(f.website), bookingUrl: orNull(f.bookingUrl), licenceNumber: orNull(f.licenceNumber), priceList: Object.entries(f.priceList).filter(([, v]) => v.from.trim()).map(([kind, v]) => ({ kind, from: num(v.from), to: v.to ? num(v.to) : null })), labourRateHour: f.labourRateHour ? num(f.labourRateHour) : null, partsWarrantyMonths: f.partsWarrantyMonths ? num(f.partsWarrantyMonths) : null, labourWarrantyMonths: f.labourWarrantyMonths ? num(f.labourWarrantyMonths) : null, warrantyNote: orNull(f.warrantyNote), slotMinutes: num(f.slotMinutes, 60) });
      toast.success(res.data?.data?.pendingVerification ? 'Saved. Your workshop shows once it is verified.' : 'Saved');
      data.reload();
    } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); }
  };
  const toggle = (k: 'services' | 'makes', v: string) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((s) => s !== v) : [...x[k], v] }));
  const setHours = (day: string, on: boolean) => setF((x) => { const a = { ...x.availability }; if (on) a[day] = a[day]?.length ? a[day] : [['08:00', '17:00']]; else delete a[day]; return { ...x, availability: a }; });
  const setRange = (day: string, i: number, which: 0 | 1, v: string) => setF((x) => { const a = { ...x.availability }; a[day] = a[day].map((r, j) => (j === i ? ((which === 0 ? [v, r[1]] : [r[0], v]) as [string, string]) : r)); return { ...x, availability: a }; });
  const update = (b: BookingCard, patch: Record<string, unknown>, done: string) => autoApi.updateWorkshopBooking(b.id, patch).then(() => { toast.success(done); bookings.reload(); }).catch((err) => toast.error(autoError(err, 'That did not work.')));
  const q = (id: string) => quote[id] ?? { lines: [{ label: '', amount: '', kind: 'LABOUR' }], note: '' };
  const setQ = (id: string, v: { lines: Array<{ label: string; amount: string; kind: string }>; note: string }) => setQuote((x) => ({ ...x, [id]: v }));
  const sendQuote = (b: BookingCard) => { const v = q(b.id); update(b, { quoteLines: v.lines.filter((l) => l.label.trim() && l.amount.trim()).map((l) => ({ label: l.label, amount: num(l.amount), kind: l.kind })), quoteNote: v.note || null }, 'Quote sent'); };
  const r = (i: InspectionCard) => report[i.id] ?? { sections: i.sections.map((s) => ({ key: s.key, label: s.label, result: 'PASS', notes: '' })), summary: '', scheduledAt: '' };
  const setR = (id: string, v: { sections: Array<{ key: string; label: string; result: string; notes: string }>; summary: string; scheduledAt: string }) => setReport((x) => ({ ...x, [id]: v }));
  const inspAct = (fn: () => Promise<unknown>, done: string) => fn().then(() => { toast.success(done); open.reload(); mine.reload(); }).catch((err) => toast.error(autoError(err, 'That did not work.')));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Wrench} kicker="Cars" title="Your workshop" blurb="Your entry in the directory, the bookings that come in, and the inspections open nearby. Members see it once it is verified." action={p ? <div className="flex items-center gap-2"><Chip tone={p.isVerified ? 'emerald' : 'amber'}>{p.isVerified ? 'Verified and listed' : 'Awaiting verification'}</Chip>{p.isVerified && <Link href={`/cars/mechanics/${p.slug}`} className="btn-ghost text-sm">View</Link>}</div> : undefined} />
      <AutoNav current="/dashboard/cars/workshop" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && (
        <>
          {p && (
            <Panel title="Bookings" intro={Object.entries(data.data.counts).map(([k, v]) => `${v} ${k.toLowerCase().replace('_', ' ')}`).join(', ') || 'None yet.'}>
              {bookings.loading && <Loading />}
              <ul className="space-y-3">
                {(bookings.data ?? []).map((b) => (
                  <li key={b.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{b.kindLabel} · {b.member?.name} <span className="font-normal text-slate-500">· {b.member?.email}</span></p><p className="text-xs text-slate-500">{fmtWhen(b.scheduledAt)} · {b.durationMinutes} min · {b.dropOff ? 'drop off' : `at ${b.address}`}{b.vehicle ? ` · ${b.vehicle.name}` : ''}{b.odometerKm ? ` · ${b.odometerKm.toLocaleString('en-AU')} km` : ''}</p></div><StatusChip status={b.status} /></div>
                    {b.concern && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">“{b.concern}”</p>}
                    {b.partsRequested.length > 0 && <p className="mt-1 text-xs text-slate-500">Parts asked for: {b.partsRequested.map((x) => `${x.qty} × ${x.name}`).join(', ')}</p>}
                    {b.quoteLines.length > 0 && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Quoted {aud0(b.quoteAmount)}{b.quoteAcceptedAt ? ', accepted' : ''}{b.escrowStatus ? ` · payment ${b.escrowStatus === 'CAPTURED' ? 'released' : 'held'}` : ''}</p>}
                    {['REQUESTED', 'QUOTED'].includes(b.status) && (
                      <div className="mt-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote, line by line</p>
                        {q(b.id).lines.map((l, i) => <div key={i} className="mt-1 grid grid-cols-[2fr_1fr_1fr] gap-1"><input value={l.label} onChange={(e) => setQ(b.id, { ...q(b.id), lines: q(b.id).lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Front pads" className={inputClass} /><NumberInput value={l.amount} onChange={(v) => setQ(b.id, { ...q(b.id), lines: q(b.id).lines.map((x, j) => (j === i ? { ...x, amount: v } : x)) })} prefix="$" /><SelectInput value={l.kind} onChange={(v) => setQ(b.id, { ...q(b.id), lines: q(b.id).lines.map((x, j) => (j === i ? { ...x, kind: v } : x)) })} options={[{ value: 'PARTS', label: 'Parts' }, { value: 'LABOUR', label: 'Labour' }, { value: 'OTHER', label: 'Other' }]} /></div>)}
                        <div className="mt-1 flex flex-wrap gap-2"><button type="button" onClick={() => setQ(b.id, { ...q(b.id), lines: [...q(b.id).lines, { label: '', amount: '', kind: 'PARTS' }] })} className="btn-ghost text-xs">Add a line</button></div>
                        <input value={q(b.id).note} onChange={(e) => setQ(b.id, { ...q(b.id), note: e.target.value })} placeholder="A note with the quote" className={`${inputClass} mt-1`} />
                        <div className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => sendQuote(b)} className="rounded-md bg-rose-500 px-2 py-1 text-xs font-semibold text-white">Send the quote</button><button type="button" onClick={() => update(b, { status: 'CONFIRMED' }, 'Confirmed')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Confirm without a quote</button><button type="button" onClick={() => update(b, { status: 'DECLINED' }, 'Declined')} className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Decline</button></div>
                      </div>
                    )}
                    {['CONFIRMED', 'IN_PROGRESS'].includes(b.status) && <div className="mt-2 flex flex-wrap gap-1">{b.status === 'CONFIRMED' && <button type="button" onClick={() => update(b, { status: 'IN_PROGRESS' }, 'Under way')} className="rounded-md bg-sky-500 px-2 py-1 text-xs font-semibold text-white">Start the job</button>}<button type="button" onClick={() => { const odo = window.prompt('Odometer reading (km), for the car\'s history', b.odometerKm ? String(b.odometerKm) : ''); const note = window.prompt('A note for the member: what was done, what to watch', b.workshopNote ?? ''); const total = window.prompt('Final amount, if different from the quote', b.finalAmount ? String(b.finalAmount) : b.quoteAmount ? String(b.quoteAmount) : ''); update(b, { status: 'COMPLETED', odometerKm: odo ? num(odo) : null, workshopNote: note || null, finalAmount: total ? num(total) : null }, 'Marked done. Written into the car\'s history.'); }} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Done</button><button type="button" onClick={() => update(b, { status: 'NO_SHOW' }, 'Marked missed')} className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">No show</button></div>}
                  </li>
                ))}
                {bookings.data && bookings.data.length === 0 && <li className="text-sm text-slate-500">No bookings yet.</li>}
              </ul>
            </Panel>
          )}
          {p?.doesInspections && (
            <Panel title="Pre-purchase inspections" intro={`${data.data.openInspections} open request${data.data.openInspections === 1 ? '' : 's'} in ${p.state ?? 'your state'}. Take one on, arrange access with the seller, report section by section. The fee is held by the buyer and released when the report is in.`}>
              <ul className="space-y-2">{(open.data ?? []).map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><span><span className="font-medium text-slate-900 dark:text-white">{i.listing.year} {i.listing.make} {i.listing.model}</span><span className="text-xs text-slate-500"> · {[i.listing.suburb || i.listing.city, i.listing.state].filter(Boolean).join(', ')} · fee {aud0(i.fee)} · asked by {i.requestedBy}</span></span><button type="button" onClick={() => inspAct(() => autoApi.acceptInspection(i.id), 'Taken on. The buyer and seller have been told.')} className="rounded-md bg-rose-500 px-2 py-1 text-xs font-semibold text-white">Take it on</button></li>)}</ul>
              <ul className="mt-3 space-y-3">{(mine.data ?? []).filter((i) => i.isInspector && ['ASSIGNED', 'SCHEDULED'].includes(i.status)).map((i) => <li key={i.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900 dark:text-white">{i.listing.year} {i.listing.make} {i.listing.model} <span className="font-normal text-slate-500">· {i.listing.title}</span></p><StatusChip status={i.status} /></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><Field label="Scheduled for"><input type="datetime-local" value={r(i).scheduledAt} onChange={(e) => setR(i.id, { ...r(i), scheduledAt: e.target.value })} className={inputClass} /></Field><div className="flex items-end pb-1"><button type="button" disabled={!r(i).scheduledAt} onClick={() => inspAct(() => autoApi.updateInspection(i.id, { status: 'SCHEDULED', scheduledAt: new Date(r(i).scheduledAt).toISOString() }), 'Scheduled')} className="btn-secondary text-xs disabled:opacity-50">Set the time</button></div></div><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">The report</p><ul className="mt-1 space-y-1">{r(i).sections.map((s, idx) => <li key={s.key} className="grid gap-1 sm:grid-cols-[1fr_auto_2fr]"><span className="text-sm text-slate-800 dark:text-slate-200">{s.label}</span><div className="flex gap-1">{['PASS', 'ADVISORY', 'FAIL'].map((res) => <button key={res} type="button" onClick={() => setR(i.id, { ...r(i), sections: r(i).sections.map((x, j) => (j === idx ? { ...x, result: res } : x)) })} className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', s.result === res ? (res === 'PASS' ? 'bg-emerald-500 text-white' : res === 'FAIL' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white') : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{res.toLowerCase()}</button>)}</div><input value={s.notes} onChange={(e) => setR(i.id, { ...r(i), sections: r(i).sections.map((x, j) => (j === idx ? { ...x, notes: e.target.value } : x)) })} placeholder="Notes" className={inputClass} /></li>)}</ul><Field label="Summary for the buyer" className="mt-2"><textarea value={r(i).summary} onChange={(e) => setR(i.id, { ...r(i), summary: e.target.value })} rows={3} maxLength={3000} className={inputClass} /></Field><button type="button" disabled={!r(i).summary.trim()} onClick={() => inspAct(() => autoApi.updateInspection(i.id, { status: 'COMPLETED', report: r(i).sections, summary: r(i).summary }), 'Report sent to the buyer')} className="btn-primary mt-2 text-sm disabled:opacity-50">Send the report</button></li>)}</ul>
            </Panel>
          )}
          <Panel title={p ? 'Your entry' : 'Create your entry'} intro="What members filter on. Be specific about what you do and for whom.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workshop name"><input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} className={inputClass} /></Field>
              <Field label="One line" ><input value={f.headline} onChange={(e) => setF((x) => ({ ...x, headline: e.target.value }))} maxLength={140} className={inputClass} placeholder="Women-owned, plain-spoken, southside" /></Field>
              <Field label="About" className="sm:col-span-2"><textarea value={f.about} onChange={(e) => setF((x) => ({ ...x, about: e.target.value }))} rows={5} maxLength={4000} className={inputClass} /></Field>
              <Field label="Languages" hint="Comma separated."><input value={f.languages} onChange={(e) => setF((x) => ({ ...x, languages: e.target.value }))} className={inputClass} /></Field>
              <Field label="Repairer licence number" hint="Speeds up verification."><input value={f.licenceNumber} onChange={(e) => setF((x) => ({ ...x, licenceNumber: e.target.value }))} maxLength={30} className={inputClass} /></Field>
              <Field label="Phone"><input value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} className={inputClass} /></Field>
              <Field label="Website"><input value={f.website} onChange={(e) => setF((x) => ({ ...x, website: e.target.value }))} className={inputClass} placeholder="https://" /></Field>
              <Field label="External booking page"><input value={f.bookingUrl} onChange={(e) => setF((x) => ({ ...x, bookingUrl: e.target.value }))} className={inputClass} placeholder="https://" /></Field>
              <Field label="Address"><input value={f.address} onChange={(e) => setF((x) => ({ ...x, address: e.target.value }))} className={inputClass} /></Field>
              <Field label="Suburb"><input value={f.suburb} onChange={(e) => setF((x) => ({ ...x, suburb: e.target.value }))} className={inputClass} /></Field>
              <Field label="City"><input value={f.city} onChange={(e) => setF((x) => ({ ...x, city: e.target.value }))} className={inputClass} /></Field>
              <Field label="State"><SelectInput value={f.state} onChange={(v) => setF((x) => ({ ...x, state: v }))} options={['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))} /></Field>
              <Field label="Postcode"><input value={f.postcode} onChange={(e) => setF((x) => ({ ...x, postcode: e.target.value }))} maxLength={4} className={inputClass} /></Field>
              <Field label="Labour rate, an hour"><NumberInput value={f.labourRateHour} onChange={(v) => setF((x) => ({ ...x, labourRateHour: v }))} prefix="$" /></Field>
              <Field label="Parts warranty (months)"><NumberInput value={f.partsWarrantyMonths} onChange={(v) => setF((x) => ({ ...x, partsWarrantyMonths: v }))} /></Field>
              <Field label="Labour warranty (months)"><NumberInput value={f.labourWarrantyMonths} onChange={(v) => setF((x) => ({ ...x, labourWarrantyMonths: v }))} /></Field>
              <Field label="Warranty note" className="sm:col-span-2"><input value={f.warrantyNote} onChange={(e) => setF((x) => ({ ...x, warrantyNote: e.target.value }))} maxLength={300} className={inputClass} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-4"><Check checked={f.womenOwned} onChange={(v) => setF((x) => ({ ...x, womenOwned: v }))} label="Women-owned" /><Check checked={f.womenMechanics} onChange={(v) => setF((x) => ({ ...x, womenMechanics: v }))} label="Women mechanics on the tools" /><Check checked={f.mobile} onChange={(v) => setF((x) => ({ ...x, mobile: v }))} label="Mobile: we come to you" /><Check checked={f.loanCar} onChange={(v) => setF((x) => ({ ...x, loanCar: v }))} label="Loan car" /><Check checked={f.afterHours} onChange={(v) => setF((x) => ({ ...x, afterHours: v }))} label="After hours" /><Check checked={f.evCapable} onChange={(v) => setF((x) => ({ ...x, evCapable: v }))} label="Electric and hybrid" /><Check checked={f.doesInspections} onChange={(v) => setF((x) => ({ ...x, doesInspections: v }))} label="Pre-purchase inspections" /></div>
            <div className="mt-4"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Services and prices from</span><ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">{data.data.serviceKinds.map((s) => <li key={s.key} className="flex items-center gap-2"><button type="button" onClick={() => toggle('services', s.key)} className={cn('flex-1 rounded-full px-2.5 py-1 text-left text-xs font-medium', f.services.includes(s.key) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{s.label}</button>{f.services.includes(s.key) && <><div className="w-24"><NumberInput value={f.priceList[s.key]?.from ?? ''} onChange={(v) => setF((x) => ({ ...x, priceList: { ...x.priceList, [s.key]: { from: v, to: x.priceList[s.key]?.to ?? '' } } }))} prefix="$" placeholder={String(s.from)} /></div><div className="w-24"><NumberInput value={f.priceList[s.key]?.to ?? ''} onChange={(v) => setF((x) => ({ ...x, priceList: { ...x.priceList, [s.key]: { from: x.priceList[s.key]?.from ?? '', to: v } } }))} prefix="$" placeholder={String(s.to)} /></div></>}</li>)}</ul></div>
            <div className="mt-4"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Makes you specialise in (none means all)</span><div className="mt-1.5 flex flex-wrap gap-1.5">{data.data.makes.map((m) => <button key={m} type="button" onClick={() => toggle('makes', m)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', f.makes.includes(m) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{m}</button>)}</div></div>
          </Panel>
          <Panel title="Hours and bookings" intro="Members book inside these hours, in your timezone (from your account settings). Requests come to you to quote or confirm.">
            <div className="flex flex-wrap items-center gap-4"><Check checked={f.acceptsBookings} onChange={(v) => setF((x) => ({ ...x, acceptsBookings: v }))} label="Take bookings here" /><div className="w-40"><Field label="Smallest booking"><NumberInput value={f.slotMinutes} onChange={(v) => setF((x) => ({ ...x, slotMinutes: v }))} suffix="min" min={15} max={480} /></Field></div></div>
            <ul className="mt-4 space-y-2">{DAYS.map((d, i) => { const key = String(i); const on = Boolean(f.availability[key]); return <li key={key} className="flex flex-wrap items-center gap-3 text-sm"><label className="flex w-16 items-center gap-2"><input type="checkbox" checked={on} onChange={(e) => setHours(key, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-rose-500" /> {d}</label>{on && f.availability[key].map((rg, j) => <span key={j} className="flex items-center gap-1"><input type="time" value={rg[0]} onChange={(e) => setRange(key, j, 0, e.target.value)} className={inputClass} /><span className="text-slate-400">to</span><input type="time" value={rg[1]} onChange={(e) => setRange(key, j, 1, e.target.value)} className={inputClass} /></span>)}</li>; })}</ul>
          </Panel>
          <button type="button" onClick={save} disabled={busy || f.name.trim().length < 2 || f.headline.trim().length < 5 || f.about.trim().length < 20} className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"><Save className="h-4 w-4" /> {p ? 'Save changes' : 'Create the entry'}</button>
        </>
      )}
    </div>
  );
}
