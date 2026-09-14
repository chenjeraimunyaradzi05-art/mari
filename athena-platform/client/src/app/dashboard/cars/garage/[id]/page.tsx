'use client';

/**
 * One car in the garage: the odometer kept up to date, what it is worth
 * with the assumptions, the reminders, the service history (each job's
 * warranty counted forward), a service logged by hand or written in by
 * a workshop, the maintenance guide for its fuel type, the trade-in and
 * the way to sell it or book it in.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { KeyRound, Plus } from 'lucide-react';
import { autoApi, autoError, aud0, type BookingCard, type CarCard, type Reminder, type VehicleCard } from '@/lib/automotive-api';
import { AncapBadge, AutoNav, Confirm, ErrorBox, Loading, PageTitle, StatusChip, fmtDay, fmtWhen, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, Notes, NumberInput, Panel, SelectInput, Stat, inputClass, num } from '@/components/strategy/StrategyUi';
import { ReminderList } from '../../page';
import { safeHref } from '@/lib/safe-href';

type Service = { id: string; date: string; odometerKm: number | null; kind: string; kindLabel: string; title: string; workshop: string | null; mechanicSlug: string | null; cost: number | null; notes: string | null; partsWarrantyMonths: number | null; labourWarrantyMonths: number | null; invoiceUrl: string | null; bookingId: string | null; warrantyUntil: string | null };
type Detail = VehicleCard & { valuation: { low: number; mid: number; high: number; tradeIn: number; assumptions: string[]; newPriceAssumed: boolean }; catalogue: CarCard | null; services: Service[]; spent: number; bookings: BookingCard[]; tradeIns: Array<{ id: string; status: string; estimateMid: number; expiresAt: string; quotes: number }>; maintenance: Array<{ key: string; title: string; every: string; what: string; cost: string }> };

const EMPTY_SERVICE = { date: new Date().toISOString().slice(0, 10), odometerKm: '', kind: 'logbook', title: '', workshop: '', cost: '', notes: '', partsWarrantyMonths: '', labourWarrantyMonths: '' };

export default function VehiclePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ref = useReference();
  const data = useLoad<Detail>(() => autoApi.vehicle(params.id), [params.id]);
  const [odo, setOdo] = useState('');
  const [editing, setEditing] = useState(false);
  const [e, setE] = useState({ nickname: '', regoDueAt: '', insuranceRenewsAt: '', insurer: '', insurancePremium: '', nextServiceDueAt: '', nextServiceDueKm: '', warrantyEndsAt: '', warrantyEndsKm: '', kmPerYear: '', serviceIntervalMonths: '', serviceIntervalKm: '', newPrice: '', notes: '' });
  const [logging, setLogging] = useState(false);
  const [s, setS] = useState(EMPTY_SERVICE);
  const [busy, setBusy] = useState(false);
  const v = data.data;

  useEffect(() => { if (v) setE({ nickname: v.nickname ?? '', regoDueAt: v.regoDueAt ?? '', insuranceRenewsAt: v.insuranceRenewsAt ?? '', insurer: v.insurer ?? '', insurancePremium: v.insurancePremium ? String(v.insurancePremium) : '', nextServiceDueAt: v.nextServiceDueAt ?? '', nextServiceDueKm: v.nextServiceDueKm ? String(v.nextServiceDueKm) : '', warrantyEndsAt: v.warrantyEndsAt ?? '', warrantyEndsKm: v.warrantyEndsKm ? String(v.warrantyEndsKm) : '', kmPerYear: v.kmPerYear ? String(v.kmPerYear) : '', serviceIntervalMonths: String(v.serviceIntervalMonths), serviceIntervalKm: String(v.serviceIntervalKm), newPrice: v.newPrice ? String(v.newPrice) : '', notes: v.notes ?? '' }); }, [v]);

  const orNull = (x: string) => (x.trim() ? x.trim() : null);
  const numOrNull = (x: string) => (x.trim() ? num(x) : null);
  const saveOdo = async () => { if (!v) return; try { await autoApi.odometer(v.id, num(odo)); toast.success('Odometer updated'); setOdo(''); data.reload(); } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } };
  const saveEdit = async () => { if (!v) return; setBusy(true); try { await autoApi.updateVehicle(v.id, { nickname: orNull(e.nickname), regoDueAt: orNull(e.regoDueAt), insuranceRenewsAt: orNull(e.insuranceRenewsAt), insurer: orNull(e.insurer), insurancePremium: numOrNull(e.insurancePremium), nextServiceDueAt: orNull(e.nextServiceDueAt), nextServiceDueKm: numOrNull(e.nextServiceDueKm), warrantyEndsAt: orNull(e.warrantyEndsAt), warrantyEndsKm: numOrNull(e.warrantyEndsKm), kmPerYear: numOrNull(e.kmPerYear), serviceIntervalMonths: num(e.serviceIntervalMonths, 12), serviceIntervalKm: num(e.serviceIntervalKm, 15000), newPrice: numOrNull(e.newPrice), notes: orNull(e.notes) }); toast.success('Saved'); setEditing(false); data.reload(); } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); } };
  const logService = async () => { if (!v) return; setBusy(true); try { await autoApi.addService(v.id, { date: s.date, odometerKm: numOrNull(s.odometerKm), kind: s.kind, title: s.title || (ref.data?.serviceKinds.find((k) => k.key === s.kind)?.label ?? s.kind), workshop: orNull(s.workshop), cost: numOrNull(s.cost), notes: orNull(s.notes), partsWarrantyMonths: numOrNull(s.partsWarrantyMonths), labourWarrantyMonths: numOrNull(s.labourWarrantyMonths) }); toast.success('Logged. The next service has moved forward.'); setLogging(false); setS(EMPTY_SERVICE); data.reload(); } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); } };
  const remove = async () => { if (!v) return; try { await autoApi.deleteVehicle(v.id); toast.success('Removed from the garage'); router.push('/dashboard/cars/garage'); } catch (err) { toast.error(autoError(err, 'That could not be removed.')); } };
  const removeService = async (id: string) => { try { await autoApi.deleteService(id); data.reload(); } catch (err) { toast.error(autoError(err, 'That could not be removed.')); } };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <AutoNav current="/dashboard/cars/garage" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {v && (
        <>
          <PageTitle icon={KeyRound} kicker={`${v.year} ${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ''}`} title={v.name} blurb={`${v.fuelLabel}${v.rego ? ` · ${v.rego}${v.regoState ? ` (${v.regoState})` : ''}` : ''}${v.purchasedAt ? ` · yours since ${fmtDay(v.purchasedAt, { month: 'short', year: 'numeric' })}` : ''}`} action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditing((x) => !x)} className="btn-secondary text-sm">{editing ? 'Close' : 'Edit details'}</button><Link href={`/dashboard/cars/sell?vehicle=${v.id}`} className="btn-ghost text-sm">Sell it</Link></div>} />
          {editing && (
            <Panel title="Details" intro="The dates drive the reminders; the intervals and the yearly distance drive the service projection.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Nickname"><input value={e.nickname} onChange={(x) => setE((y) => ({ ...y, nickname: x.target.value }))} className={inputClass} /></Field>
                <Field label="Kilometres a year"><NumberInput value={e.kmPerYear} onChange={(x) => setE((y) => ({ ...y, kmPerYear: x }))} /></Field>
                <Field label="Service every (months)"><NumberInput value={e.serviceIntervalMonths} onChange={(x) => setE((y) => ({ ...y, serviceIntervalMonths: x }))} /></Field>
                <Field label="Service every (km)"><NumberInput value={e.serviceIntervalKm} onChange={(x) => setE((y) => ({ ...y, serviceIntervalKm: x }))} /></Field>
                <Field label="Next service due"><input type="date" value={e.nextServiceDueAt} onChange={(x) => setE((y) => ({ ...y, nextServiceDueAt: x.target.value }))} className={inputClass} /></Field>
                <Field label="Or at (km)"><NumberInput value={e.nextServiceDueKm} onChange={(x) => setE((y) => ({ ...y, nextServiceDueKm: x }))} /></Field>
                <Field label="Registration due"><input type="date" value={e.regoDueAt} onChange={(x) => setE((y) => ({ ...y, regoDueAt: x.target.value }))} className={inputClass} /></Field>
                <Field label="Insurance renews"><input type="date" value={e.insuranceRenewsAt} onChange={(x) => setE((y) => ({ ...y, insuranceRenewsAt: x.target.value }))} className={inputClass} /></Field>
                <Field label="Insurer"><input value={e.insurer} onChange={(x) => setE((y) => ({ ...y, insurer: x.target.value }))} className={inputClass} /></Field>
                <Field label="Premium, a year"><NumberInput value={e.insurancePremium} onChange={(x) => setE((y) => ({ ...y, insurancePremium: x }))} prefix="$" /></Field>
                <Field label="Warranty ends"><input type="date" value={e.warrantyEndsAt} onChange={(x) => setE((y) => ({ ...y, warrantyEndsAt: x.target.value }))} className={inputClass} /></Field>
                <Field label="Or at (km)"><NumberInput value={e.warrantyEndsKm} onChange={(x) => setE((y) => ({ ...y, warrantyEndsKm: x }))} /></Field>
                <Field label="New price" hint="Sharpens the valuation."><NumberInput value={e.newPrice} onChange={(x) => setE((y) => ({ ...y, newPrice: x }))} prefix="$" /></Field>
                <Field label="Notes" className="sm:col-span-2 lg:col-span-3"><input value={e.notes} onChange={(x) => setE((y) => ({ ...y, notes: x.target.value }))} className={inputClass} maxLength={2000} /></Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={saveEdit} disabled={busy} className="btn-primary text-sm disabled:opacity-50">Save</button><Confirm label="Remove from the garage" onConfirm={remove} hint="The history goes with it." /></div>
            </Panel>
          )}
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-6">
              <Panel title="Odometer" intro={v.odometerNow ? `About ${v.odometerNow.toLocaleString('en-AU')} km today${v.odometerAt ? `, from ${v.odometerKm?.toLocaleString('en-AU')} km on ${fmtDay(v.odometerAt)}${v.kmPerYear ? ` at ${v.kmPerYear.toLocaleString('en-AU')} km a year` : ''}` : ''}.` : 'No reading yet. Two readings a few months apart work out how far you drive.'}>
                <div className="flex flex-wrap items-end gap-2"><div className="w-44"><Field label="Reading today"><NumberInput value={odo} onChange={setOdo} suffix="km" /></Field></div><button type="button" onClick={saveOdo} disabled={num(odo) <= 0} className="btn-secondary text-sm disabled:opacity-50">Update</button></div>
              </Panel>
              <Panel title="Service history" intro={v.services.length ? `${v.services.length} record${v.services.length === 1 ? '' : 's'}, ${aud0(v.spent)} spent. Jobs booked through ATHENA are written in by the workshop.` : 'Nothing logged yet. Log the last service and the next one is worked out.'} aside={<button type="button" onClick={() => setLogging((x) => !x)} className="btn-secondary inline-flex items-center gap-1 text-sm"><Plus className="h-3.5 w-3.5" /> Log a service</button>}>
                {logging && (
                  <div className="mb-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Date"><input type="date" value={s.date} onChange={(x) => setS((y) => ({ ...y, date: x.target.value }))} className={inputClass} /></Field>
                      <Field label="What"><SelectInput value={s.kind} onChange={(x) => setS((y) => ({ ...y, kind: x }))} options={(ref.data?.serviceKinds ?? []).map((k) => ({ value: k.key, label: k.label }))} /></Field>
                      <Field label="Odometer then"><NumberInput value={s.odometerKm} onChange={(x) => setS((y) => ({ ...y, odometerKm: x }))} suffix="km" /></Field>
                      <Field label="Title"><input value={s.title} onChange={(x) => setS((y) => ({ ...y, title: x.target.value }))} className={inputClass} placeholder="60,000 km service" /></Field>
                      <Field label="Workshop"><input value={s.workshop} onChange={(x) => setS((y) => ({ ...y, workshop: x.target.value }))} className={inputClass} /></Field>
                      <Field label="Cost"><NumberInput value={s.cost} onChange={(x) => setS((y) => ({ ...y, cost: x }))} prefix="$" /></Field>
                      <Field label="Parts warranty (months)"><NumberInput value={s.partsWarrantyMonths} onChange={(x) => setS((y) => ({ ...y, partsWarrantyMonths: x }))} /></Field>
                      <Field label="Labour warranty (months)"><NumberInput value={s.labourWarrantyMonths} onChange={(x) => setS((y) => ({ ...y, labourWarrantyMonths: x }))} /></Field>
                      <Field label="Notes"><input value={s.notes} onChange={(x) => setS((y) => ({ ...y, notes: x.target.value }))} className={inputClass} /></Field>
                    </div>
                    <div className="mt-3 flex gap-2"><button type="button" onClick={logService} disabled={busy} className="btn-primary text-sm disabled:opacity-50">Save</button><button type="button" onClick={() => setLogging(false)} className="btn-ghost text-sm">Cancel</button></div>
                  </div>
                )}
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {v.services.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900 dark:text-white">{r.title} <span className="font-normal text-slate-500">· {r.kindLabel}</span></p><span className="text-sm tabular-nums text-slate-800 dark:text-slate-200">{r.cost !== null ? aud0(r.cost) : ''}</span></div>
                      <p className="text-xs text-slate-500">{fmtDay(r.date, { day: 'numeric', month: 'short', year: 'numeric' })}{r.odometerKm ? ` · ${r.odometerKm.toLocaleString('en-AU')} km` : ''}{r.workshop ? ` · ${r.mechanicSlug ? '' : ''}${r.workshop}` : ''}{r.warrantyUntil ? ` · warranty on this work until ${fmtDay(r.warrantyUntil, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
                      {r.notes && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{r.notes}</p>}
                      <div className="mt-1 flex gap-3 text-xs">{r.invoiceUrl && <a href={safeHref(r.invoiceUrl)} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">Invoice</a>}{r.mechanicSlug && <Link href={`/cars/mechanics/${r.mechanicSlug}`} className="font-semibold text-rose-600">The workshop</Link>}{!r.bookingId && <button type="button" onClick={() => removeService(r.id)} className="text-slate-500 hover:text-rose-600">Remove</button>}</div>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="What it needs, and when" intro="From the maintenance guide, for this fuel type. Log a service and the next one is worked out from the intervals.">
                <ul className="grid gap-2 sm:grid-cols-2">{v.maintenance.map((m) => <li key={m.key} className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60"><p className="font-semibold text-slate-900 dark:text-white">{m.title}</p><p className="text-slate-600 dark:text-slate-400">{m.every} · {m.cost}</p></li>)}</ul>
              </Panel>
            </div>
            <div className="space-y-6">
              <Panel title="Coming up"><ReminderList reminders={v.reminders} />{v.bookings.length > 0 && <ul className="mt-3 space-y-1">{v.bookings.map((b) => <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60"><span>{b.kindLabel} at {b.mechanic.name} · {fmtWhen(b.scheduledAt)}</span><StatusChip status={b.status} /></li>)}</ul>}<div className="mt-3 flex flex-wrap gap-2"><Link href={`/cars/mechanics?service=logbook&vehicle=${v.id}`} className="btn-secondary text-sm">Book a service</Link><Link href={`/cars/insurance?value=${v.valuation.mid}&fuel=${v.fuelType}`} className="btn-ghost text-sm">Insurance estimate</Link></div></Panel>
              <Panel title="What it is worth" intro="A guide, not a valuation.">
                <div className="grid grid-cols-2 gap-2"><Stat label="Private sale" value={`${aud0(v.valuation.low)} to ${aud0(v.valuation.high)}`} tone="good" /><Stat label="Trade-in, about" value={aud0(v.valuation.tradeIn)} /></div>
                <Notes items={v.valuation.assumptions} />
                <div className="mt-3 flex flex-wrap gap-2"><Link href={`/dashboard/cars/sell?vehicle=${v.id}`} className="btn-primary text-sm">Sell it with buyer protection</Link><Link href="/cars/value" className="btn-ghost text-sm">Plan the changeover</Link></div>
                {v.tradeIns.length > 0 && <ul className="mt-3 space-y-1 text-xs">{v.tradeIns.map((t) => <li key={t.id} className="flex items-center justify-between gap-2"><span>Trade-in request · {t.quotes} quote{t.quotes === 1 ? '' : 's'} · until {fmtDay(t.expiresAt)}</span><StatusChip status={t.status} /></li>)}</ul>}
              </Panel>
              {v.catalogue && <Panel title="In the catalogue" intro={`${v.catalogue.make} ${v.catalogue.model}${v.catalogue.variant ? ` ${v.catalogue.variant}` : ''}`}><div className="flex flex-wrap items-center gap-2"><AncapBadge ancap={v.catalogue.ancap} stars={v.catalogue.ancapStars} /><span className="text-xs text-slate-500">{v.catalogue.warranty}</span></div><Link href={`/cars/new/${v.catalogue.slug}`} className="mt-2 inline-block text-sm font-semibold text-rose-600">The catalogue page, and what other owners say</Link></Panel>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
