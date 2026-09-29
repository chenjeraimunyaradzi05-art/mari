'use client';

/**
 * Staff keeping the disability-friendly employer list.
 *
 * The list had a reader and no writer, so it could never hold an employer.
 * Staff now list one they have checked, saying what they checked; editing a
 * listing is a fresh check and is dated as one; retiring takes an employer off
 * the list with a reason and keeps its history. Being on this list is ATHENA
 * vouching for a workplace to women with disability, so every change is in
 * the audit log under the name of whoever made it. No badge is offered: a
 * badge would name somebody else's accreditation, which nothing here checks.
 */

import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

type Assessment = {
  accessibilityRating: number;
  accommodationsOffered: string[];
  hasWheelchairAccess: boolean;
  hasFlexibleWork: boolean;
  hasRemoteOptions: boolean;
  hasMentalHealthSupport: boolean;
};
type Listing = Assessment & {
  id: string;
  organizationId: string;
  verifiedAt: string | null;
  organization: { id: string; name: string; industry?: string | null };
};
type OrganizationHit = {
  id: string;
  name: string;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  disabilityFriendlyListings?: Array<{ id: string; verifiedAt: string | null }>;
};

const FEATURES: Array<[keyof Omit<Assessment, 'accessibilityRating' | 'accommodationsOffered'>, string]> = [
  ['hasWheelchairAccess', 'Wheelchair access'],
  ['hasFlexibleWork', 'Flexible work'],
  ['hasRemoteOptions', 'Remote options'],
  ['hasMentalHealthSupport', 'Mental health support'],
];

const blank: Assessment = {
  accessibilityRating: 3,
  accommodationsOffered: [],
  hasWheelchairAccess: false,
  hasFlexibleWork: false,
  hasRemoteOptions: false,
  hasMentalHealthSupport: false,
};

const inputClass = 'w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700';
const labelClass = 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

const serverMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
};

function AssessmentForm({
  idPrefix,
  initial,
  submitLabel,
  onSubmit,
}: {
  idPrefix: string;
  initial: Assessment;
  submitLabel: string;
  onSubmit: (assessment: Assessment, basis: string) => Promise<string>;
}) {
  const [assessment, setAssessment] = useState<Assessment>(initial);
  const [accommodations, setAccommodations] = useState(initial.accommodationsOffered.join('\n'));
  const [basis, setBasis] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setSaving(true);
    setResult(null);
    try {
      const text = await onSubmit(
        { ...assessment, accommodationsOffered: accommodations.split('\n').map((a) => a.trim()).filter(Boolean) },
        basis
      );
      setResult({ ok: true, text });
      setBasis('');
    } catch (err) {
      setResult({ ok: false, text: serverMessage(err, 'Nothing was saved.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-rating`} className={labelClass}>Accessibility rating</label>
          <select
            id={`${idPrefix}-rating`}
            value={assessment.accessibilityRating}
            onChange={(e) => setAssessment((a) => ({ ...a, accessibilityRating: Number(e.target.value) }))}
            className={cn('mt-1', inputClass)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} of 5</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm text-slate-700 dark:text-slate-300">
          {FEATURES.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={assessment[key]} onChange={(e) => setAssessment((a) => ({ ...a, [key]: e.target.checked }))} /> {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-accommodations`} className={labelClass}>Adjustments offered, one per line</label>
        <textarea id={`${idPrefix}-accommodations`} value={accommodations} onChange={(e) => setAccommodations(e.target.value)} rows={3} className={cn('mt-1', inputClass)} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-basis`} className={labelClass}>What you checked</label>
        <textarea
          id={`${idPrefix}-basis`}
          value={basis}
          onChange={(e) => setBasis(e.target.value)}
          rows={2}
          placeholder="Who you spoke to, when, and what you saw. Goes into the audit log with your name."
          className={cn('mt-1', inputClass)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary inline-flex items-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
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

function ListingRow({ listing, onChanged }: { listing: Listing; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'retire'>('view');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retire = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/impact/admin/disability-employers/${listing.id}/retire`, { reason });
      setMode('view');
      onChanged();
    } catch (err) {
      setError(serverMessage(err, 'The employer could not be taken off the list. It is still listed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{listing.organization.name}</p>
          <p className="text-xs text-slate-500">
            {listing.verifiedAt ? `Listed · checked ${formatDate(listing.verifiedAt)}` : 'Retired · not shown to members'} · rated {listing.accessibilityRating} of 5
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')} className="font-medium text-rose-600 hover:underline dark:text-rose-400">
            {listing.verifiedAt ? 'Re-check and edit' : 'Re-check and relist'}
          </button>
          {listing.verifiedAt && (
            <button type="button" onClick={() => setMode(mode === 'retire' ? 'view' : 'retire')} className="font-medium text-slate-600 hover:underline dark:text-slate-300">
              Retire
            </button>
          )}
        </div>
      </div>
      {mode === 'edit' && (
        <AssessmentForm
          idPrefix={`edit-${listing.id}`}
          initial={listing}
          submitLabel={listing.verifiedAt ? 'Save the re-check' : 'Relist'}
          onSubmit={async (assessment, basis) => {
            const res = await api.patch(`/impact/admin/disability-employers/${listing.id}`, { ...assessment, basis });
            onChanged();
            return res.data?.message || 'Saved.';
          }}
        />
      )}
      {mode === 'retire' && (
        <div className="space-y-2">
          <label htmlFor={`retire-${listing.id}`} className={labelClass}>Why it is coming off the list</label>
          <textarea id={`retire-${listing.id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
          <button type="button" onClick={retire} disabled={busy} className="btn-secondary inline-flex items-center gap-2 text-red-600">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Retire this employer
          </button>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </li>
  );
}

/** The whole panel: shown to admins only, by the page that mounts it. */
export function StaffDisabilityEmployers({ onChanged }: { onChanged?: () => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<OrganizationHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<OrganizationHit | null>(null);
  // The form closes once an employer is listed, taking its own answer with
  // it, so the server's answer is kept here.
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await api.get('/impact/admin/disability-employers');
      setListings((res.data?.data as Listing[]) || []);
      setState('ready');
    } catch {
      setState('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = () => {
    void load();
    onChanged?.();
  };

  const search = async () => {
    setSearching(true);
    setSearchError(null);
    setHits(null);
    try {
      const res = await api.get('/impact/admin/organizations', { params: { q: query.trim() } });
      setHits((res.data?.data as OrganizationHit[]) || []);
    } catch (err) {
      setSearchError(serverMessage(err, 'The search did not work just now.'));
    } finally {
      setSearching(false);
    }
  };

  return (
    <section aria-labelledby="staff-disability-employers" className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 id="staff-disability-employers" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Building2 className="h-5 w-5 text-rose-600" /> Staff: the disability-friendly employer list
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          List only an employer you have checked, and say what you checked. Every listing, re-check and retirement is recorded in the audit log under your name.
        </p>
      </div>

      <div className="space-y-3">
        <label htmlFor="employer-search" className={labelClass}>Find the organisation</label>
        <div className="flex gap-2">
          <input id="employer-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="At least two letters of its name" className={inputClass} />
          <button type="button" onClick={search} disabled={searching || query.trim().length < 2} className="btn-secondary inline-flex items-center gap-2">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
          </button>
        </div>
        {searchError && <p role="alert" className="text-sm text-red-600">{searchError}</p>}
        {hits && hits.length === 0 && <p className="text-sm text-slate-500">No organisation on ATHENA has that name. It needs an organisation page before it can be listed.</p>}
        {hits && hits.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {hits.map((org) => {
              const existing = org.disabilityFriendlyListings?.[0];
              return (
                <li key={org.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    {org.name}
                    <span className="text-slate-500">{[org.industry, org.city, org.state].filter(Boolean).length ? ` · ${[org.industry, org.city, org.state].filter(Boolean).join(', ')}` : ''}</span>
                  </span>
                  {existing ? (
                    <span className="text-xs text-slate-500">{existing.verifiedAt ? 'Already listed' : 'Retired: relist it below'}</span>
                  ) : (
                    <button type="button" onClick={() => { setChosen(org); setNotice(null); }} className="font-medium text-rose-600 hover:underline dark:text-rose-400">
                      Choose
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {notice && !chosen && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>
        )}
        {chosen && (
          <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-900/10">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Listing {chosen.name}</p>
            <AssessmentForm
              key={chosen.id}
              idPrefix="new-employer"
              initial={blank}
              submitLabel="List this employer"
              onSubmit={async (assessment, basis) => {
                const res = await api.post('/impact/admin/disability-employers', { organizationId: chosen.id, ...assessment, basis });
                setNotice(res.data?.message || 'Listed.');
                setChosen(null);
                setHits(null);
                changed();
                return res.data?.message || 'Listed.';
              }}
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Listings</h3>
        {state === 'loading' ? (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : state === 'failed' ? (
          <p role="alert" className="text-sm text-red-600">
            The listings could not be loaded just now.{' '}
            <button type="button" onClick={() => void load()} className="font-medium underline">Try again</button>
          </p>
        ) : listings.length === 0 ? (
          <p className="text-sm text-slate-500">No employer has been listed yet.</p>
        ) : (
          <ul className="space-y-3">
            {listings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} onChanged={changed} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default StaffDisabilityEmployers;
