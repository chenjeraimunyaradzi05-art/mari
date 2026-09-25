'use client';

/**
 * The data breach register. Every incident is recorded here with its
 * severity, the data involved and the regimes it falls under. For a Queensland
 * company that is the Australian Notifiable Data Breaches scheme by default: a
 * 30-day assessment window that opens at intake, a serious-harm decision with
 * its reasoning, and the four-part statement the OAIC takes. Breaches that
 * touch UK or EU members also run the 72-hour regulator clock the GDPR
 * requires. Each row is labelled with whichever clock applies to it and never
 * the other one, so nobody panic-notifies the OAIC against a deadline it does
 * not set.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ArrowLeft, Loader2, Plus, ShieldAlert, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ORGANISATION, contactLink, siteOrigin } from '@/lib/contact';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Status = 'DETECTED' | 'INVESTIGATING' | 'CONTAINED' | 'NOTIFIED' | 'RESOLVED' | 'CLOSED';
type Jurisdiction = 'AU' | 'UK' | 'EU';
type DeadlineState = 'NOT_APPLICABLE' | 'NOT_REQUIRED' | 'MET' | 'MISSED' | 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK';
type Deadline = { deadlineAt: string | null; hoursRemaining: number | null; state: DeadlineState };
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
  jurisdiction: string | null;
  jurisdictions: Jurisdiction[];
  assessmentDueAt: string | null;
  assessmentComplete: boolean;
  seriousHarmLikely: boolean | null;
  remediedBeforeHarm: boolean;
  statementEntityContact: string | null;
  statementDescription: string | null;
  statementInformationKinds: string[];
  statementRecommendedSteps: string | null;
  statementLodgedAt: string | null;
};

const DATA_CATEGORIES = ['PII', 'SENSITIVE', 'FINANCIAL', 'UGC', 'BIOMETRIC', 'BEHAVIORAL', 'TECHNICAL'] as const;
const JURISDICTIONS: { code: Jurisdiction; label: string }[] = [
  { code: 'AU', label: 'Australia (NDB scheme)' },
  { code: 'UK', label: 'United Kingdom (UK GDPR)' },
  { code: 'EU', label: 'EU (GDPR)' },
];
const JURISDICTION_NAME: Record<Jurisdiction, string> = { AU: 'Australia', UK: 'the United Kingdom', EU: 'the EU' };
const SEVERITY_TONE: Record<Severity, string> = { LOW: 'bg-slate-100 text-slate-700', MEDIUM: 'bg-amber-100 text-amber-800', HIGH: 'bg-orange-100 text-orange-800', CRITICAL: 'bg-red-100 text-red-800' };
const CLOCK_TONE: Record<DeadlineState, string> = { NOT_APPLICABLE: 'text-slate-500', NOT_REQUIRED: 'text-slate-500', MET: 'text-emerald-700', MISSED: 'text-red-700', OVERDUE: 'text-red-700', DUE_SOON: 'text-amber-700', ON_TRACK: 'text-blue-700' };
const CLOCK_LABEL: Record<DeadlineState, string> = { NOT_APPLICABLE: 'No 72-hour clock', NOT_REQUIRED: 'No regulator notification required', MET: 'Regulator notified in time', MISSED: 'Regulator notified late', OVERDUE: 'Regulator notification overdue', DUE_SOON: 'Regulator notification due soon', ON_TRACK: 'Regulator clock running' };

const DAY_MS = 24 * 60 * 60 * 1000;
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const ndbAssessmentDue = (detectedAt: string) => new Date(new Date(detectedAt).getTime() + 30 * DAY_MS);
const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);
const longDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

/** Rows recorded before the regime list existed carry a single jurisdiction. */
const regimesOf = (b: Breach): Jurisdiction[] => (b.jurisdictions?.length ? b.jurisdictions : b.jurisdiction ? [b.jurisdiction as Jurisdiction] : []);
const underNdb = (b: Breach) => regimesOf(b).includes('AU');
const clockApplies = (b: Breach) => b.notificationDeadline.state !== 'NOT_APPLICABLE';
const ndbNotifiable = (b: Breach) => b.assessmentComplete && b.seriousHarmLikely === true && !b.remediedBeforeHarm;

/** One short line for the Australian clock: where the assessment stands, or what it decided. */
const ndbLine = (b: Breach): { text: string; tone: string } => {
  if (b.assessmentComplete) {
    if (!ndbNotifiable(b)) return { text: 'Assessed · no OAIC notification needed', tone: 'text-slate-500' };
    return b.statementLodgedAt ? { text: 'OAIC statement recorded', tone: 'text-emerald-700' } : { text: 'Assessed · notify the OAIC', tone: 'text-red-700' };
  }
  const due = b.assessmentDueAt ? new Date(b.assessmentDueAt) : ndbAssessmentDue(b.detectedAt);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / DAY_MS);
  if (daysLeft < 0) return { text: 'NDB assessment overdue', tone: 'text-red-700' };
  if (daysLeft === 0) return { text: 'NDB assessment due today', tone: 'text-red-700' };
  if (daysLeft <= 7) return { text: `NDB assessment due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, tone: 'text-amber-700' };
  return { text: `NDB assessment due ${longDate(due)}`, tone: 'text-blue-700' };
};

/** The 72-hour line, with the hours left while the clock is still running. */
const gdprLine = (b: Breach): { text: string; tone: string } => {
  const d = b.notificationDeadline;
  const running = (d.state === 'ON_TRACK' || d.state === 'DUE_SOON') && d.hoursRemaining != null;
  return { text: `${CLOCK_LABEL[d.state]}${running ? ` · ${Math.max(0, d.hoursRemaining!)}h left` : ''}`, tone: CLOCK_TONE[d.state] };
};

/**
 * The entity block of an OAIC statement, from what the app knows about
 * itself. Nothing is invented: the ABN and registered office appear only once
 * they are configured, and the admin completes the rest before recording.
 */
const entityContactDefault = () => {
  const privacy = contactLink('privacy');
  return [
    ORGANISATION.legalName,
    ORGANISATION.abn ? `ABN ${ORGANISATION.abn}` : null,
    ORGANISATION.registeredOffice,
    ORGANISATION.jurisdiction,
    `Privacy contact: ${privacy.isEmail ? privacy.label : `${siteOrigin()}${privacy.href}`}`,
  ]
    .filter(Boolean)
    .join('\n');
};

const EMPTY_FORM = { title: '', description: '', severity: 'MEDIUM' as Severity, dataCategories: [] as string[], jurisdictions: ['AU'] as Jurisdiction[], affectedRecords: '', affectedUsers: '', occurredAt: '' };

export default function BreachRegisterPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [update, setUpdate] = useState({ status: '' as '' | Status, containmentActions: '', remediationActions: '', rootCause: '' });
  const [assessment, setAssessment] = useState({ remediedBeforeHarm: false, reasoning: '' });

  const register = useQuery({
    queryKey: ['admin-breaches'],
    queryFn: () => api.get('/admin/breaches'),
    select: (r) => r.data as { breaches: Breach[]; summary: { total: number; overdue: number; dueWithin24Hours: number; notifiedLate: number } },
  });

  // The Australian clock has its own monitor: assessments closing within a week.
  const ndbDue = useQuery({
    queryKey: ['admin-breaches-ndb-due'],
    queryFn: () => api.get('/admin/breaches/ndb-assessments-due'),
    select: (r) => r.data as { breaches: { id: string }[] },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-breaches'] });
    queryClient.invalidateQueries({ queryKey: ['admin-breaches-ndb-due'] });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not save');

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/breaches', {
        title: form.title.trim(),
        description: form.description.trim(),
        severity: form.severity,
        dataCategories: form.dataCategories,
        jurisdictions: form.jurisdictions,
        ...(form.affectedRecords ? { affectedRecords: Number(form.affectedRecords) } : {}),
        ...(form.affectedUsers ? { affectedUsers: Number(form.affectedUsers) } : {}),
        ...(form.occurredAt ? { occurredAt: new Date(form.occurredAt).toISOString() } : {}),
      }),
    onSuccess: (res) => {
      refresh();
      setCreating(false);
      setForm(EMPTY_FORM);
      const recorded = res.data as Breach | undefined;
      setSelectedId(recorded?.id ?? null);
      const notes: string[] = ['Recorded.'];
      if (recorded && underNdb(recorded)) notes.push('The 30-day NDB assessment window is running.');
      if (recorded?.notificationRequired) notes.push('The 72-hour regulator clock is running.');
      toast.success(notes.join(' '));
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

  const startAssessment = useMutation({
    mutationFn: (id: string) => api.post(`/admin/breaches/${id}/ndb-assessment`),
    onSuccess: () => {
      refresh();
      toast.success('Assessment window recorded.');
    },
    onError,
  });

  const recordAssessment = useMutation({
    mutationFn: ({ id, seriousHarmLikely }: { id: string; seriousHarmLikely: boolean }) =>
      api.patch(`/admin/breaches/${id}/ndb-assessment`, {
        seriousHarmLikely,
        remediedBeforeHarm: assessment.remediedBeforeHarm,
        reasoning: assessment.reasoning,
      }),
    onSuccess: () => {
      refresh();
      setAssessment({ remediedBeforeHarm: false, reasoning: '' });
      toast.success('Assessment recorded.');
    },
    onError,
  });

  const current = register.data?.breaches.find((b) => b.id === selectedId) ?? null;
  const ndbDueCount = ndbDue.data ? ndbDue.data.breaches.length : null;

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
          <p className="mt-1 text-slate-600 dark:text-slate-400">Every incident, on whichever clock applies: the 30-day assessment under the Australian Notifiable Data Breaches scheme, and the 72-hour regulator clock for breaches that touch UK or EU members.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Record an incident
          </button>
        )}
      </div>

      {register.data && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Recorded', register.data.summary.total, ''],
            ['NDB assessments due within 7 days', ndbDueCount ?? '…', ndbDueCount ? 'text-amber-700' : ''],
            ['Overdue (72h clock)', register.data.summary.overdue, register.data.summary.overdue ? 'text-red-700' : ''],
            ['Due within 24h (72h clock)', register.data.summary.dueWithin24Hours, register.data.summary.dueWithin24Hours ? 'text-amber-700' : ''],
            ['Notified late (72h clock)', register.data.summary.notifiedLate, register.data.summary.notifiedLate ? 'text-red-700' : ''],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className={cn('text-2xl font-bold text-slate-900 dark:text-white', tone as string)}>{value as number | string}</p>
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
          <fieldset>
            <legend className="text-xs uppercase tracking-wide text-slate-500">Applies under</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {JURISDICTIONS.map((j) => (
                <label key={j.code} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={form.jurisdictions.includes(j.code)} onChange={(e) => setForm({ ...form, jurisdictions: e.target.checked ? [...form.jurisdictions, j.code] : form.jurisdictions.filter((x) => x !== j.code) })} className="rounded border-slate-300" />
                  {j.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Australia starts the 30-day assessment window now, from detection. The UK and EU start the 72-hour regulator clock.</p>
          </fieldset>
          <div className="flex gap-2">
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !form.title.trim() || !form.description.trim() || form.dataCategories.length === 0 || form.jurisdictions.length === 0} className="btn-primary text-sm">
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
              {register.data!.breaches.map((b) => {
                const clocks = [...(underNdb(b) ? [ndbLine(b)] : []), ...(clockApplies(b) ? [gdprLine(b)] : [])];
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => setSelectedId(b.id)} className={cn('flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === b.id && 'bg-red-50 dark:bg-red-900/10')}>
                      <AlertTriangle className={cn('mt-0.5 h-4 w-4 flex-shrink-0', b.severity === 'CRITICAL' || b.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500')} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900 dark:text-white">{b.title}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', SEVERITY_TONE[b.severity])}>{b.severity.toLowerCase()}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{b.status.toLowerCase()}</span>
                          {regimesOf(b).map((r) => (
                            <span key={r} className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-700">{r}</span>
                          ))}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {clocks.map((c, i) => (
                            <span key={i} className={c.tone}>
                              {i > 0 ? ' · ' : ''}
                              {c.text}
                            </span>
                          ))}
                          {clocks.length > 0 ? ' · ' : ''}detected {formatDistanceToNow(new Date(b.detectedAt), { addSuffix: true })}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
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
              <p className="mt-1 text-xs text-slate-500">
                {regimesOf(current).length > 0
                  ? `Handled under the law of ${regimesOf(current).map((r) => JURISDICTION_NAME[r]).join(' and ')}.`
                  : 'No regime recorded for this incident, so the 72-hour clock is kept running for it.'}
              </p>
            </div>

            <dl className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              {underNdb(current) && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">NDB assessment (30 days, Australia)</dt>
                  <dd className="space-y-3 text-slate-700 dark:text-slate-300">
                    {current.assessmentComplete ? (
                      <p>
                        {current.seriousHarmLikely
                          ? current.remediedBeforeHarm
                            ? 'Serious harm was likely, but remedial action prevented it. No notification is required under the scheme.'
                            : current.statementLodgedAt
                              ? `Serious harm is likely. The OAIC statement was recorded on ${new Date(current.statementLodgedAt).toLocaleString('en-AU')}.`
                              : 'Serious harm is likely. Notify the OAIC and the people affected as soon as practicable.'
                          : 'Serious harm is not likely. No notification is required.'}
                      </p>
                    ) : (
                      <>
                        <p>
                          Decide by{' '}
                          {longDate(current.assessmentDueAt ? new Date(current.assessmentDueAt) : ndbAssessmentDue(current.detectedAt))}{' '}
                          whether serious harm is likely.
                          {!current.assessmentDueAt && ' The window has not been recorded yet.'}
                        </p>

                        {!current.assessmentDueAt ? (
                          <button
                            type="button"
                            onClick={() => startAssessment.mutate(current.id)}
                            disabled={startAssessment.isPending}
                            className="btn-outline px-3 py-1.5 text-sm"
                          >
                            {startAssessment.isPending ? 'Recording…' : 'Start the assessment window'}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <label htmlFor="ndb-reasoning" className="sr-only">
                              Assessment reasoning
                            </label>
                            <textarea
                              id="ndb-reasoning"
                              value={assessment.reasoning}
                              onChange={(e) => setAssessment((a) => ({ ...a, reasoning: e.target.value }))}
                              rows={2}
                              placeholder="What was considered, and why. This is the record if the assessment is ever questioned."
                              className="input w-full text-sm"
                            />
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={assessment.remediedBeforeHarm}
                                onChange={(e) => setAssessment((a) => ({ ...a, remediedBeforeHarm: e.target.checked }))}
                              />
                              Remedial action prevented the harm
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => recordAssessment.mutate({ id: current.id, seriousHarmLikely: true })}
                                disabled={recordAssessment.isPending || !assessment.reasoning.trim()}
                                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
                              >
                                Serious harm is likely
                              </button>
                              <button
                                type="button"
                                onClick={() => recordAssessment.mutate({ id: current.id, seriousHarmLikely: false })}
                                disabled={recordAssessment.isPending || !assessment.reasoning.trim()}
                                className="btn-outline px-3 py-1.5 text-sm disabled:opacity-50"
                              >
                                Not likely
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </dd>
                </div>
              )}
              {!underNdb(current) && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">NDB scheme (Australia)</dt>
                  <dd className="space-y-2 text-slate-700 dark:text-slate-300">
                    <p>Not recorded as touching Australian members.</p>
                    <button
                      type="button"
                      onClick={() => startAssessment.mutate(current.id)}
                      disabled={startAssessment.isPending}
                      className="btn-outline px-3 py-1.5 text-sm"
                    >
                      {startAssessment.isPending ? 'Recording…' : 'It does: start the 30-day assessment'}
                    </button>
                  </dd>
                </div>
              )}
              {clockApplies(current) && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Regulator clock (72h, UK and EU)</dt>
                  <dd className={CLOCK_TONE[current.notificationDeadline.state]}>
                    {CLOCK_LABEL[current.notificationDeadline.state]}
                    {current.regulatorNotifiedAt
                      ? ` · ${new Date(current.regulatorNotifiedAt).toLocaleString('en-AU')}`
                      : current.notificationDeadline.deadlineAt
                        ? ` · due ${new Date(current.notificationDeadline.deadlineAt).toLocaleString('en-AU')}`
                        : ''}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Risk to individuals</dt>
                <dd className="text-slate-700 dark:text-slate-300">{current.riskToIndividuals}</dd>
              </div>
              {current.statementLodgedAt && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">OAIC statement</dt>
                  <dd className="text-slate-700 dark:text-slate-300">
                    Recorded {new Date(current.statementLodgedAt).toLocaleString('en-AU')}
                    {current.statementInformationKinds.length > 0 ? ` · ${current.statementInformationKinds.join(', ')}` : ''}
                    {current.statementRecommendedSteps ? (
                      <span className="mt-1 block whitespace-pre-wrap text-xs text-slate-500">What people were told to do: {current.statementRecommendedSteps}</span>
                    ) : null}
                  </dd>
                </div>
              )}
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

            {!current.regulatorNotifiedAt && (ndbNotifiable(current) || (clockApplies(current) && current.notificationRequired)) && (
              <NotifyRegulatorForm key={current.id} breach={current} onDone={refresh} />
            )}

            {!current.usersNotifiedAt && (ndbNotifiable(current) || (clockApplies(current) && current.notificationRequired)) && (
              <NotifyAffectedPeopleForm key={`people-${current.id}`} breach={current} onDone={refresh} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * Telling the regulator. Two shapes, chosen by the regime being discharged:
 * the OAIC takes the four-part eligible data breach statement (recorded here,
 * copy emailed, lodged through its web form); the ICO and EU authorities take
 * an Article 33 notification within 72 hours. Keyed by breach id from the
 * parent so the prefills follow the selected incident.
 */
function NotifyRegulatorForm({ breach, onDone }: { breach: Breach; onDone: () => void }) {
  const auPath = underNdb(breach) && ndbNotifiable(breach);
  const gdprPath = clockApplies(breach) && breach.notificationRequired;
  const gdprRegimes = regimesOf(breach).filter((r): r is 'UK' | 'EU' => r !== 'AU');

  const defaultsFor = (regime: Jurisdiction) =>
    regime === 'AU'
      ? { regulatorName: 'Office of the Australian Information Commissioner', regulatorEmail: 'enquiries@oaic.gov.au' }
      : regime === 'UK'
        ? { regulatorName: "Information Commissioner's Office", regulatorEmail: '' }
        : { regulatorName: '', regulatorEmail: '' };

  const initialRegime: Jurisdiction = auPath ? 'AU' : (gdprRegimes[0] ?? 'UK');
  const [regime, setRegime] = useState<Jurisdiction>(initialRegime);
  const [regulator, setRegulator] = useState(defaultsFor(initialRegime));
  const [content, setContent] = useState('');
  const [statement, setStatement] = useState({
    entityContact: entityContactDefault(),
    description: breach.description,
    informationKinds: breach.dataCategories.map((c) => c.toLowerCase()).join('\n'),
    recommendedSteps: '',
  });

  const choices: Jurisdiction[] = [...(auPath ? (['AU'] as Jurisdiction[]) : []), ...(gdprPath ? gdprRegimes : [])];

  const notify = useMutation({
    mutationFn: () =>
      api.post(
        `/admin/breaches/${breach.id}/notify-regulator`,
        regime === 'AU'
          ? { ...regulator, jurisdiction: 'AU', statement: { ...statement, informationKinds: lines(statement.informationKinds) } }
          : { ...regulator, jurisdiction: regime, notificationContent: content.trim() }
      ),
    onSuccess: () => {
      onDone();
      toast.success(regime === 'AU' ? 'Statement recorded and a copy sent.' : 'Regulator notification recorded and sent.');
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That did not save'),
  });

  const ready =
    regulator.regulatorName.trim() &&
    regulator.regulatorEmail.includes('@') &&
    (regime === 'AU'
      ? statement.entityContact.trim() && statement.description.trim() && lines(statement.informationKinds).length > 0 && statement.recommendedSteps.trim()
      : content.trim());

  const field = (name: string) => `notify-${name}-${breach.id}`;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{regime === 'AU' ? 'Statement to the OAIC' : 'Notify the regulator'}</p>

      {choices.length > 1 && (
        <>
          <label htmlFor={field('regime')} className="text-xs text-slate-500">
            Which regulator
          </label>
          <select
            id={field('regime')}
            value={regime}
            onChange={(e) => {
              const next = e.target.value as Jurisdiction;
              setRegime(next);
              setRegulator(defaultsFor(next));
            }}
            className="input w-full text-sm"
          >
            {choices.map((c) => (
              <option key={c} value={c}>
                {JURISDICTIONS.find((j) => j.code === c)?.label ?? c}
              </option>
            ))}
          </select>
        </>
      )}

      <label htmlFor={field('regulator')} className="sr-only">
        Regulator
      </label>
      <input id={field('regulator')} value={regulator.regulatorName} onChange={(e) => setRegulator({ ...regulator, regulatorName: e.target.value })} placeholder="Regulator" className="input w-full text-sm" />
      <label htmlFor={field('email')} className="sr-only">
        Regulator email
      </label>
      <input id={field('email')} value={regulator.regulatorEmail} onChange={(e) => setRegulator({ ...regulator, regulatorEmail: e.target.value })} type="email" placeholder="Regulator email" className="input w-full text-sm" />

      {regime === 'AU' ? (
        <>
          <p className="text-xs text-slate-500">The four parts section 26WK requires. The OAIC takes the statement through its online form; this records it here and sends a copy to the address above.</p>
          <label htmlFor={field('entity')} className="block text-xs text-slate-500">
            Who we are and how to reach us
          </label>
          <textarea id={field('entity')} value={statement.entityContact} onChange={(e) => setStatement({ ...statement, entityContact: e.target.value })} rows={3} className="input w-full text-sm" />
          <label htmlFor={field('description')} className="block text-xs text-slate-500">
            What happened
          </label>
          <textarea id={field('description')} value={statement.description} onChange={(e) => setStatement({ ...statement, description: e.target.value })} rows={3} className="input w-full text-sm" />
          <label htmlFor={field('kinds')} className="block text-xs text-slate-500">
            Kinds of information involved, one per line
          </label>
          <textarea id={field('kinds')} value={statement.informationKinds} onChange={(e) => setStatement({ ...statement, informationKinds: e.target.value })} rows={2} className="input w-full text-sm" />
          <label htmlFor={field('steps')} className="block text-xs text-slate-500">
            What the people affected should do
          </label>
          <textarea id={field('steps')} value={statement.recommendedSteps} onChange={(e) => setStatement({ ...statement, recommendedSteps: e.target.value })} rows={3} placeholder="Change your password, watch for messages that ask for your details, reach us through the privacy centre if anything looks wrong" className="input w-full text-sm" />
        </>
      ) : (
        <>
          <label htmlFor={field('content')} className="sr-only">
            Notification
          </label>
          <textarea id={field('content')} value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="The notification: what happened, when, what data, how many people, what has been done, who to contact" className="input w-full text-sm" />
        </>
      )}

      <button
        type="button"
        onClick={() => {
          const question =
            regime === 'AU'
              ? `Record this statement against the incident and send a copy to ${regulator.regulatorName}? This cannot be undone.`
              : `Send this notification to ${regulator.regulatorName} and stamp the time? This cannot be undone.`;
          if (window.confirm(question)) notify.mutate();
        }}
        disabled={notify.isPending || !ready}
        className="btn-primary w-full text-sm"
      >
        {regime === 'AU' ? 'Record statement and send copy' : 'Send and record'}
      </button>
    </div>
  );
}

/**
 * Telling the people affected.
 *
 * The Privacy Act requires both halves of a notification — the Commissioner
 * under s 26WK and the individuals under s 26WL — and this register only ever
 * had a button for the first. The backend half was finished and careful:
 * notifyAffectedUsers refuses an Australian breach with no recommended steps,
 * batches the send in hundreds, stamps usersNotifiedAt and writes a privacy
 * audit row. Nothing called it. A privacy officer discharging the second half
 * of her duty had to do it with curl, during an incident, against a clock.
 *
 * The breach record deliberately holds a count of the people affected and never
 * their ids — keeping a list of victims beside the description of what leaked
 * would be its own harm — so the recipients are supplied here, from whatever
 * the investigation identified. The form says that plainly rather than
 * pretending the product can work the list out.
 */
function NotifyAffectedPeopleForm({ breach, onDone }: { breach: Breach; onDone: () => void }) {
  const [recipients, setRecipients] = useState('');
  const [content, setContent] = useState('');
  const [steps, setSteps] = useState(breach.statementRecommendedSteps ?? '');

  const ids = Array.from(new Set(recipients.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean)));
  const ndb = underNdb(breach);
  // s 26WL: an Australian breach must tell people what they can do. The server
  // refuses without it, so the button does too rather than sending a request
  // that is going to bounce mid-incident.
  const ready = ids.length > 0 && content.trim().length > 0 && (!ndb || steps.trim().length > 0 || Boolean(breach.statementRecommendedSteps));

  const notify = useMutation({
    mutationFn: () =>
      api.post(`/admin/breaches/${breach.id}/notify-users`, {
        userIds: ids,
        notificationContent: content.trim(),
        ...(steps.trim() ? { recommendedSteps: steps.trim() } : {}),
      }),
    onSuccess: (res) => {
      onDone();
      const requested = (res.data as { requested?: number } | undefined)?.requested ?? ids.length;
      setRecipients('');
      setContent('');
      toast.success(`${requested} ${requested === 1 ? 'person' : 'people'} notified.`);
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That did not send'),
  });

  const field = (name: string) => `affected-${name}-${breach.id}`;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {ndb ? 'Tell the people affected (s 26WL)' : 'Tell the people affected'}
      </p>
      <p className="text-xs text-slate-500">
        {breach.affectedUsers != null
          ? `${breach.affectedUsers.toLocaleString()} ${breach.affectedUsers === 1 ? 'person was' : 'people were'} recorded as affected. `
          : ''}
        The register holds the count, never the list, so paste the member ids the investigation identified — one per line, or separated by commas.
      </p>

      <label htmlFor={field('ids')} className="block text-xs text-slate-500">
        Member ids to notify
      </label>
      <textarea
        id={field('ids')}
        value={recipients}
        onChange={(e) => setRecipients(e.target.value)}
        rows={3}
        placeholder={'cku1a2b3c...\ncku4d5e6f...'}
        className="input w-full font-mono text-xs"
      />
      {ids.length > 0 && (
        <p className="text-xs text-slate-500">
          {ids.length} {ids.length === 1 ? 'recipient' : 'recipients'}
          {breach.affectedUsers != null && ids.length !== breach.affectedUsers ? ` · the register records ${breach.affectedUsers.toLocaleString()} affected` : ''}
        </p>
      )}

      <label htmlFor={field('content')} className="block text-xs text-slate-500">
        What happened, in the words they will read
      </label>
      <textarea
        id={field('content')}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="What happened, when, what of theirs was involved, and what we have done about it"
        className="input w-full text-sm"
      />

      <label htmlFor={field('steps')} className="block text-xs text-slate-500">
        What they can do{ndb ? ' (required for an Australian breach)' : ''}
      </label>
      <textarea
        id={field('steps')}
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
        rows={3}
        placeholder="Change your password, watch for messages that ask for your details, reach us through the privacy centre if anything looks wrong"
        className="input w-full text-sm"
      />
      {breach.statementRecommendedSteps && (
        <p className="text-xs text-slate-500">Prefilled from the OAIC statement. Edit it and this notification uses the edited wording.</p>
      )}

      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Email ${ids.length} ${ids.length === 1 ? 'person' : 'people'} about this breach and stamp the time? This cannot be undone.`)) {
            notify.mutate();
          }
        }}
        disabled={notify.isPending || !ready}
        className="btn-primary w-full text-sm"
      >
        {notify.isPending ? 'Sending…' : `Notify ${ids.length || ''} ${ids.length === 1 ? 'person' : 'people'}`.trim()}
      </button>
    </div>
  );
}
