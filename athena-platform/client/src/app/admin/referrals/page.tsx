'use client';

/**
 * Authority referrals. A report of child abuse material or violent extremism
 * queues a referral here the moment it is filed, and a person has to take it
 * from here to the Australian Federal Police: nothing is sent automatically.
 *
 * The queue existed only as an API. The operations screen showed how many
 * referrals were waiting and linked to the report queue, which does not list
 * them, so the legal filing duty behind every row had no screen to be done
 * from. This is that screen. Filing a referral means recording the reference
 * the authority gave it; closing one means recording what became of it. Both
 * are written against the person who did them.
 *
 * The reported material itself is never shown here. The referral carries the
 * reference to it, and for child abuse material above all, a console that
 * displayed the content would be the platform passing it around again.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ArrowLeft, FileWarning, Loader2, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type EscalationStatus = 'reported' | 'acknowledged' | 'resolved';

type ReferralOrigin = {
  source: 'named' | 'anonymous';
  id: string;
  status: string;
  action: string | null;
  reviewerId: string | null;
  reportedUserId: string | null;
  description: string | null;
  createdAt: string;
};

type Escalation = {
  id: string;
  ticketId: string;
  reason: string;
  contentType: string;
  contentId: string;
  escalatedAt: string;
  reportedTo: string;
  referenceNumber: string | null;
  status: EscalationStatus;
  ageHours: number;
  report: ReferralOrigin | null;
};

type HistoryEntry = {
  id: string;
  action: string;
  moderatorId: string;
  moderatorName: string | null;
  notes: string | null;
  timestamp: string;
};

type EscalationDetail = Omit<Escalation, 'ageHours'> & { history: HistoryEntry[] };

type QueueResponse = {
  escalations: Escalation[];
  summary: { total: number; reported: number; acknowledged: number; resolved: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type Filter = EscalationStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'reported', label: 'Waiting to be filed' },
  { value: 'acknowledged', label: 'Filed, awaiting outcome' },
  { value: 'resolved', label: 'Closed' },
  { value: 'all', label: 'All' },
];

const STATUS_LABEL: Record<EscalationStatus, string> = {
  reported: 'Waiting to be filed',
  acknowledged: 'Filed',
  resolved: 'Closed',
};

const STATUS_TONE: Record<EscalationStatus, string> = {
  reported: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  acknowledged: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  resolved: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const REASON_LABEL: Record<string, string> = {
  csam: 'Child abuse material',
  terrorism: 'Violent extremism',
};

/**
 * The platform's illegal-content clock is 24 hours, and the Criminal Code asks
 * for referral "within a reasonable time". A referral still unfiled after a
 * day is past the platform's own clock, and is shown that way.
 */
const FILING_ATTENTION_HOURS = 24;

const HISTORY_LABEL: Record<string, string> = {
  escalation_reported: 'Noted, still waiting to be filed',
  escalation_acknowledged: 'Filed with the authority',
  escalation_resolved: 'Closed',
};

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error;

const reasonLabel = (reason: string) => REASON_LABEL[reason.toLowerCase()] ?? reason;

export default function AuthorityReferralsPage() {
  const [filter, setFilter] = useState<Filter>('reported');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queue = useQuery({
    queryKey: ['admin-referrals', filter, page],
    queryFn: async () => {
      const response = await api.get('/admin/moderation/escalations', {
        params: { page, limit: 25, ...(filter === 'all' ? {} : { status: filter }) },
      });
      return response.data as QueueResponse;
    },
  });

  const summary = queue.data?.summary;
  const rows = queue.data?.escalations ?? [];
  const totalPages = queue.data?.pagination.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <FileWarning className="h-7 w-7 text-red-600" /> Authority referrals
        </h1>
        <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-400">
          Reports of child abuse material and violent extremism wait here to be referred to the Australian Federal Police.
          Nothing is sent to them automatically: file each one through the authority&apos;s own reporting channel, then record the
          reference they give you so the referral can be followed to its end.
        </p>
      </div>

      {summary && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Waiting to be filed', value: summary.reported, tone: summary.reported > 0 ? 'text-red-700 dark:text-red-300' : '' },
            { label: 'Filed, awaiting outcome', value: summary.acknowledged, tone: '' },
            { label: 'Closed', value: summary.resolved, tone: '' },
          ].map((tile) => (
            <div key={tile.label} className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{tile.label}</p>
              <p className={cn('text-2xl font-bold text-slate-900 dark:text-white', tile.tone)}>{tile.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Which referrals">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => {
              setFilter(option.value);
              setPage(1);
              setSelectedId(null);
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm',
              filter === option.value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={cn('grid gap-6', selectedId ? 'lg:grid-cols-[minmax(0,1fr)_460px]' : 'grid-cols-1')}>
        <div>
          {queue.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading referrals" />
            </div>
          ) : queue.isError ? (
            <div className="card flex flex-col items-start gap-3 border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-900/20" role="alert">
              <p className="font-medium text-red-800 dark:text-red-200">The referral queue could not be loaded.</p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {errorMessage(queue.error) ?? 'The server did not answer.'} Until it loads, do not assume there is nothing waiting.
              </p>
              <button type="button" onClick={() => queue.refetch()} className="btn-outline inline-flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">
              {filter === 'reported' ? 'No referral is waiting to be filed.' : 'No referrals here.'}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
                {rows.map((row) => {
                  const late = row.status === 'reported' && row.ageHours >= FILING_ATTENTION_HOURS;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          'flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800',
                          selectedId === row.id && 'bg-red-50 dark:bg-red-900/10'
                        )}
                      >
                        <AlertTriangle className={cn('mt-0.5 h-4 w-4 flex-shrink-0', late ? 'text-red-600' : 'text-amber-500')} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium text-slate-900 dark:text-white">{reasonLabel(row.reason)}</span>
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[row.status])}>
                              {STATUS_LABEL[row.status]}
                            </span>
                            <code className="text-xs text-slate-500">{row.ticketId}</code>
                          </span>
                          <span className="block text-xs text-slate-500">
                            To {row.reportedTo} · queued {formatDistanceToNow(new Date(row.escalatedAt), { addSuffix: true })}
                            {row.referenceNumber ? ` · their reference ${row.referenceNumber}` : ''}
                            {late && <span className="text-red-700 dark:text-red-300"> · waiting more than a day</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button type="button" className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <span className="text-slate-500">
                    Page {page} of {totalPages}
                  </span>
                  <button type="button" className="btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {selectedId && <ReferralPanel key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

/**
 * One referral: what it is about, where it came from, what has been done, and
 * the one next step its status allows. Keyed by id from the parent, so the
 * forms start empty for each referral.
 */
function ReferralPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const detail = useQuery({
    queryKey: ['admin-referral', id],
    queryFn: async () => (await api.get(`/admin/moderation/escalations/${id}`)).data as EscalationDetail,
  });

  const advance = useMutation({
    mutationFn: (body: { status: EscalationStatus; referenceNumber?: string; notes?: string }) =>
      api.patch(`/admin/moderation/escalations/${id}`, body),
    onSuccess: (_response, body) => {
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-referral', id] });
      setReferenceNumber('');
      setNotes('');
      toast.success(body.status === 'acknowledged' ? 'Filing recorded.' : 'Referral closed.');
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That was not recorded. Nothing has changed.'),
  });

  const field = (name: string) => `referral-${name}-${id}`;

  return (
    <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6" aria-label="Referral">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
        <X className="h-5 w-5" />
      </button>

      {detail.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading referral" />
        </div>
      ) : detail.isError || !detail.data ? (
        <div className="space-y-3 pr-8" role="alert">
          <p className="font-medium text-red-800 dark:text-red-200">This referral could not be loaded.</p>
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage(detail.error) ?? 'The server did not answer.'}</p>
          <button type="button" onClick={() => detail.refetch()} className="btn-outline inline-flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : (
        <ReferralBody
          referral={detail.data}
          pending={advance.isPending}
          referenceNumber={referenceNumber}
          setReferenceNumber={setReferenceNumber}
          notes={notes}
          setNotes={setNotes}
          field={field}
          onFile={() =>
            advance.mutate({
              status: 'acknowledged',
              referenceNumber: referenceNumber.trim(),
              ...(notes.trim() ? { notes: notes.trim() } : {}),
            })
          }
          onClose={() => {
            if (window.confirm('Close this referral? A closed referral cannot be reopened.')) {
              advance.mutate({ status: 'resolved', notes: notes.trim() });
            }
          }}
        />
      )}
    </aside>
  );
}

function ReferralBody({
  referral,
  pending,
  referenceNumber,
  setReferenceNumber,
  notes,
  setNotes,
  field,
  onFile,
  onClose,
}: {
  referral: EscalationDetail;
  pending: boolean;
  referenceNumber: string;
  setReferenceNumber: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  field: (name: string) => string;
  onFile: () => void;
  onClose: () => void;
}) {
  const origin = referral.report;

  return (
    <>
      <div className="pr-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{reasonLabel(referral.reason)}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          To be referred to <span className="font-medium">{referral.reportedTo}</span>.
        </p>
      </div>

      <dl className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Our reference</dt>
          <dd className="font-mono text-slate-800 dark:text-slate-200">{referral.ticketId}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">The content</dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {referral.contentType.toLowerCase()} <code className="text-xs">{referral.contentId}</code>
            <span className="mt-1 block text-xs text-slate-500">
              Give the authority this reference. It is not shown here, and it should not be opened, copied or downloaded.
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Queued</dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {new Date(referral.escalatedAt).toLocaleString('en-AU')} ({formatDistanceToNow(new Date(referral.escalatedAt), { addSuffix: true })})
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {STATUS_LABEL[referral.status]}
            {referral.referenceNumber ? ` · their reference ${referral.referenceNumber}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">The report behind it</dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {origin ? (
              <>
                {origin.source === 'anonymous' ? 'Filed without an account' : 'Filed by a member'}, {origin.status.toLowerCase()}
                {origin.action ? ` · ${origin.action.toLowerCase().replace(/_/g, ' ')}` : ''}
                {origin.description && <span className="mt-1 block whitespace-pre-wrap text-xs text-slate-500">&ldquo;{origin.description}&rdquo;</span>}
                <Link href="/admin/moderation" className="mt-1 block text-xs text-primary-600 hover:underline">
                  Decide the report itself in the report queue
                </Link>
              </>
            ) : (
              'No report carries this reference any more. The referral stands on its own.'
            )}
          </dd>
        </div>
      </dl>

      {referral.history.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What has been done</p>
          <ol className="mt-2 space-y-2 text-sm">
            {referral.history.map((entry) => (
              <li key={entry.id} className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                <span className="font-medium text-slate-800 dark:text-slate-200">{HISTORY_LABEL[entry.action] ?? entry.action.replace(/_/g, ' ')}</span>
                <span className="block text-xs text-slate-500">
                  {entry.moderatorName ?? 'A staff account that no longer exists'} · {new Date(entry.timestamp).toLocaleString('en-AU')}
                </span>
                {entry.notes && <span className="block whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{entry.notes}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {referral.status === 'reported' && (
        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Record the filing</p>
          <p className="text-xs text-slate-500">
            Once you have filed it with {referral.reportedTo}, record the reference they gave you. A referral counts as filed only with that reference.
          </p>
          <label htmlFor={field('reference')} className="block text-xs text-slate-500">
            Their reference number
          </label>
          <input
            id={field('reference')}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="input w-full text-sm"
            autoComplete="off"
          />
          <label htmlFor={field('notes')} className="block text-xs text-slate-500">
            Notes (how and when it was filed)
          </label>
          <textarea id={field('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input w-full text-sm" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onFile} disabled={pending || !referenceNumber.trim()} className="btn-primary text-sm">
              {pending ? 'Recording…' : 'Record the filing'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending || !notes.trim()}
              className="btn-outline text-sm"
              title="Closing without filing needs a note saying why"
            >
              Close without filing
            </button>
          </div>
          <p className="text-xs text-slate-500">Closing without filing needs a note saying why, for example that the authority already holds it.</p>
        </div>
      )}

      {referral.status === 'acknowledged' && (
        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Record the outcome</p>
          <label htmlFor={field('outcome')} className="block text-xs text-slate-500">
            What the authority did, or told you
          </label>
          <textarea id={field('outcome')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input w-full text-sm" />
          <button type="button" onClick={onClose} disabled={pending || !notes.trim()} className="btn-primary text-sm">
            {pending ? 'Recording…' : 'Close the referral'}
          </button>
        </div>
      )}

      {referral.status === 'resolved' && <p className="border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800">This referral is closed.</p>}
    </>
  );
}
