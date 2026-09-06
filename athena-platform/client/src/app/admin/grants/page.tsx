'use client';

/**
 * Grant applications, from the platform's side. Grant providers are outside
 * organisations; their decision comes back through whoever handles
 * partnerships and is recorded here. The applicant is told in the app and by
 * email the moment it is saved.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Landmark, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'SUBMITTED' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'AWARDED' | 'REJECTED' | 'WITHDRAWN';
type Application = {
  id: string;
  status: Status;
  matchScore: number | null;
  applicationData: Record<string, unknown> | null;
  submittedAt: string | null;
  resultAt: string | null;
  amountAwarded: string | number | null;
  notes: string | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  grant: { id: string; name: string; provider: string; providerType: string; maxFunding: string | number | null; deadline: string | null };
};

const TONE: Record<Status, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  SHORTLISTED: 'bg-purple-100 text-purple-800',
  AWARDED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-600',
};
const DECISIONS: Array<[Exclude<Status, 'SUBMITTED' | 'WITHDRAWN'>, string]> = [
  ['UNDER_REVIEW', 'Under review'],
  ['SHORTLISTED', 'Shortlisted'],
  ['AWARDED', 'Awarded'],
  ['REJECTED', 'Not successful'],
];

const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
const aud = (v: unknown) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(v));
const name = (u: Application['user']) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

export default function AdminGrantsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | Status>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Exclude<Status, 'SUBMITTED' | 'WITHDRAWN'>>('UNDER_REVIEW');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const list = useQuery({
    queryKey: ['admin-grant-applications', status],
    queryFn: () => api.get('/admin/grants/applications', { params: status === 'all' ? {} : { status } }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Application[]) : []),
  });

  const save = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/grants/applications/${id}`, { status: decision, ...(decision === 'AWARDED' && amount ? { amountAwarded: Number(amount) } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-grant-applications'] });
      toast.success('Recorded. The applicant has been told.');
      setNotes('');
      setAmount('');
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not record that'),
  });

  const current = list.data?.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Landmark className="h-7 w-7 text-emerald-600" /> Grant applications
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Record what the provider decided. The applicant is told in the app and by email.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input py-1.5 text-sm" aria-label="Status">
          <option value="all">All submitted</option>
          <option value="SUBMITTED">New</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="AWARDED">Awarded</option>
          <option value="REJECTED">Not successful</option>
        </select>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1')}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-slate-500">No applications here.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Applicant</th>
                  <th className="px-4 py-2">Grant</th>
                  <th className="px-4 py-2">Match</th>
                  <th className="px-4 py-2">Submitted</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data!.map((a) => (
                  <tr key={a.id} onClick={() => setSelectedId(a.id)} className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === a.id && 'bg-emerald-50 dark:bg-emerald-900/20')}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">{name(a.user)}</div>
                      <div className="text-xs text-slate-500">{a.user.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-slate-900 dark:text-white">{a.grant.name}</div>
                      <div className="text-xs text-slate-500">{a.grant.provider}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.matchScore ?? '–'}</td>
                    <td className="px-4 py-2 text-slate-500">{a.submittedAt ? formatDistanceToNow(new Date(a.submittedAt), { addSuffix: true }) : '–'}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE[a.status])}>{a.status.replace('_', ' ').toLowerCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {current && (
          <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6">
            <button type="button" onClick={() => setSelectedId(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.grant.provider}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.grant.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {name(current.user)} · <a href={`mailto:${current.user.email}`} className="text-primary-600 hover:underline">{current.user.email}</a>
              </p>
              {current.grant.maxFunding && <p className="text-xs text-slate-500">Up to {aud(current.grant.maxFunding)}</p>}
            </div>
            {current.applicationData && Object.keys(current.applicationData).length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">What they submitted</p>
                <dl className="max-h-56 space-y-1 overflow-y-auto text-xs">
                  {Object.entries(current.applicationData).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {(current.amountAwarded || current.notes) && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                {current.amountAwarded ? <p className="font-medium text-emerald-700">Awarded {aud(current.amountAwarded)}</p> : null}
                {current.notes ? <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{current.notes}</p> : null}
              </div>
            )}
            <div className="space-y-2">
              <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} className="input w-full text-sm" aria-label="Decision">
                {DECISIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {decision === 'AWARDED' && <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={0} placeholder="Amount awarded (AUD)" aria-label="Amount awarded" className="input w-full text-sm" />}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="A note the applicant reads (optional)" aria-label="Note" className="input w-full text-sm" />
              <button type="button" onClick={() => save.mutate(current.id)} disabled={save.isPending} className="btn-primary w-full py-2 text-sm">
                Record decision
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
