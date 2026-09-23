'use client';

/**
 * The report queue. Every user report lands here; a moderator claims one so
 * two people do not work the same case, reads it beside the other open
 * reports against the same account, and decides: dismiss, warn, remove the
 * content, suspend, ban, or escalate to the authorities. The routes have
 * existed since the moderation work; this is the first screen that reaches
 * them. Open to admins and moderators.
 *
 * Above the reports sits the safety queue, and it sits there deliberately.
 * A member writing about suicide in a wellness forum, or an account whose
 * safety score has fallen into critical territory, raises an AdminFlag — and
 * until this screen read them, nothing on the platform did. Those rows were
 * written and never looked at. They are now the first thing a moderator sees
 * when she opens this page, ahead of every rude comment, and an admin who is
 * told about one is linked straight to #safety-concerns.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ArrowLeft, HeartPulse, Loader2, ShieldAlert, UserCheck, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { cn } from '@/lib/utils';

type Person = { id: string; firstName: string | null; lastName: string | null; displayName: string | null; email: string; isSuspended?: boolean };
type Report = {
  id: string;
  contentType: string;
  contentId: string | null;
  reason: string;
  description: string | null;
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  action: string | null;
  reviewerId: string | null;
  reviewNotes: string | null;
  actionTakenAt: string | null;
  createdAt: string;
  reporter: Person;
  reportedUser: Person;
};
type Related = { id: string; reason: string; status: string; action: string | null; createdAt: string };

/**
 * A safety flag. SAFETY_CONCERN comes from crisis language in a wellness
 * forum post; SAFETY_CRITICAL from a safety score falling below 25. Both are
 * raised HIGH, which is what `isUrgent` reflects — the server sorts on it so
 * one can never be pushed off the page by newer, smaller flags.
 */
type SafetyFlag = {
  id: string;
  type: string;
  severity: string;
  isUrgent: boolean;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  member: Person | null;
  raisedBy: Person | null;
  raisedBySystem: boolean;
};

const FLAG_LABELS: Record<string, string> = {
  SAFETY_CONCERN: 'Crisis language in a wellness post',
  SAFETY_CRITICAL: 'Safety score in critical territory',
};

const ACTIONS: Array<{ value: string; label: string; tone: string; help: string }> = [
  { value: 'dismiss', label: 'Dismiss', tone: 'btn-outline', help: 'Nothing here breaks the guidelines.' },
  { value: 'warn', label: 'Warn', tone: 'btn-outline', help: 'Tell the account what crossed the line; keep the content.' },
  { value: 'remove', label: 'Remove content', tone: 'btn-outline', help: 'Take the content down; the account stays.' },
  { value: 'suspend', label: 'Suspend', tone: 'btn-outline', help: 'Lock the account for now.' },
  { value: 'ban', label: 'Ban', tone: 'btn-outline text-red-600', help: 'Remove the account for good.' },
  { value: 'escalate', label: 'Escalate', tone: 'btn-outline text-amber-700', help: 'Refer to the authorities and lock the case.' },
];

const STATUS_TONE: Record<Report['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  REVIEWING: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  DISMISSED: 'bg-slate-100 text-slate-600',
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

function nameOf(person: Person | null | undefined): string {
  if (!person) return 'Unknown';
  return person.displayName?.trim() || [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || person.email;
}

export default function ModerationQueuePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'open' | Report['status']>('open');
  const [assigned, setAssigned] = useState<'all' | 'me' | 'unclaimed'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [closingFlagId, setClosingFlagId] = useState<string | null>(null);
  const [flagNote, setFlagNote] = useState('');

  const flags = useQuery({
    queryKey: ['admin-safety-flags'],
    queryFn: () => api.get('/safety/moderation/flags', { params: { limit: 50 } }),
    select: (response) => ({
      flags: (Array.isArray(response.data?.flags) ? response.data.flags : []) as SafetyFlag[],
      openCount: Number(response.data?.openCount ?? 0),
      urgentCount: Number(response.data?.urgentCount ?? 0),
    }),
  });

  const closeFlag = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/safety/moderation/flags/${id}/resolve`, note ? { notes: note } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-safety-flags'] });
      setClosingFlagId(null);
      setFlagNote('');
      toast.success('Flag closed');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not close that flag'),
  });

  const queue = useQuery({
    queryKey: ['admin-reports', status, assigned],
    queryFn: () =>
      api.get('/admin/moderation/reports', {
        params: { limit: 50, ...(status !== 'open' ? { status } : {}), ...(assigned !== 'all' ? { assigned } : {}) },
      }),
    select: (response) => ({
      reports: (Array.isArray(response.data?.reports) ? response.data.reports : []) as Report[],
      openCount: Number(response.data?.openCount ?? 0),
    }),
  });

  const detail = useQuery({
    queryKey: ['admin-report', selectedId],
    queryFn: () => api.get(`/admin/moderation/reports/${selectedId}`),
    enabled: Boolean(selectedId),
    select: (response) => ({ report: response.data?.report as Report, related: (response.data?.relatedReports ?? []) as Related[] }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    queryClient.invalidateQueries({ queryKey: ['admin-report', selectedId] });
  };

  const claim = useMutation({
    mutationFn: ({ id, release }: { id: string; release: boolean }) => api.post(`/admin/moderation/reports/${id}/claim`, { release }),
    onSuccess: (_res, { release }) => {
      refresh();
      toast.success(release ? 'Released' : 'Claimed');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not claim that report'),
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/admin/moderation/reports/${id}/action`, { action, notes: notes.trim() || undefined }),
    onSuccess: (_res, { action }) => {
      refresh();
      setNotes('');
      toast.success(`Report ${action === 'dismiss' ? 'dismissed' : 'actioned'}`);
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not action that report'),
  });

  // Open reports still visible in the list even after a filter narrows them.
  const reports = queue.data?.reports.filter((r) => status !== 'open' || r.status === 'PENDING' || r.status === 'REVIEWING') ?? [];
  const current = detail.data?.report;
  const mine = current?.reviewerId === user?.id;
  const claimedByOther = Boolean(current?.reviewerId && !mine);
  const finished = current?.status === 'RESOLVED' || current?.status === 'DISMISSED';

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <ShieldAlert className="h-7 w-7 text-rose-600" /> Report queue
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {queue.data ? `${queue.data.openCount} open` : 'Loading'} · claim a report before you decide it, so nobody works the same case twice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input py-1.5 text-sm" aria-label="Status">
            <option value="open">Open</option>
            <option value="PENDING">Unclaimed</option>
            <option value="REVIEWING">Being reviewed</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
          <select value={assigned} onChange={(e) => setAssigned(e.target.value as typeof assigned)} className="input py-1.5 text-sm" aria-label="Assigned">
            <option value="all">Anyone</option>
            <option value="me">Claimed by me</option>
            <option value="unclaimed">Unclaimed</option>
          </select>
        </div>
      </div>

      {/*
        Above the reports, always, and never collapsed behind a filter. These
        are the rows the platform used to write and never read: somebody
        saying she wants to die, or an account that has fallen off the safety
        scale. If one is open it is the first thing on this page.
      */}
      <section id="safety-concerns" className="mb-8 scroll-mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <HeartPulse className="h-5 w-5 text-rose-600" /> Safety concerns
          </h2>
          {flags.data && flags.data.openCount > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {flags.data.openCount} open{flags.data.urgentCount > 0 ? ` · ${flags.data.urgentCount} urgent` : ''}
            </p>
          )}
        </div>

        {flags.isLoading ? (
          <div className="flex justify-center rounded-xl border border-rose-200 bg-rose-50/50 py-8 dark:border-rose-900/40 dark:bg-rose-950/20">
            <Loader2 className="h-5 w-5 animate-spin text-rose-400" />
          </div>
        ) : flags.isError ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            The safety queue could not be loaded. Do not read that as nothing being there — refresh, and tell an
            administrator if it keeps failing.
          </div>
        ) : flags.data && flags.data.flags.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Nothing open. Crisis language in a wellness forum post, and a safety score falling below 25, both arrive here.
          </div>
        ) : (
          <ul className="space-y-3">
            {(flags.data?.flags ?? []).map((flag) => (
              <li
                key={flag.id}
                className={cn(
                  'rounded-xl border p-4',
                  flag.isUrgent
                    ? 'border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                )}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                      flag.isUrgent ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    {flag.severity}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">{FLAG_LABELS[flag.type] ?? flag.type}</span>
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true })}
                    {flag.raisedBySystem ? ' · raised automatically' : ''}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {flag.member ? (
                    <Link href={`/profile/${flag.member.id}`} className="font-medium hover:underline">
                      {nameOf(flag.member)}
                    </Link>
                  ) : (
                    <span className="font-medium">Account no longer on the platform</span>
                  )}
                  {flag.reason ? ` — ${flag.reason}` : ''}
                </p>
                {flag.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{flag.notes}</p>}

                {closingFlagId === flag.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={flagNote}
                      onChange={(e) => setFlagNote(e.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder="What you did about it (who you contacted, what you found)"
                      aria-label="What you did about this safety concern"
                      className="input w-full text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={closeFlag.isPending}
                        onClick={() => closeFlag.mutate({ id: flag.id, note: flagNote.trim() })}
                        className="btn-primary px-3 py-1.5 text-sm"
                      >
                        Close this flag
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setClosingFlagId(null);
                          setFlagNote('');
                        }}
                        className="text-sm text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setClosingFlagId(flag.id);
                      setFlagNote('');
                    }}
                    className="mt-3 text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                  >
                    I have handled this
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={cn('grid gap-6', selectedId ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-1')}>
        <div>
          {queue.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : queue.isError ? (
            <div className="card p-8 text-center text-slate-500">Could not load the queue. You may not have access.</div>
          ) : reports.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">Nothing waiting.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(report.id)}
                    className={cn('flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === report.id && 'bg-blue-50 dark:bg-blue-900/20')}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">{report.reason}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{report.contentType}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[report.status])}>{report.status.toLowerCase()}</span>
                        {report.reviewerId === user?.id && <span className="text-[11px] text-blue-600">yours</span>}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {nameOf(report.reportedUser)} · reported by {nameOf(report.reporter)} · {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedId && (
          <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6">
            <button type="button" onClick={() => setSelectedId(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            {detail.isLoading || !current ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.contentType} report</p>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.reason}</h2>
                  {current.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{current.description}</p>}
                  {current.contentId && (
                    <p className="mt-1 text-xs text-slate-500">
                      Content: <code>{current.contentId}</code>
                      {current.contentType === 'POST' && (
                        <>
                          {' · '}
                          <Link href={`/posts/${current.contentId}`} target="_blank" className="text-primary-600 hover:underline">
                            open
                          </Link>
                        </>
                      )}
                    </p>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Reported account</dt>
                    <dd>
                      <Link href={`/profile/${current.reportedUser.id}`} className="font-medium text-slate-900 hover:underline dark:text-white">
                        {nameOf(current.reportedUser)}
                      </Link>
                      {current.reportedUser.isSuspended && <span className="ml-1 text-xs text-red-600">suspended</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Reported by</dt>
                    <dd className="text-slate-900 dark:text-white">{nameOf(current.reporter)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Filed</dt>
                    <dd className="text-slate-900 dark:text-white">{new Date(current.createdAt).toLocaleString('en-AU')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Status</dt>
                    <dd>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[current.status])}>{current.status.toLowerCase()}</span>
                    </dd>
                  </div>
                </dl>

                {(detail.data?.related.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Other reports against this account</p>
                    <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
                      {detail.data!.related.map((r) => (
                        <li key={r.id}>
                          {r.reason} · {r.status.toLowerCase()}
                          {r.action ? ` · ${r.action}` : ''} · {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {finished ? (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Decided: <strong>{current.action ?? current.status.toLowerCase()}</strong>
                    {current.reviewNotes && <span className="block mt-1 whitespace-pre-wrap">{current.reviewNotes}</span>}
                  </div>
                ) : claimedByOther ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Another moderator has claimed this report.</p>
                ) : !mine ? (
                  <button type="button" onClick={() => claim.mutate({ id: current.id, release: false })} disabled={claim.isPending} className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2">
                    <UserCheck className="h-4 w-4" /> Claim this report
                  </button>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Notes for the record (what you saw, why you decided this)"
                      aria-label="Decision notes"
                      className="input w-full text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {ACTIONS.map((a) => (
                        <button
                          key={a.value}
                          type="button"
                          title={a.help}
                          disabled={decide.isPending}
                          onClick={() => {
                            if (['ban', 'suspend', 'escalate'].includes(a.value) && !window.confirm(`${a.label}: ${a.help} Continue?`)) return;
                            decide.mutate({ id: current.id, action: a.value });
                          }}
                          className={cn('px-3 py-2 text-sm', a.tone)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => claim.mutate({ id: current.id, release: true })} disabled={claim.isPending} className="w-full text-center text-xs text-slate-500 hover:underline">
                      Release this report
                    </button>
                  </div>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
