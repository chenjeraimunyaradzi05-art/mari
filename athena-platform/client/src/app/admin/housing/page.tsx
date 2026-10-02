'use client';

/**
 * The safety check on housing. A listing that asks to be shown as DV-safe, and
 * every emergency or transitional listing, is held here until a person has
 * looked at it. Approving it marks it "Checked by ATHENA staff" and puts it live;
 * a DV-safe claim can instead be shown as an ordinary listing, and any of them
 * can be taken down. The lister is told in the app whichever way it goes.
 *
 * Approving takes two things, and the server refuses without either: a note of
 * what you checked, which goes into the audit record with your name, and a
 * provider check on whoever listed the place that is approved and has not run
 * out (the Provider checks list below). The note is not shown to the lister.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, ShieldCheck, X } from 'lucide-react';
import { housingApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ProviderChecks } from './ProviderChecks';

type Lister = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string;
  womanVerificationStatus: string;
  createdAt: string;
};

type Listing = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  /** The lister's claim. An emergency or transitional place may not make it. */
  dvSafe: boolean;
  address: string | null;
  suburb: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  rentWeekly: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  features: string[];
  dvSafeNote: string | null;
  images: unknown;
  createdAt: string;
  lister: Lister | null;
  /** Whether whoever listed the place holds a provider check that is approved and has not run out. */
  providerCheck?: { standing: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'; expiresAt: string | null };
};

const PROVIDER_STANDING_TEXT: Record<string, string> = {
  APPROVED: 'Provider check approved',
  PENDING: 'Provider check waiting for a decision',
  REJECTED: 'Provider check was refused',
  EXPIRED: 'Provider check has ended',
  NONE: 'No provider check yet',
};

/** An emergency or transitional place is confidential whether or not it claims to be DV-safe. */
const confidentialByType = (l: Pick<Listing, 'type'>) => l.type === 'EMERGENCY' || l.type === 'TRANSITIONAL';

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const nameOf = (u: Lister | null) => (u ? u.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : 'Unknown member');
const place = (l: Listing) => [l.address, l.suburb, l.city, l.state, l.postcode].filter(Boolean).join(', ') || 'No location given';
const photos = (value: unknown): string[] => (Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string') : []);

type Outcome = 'APPROVE' | 'ORDINARY' | 'TAKE_DOWN';

const OUTCOMES: Array<{ value: Outcome; label: string; body: { safetyVerified?: boolean; dvSafe?: boolean; status: string }; toast: string }> = [
  { value: 'APPROVE', label: 'Approve as DV-safe', body: { safetyVerified: true, dvSafe: true, status: 'ACTIVE' }, toast: 'Live as DV-safe, marked as checked. The lister has been told.' },
  { value: 'ORDINARY', label: 'Show as an ordinary listing', body: { dvSafe: false, status: 'ACTIVE' }, toast: 'Live as an ordinary listing. The lister has been told.' },
  { value: 'TAKE_DOWN', label: 'Take it down', body: { status: 'WITHDRAWN' }, toast: 'Taken down. The lister has been told.' },
];

export default function AdminHousingPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  // What the member of staff checked. Needed to approve; kept in the audit record.
  const [checkNote, setCheckNote] = useState('');

  const list = useQuery({
    queryKey: ['admin-housing-pending'],
    queryFn: housingApi.getPendingSafetyChecks,
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Listing[]) : []),
  });

  const decide = useMutation({
    mutationFn: ({ id, outcome, confidentialType, dvSafeClaim }: { id: string; outcome: Outcome; confidentialType: boolean; dvSafeClaim: boolean }) => {
      const chosen = OUTCOMES.find((o) => o.value === outcome)!;
      // An emergency or transitional place that does not claim DV-safe is
      // approved as itself: it is not told it is DV-safe, and the claim is not
      // added to it.
      const body = outcome === 'APPROVE' && confidentialType && !dvSafeClaim ? { safetyVerified: true, status: 'ACTIVE' } : chosen.body;
      return housingApi.adminUpdateListing(id, {
        ...body,
        ...(outcome === 'APPROVE' ? { checkNote: checkNote.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    },
    onSuccess: (_r, { outcome }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-housing-pending'] });
      setNote('');
      setCheckNote('');
      setSelectedId(null);
      toast.success(OUTCOMES.find((o) => o.value === outcome)!.toast);
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not record that'),
  });

  const current = list.data?.find((l) => l.id === selectedId) ?? null;
  const providerStanding = current?.providerCheck?.standing ?? 'NONE';
  const checkNoteReady = checkNote.trim().length >= 10;
  const canApprove = checkNoteReady && providerStanding === 'APPROVED';

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <ShieldCheck className="h-7 w-7 text-primary-600" /> Safe housing checks
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Listings that ask to be shown as DV-safe, and every emergency or transitional listing, wait here, off the list, until a person has looked. A woman leaving violence trusts the badge, so speak to the lister before you approve, and write down what you checked.
        </p>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1')}>
        <div>
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : list.isError ? (
            <div className="card p-10 text-center text-slate-500">Could not load the queue.</div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <div className="card p-10 text-center text-slate-500">Nothing waiting for a check.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {list.data!.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setSelectedId(l.id)} className={cn('flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === l.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{l.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{l.title}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {[l.suburb, l.city, l.state].filter(Boolean).join(', ') || 'No location given'} · {nameOf(l.lister)} · asked {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {current && (
          <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6">
            <button type="button" onClick={() => setSelectedId(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.type} · {current.status.toLowerCase()}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.title}</h2>
              <p className="text-xs text-slate-500">{place(current)}</p>
            </div>

            <div className="rounded-lg bg-purple-50 p-3 text-sm dark:bg-purple-900/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-800 dark:text-purple-200">Why the lister says it is safe</p>
              <p className="mt-1 whitespace-pre-wrap text-purple-900 dark:text-purple-100">{current.dvSafeNote || 'No note was given.'}</p>
            </div>

            <p
              className={cn(
                'rounded-lg p-3 text-sm',
                providerStanding === 'APPROVED' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100'
              )}
            >
              {PROVIDER_STANDING_TEXT[providerStanding]}
              {providerStanding === 'APPROVED' && current.providerCheck?.expiresAt ? `, until ${new Date(current.providerCheck.expiresAt).toLocaleDateString('en-AU', { dateStyle: 'long' })}` : ''}.
              {providerStanding !== 'APPROVED' && (
                <>
                  {' '}A place cannot be marked checked until this is approved. <a href="#provider-checks" className="font-semibold underline">Go to Provider checks</a>.
                </>
              )}
            </p>

            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Listed by</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {current.lister ? (
                    <>
                      <Link href={`/profile/${current.lister.id}`} className="text-primary-600 hover:underline">{nameOf(current.lister)}</Link>
                      <span className="block text-xs text-slate-500">
                        {current.lister.email} · woman verification {current.lister.womanVerificationStatus.toLowerCase()} · member since {new Date(current.lister.createdAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  ) : (
                    'Unknown member'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">The place</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {current.bedrooms ?? '?'} bed · {current.bathrooms ?? '?'} bath{current.rentWeekly ? ` · $${Number(current.rentWeekly)}/wk` : ''}
                  {current.features.length > 0 && <span className="block text-xs text-slate-500">{current.features.join(', ')}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Description</dt>
                <dd className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{current.description}</dd>
              </div>
              {photos(current.images).length > 0 && (
                <div>
                  <dt className="text-xs text-slate-500">Photos</dt>
                  <dd className="text-xs">
                    {photos(current.images).map((p, i) => (
                      <a key={p} href={p} target="_blank" rel="noopener noreferrer" className="mr-2 text-primary-600 hover:underline">
                        Photo {i + 1}
                      </a>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Before approving</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Speak to the lister and confirm the place exists at that address.</li>
                <li>Confirm who else lives there and who else knows the address.</li>
                <li>Confirm she understands the address goes only to a woman she has answered, and that she will see an alias, not a name.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label htmlFor="housing-check-basis" className="block text-xs font-medium text-slate-600 dark:text-slate-300">What you checked (needed to approve)</label>
              <textarea
                id="housing-check-basis"
                value={checkNote}
                onChange={(e) => setCheckNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Who you spoke to, and how you know the place is safe"
                aria-describedby="housing-check-basis-help"
                className="input w-full text-sm"
              />
              <p id="housing-check-basis-help" className="text-xs text-slate-500">Kept in the audit record with your name. It is not shown to the lister.</p>
              <label htmlFor="housing-check-note" className="block text-xs font-medium text-slate-600 dark:text-slate-300">A line for the lister (optional)</label>
              <textarea id="housing-check-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="What they should know about the outcome" className="input w-full text-sm" />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => decide.mutate({ id: current.id, outcome: 'APPROVE', confidentialType: confidentialByType(current), dvSafeClaim: current.dvSafe })}
                  disabled={decide.isPending || !canApprove}
                  className="btn-primary min-h-[44px] text-sm"
                >
                  {current.dvSafe ? 'Approve as DV-safe' : 'Approve as checked'}
                </button>
                {/* An emergency or transitional place has no ordinary version of itself. */}
                {!confidentialByType(current) && (
                  <button type="button" onClick={() => decide.mutate({ id: current.id, outcome: 'ORDINARY', confidentialType: false, dvSafeClaim: true })} disabled={decide.isPending} className="btn-secondary min-h-[44px] text-sm">
                    Show as ordinary listing
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Take this listing down? The lister is told.')) decide.mutate({ id: current.id, outcome: 'TAKE_DOWN', confidentialType: confidentialByType(current), dvSafeClaim: true });
                  }}
                  disabled={decide.isPending}
                  className="min-h-[44px] px-3 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Take it down
                </button>
              </div>
              {!canApprove && (
                <p className="text-xs text-slate-500">
                  To approve: {providerStanding !== 'APPROVED' ? 'the lister needs an approved provider check' : ''}
                  {providerStanding !== 'APPROVED' && !checkNoteReady ? ', and ' : ''}
                  {!checkNoteReady ? 'say what you checked (at least a sentence)' : ''}.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      <ProviderChecks />
    </div>
  );
}
