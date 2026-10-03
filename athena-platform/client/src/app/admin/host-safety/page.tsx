'use client';

/**
 * Host safety attestations, as staff decide them.
 *
 * An organisation may place apprentices through ATHENA only while it is verified
 * (the badge review under Verification requests) AND holds an approved
 * attestation from here. The attestation is the organisation's own statement
 * about how it keeps an apprentice safe; approving it means a member of staff has
 * read it and done something to be satisfied (looked the ABN up on the register,
 * called the safety contact, asked for the policy) and written that down. The
 * note goes in the audit record under the member of staff, and for a refusal it
 * is the reason the organisation reads.
 *
 * Organisation-level facts only. No individual's police or background check is
 * collected or shown here, and none should be asked for: see
 * docs/security/host-employer-checks.md.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Building2, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { hostSafetyApi, abnLookupUrl, type HostAttestationForReview } from '@/lib/verification-api';
import { cn } from '@/lib/utils';

/** `standing` is every other approval that stands, so one can be found and withdrawn at any point in its year. */
type Queue = { waiting: HostAttestationForReview[]; ending: HostAttestationForReview[]; standing?: HostAttestationForReview[] };

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const nameOf = (u: HostAttestationForReview['attestedBy']) => (u ? u.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : 'Unknown member');
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { dateStyle: 'long' });

/** The statements, in words, for a reviewer. Falls back to the id for a question this build does not know. */
const STATEMENT_LABELS: Record<string, string> = {
  whsPolicy: 'Has a written work health and safety policy that covers apprentices',
  workersCompensation: "Holds workers' compensation insurance that covers apprentices",
  supervision: 'Apprentices work under a named, experienced person',
  induction: 'Safety induction and protective equipment before the first shift',
  incidentReporting: 'Records and reports incidents and injuries, and apprentices know who to tell',
  complaintsRoute: 'A complaints route that does not run through the supervisor, with no penalty for using it',
  youngWorkers: 'Will meet its state obligations for people who work with children and young people',
};

const ABR_TEXT: Record<string, string> = {
  FOUND: 'Found on the register',
  NOT_CONFIGURED: 'The register lookup is not switched on, so the ABN was not looked up automatically. Look it up yourself.',
  UNAVAILABLE: 'The register could not be reached when this was sent. Look it up yourself.',
  NOT_FOUND: 'Not on the register',
};

export default function AdminHostSafetyPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [days, setDays] = useState('365');

  const queue = useQuery({
    queryKey: ['admin-host-safety-queue'],
    queryFn: hostSafetyApi.queue,
    select: (r) => (r.data?.data ?? { waiting: [], ending: [], standing: [] }) as Queue,
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) =>
      hostSafetyApi.decide(id, { decision, note: note.trim(), ...(decision === 'APPROVE' ? { validForDays: Number(days) || 365 } : {}) }),
    onSuccess: (_r, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-host-safety-queue'] });
      setNote('');
      setDays('365');
      setSelectedId(null);
      toast.success(decision === 'APPROVE' ? 'Approved. The organisation owners and admins have been told.' : 'Recorded. The organisation has been told why.');
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not record that'),
  });

  const endingIds = new Set((queue.data?.ending ?? []).map((r) => r.id));
  const rows = [...(queue.data?.waiting ?? []), ...(queue.data?.ending ?? []), ...(queue.data?.standing ?? [])];
  const current = rows.find((r) => r.id === selectedId) ?? null;
  const noteReady = note.trim().length >= 10;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <ShieldCheck className="h-7 w-7 text-primary-600" /> Host safety checks
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Organisations that want to place apprentices send a safety attestation. It is the organisation&rsquo;s own statement: read it, check what you can (the ABN on the register, the safety contact), and write down what you did. An organisation also has to be verified, under Verification requests, before it can place anyone. Do not ask for, or record, anyone&rsquo;s police or background check.
        </p>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-1')}>
        <div>
          {queue.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : queue.isError ? (
            <div className="card p-10 text-center text-slate-500">Could not load the queue.</div>
          ) : rows.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">Nothing is waiting, and no approval stands.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelectedId(r.id)} className={cn('flex min-h-[56px] w-full items-center gap-3 p-4 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-800', selectedId === r.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', r.standing === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
                      {r.standing === 'PENDING' ? (r.renewal ? 'Renewal' : 'Waiting') : endingIds.has(r.id) ? 'Ending' : 'Approved'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{r.organization?.name ?? 'An organisation'}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {r.standing === 'PENDING' && r.attestedAt ? `sent ${formatDistanceToNow(new Date(r.attestedAt), { addSuffix: true })}` : r.expiresAt ? `ends ${longDate(r.expiresAt)}` : ''}
                        {r.organization && !r.organization.isVerified ? ' · not verified yet' : ''}
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
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Building2 className="h-3.5 w-3.5" /> {current.organization?.type ?? 'Organisation'}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.organization?.name}</h2>
              <p className="text-xs text-slate-500">
                {[current.organization?.city, current.organization?.state].filter(Boolean).join(', ')}
                {current.organization?.website ? ` · ${current.organization.website}` : ''}
              </p>
              <p className={cn('mt-2 rounded-md p-2 text-xs', current.organization?.isVerified ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900')}>
                {current.organization?.isVerified ? 'The organisation is verified.' : 'The organisation is not verified yet. Approving this does not make it verified; it also needs the badge review.'}
              </p>
            </div>

            {current.renewal && current.currentApprovalEndsAt && (
              <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                A renewal. The approval that stands ends {longDate(current.currentApprovalEndsAt)}.
              </p>
            )}

            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Sent by</dt>
                <dd className="text-slate-800 dark:text-slate-200">{nameOf(current.attestedBy)}{current.attestedBy ? ` · ${current.attestedBy.email}` : ''}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Safety contact</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {current.safetyContactName}
                  {current.safetyContactEmail ? ` · ${current.safetyContactEmail}` : ''}
                  {current.safetyContactPhone ? ` · ${current.safetyContactPhone}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">ABN</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {current.abn ? (
                    <a href={abnLookupUrl(current.abn)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{current.abn} on ABN Lookup</a>
                  ) : (
                    'None'
                  )}
                  {current.abnCheck && (
                    <span className="mt-1 block text-xs text-slate-500">
                      {ABR_TEXT[current.abnCheck.lookup] ?? current.abnCheck.lookup}
                      {current.abnCheck.lookup === 'FOUND' && ` · ${current.abnCheck.entityName ?? ''} · ${current.abnCheck.abnStatus ?? ''}`}
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-xs text-slate-500">What the organisation says is true</p>
              <ul className="mt-1 space-y-1 text-sm">
                {Object.entries(current.answers ?? {}).map(([id, yes]) => (
                  <li key={id} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <Check className={cn('mt-0.5 h-4 w-4 flex-shrink-0', yes ? 'text-emerald-600' : 'text-slate-300')} aria-label={yes ? 'Yes' : 'No'} />
                    <span>{STATEMENT_LABELS[id] ?? id}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <label htmlFor="host-note" className="block text-xs font-medium text-slate-600 dark:text-slate-300">What you did, or why not (needed for either answer)</label>
              <textarea id="host-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Who you spoke to, what you looked at. A refusal's note is the reason the organisation reads." className="input w-full text-sm" />
              <label htmlFor="host-days" className="block text-xs font-medium text-slate-600 dark:text-slate-300">Stands for (days, at most 730)</label>
              <input id="host-days" type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} className="input w-32 text-sm" />
              <div className="flex flex-wrap gap-2">
                {current.standing === 'PENDING' && (
                  <button type="button" onClick={() => decide.mutate({ id: current.id, decision: 'APPROVE' })} disabled={decide.isPending || !noteReady} className="btn-primary min-h-[44px] text-sm">
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(current.standing === 'APPROVED' ? 'Withdraw this approval? The organisation can no longer open listings or confirm placements, and is told why.' : 'Refuse this attestation? The organisation is told why.')) {
                      decide.mutate({ id: current.id, decision: 'REJECT' });
                    }
                  }}
                  disabled={decide.isPending || !noteReady}
                  className="min-h-[44px] px-3 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {current.standing === 'APPROVED' ? 'Withdraw the approval' : 'Refuse'}
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
