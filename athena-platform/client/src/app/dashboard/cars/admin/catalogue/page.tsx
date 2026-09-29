'use client';

/**
 * The new-car catalogue, kept by the team.
 *
 * Every price, ANCAP rating, consumption figure and warranty a member reads on
 * a new-car page used to be a literal in the server's code, so the only way
 * to correct one was a deploy — and nobody was ever prompted to. This page is
 * where the catalogue is kept now: each car with the date it was last checked
 * and by whom, what needs looking at (never checked, not checked in six
 * months, a lapsed or missing ANCAP rating, no source link), a form to add or
 * correct a car, a one-press record that a car was checked and is still
 * right, retiring and restoring, and the whole catalogue as a CSV to edit in
 * a spreadsheet and bring back after a preview.
 *
 * A change to a figure always carries its as-at, because members read that
 * line next to the figure. The form fills in today's line the moment a figure
 * is touched, and the admin can reword it; the server refuses a figure change
 * without one.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BookOpenCheck, Download, FileUp } from 'lucide-react';
import { autoApi, autoError, aud0, type AdminCarCard, type AdminCatalogue, type CatalogueImport, type Reference } from '@/lib/automotive-api';
import { AncapBadge, AutoNav, Confirm, ErrorBox, Loading, PageTitle, fmtDay, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, Panel, SelectInput, inputClass } from '@/components/strategy/StrategyUi';
import { downloadBlob } from '@/lib/download';
import { safeHref } from '@/lib/safe-href';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------ the form

type Draft = {
  make: string; model: string; variant: string; year: string; bodyType: string; fuelType: string; transmission: string; seats: string; priceFrom: string;
  ancapStars: string; ancapYear: string; fuelPer100: string; kwhPer100: string; rangeKm: string; co2GramsKm: string; warrantyYears: string; warrantyKm: string;
  serviceIntervalMonths: string; serviceIntervalKm: string; servicingCostYear: string; safetyFeatures: string[]; highlights: string; sourceUrl: string; asAt: string;
};
type DraftKey = keyof Draft;

const NUMBER_FIELDS: DraftKey[] = ['year', 'seats', 'priceFrom', 'ancapStars', 'ancapYear', 'fuelPer100', 'kwhPer100', 'rangeKm', 'co2GramsKm', 'warrantyYears', 'warrantyKm', 'serviceIntervalMonths', 'serviceIntervalKm', 'servicingCostYear'];
/** Words about the row rather than claims about the car; the same split the server makes. */
const NOT_FIGURES: ReadonlySet<DraftKey> = new Set(['make', 'model', 'highlights', 'sourceUrl', 'asAt']);

const text = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

/** Today's as-at, in the words members read: a date and what the price includes. */
function todayLine(): string {
  return `Checked ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}: list price before on-road costs`;
}

function draftOf(car: AdminCarCard | null): Draft {
  if (!car) return { make: '', model: '', variant: '', year: String(new Date().getFullYear()), bodyType: 'SUV', fuelType: 'PETROL', transmission: 'AUTOMATIC', seats: '5', priceFrom: '', ancapStars: '', ancapYear: '', fuelPer100: '', kwhPer100: '', rangeKm: '', co2GramsKm: '', warrantyYears: '', warrantyKm: '', serviceIntervalMonths: '12', serviceIntervalKm: '15000', servicingCostYear: '', safetyFeatures: [], highlights: '', sourceUrl: '', asAt: todayLine() };
  return {
    make: car.make, model: car.model, variant: text(car.variant), year: text(car.year), bodyType: car.bodyType, fuelType: car.fuelType, transmission: car.transmission, seats: text(car.seats), priceFrom: text(car.priceFrom),
    ancapStars: text(car.ancapStars), ancapYear: text(car.ancapYear), fuelPer100: text(car.fuelPer100), kwhPer100: text(car.kwhPer100), rangeKm: text(car.rangeKm), co2GramsKm: text(car.co2GramsKm), warrantyYears: text(car.warrantyYears), warrantyKm: text(car.warrantyKm),
    serviceIntervalMonths: text(car.serviceIntervalMonths), serviceIntervalKm: text(car.serviceIntervalKm), servicingCostYear: text(car.servicingCostYear), safetyFeatures: [...car.safetyFeatures], highlights: car.highlights.join('\n'), sourceUrl: text(car.sourceUrl), asAt: text(car.asAt),
  };
}

/** A field as the server takes it: an empty number is "not published" (null), a list is one entry per line. */
function valueOf(draft: Draft, key: DraftKey): unknown {
  if (key === 'safetyFeatures') return draft.safetyFeatures;
  if (key === 'highlights') return draft.highlights.split('\n').map((h) => h.trim()).filter(Boolean);
  const raw = draft[key] as string;
  if (NUMBER_FIELDS.includes(key)) return raw.trim() === '' ? null : Number(raw);
  if (key === 'variant' || key === 'sourceUrl') return raw.trim() === '' ? null : raw.trim();
  return raw.trim();
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function CarForm({ car, reference, onDone, onCancel }: { car: AdminCarCard | null; reference: Reference | null; onDone: () => void; onCancel: () => void }) {
  const original = useMemo(() => draftOf(car), [car]);
  const [draft, setDraft] = useState<Draft>(original);
  const [asAtTouched, setAsAtTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key: DraftKey, value: string | string[]) => setDraft((d) => ({ ...d, [key]: value }));

  const changedKeys = (Object.keys(draft) as DraftKey[]).filter((k) => k !== 'asAt' && !sameValue(valueOf(draft, k), valueOf(original, k)));
  const figuresChanged = changedKeys.some((k) => !NOT_FIGURES.has(k));
  // A new car, or a changed figure, takes today's line unless the admin has
  // written her own; otherwise the as-at stays as it is and is not sent.
  const asAt = asAtTouched ? draft.asAt : !car || figuresChanged ? todayLine() : original.asAt;
  const sendAsAt = !car || figuresChanged || (asAtTouched && draft.asAt.trim() !== original.asAt.trim());

  const save = async () => {
    setBusy(true);
    try {
      if (!car) {
        const body = Object.fromEntries((Object.keys(draft) as DraftKey[]).map((k) => [k, k === 'asAt' ? asAt.trim() : valueOf(draft, k)]));
        await autoApi.admin.addCar(body);
        toast.success('Added to the catalogue');
      } else {
        const body: Record<string, unknown> = Object.fromEntries(changedKeys.map((k) => [k, valueOf(draft, k)]));
        if (sendAsAt) body.asAt = asAt.trim();
        if (Object.keys(body).length === 0) { toast('Nothing has changed'); setBusy(false); return; }
        await autoApi.admin.updateCar(car.id, body);
        toast.success('Saved');
      }
      onDone();
    } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); }
  };

  const num = (key: DraftKey, label: string, hint?: string, prefix?: string, suffix?: string) => <Field label={label} hint={hint}><NumberInput value={draft[key] as string} onChange={(v) => set(key, v)} prefix={prefix} suffix={suffix} /></Field>;
  return (
    <div className="mt-3 space-y-4 rounded-xl border border-rose-200 bg-white p-4 dark:border-rose-900/40 dark:bg-slate-900">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Make"><input value={draft.make} onChange={(e) => set('make', e.target.value)} maxLength={40} className={inputClass} /></Field>
        <Field label="Model"><input value={draft.model} onChange={(e) => set('model', e.target.value)} maxLength={60} className={inputClass} /></Field>
        <Field label="Grade" hint="The entry grade the figures are for"><input value={draft.variant} onChange={(e) => set('variant', e.target.value)} maxLength={80} className={inputClass} /></Field>
        {num('year', 'Model year')}
        <Field label="Body"><SelectInput value={draft.bodyType} onChange={(v) => set('bodyType', v)} options={(reference?.bodyTypes ?? []).map((b) => ({ value: b.key, label: b.label }))} /></Field>
        <Field label="Fuel"><SelectInput value={draft.fuelType} onChange={(v) => set('fuelType', v)} options={(reference?.fuelTypes ?? []).map((f) => ({ value: f.key, label: f.label }))} /></Field>
        <Field label="Transmission"><SelectInput value={draft.transmission} onChange={(v) => set('transmission', v)} options={[{ value: 'AUTOMATIC', label: 'Automatic' }, { value: 'MANUAL', label: 'Manual' }]} /></Field>
        {num('seats', 'Seats')}
        {num('priceFrom', 'List price from', 'Before on-road costs', '$')}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="ANCAP stars" hint="Zero is a rating; leave empty if ANCAP has not tested it"><SelectInput value={draft.ancapStars} onChange={(v) => set('ancapStars', v)} options={[{ value: '', label: 'Not rated' }, ...[0, 1, 2, 3, 4, 5].map((s) => ({ value: String(s), label: `${s} star${s === 1 ? '' : 's'}` }))]} /></Field>
        {num('ancapYear', 'Year of the ANCAP test', 'The date stamp on the rating')}
        <div className="flex items-end pb-2 text-xs"><a href="https://www.ancap.com.au" target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">Look it up on ancap.com.au</a></div>
        {num('fuelPer100', 'Fuel', 'Litres per 100 km; empty for an electric car', undefined, 'L')}
        {num('kwhPer100', 'Energy', 'kWh per 100 km; electric and plug-in only', undefined, 'kWh')}
        {num('rangeKm', 'Electric range', undefined, undefined, 'km')}
        {num('co2GramsKm', 'Tailpipe CO2', 'From the Green Vehicle Guide; empty to estimate from fuel use', undefined, 'g/km')}
        {num('warrantyYears', 'Warranty', undefined, undefined, 'years')}
        {num('warrantyKm', 'Warranty distance', 'Empty for unlimited', undefined, 'km')}
        {num('serviceIntervalMonths', 'Service every', undefined, undefined, 'months')}
        {num('serviceIntervalKm', 'or every', undefined, undefined, 'km')}
        {num('servicingCostYear', 'Servicing a year', 'Capped-price or typical', '$')}
      </div>
      <Field label="Safety features fitted across the range" hint="Only what is standard on every grade; members are told to check the rest">
        <div className="mt-1 grid gap-1 sm:grid-cols-2">{(reference?.safetyFeatures ?? []).map((f) => <Check key={f.key} checked={draft.safetyFeatures.includes(f.key)} onChange={(on) => set('safetyFeatures', on ? [...draft.safetyFeatures, f.key] : draft.safetyFeatures.filter((k) => k !== f.key))} label={f.name} />)}</div>
      </Field>
      <Field label="Highlights" hint="One per line, up to six, in plain words"><textarea value={draft.highlights} onChange={(e) => set('highlights', e.target.value)} rows={3} className={inputClass} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Where the figures come from" hint="The maker's price page or spec sheet; members see this link"><input value={draft.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} maxLength={500} placeholder="https://" className={inputClass} /></Field>
        <Field label="As at" hint={sendAsAt ? 'Members read this next to the figures' : 'Unchanged: nothing you have edited is a figure'}><input value={asAt} onChange={(e) => { setAsAtTouched(true); set('asAt', e.target.value); }} maxLength={160} className={inputClass} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={save} className="btn-primary text-sm disabled:opacity-50">{car ? 'Save changes' : 'Add to the catalogue'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
        {car && <span className="text-xs text-slate-500">{changedKeys.length === 0 ? 'Nothing changed yet.' : `Changing ${changedKeys.length} field${changedKeys.length === 1 ? '' : 's'}.`}</span>}
      </div>
    </div>
  );
}

/** "I checked this against the source and it is still right": the as-at, and the source if it has moved. */
function CheckedForm({ car, onDone, onCancel }: { car: AdminCarCard; onDone: () => void; onCancel: () => void }) {
  const [asAt, setAsAt] = useState(todayLine());
  const [sourceUrl, setSourceUrl] = useState(car.sourceUrl ?? '');
  const [busy, setBusy] = useState(false);
  const record = async () => {
    setBusy(true);
    try {
      await autoApi.admin.carChecked(car.id, { asAt: asAt.trim(), sourceUrl: sourceUrl.trim() || null });
      toast.success('Recorded as checked');
      onDone();
    } catch (err) { toast.error(autoError(err, 'That could not be recorded.')); } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-900/40 dark:bg-slate-900">
      <p className="text-xs text-slate-600 dark:text-slate-400">Compare the price, the ANCAP rating and its year, the warranty and the servicing cost with the source. If anything differs, cancel and edit the car instead.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Source"><input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} maxLength={500} placeholder="https://" className={inputClass} /></Field>
        <Field label="As at"><input value={asAt} onChange={(e) => setAsAt(e.target.value)} maxLength={160} className={inputClass} /></Field>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || asAt.trim().length < 3} onClick={record} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">It is still right</button><button type="button" onClick={onCancel} className="btn-ghost text-xs">Cancel</button></div>
    </div>
  );
}

// ------------------------------------------------------------------- import

const show = (v: unknown) => (v === null || v === undefined || v === '' ? 'empty' : Array.isArray(v) ? v.join(', ') || 'none' : String(v));

function ImportPreview({ plan }: { plan: CatalogueImport }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-slate-700 dark:text-slate-300">{plan.creates.length} to add, {plan.updates.length} to change, {plan.unchanged} unchanged{plan.errors.length ? `, ${plan.errors.length} with problems` : ''}.</p>
      {plan.errors.length > 0 && <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20"><p className="text-xs font-semibold text-red-700 dark:text-red-300">Nothing can be imported until these are fixed</p><ul className="mt-1 space-y-1 text-xs text-red-700 dark:text-red-300">{plan.errors.map((e) => <li key={`${e.line}-${e.message}`}>Line {e.line}{e.slug ? ` (${e.slug})` : ''}: {e.message}</li>)}</ul></div>}
      {plan.warnings.length > 0 && <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20"><ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">{plan.warnings.map((w) => <li key={`${w.line}-${w.message}`}>Line {w.line} ({w.slug}): {w.message}</li>)}</ul></div>}
      {plan.creates.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New</p><ul className="mt-1 space-y-1 text-xs">{plan.creates.map((c) => <li key={c.slug}>Line {c.line}: {c.name} from {aud0(c.priceFrom)}{c.isActive ? '' : ', retired'}</li>)}</ul></div>}
      {plan.updates.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Changes</p><ul className="mt-1 space-y-2 text-xs">{plan.updates.map((u) => <li key={u.slug}><span className="font-medium text-slate-900 dark:text-white">Line {u.line}: {u.slug}</span><ul className="ml-4 list-disc">{Object.entries(u.changes).map(([k, ch]) => <li key={k}>{k}: {show(ch.from)} → {show(ch.to)}</li>)}</ul></li>)}</ul></div>}
    </div>
  );
}

// --------------------------------------------------------------------- page

type Show = 'due' | 'active' | 'retired' | 'all';

const FLAG_TONE: Record<string, string> = { UNCHECKED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200', CHECK_DUE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200', ANCAP_LAPSED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200', ANCAP_UNRATED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', NO_SOURCE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };

export default function CatalogueAdminPage() {
  const data = useLoad<AdminCatalogue>(() => autoApi.admin.catalogue());
  const ref = useReference();
  const [search, setSearch] = useState('');
  const [showing, setShowing] = useState<Show>('due');
  const [editing, setEditing] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [plan, setPlan] = useState<CatalogueImport | null>(null);
  const o = data.data;

  const models = useMemo(() => {
    const words = search.trim().toLowerCase();
    return (o?.models ?? []).filter((m) => (showing === 'due' ? m.due : showing === 'active' ? m.isActive : showing === 'retired' ? !m.isActive : true))
      .filter((m) => !words || `${m.make} ${m.model} ${m.variant ?? ''} ${m.slug}`.toLowerCase().includes(words));
  }, [o, search, showing]);

  const done = () => { setEditing(null); setChecking(null); data.reload(); };
  const setActive = async (m: AdminCarCard, isActive: boolean) => {
    try { await autoApi.admin.updateCar(m.id, { isActive }); toast.success(isActive ? 'Back in the catalogue' : 'Retired: members no longer see it'); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); }
  };
  const exportCsv = async () => {
    setBusy(true);
    try { const res = await autoApi.admin.exportCatalogue(); downloadBlob(`athena-car-catalogue-${new Date().toISOString().slice(0, 10)}.csv`, res.data as Blob); } catch (err) { toast.error(autoError(err, 'The catalogue could not be exported.')); } finally { setBusy(false); }
  };
  const preview = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setPlan(null);
    try {
      const textOf = await file.text();
      setCsv({ name: file.name, text: textOf });
      const res = await autoApi.admin.importCatalogue(textOf, false);
      setPlan(res.data.data as CatalogueImport);
    } catch (err) { toast.error(autoError(err, 'That file could not be read.')); } finally { setBusy(false); }
  };
  const apply = async () => {
    if (!csv) return;
    setBusy(true);
    try {
      const res = await autoApi.admin.importCatalogue(csv.text, true);
      const result = res.data.data as CatalogueImport;
      toast.success(`Imported: ${result.creates.length} added, ${result.updates.length} changed`);
      setCsv(null); setPlan(null); data.reload();
    } catch (err) { toast.error(autoError(err, 'Nothing was imported.')); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={BookOpenCheck} kicker="Cars · admin" title="The new-car catalogue" blurb={o ? `${o.counts.active} cars members can see, ${o.counts.retired} retired. ${o.counts.due} to check: never checked, or not in the last ${o.recheckDays} days.` : 'Prices, safety ratings and running costs, kept by the team.'} action={<Link href="/dashboard/cars/admin" className="btn-ghost text-sm">Back to the queues</Link>} />
      <AutoNav current="/dashboard/cars/admin" />
      {data.loading && !o && <Loading />}
      <ErrorBox error={data.error} />
      {o && (
        <div className="space-y-6">
          <Panel title="Cars" intro="Check a car against the maker's price page and ANCAP. If it is still right, say so; if not, edit it. Retiring takes a car off every member page but keeps its reviews and the garages that point at it." aside={<button type="button" onClick={() => { setEditing('new'); setChecking(null); }} className="btn-primary text-sm">Add a car</button>}>
            {editing === 'new' && <CarForm car={null} reference={ref.data} onDone={done} onCancel={() => setEditing(null)} />}
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field label="Find"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Make, model or slug" className={inputClass} /></Field>
              <Field label="Show"><SelectInput value={showing} onChange={(v) => setShowing(v as Show)} options={[{ value: 'due', label: `To check (${o.counts.due})` }, { value: 'active', label: `In the catalogue (${o.counts.active})` }, { value: 'retired', label: `Retired (${o.counts.retired})` }, { value: 'all', label: 'Everything' }]} /></Field>
            </div>
            <ul className="mt-4 space-y-2">
              {models.map((m) => (
                <li key={m.id} className={cn('rounded-lg p-3 text-sm', m.isActive ? 'bg-slate-50 dark:bg-slate-800/60' : 'bg-slate-100/60 opacity-80 dark:bg-slate-800/30')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{m.make} {m.model} <span className="font-normal text-slate-500">{m.variant} · {m.year} · from {aud0(m.priceFrom)}</span>{!m.isActive && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Retired</span>}</span>
                    <AncapBadge ancap={m.ancap} stars={m.ancapStars} compact />
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{m.asAt ?? 'No as-at'}. {m.lastCheck ? `Last checked ${fmtDay(m.lastCheck.at, { day: 'numeric', month: 'short', year: 'numeric' })}${m.lastCheck.by ? ` by ${m.lastCheck.by}` : ''}.` : 'Never checked by the team.'}{safeHref(m.sourceUrl) && <> <a href={safeHref(m.sourceUrl)} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">Source</a></>}</p>
                  {m.flags.length > 0 && <ul className="mt-2 flex flex-wrap gap-1">{m.flags.map((f) => <li key={f.key} title={f.words} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', FLAG_TONE[f.key])}>{f.words}</li>)}</ul>}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <button type="button" onClick={() => { setEditing(editing === m.id ? null : m.id); setChecking(null); }} className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100">{editing === m.id ? 'Close' : 'Edit'}</button>
                    <button type="button" onClick={() => { setChecking(checking === m.id ? null : m.id); setEditing(null); }} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Checked, still right</button>
                    {m.isActive ? <Confirm label="Retire" tone="slate" hint="Members will no longer see it." onConfirm={() => setActive(m, false)} /> : <button type="button" onClick={() => setActive(m, true)} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">Restore</button>}
                    {m.isActive && <Link href={`/cars/new/${m.slug}`} className="btn-ghost text-xs">The page members see</Link>}
                  </div>
                  {editing === m.id && <CarForm car={m} reference={ref.data} onDone={done} onCancel={() => setEditing(null)} />}
                  {checking === m.id && <CheckedForm car={m} onDone={done} onCancel={() => setChecking(null)} />}
                </li>
              ))}
              {models.length === 0 && <li className="text-sm text-slate-500">{showing === 'due' ? 'Every car has been checked within the last ' + o.recheckDays + ' days.' : 'No cars match.'}</li>}
            </ul>
          </Panel>

          <Panel icon={FileUp} title="The catalogue as a spreadsheet" intro="Export the catalogue, change it in Excel, Numbers or Sheets, and import it back. You see every change before it is made, and a file with any problem changes nothing.">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} onClick={exportCsv} className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"><Download className="h-4 w-4" /> Export as CSV</button>
              <label className={cn('btn-primary inline-flex cursor-pointer items-center gap-2 text-sm', busy && 'pointer-events-none opacity-50')}><FileUp className="h-4 w-4" /> Choose a CSV to import<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void preview(e.target.files?.[0]); e.target.value = ''; }} /></label>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600 dark:text-slate-400">
              <li>Rows are matched by slug. A slug the catalogue does not have is a new car, and needs every column.</li>
              <li>A file can carry only the columns it changes: <code>slug,priceFrom,asAt</code> reprices and leaves everything else alone. An empty cell in a column that is there means not published.</li>
              <li>Safety features and highlights are separated by a vertical bar ( | ). isActive is yes or no.</li>
              <li>Any row that changes a figure needs the asAt column, because members read it next to the figures.</li>
            </ul>
            {csv && plan && (
              <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{csv.name}</p>
                <ImportPreview plan={plan} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy || plan.errors.length > 0 || plan.creates.length + plan.updates.length === 0} onClick={apply} className="btn-primary text-sm disabled:opacity-50">{plan.creates.length + plan.updates.length === 0 ? 'Nothing to change' : `Make these ${plan.creates.length + plan.updates.length} changes`}</button>
                  <button type="button" onClick={() => { setCsv(null); setPlan(null); }} className="btn-ghost text-sm">Discard</button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
