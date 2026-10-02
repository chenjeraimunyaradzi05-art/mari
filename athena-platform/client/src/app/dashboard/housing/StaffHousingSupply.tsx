'use client';

/**
 * Staff putting a housing partner's places on ATHENA.
 *
 * Until this existed, the only way a listing reached the safe-housing search
 * was a member typing one in, so a survivor sent there from the safety page
 * found it empty. Staff can now enter a partner's place here, or load the
 * partner's whole list from a spreadsheet. Each listing belongs to a member
 * account that answers the women who ask — the partner's own, named by email,
 * or the member of staff's if none is given.
 *
 * A DV-safe place is held for a check like a member's, unless the member of
 * staff entering it has checked it herself; then she says what she checked,
 * and that goes into the audit log with her name. A spreadsheet row is never
 * marked checked: the sheet is the partner's word, and the badge is a
 * person's.
 *
 * The server holds every rule; this form only collects. A refusal is shown as
 * the server's own sentence, and a spreadsheet with problems lists every one
 * with its line, because nothing from it is written until all are fixed.
 */

import { useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, FileSpreadsheet, Loader2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: 'RENTAL', label: 'Rental' },
  { value: 'SHARE', label: 'Share house' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'TRANSITIONAL', label: 'Transitional' },
];
const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

type ImportProblem = { line: number; title: string | null; message: string };
type DryRun = { rows: number; heldForCheck: number; listerIsStaff: boolean; titles: string[] };

const inputClass = 'w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700';
const labelClass = 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

const serverMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
};
const importProblems = (err: unknown): ImportProblem[] => {
  const errors = (err as { response?: { data?: { errors?: unknown } } })?.response?.data?.errors;
  return Array.isArray(errors) ? (errors as ImportProblem[]) : [];
};

const emptyPlace = {
  title: '',
  description: '',
  type: 'RENTAL',
  address: '',
  suburb: '',
  city: '',
  state: 'QLD',
  postcode: '',
  rentWeekly: '',
  bondAmount: '',
  bedrooms: '',
  bathrooms: '',
  availableFrom: '',
  features: '',
  petFriendly: false,
  accessibleUnit: false,
  flexibleLease: false,
  dvSafe: false,
  dvSafeNote: '',
  safetyVerified: false,
  safetyCheckNote: '',
};

function OnePlace({ onListed }: { onListed?: () => void }) {
  const [place, setPlace] = useState(emptyPlace);
  const [listerEmail, setListerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof typeof emptyPlace>(key: K, value: (typeof emptyPlace)[K]) => setPlace((p) => ({ ...p, [key]: value }));
  const confidential = place.dvSafe || place.type === 'EMERGENCY' || place.type === 'TRANSITIONAL';

  const submit = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await api.post('/housing/admin/listings', {
        title: place.title,
        description: place.description,
        type: place.type,
        address: place.address,
        suburb: place.suburb,
        city: place.city,
        state: place.state,
        postcode: place.postcode,
        rentWeekly: place.rentWeekly,
        bondAmount: place.bondAmount,
        bedrooms: place.bedrooms,
        bathrooms: place.bathrooms,
        availableFrom: place.availableFrom,
        features: place.features
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
        petFriendly: place.petFriendly,
        accessibleUnit: place.accessibleUnit,
        flexibleLease: place.flexibleLease,
        dvSafe: place.dvSafe,
        ...(place.dvSafe ? { dvSafeNote: place.dvSafeNote } : {}),
        ...(confidential && place.safetyVerified ? { safetyVerified: true, safetyCheckNote: place.safetyCheckNote } : {}),
        ...(listerEmail.trim() ? { listerEmail: listerEmail.trim() } : {}),
      });
      setResult({ ok: true, text: res.data?.message || 'Listed.' });
      setPlace(emptyPlace);
      onListed?.();
    } catch (err) {
      setResult({ ok: false, text: serverMessage(err, 'The place could not be listed. Nothing was saved.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="supply-lister" className={labelClass}>Partner account email</label>
        <input id="supply-lister" type="email" value={listerEmail} onChange={(e) => setListerEmail(e.target.value)} placeholder="Leave empty to answer inquiries yourself" className={cn('mt-1', inputClass)} />
        <p className="mt-1 text-xs text-slate-500">The account that is told about inquiries and answers them. It must be an ATHENA account that is not suspended.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="supply-title" className={labelClass}>Title</label>
          <input id="supply-title" value={place.title} onChange={(e) => set('title', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="supply-description" className={labelClass}>Description</label>
          <textarea id="supply-description" value={place.description} onChange={(e) => set('description', e.target.value)} rows={3} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-type" className={labelClass}>Type</label>
          <select id="supply-type" value={place.type} onChange={(e) => set('type', e.target.value)} className={cn('mt-1', inputClass)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="supply-address" className={labelClass}>Street address</label>
          <input id="supply-address" value={place.address} onChange={(e) => set('address', e.target.value)} className={cn('mt-1', inputClass)} />
          <p className="mt-1 text-xs text-slate-500">Shown only once the lister has answered a woman who asked.</p>
        </div>
        <div>
          <label htmlFor="supply-suburb" className={labelClass}>Suburb</label>
          <input id="supply-suburb" value={place.suburb} onChange={(e) => set('suburb', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-city" className={labelClass}>City</label>
          <input id="supply-city" value={place.city} onChange={(e) => set('city', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-state" className={labelClass}>State</label>
          <select id="supply-state" value={place.state} onChange={(e) => set('state', e.target.value)} className={cn('mt-1', inputClass)}>
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="supply-postcode" className={labelClass}>Postcode</label>
          <input id="supply-postcode" inputMode="numeric" value={place.postcode} onChange={(e) => set('postcode', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-rent" className={labelClass}>Rent a week ($)</label>
          <input id="supply-rent" inputMode="decimal" value={place.rentWeekly} onChange={(e) => set('rentWeekly', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-bond" className={labelClass}>Bond ($)</label>
          <input id="supply-bond" inputMode="decimal" value={place.bondAmount} onChange={(e) => set('bondAmount', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-bedrooms" className={labelClass}>Bedrooms</label>
          <input id="supply-bedrooms" inputMode="numeric" value={place.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-bathrooms" className={labelClass}>Bathrooms</label>
          <input id="supply-bathrooms" inputMode="numeric" value={place.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-available" className={labelClass}>Available from</label>
          <input id="supply-available" type="date" value={place.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="supply-features" className={labelClass}>Features, separated by commas</label>
          <input id="supply-features" value={place.features} onChange={(e) => set('features', e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-300">
        <label className="flex items-center gap-2"><input type="checkbox" checked={place.petFriendly} onChange={(e) => set('petFriendly', e.target.checked)} /> Pet friendly</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={place.accessibleUnit} onChange={(e) => set('accessibleUnit', e.target.checked)} /> Accessible</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={place.flexibleLease} onChange={(e) => set('flexibleLease', e.target.checked)} /> Flexible lease</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={place.dvSafe} onChange={(e) => set('dvSafe', e.target.checked)} /> DV-safe</label>
      </div>

      {/* A DV-safe claim, and every emergency or transitional place, is held for the same check. */}
      {confidential && (
        <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-900/10">
          {place.dvSafe && (
            <div>
              <label htmlFor="supply-dv-note" className={labelClass}>Why this place is safe for a woman leaving violence</label>
              <textarea id="supply-dv-note" value={place.dvSafeNote} onChange={(e) => set('dvSafeNote', e.target.value)} rows={2} className={cn('mt-1', inputClass)} />
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={place.safetyVerified} onChange={(e) => set('safetyVerified', e.target.checked)} className="mt-1" />
            <span>
              I have checked this place and the partner myself. The member account it is listed under also needs a current provider check
              (approved under Provider checks). Leave this off and another member of staff checks it from the queue.
            </span>
          </label>
          {place.safetyVerified && (
            <div>
              <label htmlFor="supply-check-note" className={labelClass}>What you checked</label>
              <textarea id="supply-check-note" value={place.safetyCheckNote} onChange={(e) => set('safetyCheckNote', e.target.value)} rows={2} placeholder="Who you spoke to, when, and how you know it is safe" className={cn('mt-1', inputClass)} />
              <p className="mt-1 text-xs text-slate-500">This goes into the audit log with your name. The badge women see says a person at ATHENA checked it.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary inline-flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} List this place
        </button>
        {result && (
          <p role={result.ok ? 'status' : 'alert'} className={cn('text-sm', result.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>
            {result.text}
          </p>
        )}
      </div>
    </div>
  );
}

function FromSpreadsheet({ onListed }: { onListed?: () => void }) {
  const [csv, setCsv] = useState('');
  const [listerEmail, setListerEmail] = useState('');
  const [busy, setBusy] = useState<'check' | 'import' | 'template' | null>(null);
  const [checked, setChecked] = useState<DryRun | null>(null);
  const [problems, setProblems] = useState<ImportProblem[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const body = () => ({ csv, ...(listerEmail.trim() ? { listerEmail: listerEmail.trim() } : {}) });

  const reset = () => {
    setChecked(null);
    setProblems([]);
    setMessage(null);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setCsv(await file.text());
  };

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      const res = await api.get('/housing/admin/listings/import-template', { responseType: 'text' });
      const url = URL.createObjectURL(new Blob([String(res.data)], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'athena-housing-import.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ ok: false, text: serverMessage(err, 'The template could not be downloaded.') });
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy('check');
    reset();
    try {
      const res = await api.post('/housing/admin/listings/import', { ...body(), dryRun: true });
      setChecked(res.data?.data as DryRun);
    } catch (err) {
      setProblems(importProblems(err));
      setMessage({ ok: false, text: serverMessage(err, 'The sheet could not be checked.') });
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    setBusy('import');
    setMessage(null);
    try {
      const res = await api.post('/housing/admin/listings/import', body());
      setMessage({ ok: true, text: res.data?.message || 'Imported.' });
      setChecked(null);
      setCsv('');
      onListed?.();
    } catch (err) {
      setProblems(importProblems(err));
      setMessage({ ok: false, text: serverMessage(err, 'The import failed. Nothing was written.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        One row a place, with the header row first. Check the sheet before importing: every row goes in, or none does, and every problem is listed with its line.{' '}
        <button type="button" onClick={downloadTemplate} disabled={busy !== null} className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          Download the column template
        </button>
      </p>
      <div>
        <label htmlFor="supply-import-lister" className={labelClass}>Partner account email</label>
        <input id="supply-import-lister" type="email" value={listerEmail} onChange={(e) => { setListerEmail(e.target.value); setChecked(null); }} placeholder="Leave empty to answer inquiries yourself" className={cn('mt-1', inputClass)} />
      </div>
      <div>
        <label htmlFor="supply-import-file" className={labelClass}>CSV file</label>
        <input id="supply-import-file" type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])} className="mt-1 block text-sm" />
      </div>
      <div>
        <label htmlFor="supply-import-csv" className={labelClass}>Or paste it</label>
        <textarea id="supply-import-csv" value={csv} onChange={(e) => { setCsv(e.target.value); reset(); }} rows={6} className={cn('mt-1 font-mono', inputClass)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={check} disabled={busy !== null || !csv.trim()} className="btn-secondary inline-flex items-center gap-2">
          {busy === 'check' && <Loader2 className="h-4 w-4 animate-spin" />} Check the sheet
        </button>
        {checked && (
          <button type="button" onClick={runImport} disabled={busy !== null} className="btn-primary inline-flex items-center gap-2">
            {busy === 'import' && <Loader2 className="h-4 w-4 animate-spin" />} Import {checked.rows} place{checked.rows === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {checked && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100">
          <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> {checked.rows} row{checked.rows === 1 ? '' : 's'} ready.</p>
          <p className="mt-1">
            {checked.heldForCheck > 0 ? `${checked.heldForCheck} DV-safe, emergency or transitional place${checked.heldForCheck === 1 ? '' : 's'} will wait for a safety check. ` : ''}
            {checked.listerIsStaff ? 'Inquiries will come to you.' : 'Inquiries will go to the partner account.'}
          </p>
        </div>
      )}

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={cn('text-sm', message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>
          {message.text}
        </p>
      )}
      {problems.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-100">
          {problems.map((p, i) => (
            <li key={`${p.line}-${i}`} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                Line {p.line}
                {p.title ? ` (${p.title})` : ''}: {p.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The whole panel: shown to admins only, by the page that mounts it. */
export function StaffHousingSupply({ onListed }: { onListed?: () => void }) {
  const [mode, setMode] = useState<'one' | 'sheet'>('one');
  return (
    <section aria-labelledby="staff-housing-supply" className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 id="staff-housing-supply" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Building2 className="h-5 w-5 text-rose-600" /> Staff: list a housing partner&rsquo;s places
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Only places a partner has given you. Every listing entered here is recorded in the audit log under your name.
        </p>
      </div>
      <div role="tablist" className="flex gap-2">
        <button type="button" role="tab" aria-selected={mode === 'one'} onClick={() => setMode('one')} className={cn('rounded-full px-3 py-1 text-sm', mode === 'one' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>
          <Plus className="mr-1 inline h-3.5 w-3.5" /> One place
        </button>
        <button type="button" role="tab" aria-selected={mode === 'sheet'} onClick={() => setMode('sheet')} className={cn('rounded-full px-3 py-1 text-sm', mode === 'sheet' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>
          <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" /> From a spreadsheet
        </button>
      </div>
      {mode === 'one' ? <OnePlace onListed={onListed} /> : <FromSpreadsheet onListed={onListed} />}
    </section>
  );
}

export default StaffHousingSupply;
