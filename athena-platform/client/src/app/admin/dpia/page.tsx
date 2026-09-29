'use client';

/**
 * Privacy impact assessments. Before a feature handles personal information in
 * a way that could hurt someone, the risks are written down, weighed and
 * answered, and somebody signs off on what is left. The OAIC expects one for
 * any project with a high privacy impact; for members in the UK and the EU it
 * is the Article 35 DPIA. On a platform whose members include women leaving
 * abusive relationships, most of what it builds qualifies.
 *
 * The assessments could only be written with curl, so none were. This screen
 * writes them. An assessment ending at high residual risk cannot be approved
 * until someone accepts that risk on the record, and one that changes after it
 * was approved goes back for sign-off rather than keeping an approval for a
 * version nobody approved.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Plus, RefreshCw, Scale, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DATA_CATEGORIES,
  DPIA_STATUSES,
  MITIGATION_STATUSES,
  RISK_LEVELS,
  errorMessage,
  fromDateInput,
  fromLines,
  labelOf,
  longDate,
  toDateInput,
  toLines,
  type DpiaStatus,
  type MitigationStatus,
  type RiskLevel,
} from '../_records/vocabulary';

type Risk = { description: string; likelihood: RiskLevel; impact: RiskLevel; score?: number };
type Mitigation = { measure: string; status: MitigationStatus; risk: string | null; owner: string | null };

type Assessment = {
  id: string;
  title: string;
  description: string;
  featureOrSystem: string;
  dataCategories: string[];
  processingOperations: string[];
  necessity: string;
  proportionality: string;
  risks: unknown;
  mitigations: unknown;
  residualRiskLevel: RiskLevel;
  residualRiskAccepted: boolean;
  dpoConsulted: boolean;
  dpoComments: string | null;
  regulatorConsulted: boolean;
  regulatorResponse: string | null;
  status: DpiaStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type Paged<T> = { success: boolean; data: T[]; pagination: { page: number; limit: number; total: number; pages: number; hasMore: boolean } };

type Filter = DpiaStatus | 'all';
const FILTERS: { value: Filter; label: string }[] = [{ value: 'all', label: 'All' }, ...DPIA_STATUSES];

const STATUS_TONE: Record<DpiaStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
};

const RISK_TONE: Record<RiskLevel, string> = {
  LOW: 'text-slate-600 dark:text-slate-300',
  MEDIUM: 'text-amber-700 dark:text-amber-300',
  HIGH: 'text-red-700 dark:text-red-300',
};

const isLevel = (value: unknown): value is RiskLevel => value === 'LOW' || value === 'MEDIUM' || value === 'HIGH';

/**
 * The risks as recorded. Entries written before the API held them to a shape
 * may not be readable; they are counted rather than dropped silently, so the
 * screen never shows an assessment as having fewer risks than it holds.
 */
function readRisks(value: unknown): { risks: Risk[]; unreadable: number } {
  const entries = Array.isArray(value) ? value : [];
  const risks = entries.filter(
    (entry): entry is Risk =>
      Boolean(entry) && typeof entry === 'object' && typeof (entry as Risk).description === 'string' && isLevel((entry as Risk).likelihood) && isLevel((entry as Risk).impact)
  );
  return { risks, unreadable: entries.length - risks.length };
}

function readMitigations(value: unknown): { mitigations: Mitigation[]; unreadable: number } {
  const entries = Array.isArray(value) ? value : [];
  // An entry with a status this screen does not know is counted as unreadable
  // rather than shown as "planned": guessing would misstate what was done.
  const mitigations = entries
    .filter(
      (entry) =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as Mitigation).measure === 'string' &&
        MITIGATION_STATUSES.some((status) => status.value === (entry as Mitigation).status)
    )
    .map((entry) => {
      const m = entry as Mitigation;
      return {
        measure: m.measure,
        status: m.status,
        risk: typeof m.risk === 'string' ? m.risk : null,
        owner: typeof m.owner === 'string' ? m.owner : null,
      };
    });
  return { mitigations, unreadable: entries.length - mitigations.length };
}

const RANK: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const scoreOf = (risk: Risk) => risk.score ?? RANK[risk.likelihood] * RANK[risk.impact];

export default function ImpactAssessmentsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | Assessment | null>(null);

  const list = useQuery({
    queryKey: ['admin-dpia', filter, page],
    queryFn: async () => {
      const response = await api.get('/gdpr/dpia', { params: { page, limit: 50, ...(filter === 'all' ? {} : { status: filter }) } });
      return response.data as Paged<Assessment>;
    },
  });

  const assessments = list.data?.data ?? [];
  const pages = list.data?.pagination.pages ?? 1;
  const selected = assessments.find((assessment) => assessment.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin/compliance" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Privacy &amp; compliance
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Scale className="h-7 w-7 text-violet-600" /> Privacy impact assessments
          </h1>
          <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-400">
            Before a feature handles personal information in a way that could hurt someone, its risks are written down, weighed and answered, and
            somebody signs off on what is left. The{' '}
            <Link href="/admin/ropa" className="text-primary-600 hover:underline">
              record of processing activities
            </Link>{' '}
            links each risky activity to its assessment.
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing('new')} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Start an assessment
          </button>
        )}
      </div>

      {editing && (
        <AssessmentForm
          key={editing === 'new' ? 'new' : editing.id}
          assessment={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            setSelectedId(id);
          }}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Which assessments">
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

      <div className={cn('grid gap-6', selected ? 'lg:grid-cols-[minmax(0,1fr)_500px]' : 'grid-cols-1')}>
        <div>
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading assessments" />
            </div>
          ) : list.isError ? (
            <div className="card flex flex-col items-start gap-3 border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-900/20" role="alert">
              <p className="font-medium text-red-800 dark:text-red-200">The assessments could not be loaded.</p>
              <p className="text-sm text-red-700 dark:text-red-300">{errorMessage(list.error) ?? 'The server did not answer.'}</p>
              <button type="button" onClick={() => list.refetch()} className="btn-outline inline-flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : assessments.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">
              {filter === 'all' ? 'No assessment has been written yet. The safety features are where to start.' : 'Nothing here.'}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
                {assessments.map((assessment) => {
                  const { risks } = readRisks(assessment.risks);
                  const reviewDue = assessment.nextReviewDate && new Date(assessment.nextReviewDate).getTime() < Date.now();
                  return (
                    <li key={assessment.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(assessment.id)}
                        className={cn(
                          'flex w-full flex-col gap-1 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800',
                          selectedId === assessment.id && 'bg-violet-50 dark:bg-violet-900/10'
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900 dark:text-white">{assessment.title}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[assessment.status])}>
                            {labelOf(DPIA_STATUSES, assessment.status)}
                          </span>
                        </span>
                        <span className="text-xs text-slate-500">
                          {assessment.featureOrSystem} · {risks.length} {risks.length === 1 ? 'risk' : 'risks'} ·{' '}
                          <span className={RISK_TONE[assessment.residualRiskLevel]}>{labelOf(RISK_LEVELS, assessment.residualRiskLevel).toLowerCase()} residual risk</span>
                          {assessment.status === 'APPROVED' && assessment.approvedAt
                            ? ` · approved ${longDate(assessment.approvedAt)}${assessment.approvedByName ? ` by ${assessment.approvedByName}` : ''}`
                            : ''}
                          {reviewDue && <span className="text-amber-700 dark:text-amber-300"> · review was due {longDate(assessment.nextReviewDate)}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {pages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button type="button" className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <span className="text-slate-500">
                    Page {page} of {pages}
                  </span>
                  <button type="button" className="btn-outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {selected && (
          <AssessmentPanel key={selected.id} assessment={selected} onClose={() => setSelectedId(null)} onEdit={() => setEditing(selected)} />
        )}
      </div>
    </div>
  );
}

type FormState = {
  title: string;
  featureOrSystem: string;
  description: string;
  dataCategories: string[];
  processingOperations: string;
  necessity: string;
  proportionality: string;
  risks: Risk[];
  mitigations: Mitigation[];
  residualRiskLevel: RiskLevel | '';
};

const EMPTY_FORM: FormState = {
  title: '',
  featureOrSystem: '',
  description: '',
  dataCategories: [],
  processingOperations: '',
  necessity: '',
  proportionality: '',
  risks: [],
  mitigations: [],
  residualRiskLevel: '',
};

function AssessmentForm({ assessment, onCancel, onSaved }: { assessment: Assessment | null; onCancel: () => void; onSaved: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() =>
    assessment
      ? {
          title: assessment.title,
          featureOrSystem: assessment.featureOrSystem,
          description: assessment.description,
          dataCategories: assessment.dataCategories,
          processingOperations: fromLines(assessment.processingOperations),
          necessity: assessment.necessity,
          proportionality: assessment.proportionality,
          risks: readRisks(assessment.risks).risks.map(({ description, likelihood, impact }) => ({ description, likelihood, impact })),
          mitigations: readMitigations(assessment.mitigations).mitigations,
          residualRiskLevel: assessment.residualRiskLevel,
        }
      : EMPTY_FORM
  );
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const unreadable = assessment ? readRisks(assessment.risks).unreadable + readMitigations(assessment.mitigations).unreadable : 0;

  const problems: string[] = [];
  if (!form.title.trim()) problems.push('Give the assessment a title.');
  if (!form.featureOrSystem.trim()) problems.push('Name the feature or system it covers.');
  if (!form.description.trim()) problems.push('Describe what the feature does with personal information.');
  if (!form.necessity.trim()) problems.push('Say why the processing is necessary.');
  if (!form.proportionality.trim()) problems.push('Say why it is proportionate.');
  if (!form.residualRiskLevel) problems.push('Rate the risk that is left after the measures.');
  if (form.risks.some((risk) => !risk.description.trim())) problems.push('Describe every risk, or remove the empty one.');
  if (form.mitigations.some((m) => !m.measure.trim())) problems.push('Describe every measure, or remove the empty one.');

  const reopening = assessment?.status === 'APPROVED';

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        featureOrSystem: form.featureOrSystem.trim(),
        description: form.description.trim(),
        dataCategories: form.dataCategories,
        processingOperations: toLines(form.processingOperations),
        necessity: form.necessity.trim(),
        proportionality: form.proportionality.trim(),
        residualRiskLevel: form.residualRiskLevel,
        risks: form.risks.map((risk) => ({ ...risk, description: risk.description.trim() })),
        mitigations: form.mitigations.map((m) => ({
          measure: m.measure.trim(),
          status: m.status,
          risk: m.risk || null,
          owner: m.owner?.trim() || null,
        })),
        // A changed approved assessment goes back for sign-off; the approval
        // was given to the version before this one.
        ...(reopening ? { status: 'PENDING_REVIEW' } : {}),
      };
      return assessment ? api.patch(`/gdpr/dpia/${assessment.id}`, body) : api.post('/gdpr/dpia', body);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dpia'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dpia-options'] });
      toast.success(reopening ? 'Saved, and sent back for sign-off.' : assessment ? 'Saved.' : 'Assessment started as a draft.');
      onSaved((response.data as { data: Assessment }).data.id);
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That was not saved.'),
  });

  const field = (name: string) => `dpia-${name}`;
  const textArea = (key: 'description' | 'necessity' | 'proportionality' | 'processingOperations', label: string, placeholder?: string) => (
    <div>
      <label htmlFor={field(key)} className="block text-xs text-slate-500">
        {label}
      </label>
      <textarea id={field(key)} value={form[key]} onChange={(e) => set(key, e.target.value)} rows={3} placeholder={placeholder} className="input w-full text-sm" />
    </div>
  );

  return (
    <div className="card mb-6 space-y-4">
      <h2 className="font-semibold text-slate-900 dark:text-white">{assessment ? `Edit: ${assessment.title}` : 'Start an assessment'}</h2>
      {reopening && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          This assessment is approved. Saving a change sends it back for sign-off, because the approval was given to the version before it.
        </p>
      )}
      {unreadable > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          {unreadable} {unreadable === 1 ? 'entry was' : 'entries were'} recorded in a form this screen cannot read. Saving replaces the risks and measures
          with the ones shown below.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={field('title')} className="block text-xs text-slate-500">
            Title
          </label>
          <input id={field('title')} value={form.title} onChange={(e) => set('title', e.target.value)} className="input w-full text-sm" />
        </div>
        <div>
          <label htmlFor={field('feature')} className="block text-xs text-slate-500">
            Feature or system
          </label>
          <input id={field('feature')} value={form.featureOrSystem} onChange={(e) => set('featureOrSystem', e.target.value)} placeholder="Safety plans" className="input w-full text-sm" />
        </div>
      </div>

      {textArea('description', 'What it does with personal information')}

      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-slate-500">Kinds of information</legend>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          {DATA_CATEGORIES.map((category) => (
            <label key={category.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.dataCategories.includes(category.value)}
                onChange={(e) =>
                  set('dataCategories', e.target.checked ? [...form.dataCategories, category.value] : form.dataCategories.filter((value) => value !== category.value))
                }
                className="rounded border-slate-300"
              />
              {category.label}
            </label>
          ))}
        </div>
      </fieldset>

      {textArea('processingOperations', 'What is done to it, one step per line', 'Collected at sign-up\nStored encrypted\nShown to moderators')}
      <div className="grid gap-3 sm:grid-cols-2">
        {textArea('necessity', 'Why it is necessary')}
        {textArea('proportionality', 'Why it is proportionate')}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wide text-slate-500">Risks to the people whose information it is</legend>
        {form.risks.map((risk, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto] dark:border-slate-700">
            <input
              aria-label={`Risk ${index + 1}`}
              value={risk.description}
              onChange={(e) => set('risks', form.risks.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)))}
              placeholder="What could happen, and to whom"
              className="input text-sm"
            />
            <select
              aria-label={`Risk ${index + 1} likelihood`}
              value={risk.likelihood}
              onChange={(e) => set('risks', form.risks.map((r, i) => (i === index ? { ...r, likelihood: e.target.value as RiskLevel } : r)))}
              className="input text-sm"
            >
              {RISK_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} likelihood
                </option>
              ))}
            </select>
            <select
              aria-label={`Risk ${index + 1} impact`}
              value={risk.impact}
              onChange={(e) => set('risks', form.risks.map((r, i) => (i === index ? { ...r, impact: e.target.value as RiskLevel } : r)))}
              className="input text-sm"
            >
              {RISK_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} impact
                </option>
              ))}
            </select>
            <button type="button" onClick={() => set('risks', form.risks.filter((_, i) => i !== index))} className="p-2 text-slate-400 hover:text-red-600" aria-label={`Remove risk ${index + 1}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set('risks', [...form.risks, { description: '', likelihood: 'MEDIUM', impact: 'MEDIUM' }])} className="btn-outline inline-flex items-center gap-1 text-sm">
          <Plus className="h-4 w-4" /> Add a risk
        </button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wide text-slate-500">What is done about them</legend>
        {form.mitigations.map((mitigation, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-2 dark:border-slate-700">
            <input
              aria-label={`Measure ${index + 1}`}
              value={mitigation.measure}
              onChange={(e) => set('mitigations', form.mitigations.map((m, i) => (i === index ? { ...m, measure: e.target.value } : m)))}
              placeholder="The measure"
              className="input text-sm sm:col-span-2"
            />
            <select
              aria-label={`Measure ${index + 1} answers`}
              value={mitigation.risk ?? ''}
              onChange={(e) => set('mitigations', form.mitigations.map((m, i) => (i === index ? { ...m, risk: e.target.value || null } : m)))}
              className="input text-sm"
            >
              <option value="">Answers no single risk</option>
              {form.risks
                .filter((risk) => risk.description.trim())
                .map((risk) => (
                  <option key={risk.description} value={risk.description.trim()}>
                    {risk.description.trim()}
                  </option>
                ))}
              {mitigation.risk && !form.risks.some((risk) => risk.description.trim() === mitigation.risk) && <option value={mitigation.risk}>{mitigation.risk}</option>}
            </select>
            <div className="flex gap-2">
              <select
                aria-label={`Measure ${index + 1} status`}
                value={mitigation.status}
                onChange={(e) => set('mitigations', form.mitigations.map((m, i) => (i === index ? { ...m, status: e.target.value as MitigationStatus } : m)))}
                className="input flex-1 text-sm"
              >
                {MITIGATION_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Measure ${index + 1} owner`}
                value={mitigation.owner ?? ''}
                onChange={(e) => set('mitigations', form.mitigations.map((m, i) => (i === index ? { ...m, owner: e.target.value } : m)))}
                placeholder="Owner"
                className="input w-28 text-sm"
              />
              <button
                type="button"
                onClick={() => set('mitigations', form.mitigations.filter((_, i) => i !== index))}
                className="p-2 text-slate-400 hover:text-red-600"
                aria-label={`Remove measure ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set('mitigations', [...form.mitigations, { measure: '', status: 'PLANNED', risk: null, owner: null }])}
          className="btn-outline inline-flex items-center gap-1 text-sm"
        >
          <Plus className="h-4 w-4" /> Add a measure
        </button>
      </fieldset>

      <div className="max-w-xs">
        <label htmlFor={field('residual')} className="block text-xs text-slate-500">
          Risk left once the measures are in place
        </label>
        <select id={field('residual')} value={form.residualRiskLevel} onChange={(e) => set('residualRiskLevel', e.target.value as RiskLevel)} className="input w-full text-sm">
          <option value="">Choose…</option>
          {RISK_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {problems.length > 0 && (form.title || form.description || form.featureOrSystem) && (
        <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending || problems.length > 0} className="btn-primary text-sm">
          {save.isPending ? 'Saving…' : assessment ? 'Save' : 'Start as a draft'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AssessmentPanel({ assessment, onClose, onEdit }: { assessment: Assessment; onClose: () => void; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [signOff, setSignOff] = useState({
    residualRiskAccepted: assessment.residualRiskAccepted,
    dpoConsulted: assessment.dpoConsulted,
    dpoComments: assessment.dpoComments ?? '',
    regulatorConsulted: assessment.regulatorConsulted,
    regulatorResponse: assessment.regulatorResponse ?? '',
  });
  const [reviewDate, setReviewDate] = useState(toDateInput(assessment.nextReviewDate));

  const { risks, unreadable: unreadableRisks } = readRisks(assessment.risks);
  const { mitigations, unreadable: unreadableMitigations } = readMitigations(assessment.mitigations);

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/gdpr/dpia/${assessment.id}`, body),
    onSuccess: (_response, body) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dpia'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dpia-options'] });
      const status = body.status as DpiaStatus | undefined;
      toast.success(
        status === 'APPROVED'
          ? 'Approved.'
          : status === 'PENDING_REVIEW'
            ? 'Sent for sign-off.'
            : status === 'REJECTED'
              ? 'Recorded as not approved.'
              : status === 'DRAFT'
                ? 'Reopened as a draft.'
                : 'Saved.'
      );
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That was not saved.'),
  });

  const highResidual = assessment.residualRiskLevel === 'HIGH';
  const consultation = {
    residualRiskAccepted: signOff.residualRiskAccepted,
    dpoConsulted: signOff.dpoConsulted,
    dpoComments: signOff.dpoComments.trim() || undefined,
    regulatorConsulted: signOff.regulatorConsulted,
    regulatorResponse: signOff.regulatorResponse.trim() || undefined,
  };
  const field = (name: string) => `dpia-${name}-${assessment.id}`;

  return (
    <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6" aria-label="Impact assessment">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      <div className="pr-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{assessment.title}</h2>
        <p className="text-xs text-slate-500">
          {assessment.featureOrSystem} · {labelOf(DPIA_STATUSES, assessment.status)}
          {assessment.status === 'APPROVED' && assessment.approvedAt
            ? ` ${longDate(assessment.approvedAt)}${assessment.approvedByName ? ` by ${assessment.approvedByName}` : ''}`
            : ''}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{assessment.description}</p>
      </div>

      <dl className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
        {assessment.dataCategories.length > 0 && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Kinds of information</dt>
            <dd className="text-slate-700 dark:text-slate-300">{assessment.dataCategories.map((value) => labelOf(DATA_CATEGORIES, value)).join(', ')}</dd>
          </div>
        )}
        {assessment.processingOperations.length > 0 && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">What is done to it</dt>
            <dd className="text-slate-700 dark:text-slate-300">{assessment.processingOperations.join(' → ')}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Why it is necessary</dt>
          <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{assessment.necessity}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Why it is proportionate</dt>
          <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{assessment.proportionality}</dd>
        </div>
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risks</p>
        {risks.length === 0 && unreadableRisks === 0 ? (
          <p className="text-sm text-slate-500">None recorded.</p>
        ) : (
          <table className="mt-1 w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 font-normal">Risk</th>
                <th className="py-1 font-normal">Likely</th>
                <th className="py-1 font-normal">Impact</th>
                <th className="py-1 text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...risks]
                .sort((a, b) => scoreOf(b) - scoreOf(a))
                .map((risk, index) => (
                  <tr key={index}>
                    <td className="py-1 pr-2 text-slate-700 dark:text-slate-300">{risk.description}</td>
                    <td className={cn('py-1', RISK_TONE[risk.likelihood])}>{labelOf(RISK_LEVELS, risk.likelihood)}</td>
                    <td className={cn('py-1', RISK_TONE[risk.impact])}>{labelOf(RISK_LEVELS, risk.impact)}</td>
                    <td className="py-1 text-right font-medium">{scoreOf(risk)} / 9</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        {unreadableRisks > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{unreadableRisks} more recorded in a form this screen cannot read.</p>}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What is done about them</p>
        {mitigations.length === 0 && unreadableMitigations === 0 ? (
          <p className="text-sm text-slate-500">No measures recorded.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {mitigations.map((mitigation, index) => (
              <li key={index} className="text-slate-700 dark:text-slate-300">
                <span className="font-medium">{mitigation.measure}</span>
                <span className="block text-xs text-slate-500">
                  {labelOf(MITIGATION_STATUSES, mitigation.status)}
                  {mitigation.owner ? ` · ${mitigation.owner}` : ''}
                  {mitigation.risk ? ` · answers “${mitigation.risk}”` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {unreadableMitigations > 0 && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{unreadableMitigations} more recorded in a form this screen cannot read.</p>
        )}
      </div>

      <p className="text-sm">
        Risk left: <span className={cn('font-medium', RISK_TONE[assessment.residualRiskLevel])}>{labelOf(RISK_LEVELS, assessment.residualRiskLevel)}</span>
        {assessment.residualRiskAccepted ? ' · accepted on the record' : ''}
      </p>

      {(assessment.dpoConsulted || assessment.regulatorConsulted) && (
        <dl className="space-y-2 text-sm">
          {assessment.dpoConsulted && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Privacy officer consulted</dt>
              <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{assessment.dpoComments || 'No comments recorded'}</dd>
            </div>
          )}
          {assessment.regulatorConsulted && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Regulator consulted</dt>
              <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{assessment.regulatorResponse || 'No response recorded'}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button type="button" onClick={onEdit} className="btn-outline text-sm">
          Edit
        </button>
        {(assessment.status === 'DRAFT' || assessment.status === 'REJECTED') && (
          <button type="button" onClick={() => update.mutate({ status: 'PENDING_REVIEW' })} disabled={update.isPending} className="btn-primary text-sm">
            Send for sign-off
          </button>
        )}
        {assessment.status === 'APPROVED' && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reopen this assessment? Its approval is withdrawn until it is signed off again.')) update.mutate({ status: 'DRAFT' });
            }}
            disabled={update.isPending}
            className="text-sm text-slate-500 hover:underline"
          >
            Reopen
          </button>
        )}
      </div>

      {assessment.status === 'PENDING_REVIEW' && (
        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sign-off</p>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={signOff.dpoConsulted} onChange={(e) => setSignOff({ ...signOff, dpoConsulted: e.target.checked })} className="rounded border-slate-300" />
            The privacy officer was consulted
          </label>
          {signOff.dpoConsulted && (
            <textarea
              aria-label="What the privacy officer said"
              value={signOff.dpoComments}
              onChange={(e) => setSignOff({ ...signOff, dpoComments: e.target.value })}
              rows={2}
              placeholder="What the privacy officer said"
              className="input w-full text-sm"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={signOff.regulatorConsulted} onChange={(e) => setSignOff({ ...signOff, regulatorConsulted: e.target.checked })} className="rounded border-slate-300" />
            A regulator was consulted
          </label>
          {signOff.regulatorConsulted && (
            <textarea
              aria-label="What the regulator said"
              value={signOff.regulatorResponse}
              onChange={(e) => setSignOff({ ...signOff, regulatorResponse: e.target.value })}
              rows={2}
              placeholder="What the regulator said"
              className="input w-full text-sm"
            />
          )}
          {highResidual && (
            <label className="flex items-start gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              <input
                type="checkbox"
                checked={signOff.residualRiskAccepted}
                onChange={(e) => setSignOff({ ...signOff, residualRiskAccepted: e.target.checked })}
                className="mt-0.5 rounded border-red-300"
              />
              <span>
                I accept the high risk that is left, on the record.
                <span className="block text-xs">An assessment left at high risk cannot be approved without this.</span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={update.isPending || (highResidual && !signOff.residualRiskAccepted)}
              onClick={() => update.mutate({ status: 'APPROVED', ...consultation })}
              className="btn-primary text-sm"
            >
              Approve
            </button>
            <button type="button" disabled={update.isPending} onClick={() => update.mutate({ status: 'REJECTED', ...consultation })} className="btn-outline text-sm">
              Do not approve
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <label htmlFor={field('review')} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Review again by
        </label>
        <div className="flex flex-wrap gap-2">
          <input id={field('review')} type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="input text-sm" />
          <button
            type="button"
            disabled={update.isPending || !reviewDate || reviewDate === toDateInput(assessment.nextReviewDate)}
            onClick={() => update.mutate({ nextReviewDate: fromDateInput(reviewDate) })}
            className="btn-outline text-sm"
          >
            Set
          </button>
        </div>
      </div>
    </aside>
  );
}
