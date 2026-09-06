'use client';

/**
 * Badge applications waiting for a person. Identity checks that ran through
 * Stripe approve themselves; everything else lands here with what the member
 * wrote and where to confirm it.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, BadgeCheck, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Badge = {
  id: string;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  metadata: Record<string, unknown> | null;
  reason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; displayName: string | null; email: string; avatar: string | null };
};

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const nameOf = (u: Badge['user']) => u.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const isUrl = (v: unknown) => typeof v === 'string' && /^https?:\/\//i.test(v);

export default function AdminVerificationPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const list = useQuery({
    queryKey: ['admin-verification', status],
    queryFn: () => api.get('/verification/badges/pending', { params: { status } }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Badge[]) : []),
  });

  const decide = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'APPROVED' | 'REJECTED' }) => api.patch(`/verification/badges/${id}`, { status: next, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: (_r, { next }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-verification'] });
      setReason('');
      setSelectedId(null);
      toast.success(next === 'APPROVED' ? 'Approved. The badge is on their profile.' : 'Rejected. They can apply again.');
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not record that'),
  });

  const current = list.data?.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <BadgeCheck className="h-7 w-7 text-primary-600" /> Verification requests
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Identity checks through Stripe approve themselves. These need a person.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input py-1.5 text-sm" aria-label="Status">
          <option value="PENDING">Waiting</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : 'grid-cols-1')}>
        <div>
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <div className="card p-10 text-center text-slate-500">Nothing waiting.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {list.data!.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => setSelectedId(b.id)} className={cn('flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === b.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{b.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{nameOf(b.user)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {b.user.email} · {formatDistanceToNow(new Date(b.submittedAt), { addSuffix: true })}
                        {typeof b.metadata?.provider === 'string' ? ` · ${b.metadata.provider}` : ''}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.type} badge</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                <Link href={`/profile/${current.user.id}`} className="hover:underline">
                  {nameOf(current.user)}
                </Link>
              </h2>
              <p className="text-xs text-slate-500">{current.user.email}</p>
            </div>
            {current.metadata && Object.keys(current.metadata).length > 0 && (
              <dl className="space-y-1 text-sm">
                {Object.entries(current.metadata).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-500">{k}</dt>
                    <dd className="break-words text-slate-800 dark:text-slate-200">
                      {isUrl(v) ? (
                        <a href={String(v)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                          {String(v)}
                        </a>
                      ) : (
                        String(v)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {current.status === 'PENDING' ? (
              <div className="space-y-2">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Reason (the member reads this on rejection)" aria-label="Reason" className="input w-full text-sm" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => decide.mutate({ id: current.id, next: 'APPROVED' })} disabled={decide.isPending} className="btn-primary text-sm">
                    Approve
                  </button>
                  <button type="button" onClick={() => decide.mutate({ id: current.id, next: 'REJECTED' })} disabled={decide.isPending} className="text-sm font-medium text-red-600 hover:text-red-700">
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {current.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                {current.reviewedAt ? ` ${formatDistanceToNow(new Date(current.reviewedAt), { addSuffix: true })}` : ''}
                {current.reason ? ` · ${current.reason}` : ''}
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
