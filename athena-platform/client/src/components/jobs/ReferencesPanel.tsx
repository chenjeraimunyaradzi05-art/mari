'use client';

/**
 * Reference checks for one job application. The candidate names her referees,
 * each gets an emailed form, and their answers show here as they come in.
 * The request, send and list routes have existed for a while; this is the
 * first screen to reach them.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, Loader2, Mail, Star, UserCheck } from 'lucide-react';
import { referenceApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Reference = {
  id: string;
  refereeName: string;
  refereeTitle?: string | null;
  refereeCompany?: string | null;
  relationship: string;
  type: string;
  status: string;
  sentAt?: string | null;
  completedAt?: string | null;
  responses?: { overallRating?: number; wouldRecommend?: boolean; additionalComments?: string } | null;
};

const RELATIONSHIPS = [
  ['MANAGER', 'Manager'],
  ['COLLEAGUE', 'Colleague'],
  ['CLIENT', 'Client'],
  ['MENTOR', 'Mentor'],
  ['OTHER', 'Other'],
] as const;
const TYPES = [
  ['PROFESSIONAL', 'Professional reference'],
  ['CHARACTER', 'Character reference'],
  ['EMPLOYMENT_VERIFICATION', 'Employment verification'],
] as const;

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Not sent yet', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  SENT: { label: 'Sent', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' },
  VIEWED: { label: 'Opened', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' },
  DECLINED: { label: 'Declined', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200' },
  EXPIRED: { label: 'Expired', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

const EMPTY = { refereeName: '', refereeEmail: '', refereeTitle: '', refereeCompany: '', relationship: 'MANAGER', type: 'PROFESSIONAL' };

export function ReferencesPanel({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const references = useQuery({
    queryKey: ['application-references', applicationId],
    queryFn: () => referenceApi.forApplication(applicationId),
    enabled: open,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Reference[]) : []),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['application-references', applicationId] });
    queryClient.invalidateQueries({ queryKey: ['reference-summary'] });
  };

  const request = useMutation({
    mutationFn: async () => {
      const created = await referenceApi.request({
        applicationId,
        refereeName: form.refereeName.trim(),
        refereeEmail: form.refereeEmail.trim(),
        refereeTitle: form.refereeTitle.trim() || undefined,
        refereeCompany: form.refereeCompany.trim() || undefined,
        relationship: form.relationship,
        type: form.type,
      });
      const id = created.data?.data?.id as string | undefined;
      if (id) await referenceApi.send(id);
      return created;
    },
    onSuccess: () => {
      refresh();
      setForm(EMPTY);
      setAdding(false);
      toast.success('Reference request sent');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not send the request'),
  });

  const resend = useMutation({
    mutationFn: (id: string) => referenceApi.send(id),
    onSuccess: () => {
      refresh();
      toast.success('Reminder sent');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not send the reminder'),
  });

  return (
    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-primary-600 dark:text-slate-200"
      >
        <UserCheck className="h-4 w-4" /> References
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {references.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : references.isError ? (
            <p className="text-sm text-slate-500">Could not load the references.</p>
          ) : (references.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No referees yet. Add someone who can speak for your work.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {references.data!.map((ref) => {
                const status = STATUS[ref.status] ?? STATUS.PENDING;
                const canRemind = ['PENDING', 'SENT', 'VIEWED', 'IN_PROGRESS'].includes(ref.status);
                return (
                  <li key={ref.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900 dark:text-white">
                        {ref.refereeName}
                        {ref.refereeTitle || ref.refereeCompany ? (
                          <span className="font-normal text-slate-500"> · {[ref.refereeTitle, ref.refereeCompany].filter(Boolean).join(', ')}</span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {RELATIONSHIPS.find(([v]) => v === ref.relationship)?.[1] ?? ref.relationship} · {TYPES.find(([v]) => v === ref.type)?.[1] ?? ref.type}
                        {ref.sentAt && !ref.completedAt && ` · sent ${formatDistanceToNow(new Date(ref.sentAt), { addSuffix: true })}`}
                        {ref.completedAt && ` · answered ${formatDistanceToNow(new Date(ref.completedAt), { addSuffix: true })}`}
                      </span>
                      {ref.status === 'COMPLETED' && ref.responses && (
                        <span className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                          {typeof ref.responses.overallRating === 'number' && (
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {ref.responses.overallRating}/5
                            </span>
                          )}
                          {typeof ref.responses.wouldRecommend === 'boolean' && (
                            <span>{ref.responses.wouldRecommend ? 'Would recommend' : 'Would not recommend'}</span>
                          )}
                        </span>
                      )}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.className)}>{status.label}</span>
                    {canRemind && (
                      <button
                        type="button"
                        onClick={() => resend.mutate(ref.id)}
                        disabled={resend.isPending}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" /> {ref.status === 'PENDING' ? 'Send' : 'Remind'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {adding ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!form.refereeName.trim() || !form.refereeEmail.trim()) return;
                request.mutate();
              }}
              className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700"
            >
              <input value={form.refereeName} onChange={(e) => setForm({ ...form, refereeName: e.target.value })} placeholder="Referee's name" aria-label="Referee name" required maxLength={100} className="input" />
              <input value={form.refereeEmail} onChange={(e) => setForm({ ...form, refereeEmail: e.target.value })} placeholder="Referee's email" aria-label="Referee email" type="email" required maxLength={254} className="input" />
              <input value={form.refereeTitle} onChange={(e) => setForm({ ...form, refereeTitle: e.target.value })} placeholder="Their title (optional)" aria-label="Referee title" maxLength={100} className="input" />
              <input value={form.refereeCompany} onChange={(e) => setForm({ ...form, refereeCompany: e.target.value })} placeholder="Their company (optional)" aria-label="Referee company" maxLength={100} className="input" />
              <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} aria-label="Relationship" className="input">
                {RELATIONSHIPS.map(([value, label]) => (
                  <option key={value} value={value}>
                    They were my {label.toLowerCase()}
                  </option>
                ))}
              </select>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="Reference type" className="input">
                {TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 sm:col-span-2">
                <button type="submit" disabled={request.isPending} className="btn-primary px-3 py-1.5 text-sm">
                  {request.isPending ? 'Sending…' : 'Send request'}
                </button>
                <button type="button" onClick={() => setAdding(false)} className="btn-outline px-3 py-1.5 text-sm">
                  Cancel
                </button>
                <span className="text-xs text-slate-500">They get an email with a form that takes a few minutes.</span>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="btn-outline px-3 py-1.5 text-sm">
              Add a referee
            </button>
          )}
        </div>
      )}
    </div>
  );
}
