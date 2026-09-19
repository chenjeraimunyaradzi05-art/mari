'use client';

/**
 * Overseas credentials, from the platform's side. The assessing body
 * (ANMAC, Engineers Australia, VETASSESS and the rest) writes to the
 * member, not to us; when the outcome reaches whoever handles settlement
 * support it is recorded here and she is told in the app and by email.
 * Each credential shows which body the reference table points to.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ExternalLink, GraduationCap, Loader2, X } from 'lucide-react';
import { adminImpactApi, type CredentialOutcome } from '@/lib/impact-api';
import { safeHref } from '@/lib/safe-href';
import { cn } from '@/lib/utils';

type Status = NonNullable<CredentialOutcome['status']>;
type Body = { name: string; url: string; role: string };
type Suggestion = { matched: boolean; profession: { id: string; label: string }; body: Body; also: Body[]; note: string };
type Credential = {
  id: string;
  status: Status;
  originalCountry: string;
  credentialType: string;
  credentialName: string;
  institution: string;
  yearObtained: number | null;
  fieldOfStudy: string | null;
  documentUrl: string | null;
  australianEquiv: string | null;
  bridgingRequired: string | null;
  assessmentBody: string | null;
  assessmentDate: string | null;
  notes: string | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  suggestion: Suggestion;
};
type Reference = { asAt: string; bodies: Array<{ profession: { id: string; label: string }; body: Body; also: Body[] }> };

const TONE: Record<Status, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  RECOGNIZED: 'bg-emerald-100 text-emerald-800',
  PARTIALLY_RECOGNIZED: 'bg-blue-100 text-blue-800',
  BRIDGING_REQUIRED: 'bg-orange-100 text-orange-800',
  NOT_RECOGNIZED: 'bg-red-100 text-red-700',
};
const LABEL: Record<Status, string> = {
  PENDING_REVIEW: 'Waiting',
  RECOGNIZED: 'Recognised',
  PARTIALLY_RECOGNIZED: 'Partly recognised',
  BRIDGING_REQUIRED: 'Bridging needed',
  NOT_RECOGNIZED: 'Not recognised',
};
const DECISIONS: Status[] = ['RECOGNIZED', 'PARTIALLY_RECOGNIZED', 'BRIDGING_REQUIRED', 'NOT_RECOGNIZED', 'PENDING_REVIEW'];

const errorMessage = (error: unknown) => {
  const data = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error;
};
const name = (u: Credential['user']) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

const emptyForm = { status: 'RECOGNIZED' as Status, australianEquiv: '', bridgingRequired: '', assessmentBody: '', assessmentDate: '', notes: '' };

export default function AdminCredentialsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | Status>('PENDING_REVIEW');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const list = useQuery({
    queryKey: ['admin-credentials', status],
    queryFn: () => adminImpactApi.credentials.list(status),
    select: (r) => ({
      items: (Array.isArray(r.data?.data) ? r.data.data : []) as Credential[],
      counts: (r.data?.counts ?? {}) as Partial<Record<Status, number>>,
      reference: (r.data?.reference ?? null) as Reference | null,
    }),
  });

  const current = list.data?.items.find((c) => c.id === selectedId) ?? null;

  // A fresh drawer starts from what is already on the record and the table's suggestion.
  useEffect(() => {
    if (!current) return;
    setForm({
      status: current.status === 'PENDING_REVIEW' ? 'RECOGNIZED' : current.status,
      australianEquiv: current.australianEquiv ?? '',
      bridgingRequired: current.bridgingRequired ?? '',
      assessmentBody: current.assessmentBody ?? current.suggestion.body.name,
      assessmentDate: current.assessmentDate ? current.assessmentDate.slice(0, 10) : '',
      notes: '',
    });
  }, [current]);

  const save = useMutation({
    mutationFn: (id: string) =>
      adminImpactApi.credentials.decide(id, {
        status: form.status,
        australianEquiv: form.australianEquiv.trim() || null,
        bridgingRequired: form.bridgingRequired.trim() || null,
        assessmentBody: form.assessmentBody.trim() || null,
        assessmentDate: form.assessmentDate || null,
        notes: form.notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credentials'] });
      toast.success('Recorded. She has been told.');
      setSelectedId(null);
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not record that'),
  });

  const counts = list.data?.counts ?? {};
  const bodies = list.data?.reference?.bodies ?? [];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <GraduationCap className="h-7 w-7 text-blue-600" /> Overseas credentials
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Record what the assessing body decided. She is told in the app and by email, and can record it herself too.</p>
          <p className="mt-1 text-xs text-slate-500">
            <Link href="/admin/impact" className="text-primary-600 hover:underline">
              Impact catalogues
            </Link>
            {list.data?.reference?.asAt ? ` · Reference table: ${list.data.reference.asAt}` : ''}
          </p>
        </div>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          <span className="sr-only">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input py-1.5 text-sm">
            <option value="PENDING_REVIEW">Waiting{counts.PENDING_REVIEW ? ` (${counts.PENDING_REVIEW})` : ''}</option>
            <option value="BRIDGING_REQUIRED">Bridging needed{counts.BRIDGING_REQUIRED ? ` (${counts.BRIDGING_REQUIRED})` : ''}</option>
            <option value="RECOGNIZED">Recognised{counts.RECOGNIZED ? ` (${counts.RECOGNIZED})` : ''}</option>
            <option value="PARTIALLY_RECOGNIZED">Partly recognised{counts.PARTIALLY_RECOGNIZED ? ` (${counts.PARTIALLY_RECOGNIZED})` : ''}</option>
            <option value="NOT_RECOGNIZED">Not recognised{counts.NOT_RECOGNIZED ? ` (${counts.NOT_RECOGNIZED})` : ''}</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-1')}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (list.data?.items.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-slate-500">Nothing here.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2">Credential</th>
                  <th className="px-4 py-2">Points to</th>
                  <th className="px-4 py-2">Added</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data!.items.map((c) => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)} className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === c.id && 'bg-blue-50 dark:bg-blue-900/20')}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">{name(c.user)}</div>
                      <div className="text-xs text-slate-500">{c.user.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-slate-900 dark:text-white">{c.credentialName}</div>
                      <div className="text-xs text-slate-500">
                        {c.institution}, {c.originalCountry}
                        {c.fieldOfStudy ? ` · ${c.fieldOfStudy}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{c.assessmentBody ?? c.suggestion.body.name.replace(/\s*\(.*\)$/, '')}</td>
                    <td className="px-4 py-2 text-slate-500">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE[c.status])}>{LABEL[c.status]}</span>
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
            <div className="pr-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.credentialType.toLowerCase()}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.credentialName}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {current.institution}, {current.originalCountry}
                {current.yearObtained ? `, ${current.yearObtained}` : ''}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {name(current.user)} ·{' '}
                <a href={`mailto:${current.user.email}`} className="text-primary-600 hover:underline">
                  {current.user.email}
                </a>
              </p>
              {current.documentUrl && safeHref(current.documentUrl) && (
                <a href={safeHref(current.documentUrl)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                  The document she uploaded <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.suggestion.matched ? `Reference table: ${current.suggestion.profession.label}` : 'Reference table: no specialist body'}</p>
              <a href={current.suggestion.body.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-primary-600 hover:underline">
                {current.suggestion.body.name} <ExternalLink className="h-3 w-3" />
              </a>
              <p className="text-xs text-slate-600 dark:text-slate-300">{current.suggestion.note}</p>
            </div>

            {current.notes && <p className="whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{current.notes}</p>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(current.id);
              }}
              className="space-y-2"
            >
              <label htmlFor="decision" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Outcome
              </label>
              <select id="decision" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))} className="input w-full text-sm">
                {DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {LABEL[d]}
                  </option>
                ))}
              </select>

              <label htmlFor="assessment-body" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assessing body
              </label>
              <input id="assessment-body" list="assessing-bodies" value={form.assessmentBody} onChange={(e) => setForm((f) => ({ ...f, assessmentBody: e.target.value }))} maxLength={200} className="input w-full text-sm" />
              <datalist id="assessing-bodies">
                {bodies.flatMap((b) => [b.body, ...b.also]).map((b) => (
                  <option key={b.name} value={b.name} />
                ))}
              </datalist>

              <label htmlFor="australian-equiv" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Australian equivalent
              </label>
              <input id="australian-equiv" value={form.australianEquiv} onChange={(e) => setForm((f) => ({ ...f, australianEquiv: e.target.value }))} placeholder="Bachelor of Nursing (AQF 7)" maxLength={200} className="input w-full text-sm" />

              <label htmlFor="bridging-required" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bridging required
              </label>
              <input id="bridging-required" value={form.bridgingRequired} onChange={(e) => setForm((f) => ({ ...f, bridgingRequired: e.target.value }))} placeholder="Leave empty if none" maxLength={500} className="input w-full text-sm" />

              <label htmlFor="assessment-date" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date of the body’s letter
              </label>
              <input id="assessment-date" type="date" value={form.assessmentDate} onChange={(e) => setForm((f) => ({ ...f, assessmentDate: e.target.value }))} className="input w-full text-sm" />

              <label htmlFor="decision-note" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                A note she reads
              </label>
              <textarea id="decision-note" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} maxLength={2000} placeholder="Optional. Goes into the message and the email." className="input w-full text-sm" />

              <button type="submit" disabled={save.isPending} className="btn-primary w-full py-2 text-sm">
                {save.isPending ? 'Recording…' : 'Record and tell her'}
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
