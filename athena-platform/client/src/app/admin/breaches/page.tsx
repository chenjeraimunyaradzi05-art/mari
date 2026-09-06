'use client';

/**
 * The data breach register. Every incident is recorded here with its
 * severity and the data involved; the register runs two clocks, the 72-hour
 * regulator clock the UK and EU require and the 30-day assessment the
 * Australian Notifiable Data Breaches scheme requires, and records when the
 * regulator and the people affected were told. The routes have existed since
 * the compliance work; this is the first screen that reaches them.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ArrowLeft, Loader2, Plus, ShieldAlert, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Status = 'DETECTED' | 'INVESTIGATING' | 'CONTAINED' | 'NOTIFIED' | 'RESOLVED' | 'CLOSED';
type Deadline = { deadlineAt: string; hoursRemaining: number; state: 'NOT_REQUIRED' | 'MET' | 'MISSED' | 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' };
type Breach = {
  id: string;
  title: string;
  description: string;
  detectedAt: string;
  occurredAt: string | null;
  severity: Severity;
  status: Status;
  dataCategories: string[];
  affectedRecords: number | null;
  affectedUsers: number | null;
  riskToIndividuals: string;
  notificationRequired: boolean;
  regulatorNotifiedAt: string | null;
  regulatorReference: string | null;
  usersNotifiedAt: string | null;
  containmentActions: string[];
  remediationActions: string[];
  rootCause: string | null;
  notificationDeadline: Deadline;
};

const DATA_CATEGORIES = ['PII', 'SENSITIVE', 'FINANCIAL', 'UGC', 'BIOMETRIC', 'BEHAVIORAL', 'TECHNICAL'] as const;
const SEVERITY_TONE: Record<Severity, string> = { LOW: 'bg-slate-100 text-slate-700', MEDIUM: 'bg-amber-100 text-amber-800', HIGH: 'bg-orange-100 text-orange-800', CRITICAL: 'bg-red-100 text-red-800' };
const CLOCK_TONE: Record<Deadline['state'], string> = { NOT_REQUIRED: 'text-slate-500', MET: 'text-emerald-700', MISSED: 'text-red-700', OVERDUE: 'text-red-700', DUE_SOON: 'text-amber-700', ON_TRACK: 'text-blue-700' };
const CLOCK_LABEL: Record<Deadline['state'], string> = { NOT_REQUIRED: 'No regulator notification required', MET: 'Regulator notified in time', MISSED: 'Regulator notified late', OVERDUE: 'Regulator notification overdue', DUE_SOON: 'Regulator notification due soon', ON_TRACK: 'Regulator clock running' };

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const ndbAssessmentDue = (detectedAt: string) => new Date(new Date(detectedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

export default function BreachRegisterPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'MEDIUM' as Severity, dataCategories: [] as string[], affectedRecords: '', affectedUsers: '', occurredAt: '' });
  const [update, setUpdate] = useState({ status: '' as '' | Status, containmentActions: '', remediationActions: '', rootCause: '' });
  const [regulator, setRegulator] = useState({ regulatorName: 'Office of the Australian Information Commissioner', regulatorEmail: 'enquiries@oaic.gov.au', notificationContent: '' });

  const register = useQuery({
    queryKey: ['admin-breaches'],
    queryFn: () => api.get('/admin/breaches'),
    select: (r) => r.data as { breaches: Breach[]; summary: { total: number; overdue: number; dueWithin24Hours: number; notifiedLate: number } },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-breaches'] });
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not save');

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/breaches', {
        title: form.title.trim(),
        description: form.description.trim(),
        severity: form.severity,
        dataCategories: form.dataCategories,
        ...(form.affectedRecords ? { affectedRecords: Number(form.affectedRecords) } : {}),
        ...(form.affectedUsers ? { affectedUsers: Number(form.affectedUsers) } : {}),
        ...(form.occurredAt ? { occurredAt: new Date(form.occurredAt).toISOString() } : {}),
      }),
    onSuccess: (res) => {
      refresh();
      setCreating(false);
      setForm({ title: '', description: '', severity: 'MEDIUM', dataCategories: [], affectedRecords: '', affectedUsers: '', occurredAt: '' });
      setSelectedId(res.data?.id ?? null);
      toast.success(res.data?.notificationRequired ? 'Recorded. The regulator clock is running.' : 'Recorded.');
    },
    onError,
  });

  const save = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/breaches/${id}`, {
        ...(update.status ? { status: update.status } : {}),
        ...(update.containmentActions.trim() ? { containmentActions: lines(update.containmentActions) } : {}),
        ...(update.remediationActions.trim() ? { remediationActions: lines(update.remediationActions) } : {}),
        ...(update.rootCause.trim() ? { rootCause: update.rootCause.trim() } : {}),
      }),
    onSuccess: () => {
      refresh();
      setUpdate({ status: '', containmentActions: '', remediationActions: '', rootCause: '' });
      toast.success('Saved');
    },
    onError,
  });

  const notifyRegulator = useMutation({
    mutationFn: (id: string) => api.post(`/admin/breaches/${id}/notify-regulator`, regulator),
    onSuccess: () => {
      refresh();
      toast.success('Regulator notification recorded and sent.');
    },
    onError,
  });

  const current = register.data?.breaches.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <ShieldAlert className="h-7 w-7 text-red-600" /> Data breach register
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Every incident, with two clocks: the 72-hour regulator clock (UK and EU) and the 30-day assessment under the Australian Notifiable Data Breaches scheme.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Record an incident
          </button>
        )}
      </div>

      {register.data && (
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          {[
            ['Recorded', register.data.summary.total, ''],
            ['Overdue', register.data.summary.overdue, register.data.summary.overdue ? 'text-red-700' : ''],
            ['Due within 24h', register.data.summary.dueWithin24Hours, register.data.summary.dueWithin24Hours ? 'text-amber-700' : ''],
            ['Notified late', register.data.summary.notifiedLate, register.data.summary.notifiedLate ? 'text-red-700' : ''],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className={cn('text-2xl font-bold text-slate-900 dark:text-white', tone as string)}>{value as number}</p>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="card mb-6 space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Record an incident</h2>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What happened, in a line" aria-label="Title" className="input w-full text-sm" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="What was accessed or lost, how it was found, what is known so far" aria-label="Description" className="input w-full text-sm" />
          <div className="grid gap-3 sm:grid-cols-4">
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })} aria-label="Severity" className="input text-sm">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]).map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
            <input value={form.affectedRecords} onChange={(e) => setForm({ ...form, affectedRecords: e.target.value })} type="number" min={0} placeholder="Records affected" aria-label="Records affected" className="input text-sm" />
            <input value={form.affectedUsers} onChange={(e) => setForm({ ...form, affectedUsers: e.target.value })} type="number" min={0} placeholder="People affected" aria-label="People affected" className="input text-sm" />
            <input value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} type="datetime-local" aria-label="When it occurred" className="input text-sm" />
          </div>
          <fieldset>
            <legend className="text-xs uppercase tracking-wide text-slate-500">Data involved</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {DATA_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={form.dataCategories.includes(c)} onChange={(e) => setForm({ ...form, dataCategories: e.target.checked ? [...form.dataCategories, c] : form.dataCategories.filter((x) => x !== c) })} className="rounded border-slate-300" />
                  {c.toLowerCase()}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !form.title.trim() || !form.description.trim() || form.dataCategories.length === 0} className="btn-primary text-sm">
              Record
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_440px]' : 'grid-cols-1')}>
        <div>
          {register.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (register.data?.breaches.length ?? 0) === 0 ? (
            <div className="card p-10 text-center text-slate-500">No incidents recorded.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {register.data!.breaches.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => setSelectedId(b.id)} className={cn('flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === b.id && 'bg-red-50 dark:bg-red-900/10')}>
                    <AlertTriangle className={cn('mt-0.5 h-4 w-4 flex-shrink-0', b.severity === 'CRITICAL' || b.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">{b.title}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', SEVERITY_TONE[b.severity])}>{b.severity.toLowerCase()}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{b.status.toLowerCase()}</span>
                      </span>
                      <span className={cn('block text-xs', CLOCK_TONE[b.notificationDeadline.state])}>
                        {CLOCK_LABEL[b.notificationDeadline.state]}
                        {['ON_TRACK', 'DUE_SOON'].includes(b.notificationDeadline.state) ? ` · ${Math.max(0, b.notificationDeadline.hoursRemaining)}h left` : ''} · detected {formatDistanceToNow(new Date(b.detectedAt), { addSuffix: true })}
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
              <h2 className="pr-8 text-lg font-semibold text-slate-900 dark:text-white">{current.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{current.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                {current.dataCategories.map((c) => c.toLowerCase()).join(', ')}
                {current.affectedUsers != null ? ` · ${current.affectedUsers} people` : ''}
                {current.affectedRecords != null ? ` · ${current.affectedRecords} records` : ''}
              </p>
            </div>

            <dl className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Regulator clock (72h, UK and EU)</dt>
                <dd className={CLOCK_TONE[current.notificationDeadline.state]}>
                  {CLOCK_LABEL[current.notificationDeadline.state]}
                  {current.regulatorNotifiedAt ? ` · ${new Date(current.regulatorNotifiedAt).toLocaleString('en-AU')}` : ` · due ${new Date(current.notificationDeadline.deadlineAt).toLocaleString('en-AU')}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">NDB assessment (30 days, Australia)</dt>
                <dd className="text-slate-700 dark:text-slate-300">
                  Decide by {ndbAssessmentDue(current.detectedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} whether serious harm is likely; if so, notify the OAIC and the people affected as soon as practicable.
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Risk to individuals</dt>
                <dd className="text-slate-700 dark:text-slate-300">{current.riskToIndividuals}</dd>
              </div>
              {current.usersNotifiedAt && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">People notified</dt>
                  <dd className="text-slate-700 dark:text-slate-300">{new Date(current.usersNotifiedAt).toLocaleString('en-AU')}</dd>
                </div>
              )}
            </dl>

            {(current.containmentActions.length > 0 || current.remediationActions.length > 0 || current.rootCause) && (
              <div className="text-sm">
                {current.containmentActions.length > 0 && (
                  <p>
                    <span className="font-medium">Containment:</span> {current.containmentActions.join('; ')}
                  </p>
                )}
                {current.remediationActions.length > 0 && (
                  <p>
                    <span className="font-medium">Remediation:</span> {current.remediationActions.join('; ')}
                  </p>
                )}
                {current.rootCause && (
                  <p>
                    <span className="font-medium">Root cause:</span> {current.rootCause}
                  </p>
                )}
              </div>
            )}

            {!['RESOLVED', 'CLOSED'].includes(current.status) && (
              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investigation</p>
                <select value={update.status} onChange={(e) => setUpdate({ ...update, status: e.target.value as Status | '' })} aria-label="Status" className="input w-full text-sm">
                  <option value="">Keep status</option>
                  {(['INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'] as Status[]).map((s) => (
                    <option key={s} value={s}>
                      {s.toLowerCase()}
                    </option>
                  ))}
                </select>
                <textarea value={update.containmentActions} onChange={(e) => setUpdate({ ...update, containmentActions: e.target.value })} rows={2} placeholder="Containment actions, one per line" aria-label="Containment actions" className="input w-full text-sm" />
                <textarea value={update.remediationActions} onChange={(e) => setUpdate({ ...update, remediationActions: e.target.value })} rows={2} placeholder="Remediation actions, one per line" aria-label="Remediation actions" className="input w-full text-sm" />
                <input value={update.rootCause} onChange={(e) => setUpdate({ ...update, rootCause: e.target.value })} placeholder="Root cause" aria-label="Root cause" className="input w-full text-sm" />
                <button type="button" onClick={() => save.mutate(current.id)} disabled={save.isPending} className="btn-outline w-full text-sm">
                  Save
                </button>
              </div>
            )}

            {current.notificationRequired && !current.regulatorNotifiedAt && (
              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notify the regulator</p>
                <input value={regulator.regulatorName} onChange={(e) => setRegulator({ ...regulator, regulatorName: e.target.value })} aria-label="Regulator" className="input w-full text-sm" />
                <input value={regulator.regulatorEmail} onChange={(e) => setRegulator({ ...regulator, regulatorEmail: e.target.value })} type="email" aria-label="Regulator email" className="input w-full text-sm" />
                <textarea value={regulator.notificationContent} onChange={(e) => setRegulator({ ...regulator, notificationContent: e.target.value })} rows={4} placeholder="The notification: what happened, when, what data, how many people, what has been done, who to contact" aria-label="Notification" className="input w-full text-sm" />
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Send this notification to ${regulator.regulatorName} and stamp the time? This cannot be undone.`)) notifyRegulator.mutate(current.id);
                  }}
                  disabled={notifyRegulator.isPending || !regulator.notificationContent.trim()}
                  className="btn-primary w-full text-sm"
                >
                  Send and record
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
