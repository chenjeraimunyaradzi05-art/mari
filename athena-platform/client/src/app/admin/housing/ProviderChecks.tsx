'use client';

/**
 * The provider checks: who ATHENA has looked at as a provider of DV-safe,
 * emergency and transitional places.
 *
 * A place can be marked "Checked by ATHENA staff" only while its lister holds an
 * approved, unexpired check from here, so the badge rests on a person staff have
 * looked at as well as a place. A member asks to be checked; staff read what
 * they said, write down what they did to be satisfied (the ABN looked up on the
 * business register, a reference called, an agreement on file, an identity
 * sighted), and approve it for up to two years or refuse it with a reason the
 * member can read. Either answer is in the audit log under the member of staff.
 * A check about to end shows here first, so it is renewed before places come
 * down.
 *
 * No police or background check is run or recorded. Those are sensitive
 * information under the Privacy Act 1988 and need consent, a collection notice
 * and a lawful basis that are not built; nothing here claims them.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, UserCheck, X } from 'lucide-react';
import { housingApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Member = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string;
  womanVerificationStatus: string;
  createdAt: string;
};

type ProviderRow = {
  id: string;
  userId: string;
  providerName: string;
  relationship: string;
  relationshipLabel: string;
  abn: string | null;
  statement: string | null;
  standing: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  basis: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  submittedAt: string;
  renewalRequested: boolean;
  user: Member | null;
};

/** `standing` is every other approved check, so one can be found and withdrawn at any point in its year. */
type Queue = { waiting: ProviderRow[]; ending: ProviderRow[]; standing?: ProviderRow[] };

const CHECKS = [
  ['abnChecked', 'I looked the ABN up on the business register'],
  ['referencesCalled', 'I spoke to a reference'],
  ['partnerAgreementOnFile', 'There is an agreement with a housing service on file'],
  ['identitySighted', 'I confirmed who this person is'],
] as const;
type CheckKey = (typeof CHECKS)[number][0];

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const nameOf = (u: Member | null) => (u ? u.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : 'Unknown member');
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { dateStyle: 'long' });

export function ProviderChecks() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [basis, setBasis] = useState('');
  const [days, setDays] = useState('365');
  const [checks, setChecks] = useState<Partial<Record<CheckKey, boolean>>>({});

  const queue = useQuery({
    queryKey: ['admin-housing-provider-checks'],
    queryFn: housingApi.getProviderChecks,
    select: (r) => (r.data?.data ?? { waiting: [], ending: [], standing: [] }) as Queue,
  });

  const decide = useMutation({
    mutationFn: ({ row, decision }: { row: ProviderRow; decision: 'APPROVE' | 'REJECT' }) =>
      housingApi.decideProviderCheck(row.userId, {
        decision,
        basis: basis.trim(),
        ...(decision === 'APPROVE' ? { validForDays: Number(days) || 365, checks: Object.fromEntries(Object.entries(checks).filter(([, v]) => v)) } : {}),
      }),
    onSuccess: (_r, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-housing-provider-checks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-housing-pending'] });
      setBasis('');
      setChecks({});
      setDays('365');
      setSelectedId(null);
      toast.success(decision === 'APPROVE' ? 'Approved. Their places can now show as checked. They have been told.' : 'Recorded. Any places that showed as checked are off the list, and they have been told why.');
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not record that'),
  });

  const endingIds = new Set((queue.data?.ending ?? []).map((r) => r.id));
  const rows = [...(queue.data?.waiting ?? []), ...(queue.data?.ending ?? []), ...(queue.data?.standing ?? [])];
  const current = rows.find((r) => r.id === selectedId) ?? null;
  // A check that stands, is not about to end and has not been asked to renew has nothing to approve: approving it would only move its end date. It can be withdrawn.
  const mayApprove = current ? current.standing !== 'APPROVED' || current.renewalRequested || endingIds.has(current.id) : false;
  const basisReady = basis.trim().length >= 10;

  return (
    <section id="provider-checks" aria-labelledby="provider-checks-heading" className="mt-12 scroll-mt-6">
      <h2 id="provider-checks-heading" className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
        <UserCheck className="h-6 w-6 text-primary-600" /> Provider checks
      </h2>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        A place can show as checked only while the person offering it holds an approved provider check. Write down what you did to be satisfied. Nobody can decide their own check.
      </p>

      <div className={cn('mt-4 grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1')}>
        <div>
          {queue.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : queue.isError ? (
            <div className="card p-8 text-center text-slate-500">Could not load the provider checks.</div>
          ) : rows.length === 0 ? (
            <div className="card p-8 text-center text-slate-500">No provider checks are waiting, and none stand.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelectedId(r.id)} className={cn('flex min-h-[56px] w-full items-center gap-3 p-4 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-800', selectedId === r.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', r.standing === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
                      {r.standing === 'PENDING' ? 'Waiting' : endingIds.has(r.id) ? 'Ending' : 'Approved'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{r.providerName}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {nameOf(r.user)} · {r.relationshipLabel} ·{' '}
                        {r.standing === 'PENDING' ? `asked ${formatDistanceToNow(new Date(r.submittedAt), { addSuffix: true })}` : r.expiresAt ? `ends ${longDate(r.expiresAt)}` : ''}
                        {r.renewalRequested ? ' · asked for a renewal' : ''}
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
            <button type="button" onClick={() => setSelectedId(null)} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.relationshipLabel}</p>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{current.providerName}</h3>
              <p className="text-xs text-slate-500">
                {current.user ? (
                  <>
                    <Link href={`/profile/${current.user.id}`} className="text-primary-600 hover:underline">{nameOf(current.user)}</Link> · {current.user.email} · woman verification{' '}
                    {current.user.womanVerificationStatus.toLowerCase()} · member since {new Date(current.user.createdAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                  </>
                ) : (
                  'Unknown member'
                )}
              </p>
            </div>

            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">What they said about the places they list</dt>
                <dd className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{current.statement || 'Nothing was written.'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">ABN</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {current.abn ? (
                    <a href={`https://abr.business.gov.au/ABN/View?abn=${encodeURIComponent(current.abn.replace(/\s+/g, ''))}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      {current.abn} on ABN Lookup
                    </a>
                  ) : (
                    'None given'
                  )}
                </dd>
              </div>
              {current.standing !== 'PENDING' && current.reviewedAt && (
                <div>
                  <dt className="text-xs text-slate-500">Approved {longDate(current.reviewedAt)}</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{current.basis}</dd>
                </div>
              )}
            </dl>

            <fieldset className="space-y-1 text-sm">
              <legend className="text-xs font-medium text-slate-600 dark:text-slate-300">What you checked (tick what applies)</legend>
              {CHECKS.map(([key, label]) => (
                <label key={key} className="flex min-h-[44px] items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={Boolean(checks[key])} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} className="h-4 w-4 rounded border-slate-300" /> {label}
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="provider-basis" className="block text-xs font-medium text-slate-600 dark:text-slate-300">What you did, in a sentence or two (needed for either answer)</label>
              <textarea id="provider-basis" value={basis} onChange={(e) => setBasis(e.target.value)} rows={3} maxLength={1000} placeholder="Who you spoke to and what you looked at. If you are refusing, say why: the member reads this." className="input w-full text-sm" />
              <label htmlFor="provider-days" className="block text-xs font-medium text-slate-600 dark:text-slate-300">Stands for (days, at most 730)</label>
              <input id="provider-days" type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} className="input w-32 text-sm" />
              <div className="flex flex-wrap gap-2">
                {mayApprove && (
                  <button type="button" onClick={() => decide.mutate({ row: current, decision: 'APPROVE' })} disabled={decide.isPending || !basisReady} className="btn-primary min-h-[44px] text-sm">
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Refuse this check? Any places that showed as checked come off the list, and they are told why.')) decide.mutate({ row: current, decision: 'REJECT' });
                  }}
                  disabled={decide.isPending || !basisReady}
                  className="min-h-[44px] px-3 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {current.standing === 'APPROVED' ? 'Withdraw the check' : 'Refuse'}
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
