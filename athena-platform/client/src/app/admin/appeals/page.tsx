'use client';

/**
 * Appeals against moderation decisions. A member who was suspended, had
 * content removed or was refused verification can appeal; here a moderator
 * or admin takes it under review and upholds or rejects it, with a note the
 * member sees. Upholding a moderation or suspension appeal reverses the
 * enforcement on the server. The routes existed; the screen did not.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Scale, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Appeal = {
  id: string;
  type: 'CONTENT_MODERATION' | 'ACCOUNT_SUSPENSION' | 'VERIFICATION_DECISION' | 'OTHER';
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  reason: string;
  metadata?: Record<string, unknown> | null;
  decisionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
};

const TYPE_LABEL: Record<Appeal['type'], string> = {
  CONTENT_MODERATION: 'Content removed',
  ACCOUNT_SUSPENSION: 'Account suspended',
  VERIFICATION_DECISION: 'Verification refused',
  OTHER: 'Other',
};
const STATUS_TONE: Record<Appeal['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-700',
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

function nameOf(a: Appeal): string {
  return [a.user.firstName, a.user.lastName].filter(Boolean).join(' ').trim() || a.user.email;
}

export default function AppealsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | Appeal['status']>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const appeals = useQuery({
    queryKey: ['admin-appeals', status],
    queryFn: () => api.get('/appeals', { params: status === 'all' ? {} : { status } }),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Appeal[]) : []),
  });

  const decide = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' }) =>
      api.patch(`/appeals/${id}`, { status: next, ...(note.trim() ? { decisionNote: note.trim() } : {}) }),
    onSuccess: (response, { next }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-appeals'] });
      setNote('');
      const reversal = response.data?.reversal;
      toast.success(
        next === 'APPROVED'
          ? reversal
            ? 'Appeal upheld and the enforcement reversed'
            : 'Appeal upheld'
          : next === 'REJECTED'
            ? 'Appeal rejected'
            : 'Taken under review'
      );
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not update the appeal'),
  });

  const current = appeals.data?.find((a) => a.id === selectedId) ?? null;
  const decided = current?.status === 'APPROVED' || current?.status === 'REJECTED';

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Scale className="h-7 w-7 text-indigo-600" /> Appeals
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Upholding an appeal reverses what was done to the account. The note you write is shown to the member.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input py-1.5 text-sm" aria-label="Status">
          <option value="PENDING">Waiting</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="APPROVED">Upheld</option>
          <option value="REJECTED">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className={cn('grid gap-6', selectedId ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1')}>
        <div>
          {appeals.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : appeals.isError ? (
            <div className="card p-8 text-center text-slate-500">Could not load appeals. You may not have access.</div>
          ) : (appeals.data?.length ?? 0) === 0 ? (
            <div className="card p-10 text-center text-slate-500">Nothing here.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {appeals.data!.map((appeal) => (
                <li key={appeal.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(appeal.id)}
                    className={cn('flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === appeal.id && 'bg-indigo-50 dark:bg-indigo-900/20')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">{TYPE_LABEL[appeal.type]}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[appeal.status])}>{appeal.status.replace('_', ' ').toLowerCase()}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {nameOf(appeal)} · {formatDistanceToNow(new Date(appeal.createdAt), { addSuffix: true })}
                      </span>
                      <span className="mt-1 block truncate text-sm text-slate-600 dark:text-slate-300">{appeal.reason}</span>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{TYPE_LABEL[current.type]}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                <Link href={`/profile/${current.user.id}`} className="hover:underline">
                  {nameOf(current)}
                </Link>
              </h2>
              <p className="text-xs text-slate-500">
                {current.user.email} · appealed {formatDistanceToNow(new Date(current.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Their reason</p>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{current.reason}</p>
            </div>
            {current.metadata && Object.keys(current.metadata).length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">About</p>
                <dl className="text-xs text-slate-600 dark:text-slate-300">
                  {Object.entries(current.metadata).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-slate-500">{key}</dt>
                      <dd className="truncate">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {decided ? (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <strong>{current.status === 'APPROVED' ? 'Upheld' : 'Rejected'}</strong>
                {current.reviewedAt && ` · ${formatDistanceToNow(new Date(current.reviewedAt), { addSuffix: true })}`}
                {current.decisionNote && <span className="mt-1 block whitespace-pre-wrap">{current.decisionNote}</span>}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Decision note the member will read"
                  aria-label="Decision note"
                  className="input w-full text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {current.status === 'PENDING' && (
                    <button type="button" onClick={() => decide.mutate({ id: current.id, next: 'UNDER_REVIEW' })} disabled={decide.isPending} className="btn-outline px-3 py-2 text-sm">
                      Take under review
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Uphold this appeal? Any enforcement it concerns is reversed.')) decide.mutate({ id: current.id, next: 'APPROVED' });
                    }}
                    disabled={decide.isPending}
                    className="btn-primary px-3 py-2 text-sm"
                  >
                    Uphold
                  </button>
                  <button type="button" onClick={() => decide.mutate({ id: current.id, next: 'REJECTED' })} disabled={decide.isPending} className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700">
                    Reject
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
