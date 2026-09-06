'use client';

/**
 * Insurance applications, from the platform's side. Insurers quote, approve
 * and issue policies outside the platform; whoever handles the partnership
 * records the result here and the member is told in the app and by email.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, ShieldCheck, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DECLINED' | 'ACTIVE' | 'LAPSED';
type Application = {
  id: string;
  status: Status;
  applicationData: Record<string, unknown> | null;
  premiumQuoted: string | number | null;
  coverageAmount: string | number | null;
  policyNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  product: { id: string; name: string; provider: string; type: string; premiumMonthly: string | number | null; coverageAmount: string | number | null };
};

const TONE: Record<Status, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  DECLINED: 'bg-red-100 text-red-700',
  ACTIVE: 'bg-emerald-200 text-emerald-900',
  LAPSED: 'bg-slate-100 text-slate-600',
};
const DECISIONS: Array<[Exclude<Status, 'SUBMITTED'>, string]> = [
  ['UNDER_REVIEW', 'Under review'],
  ['APPROVED', 'Approved'],
  ['DECLINED', 'Declined'],
  ['ACTIVE', 'Policy active'],
  ['LAPSED', 'Policy lapsed'],
];

const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
const aud = (v: unknown) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(v));
const name = (u: Application['user']) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

export default function AdminInsurancePage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | Status>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ status: 'UNDER_REVIEW' as Exclude<Status, 'SUBMITTED'>, premiumQuoted: '', coverageAmount: '', policyNumber: '', startDate: '', endDate: '', note: '' });

  const list = useQuery({
    queryKey: ['admin-insurance-applications', status],
    queryFn: () => api.get('/admin/insurance/applications', { params: status === 'all' ? {} : { status } }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Application[]) : []),
  });

  const save = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/insurance/applications/${id}`, {
        status: form.status,
        ...(form.premiumQuoted ? { premiumQuoted: Number(form.premiumQuoted) } : {}),
        ...(form.coverageAmount ? { coverageAmount: Number(form.coverageAmount) } : {}),
        ...(form.policyNumber.trim() ? { policyNumber: form.policyNumber.trim() } : {}),
        ...(form.startDate ? { startDate: form.startDate } : {}),
        ...(form.endDate ? { endDate: form.endDate } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-insurance-applications'] });
      toast.success('Recorded. The member has been told.');
      setForm((f) => ({ ...f, note: '' }));
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not record that'),
  });

  const current = list.data?.find((a) => a.id === selectedId) ?? null;
  const issuing = form.status === 'APPROVED' || form.status === 'ACTIVE';

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-7 w-7 text-blue-600" /> Insurance applications
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Record the insurer's quote, decision and policy details. The member is told in the app and by email.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input py-1.5 text-sm" aria-label="Status">
          <option value="all">All submitted</option>
          <option value="SUBMITTED">New</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="APPROVED">Approved</option>
          <option value="ACTIVE">Active</option>
          <option value="DECLINED">Declined</option>
          <option value="LAPSED">Lapsed</option>
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
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Premium</th>
                  <th className="px-4 py-2">Submitted</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data!.map((a) => (
                  <tr key={a.id} onClick={() => setSelectedId(a.id)} className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === a.id && 'bg-blue-50 dark:bg-blue-900/20')}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">{name(a.user)}</div>
                      <div className="text-xs text-slate-500">{a.user.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-slate-900 dark:text-white">{a.product.name}</div>
                      <div className="text-xs text-slate-500">
                        {a.product.provider} · {a.product.type.replace(/_/g, ' ').toLowerCase()}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{a.premiumQuoted ? `${aud(a.premiumQuoted)}/mo` : a.product.premiumMonthly ? `${aud(a.product.premiumMonthly)}/mo listed` : '–'}</td>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.product.provider}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.product.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {name(current.user)} · <a href={`mailto:${current.user.email}`} className="text-primary-600 hover:underline">{current.user.email}</a>
              </p>
            </div>
            {(current.policyNumber || current.premiumQuoted || current.coverageAmount) && (
              <dl className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                {current.policyNumber && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Policy</dt>
                    <dd>{current.policyNumber}</dd>
                  </div>
                )}
                {current.premiumQuoted && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Premium</dt>
                    <dd>{aud(current.premiumQuoted)}/mo</dd>
                  </div>
                )}
                {current.coverageAmount && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Cover</dt>
                    <dd>{aud(current.coverageAmount)}</dd>
                  </div>
                )}
              </dl>
            )}
            <div className="space-y-2">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })} className="input w-full text-sm" aria-label="Decision">
                {DECISIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {issuing && (
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.premiumQuoted} onChange={(e) => setForm({ ...form, premiumQuoted: e.target.value })} type="number" min={0} step="0.01" placeholder="Premium / month" aria-label="Premium quoted" className="input text-sm" />
                  <input value={form.coverageAmount} onChange={(e) => setForm({ ...form, coverageAmount: e.target.value })} type="number" min={0} placeholder="Cover amount" aria-label="Coverage amount" className="input text-sm" />
                  <input value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} placeholder="Policy number" aria-label="Policy number" className="input text-sm" />
                  <input value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} type="date" aria-label="Start date" className="input text-sm" />
                  <input value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} type="date" aria-label="End date" className="input text-sm" />
                </div>
              )}
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} maxLength={1000} placeholder="A note the member reads (optional)" aria-label="Note" className="input w-full text-sm" />
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
