'use client';

/**
 * The garage: every car she owns, what each is worth today, and what is
 * due across all of them; and the form to add one, which matches the
 * catalogue so the service intervals and the warranty come across on
 * their own.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { KeyRound, Plus } from 'lucide-react';
import { autoApi, autoError, aud0, type Reminder, type VehicleCard } from '@/lib/automotive-api';
import { AutoNav, Empty, ErrorBox, Loading, PageTitle, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';
import { ReminderList } from '../page';

const EMPTY = { nickname: '', make: 'Toyota', model: '', year: String(new Date().getFullYear() - 3), variant: '', fuelType: '', colour: '', rego: '', regoState: 'QLD', odometerKm: '', kmPerYear: '15000', purchasePrice: '', purchasedAt: '', boughtNew: false, newPrice: '', regoDueAt: '', insuranceRenewsAt: '', insurer: '', insurancePremium: '', nextServiceDueAt: '', nextServiceDueKm: '', warrantyEndsAt: '', warrantyEndsKm: '' };

export default function GaragePage() {
  const ref = useReference();
  const data = useLoad<{ vehicles: VehicleCard[]; reminders: Reminder[] }>(() => autoApi.garage());
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  const numOrNull = (s: string) => (s.trim() ? num(s) : null);

  const add = async () => {
    setBusy(true);
    try {
      await autoApi.addVehicle({ nickname: orNull(f.nickname), make: f.make, model: f.model, year: num(f.year), variant: orNull(f.variant), fuelType: f.fuelType || undefined, colour: orNull(f.colour), rego: orNull(f.rego), regoState: f.regoState || null, odometerKm: numOrNull(f.odometerKm), kmPerYear: numOrNull(f.kmPerYear), purchasePrice: numOrNull(f.purchasePrice), purchasedAt: orNull(f.purchasedAt), boughtNew: f.boughtNew, newPrice: numOrNull(f.newPrice), regoDueAt: orNull(f.regoDueAt), insuranceRenewsAt: orNull(f.insuranceRenewsAt), insurer: orNull(f.insurer), insurancePremium: numOrNull(f.insurancePremium), nextServiceDueAt: orNull(f.nextServiceDueAt), nextServiceDueKm: numOrNull(f.nextServiceDueKm), warrantyEndsAt: orNull(f.warrantyEndsAt), warrantyEndsKm: numOrNull(f.warrantyEndsKm) });
      toast.success('In the garage.');
      setAdding(false); setF(EMPTY); data.reload();
    } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={KeyRound} kicker="Cars" title="Your garage" blurb="Service history, the warranty, registration and insurance reminders, and what each car is worth today." action={<button type="button" onClick={() => setAdding((a) => !a)} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Add a car</button>} />
      <AutoNav current="/dashboard/cars/garage" />
      {adding && (
        <Panel title="A car" intro="Make, model and year are enough to start; the rest sharpens the reminders and the valuation. If the model is in the catalogue, the service intervals and the warranty come across on their own.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Make"><SelectInput value={f.make} onChange={(v) => set('make', v)} options={(ref.data?.makes ?? ['Toyota']).map((m) => ({ value: m, label: m }))} /></Field>
            <Field label="Model"><input value={f.model} onChange={(e) => set('model', e.target.value)} className={inputClass} placeholder="Corolla" /></Field>
            <Field label="Year"><NumberInput value={f.year} onChange={(v) => set('year', v)} /></Field>
            <Field label="Variant"><input value={f.variant} onChange={(e) => set('variant', e.target.value)} className={inputClass} placeholder="Ascent Sport hybrid" /></Field>
            <Field label="Nickname"><input value={f.nickname} onChange={(e) => set('nickname', e.target.value)} className={inputClass} placeholder="The red one" /></Field>
            <Field label="Fuel"><SelectInput value={f.fuelType} onChange={(v) => set('fuelType', v)} options={[{ value: '', label: 'From the catalogue' }, ...(ref.data?.fuelTypes ?? []).map((t) => ({ value: t.key, label: t.label }))]} /></Field>
            <Field label="Registration"><input value={f.rego} onChange={(e) => set('rego', e.target.value.toUpperCase())} className={inputClass} maxLength={10} /></Field>
            <Field label="Registered in"><SelectInput value={f.regoState} onChange={(v) => set('regoState', v)} options={['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))} /></Field>
            <Field label="Odometer now"><NumberInput value={f.odometerKm} onChange={(v) => set('odometerKm', v)} suffix="km" /></Field>
            <Field label="Kilometres a year" hint="Used to project when a service is due."><NumberInput value={f.kmPerYear} onChange={(v) => set('kmPerYear', v)} /></Field>
            <Field label="Paid"><NumberInput value={f.purchasePrice} onChange={(v) => set('purchasePrice', v)} prefix="$" /></Field>
            <Field label="Bought on"><input type="date" value={f.purchasedAt} onChange={(e) => set('purchasedAt', e.target.value)} className={inputClass} /></Field>
            <Field label="Registration due"><input type="date" value={f.regoDueAt} onChange={(e) => set('regoDueAt', e.target.value)} className={inputClass} /></Field>
            <Field label="Insurance renews"><input type="date" value={f.insuranceRenewsAt} onChange={(e) => set('insuranceRenewsAt', e.target.value)} className={inputClass} /></Field>
            <Field label="Insurer"><input value={f.insurer} onChange={(e) => set('insurer', e.target.value)} className={inputClass} /></Field>
            <Field label="Premium, a year"><NumberInput value={f.insurancePremium} onChange={(v) => set('insurancePremium', v)} prefix="$" /></Field>
            <Field label="Next service due"><input type="date" value={f.nextServiceDueAt} onChange={(e) => set('nextServiceDueAt', e.target.value)} className={inputClass} /></Field>
            <Field label="Or at"><NumberInput value={f.nextServiceDueKm} onChange={(v) => set('nextServiceDueKm', v)} suffix="km" /></Field>
            <Field label="Warranty ends"><input type="date" value={f.warrantyEndsAt} onChange={(e) => set('warrantyEndsAt', e.target.value)} className={inputClass} /></Field>
            <Field label="Or at"><NumberInput value={f.warrantyEndsKm} onChange={(v) => set('warrantyEndsKm', v)} suffix="km" /></Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4"><Check checked={f.boughtNew} onChange={(v) => set('boughtNew', v)} label="Bought new" hint="The warranty end is worked out from the catalogue if you leave it blank." />{!f.boughtNew && <div className="w-44"><Field label="New price, if known" hint="Sharpens the valuation."><NumberInput value={f.newPrice} onChange={(v) => set('newPrice', v)} prefix="$" /></Field></div>}</div>
          <div className="mt-4 flex gap-2"><button type="button" onClick={add} disabled={busy || !f.model.trim() || num(f.year) < 1960} className="btn-primary text-sm disabled:opacity-50">Add to the garage</button><button type="button" onClick={() => setAdding(false)} className="btn-ghost text-sm">Cancel</button></div>
        </Panel>
      )}
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && data.data.vehicles.length === 0 && !adding && <Empty title="No cars yet" body="Add one and the service reminders, the warranty countdown, the registration and insurance reminders and the valuation all start." action={<button type="button" onClick={() => setAdding(true)} className="btn-primary text-sm">Add a car</button>} />}
      {data.data && data.data.vehicles.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <ul className="space-y-3">
            {data.data.vehicles.map((v) => (
              <li key={v.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/dashboard/cars/garage/${v.id}`} className="text-lg font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{v.name}</Link><p className="text-xs text-slate-500">{v.year} {v.make} {v.model}{v.variant ? ` ${v.variant}` : ''} · {v.fuelLabel}{v.rego ? ` · ${v.rego}` : ''}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-900 dark:text-white">{aud0(v.valuation.mid)}</p><p className="text-[11px] text-slate-500">{aud0(v.valuation.low)} to {aud0(v.valuation.high)} privately</p></div></div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div><dt className="text-slate-500">Odometer</dt><dd className="text-slate-800 dark:text-slate-200">{v.odometerNow ? `${v.odometerNow.toLocaleString('en-AU')} km` : 'Not set'}</dd></div>
                  <div><dt className="text-slate-500">Next service</dt><dd className="text-slate-800 dark:text-slate-200">{v.nextServiceDueAt ?? (v.nextServiceDueKm ? `${v.nextServiceDueKm.toLocaleString('en-AU')} km` : 'Not set')}</dd></div>
                  <div><dt className="text-slate-500">Registration</dt><dd className="text-slate-800 dark:text-slate-200">{v.regoDueAt ?? 'Not set'}</dd></div>
                  <div><dt className="text-slate-500">Warranty</dt><dd className="text-slate-800 dark:text-slate-200">{v.warrantyEndsAt ?? (v.warrantyEndsKm ? `${v.warrantyEndsKm.toLocaleString('en-AU')} km` : 'Not set')}</dd></div>
                </dl>
                {v.reminders.length > 0 && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{v.reminders.length} reminder{v.reminders.length === 1 ? '' : 's'} due</p>}
              </li>
            ))}
          </ul>
          <Panel title="Coming up" intro="Across every car. Each is also sent as a notification, once a month at most."><ReminderList reminders={data.data.reminders} /></Panel>
        </div>
      )}
    </div>
  );
}
