'use client';

/**
 * The record of processing activities: what ATHENA does with personal
 * information, why, on what basis, who receives it, where it goes and how long
 * it is kept. For a Queensland company it is how APP 1.2's accountable
 * practices are shown; for members in the UK and the EU it is the Article 30
 * record. It is also the first thing a regulator asks for.
 *
 * The API behind it was complete and nothing called it, so a record that can
 * only be kept with curl was a record nobody kept. Activities are retired, not
 * deleted: an accountability record that can be made to forget something was
 * ever done is not one.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, BookOpen, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DATA_CATEGORIES,
  DPIA_STATUSES,
  LEGAL_BASES,
  errorMessage,
  fromDateInput,
  fromLines,
  labelOf,
  longDate,
  toDateInput,
  toLines,
  type DpiaStatus,
} from '../_records/vocabulary';

type Activity = {
  id: string;
  name: string;
  description: string;
  department: string;
  dataSubjectCategories: string[];
  dataCategories: string[];
  dataElements: string[];
  legalBasis: string;
  legalBasisDetails: string | null;
  purposes: string[];
  recipients: string[];
  thirdCountryTransfers: string[];
  transferSafeguards: string | null;
  retentionPeriod: string;
  retentionJustification: string | null;
  securityMeasures: string[];
  dpiaRequired: boolean;
  dpiaId: string | null;
  subprocessors: string[];
  isActive: boolean;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type Paged<T> = { success: boolean; data: T[]; pagination: { page: number; limit: number; total: number; pages: number; hasMore: boolean } };
type DpiaOption = { id: string; title: string; status: DpiaStatus; featureOrSystem: string };

type Filter = 'true' | 'false' | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'true', label: 'In use' },
  { value: 'false', label: 'Retired' },
  { value: 'all', label: 'All' },
];

/** The list columns, each edited as one entry per line. */
const LIST_FIELDS = [
  { key: 'purposes', label: 'Purposes', hint: 'Why it is done, one per line' },
  { key: 'dataSubjectCategories', label: 'Whose information', hint: 'Members, employers, mentors… one per line' },
  { key: 'dataElements', label: 'What is collected', hint: 'The fields themselves, one per line' },
  { key: 'recipients', label: 'Who receives it', hint: 'Teams and outside parties, one per line' },
  { key: 'thirdCountryTransfers', label: 'Countries it goes to outside Australia', hint: 'One per line; leave empty if none' },
  { key: 'securityMeasures', label: 'How it is protected', hint: 'One per line' },
  { key: 'subprocessors', label: 'Service providers who handle it', hint: 'One per line' },
] as const;

type ListKey = (typeof LIST_FIELDS)[number]['key'];

type FormState = {
  name: string;
  description: string;
  department: string;
  legalBasis: string;
  legalBasisDetails: string;
  retentionPeriod: string;
  retentionJustification: string;
  transferSafeguards: string;
  dpiaRequired: boolean;
  dpiaId: string;
  nextReviewDate: string;
  dataCategories: string[];
} & Record<ListKey, string>;

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  department: '',
  legalBasis: '',
  legalBasisDetails: '',
  retentionPeriod: '',
  retentionJustification: '',
  transferSafeguards: '',
  dpiaRequired: false,
  dpiaId: '',
  nextReviewDate: '',
  dataCategories: [],
  purposes: '',
  dataSubjectCategories: '',
  dataElements: '',
  recipients: '',
  thirdCountryTransfers: '',
  securityMeasures: '',
  subprocessors: '',
};

function formFrom(activity: Activity): FormState {
  return {
    name: activity.name,
    description: activity.description,
    department: activity.department,
    legalBasis: activity.legalBasis,
    legalBasisDetails: activity.legalBasisDetails ?? '',
    retentionPeriod: activity.retentionPeriod,
    retentionJustification: activity.retentionJustification ?? '',
    transferSafeguards: activity.transferSafeguards ?? '',
    dpiaRequired: activity.dpiaRequired,
    dpiaId: activity.dpiaId ?? '',
    nextReviewDate: toDateInput(activity.nextReviewDate),
    dataCategories: activity.dataCategories,
    purposes: fromLines(activity.purposes),
    dataSubjectCategories: fromLines(activity.dataSubjectCategories),
    dataElements: fromLines(activity.dataElements),
    recipients: fromLines(activity.recipients),
    thirdCountryTransfers: fromLines(activity.thirdCountryTransfers),
    securityMeasures: fromLines(activity.securityMeasures),
    subprocessors: fromLines(activity.subprocessors),
  };
}

/** Where an activity stands against its own review date. */
function reviewState(activity: Activity): { text: string; tone: string } | null {
  if (!activity.isActive) return null;
  if (activity.nextReviewDate && new Date(activity.nextReviewDate).getTime() < Date.now()) {
    return { text: `Review was due ${longDate(activity.nextReviewDate)}`, tone: 'text-amber-700 dark:text-amber-300' };
  }
  if (!activity.lastReviewDate) return { text: 'Never reviewed', tone: 'text-slate-500' };
  return { text: `Reviewed ${longDate(activity.lastReviewDate)}`, tone: 'text-slate-500' };
}

export default function ProcessingRegisterPage() {
  const [filter, setFilter] = useState<Filter>('true');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | Activity | null>(null);

  const register = useQuery({
    queryKey: ['admin-ropa', filter, page],
    queryFn: async () => {
      const response = await api.get('/gdpr/ropa', { params: { page, limit: 50, ...(filter === 'all' ? {} : { active: filter }) } });
      return response.data as Paged<Activity>;
    },
  });

  // The assessments an activity can point at. Only needed for linking, so a
  // failure here is said where the link is chosen rather than blocking the page.
  const assessments = useQuery({
    queryKey: ['admin-dpia-options'],
    queryFn: async () => (await api.get('/gdpr/dpia', { params: { limit: 100 } })).data as Paged<DpiaOption>,
  });

  const activities = register.data?.data ?? [];
  const pages = register.data?.pagination.pages ?? 1;
  const selected = activities.find((activity) => activity.id === selectedId) ?? null;
  const dpias = assessments.data?.data ?? [];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin/compliance" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Privacy &amp; compliance
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <BookOpen className="h-7 w-7 text-emerald-600" /> Record of processing activities
          </h1>
          <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-400">
            What we do with personal information, why, on what basis, who receives it and how long it is kept. It is how the Australian Privacy
            Principles&apos; accountable practices are shown, and the Article 30 record for members in the UK and the EU.{' '}
            <Link href="/admin/dpia" className="text-primary-600 hover:underline">
              Impact assessments
            </Link>{' '}
            sit behind the riskier ones.
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing('new')} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Record an activity
          </button>
        )}
      </div>

      {editing && (
        <ActivityForm
          key={editing === 'new' ? 'new' : editing.id}
          activity={editing === 'new' ? null : editing}
          dpias={dpias}
          dpiasFailed={assessments.isError}
          onCancel={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            setSelectedId(id);
          }}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Which activities">
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

      <div className={cn('grid gap-6', selected ? 'lg:grid-cols-[minmax(0,1fr)_480px]' : 'grid-cols-1')}>
        <div>
          {register.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading the record" />
            </div>
          ) : register.isError ? (
            <div className="card flex flex-col items-start gap-3 border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-900/20" role="alert">
              <p className="font-medium text-red-800 dark:text-red-200">The record could not be loaded.</p>
              <p className="text-sm text-red-700 dark:text-red-300">{errorMessage(register.error) ?? 'The server did not answer.'}</p>
              <button type="button" onClick={() => register.refetch()} className="btn-outline inline-flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : activities.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">
              {filter === 'true' ? 'No processing activity is recorded yet. Start with the ones that handle safety or health information.' : 'Nothing here.'}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
                {activities.map((activity) => {
                  const review = reviewState(activity);
                  const missingAssessment = activity.isActive && activity.dpiaRequired && !activity.dpiaId;
                  return (
                    <li key={activity.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(activity.id)}
                        className={cn(
                          'flex w-full flex-col gap-1 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800',
                          selectedId === activity.id && 'bg-emerald-50 dark:bg-emerald-900/10'
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900 dark:text-white">{activity.name}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{activity.department}</span>
                          {!activity.isActive && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">Retired</span>
                          )}
                          {missingAssessment && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                              Assessment needed, none linked
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-slate-500">
                          {labelOf(LEGAL_BASES, activity.legalBasis)} · kept {activity.retentionPeriod}
                          {review && <span className={review.tone}> · {review.text}</span>}
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
          <ActivityPanel
            key={selected.id}
            activity={selected}
            dpias={dpias}
            onClose={() => setSelectedId(null)}
            onEdit={() => setEditing(selected)}
          />
        )}
      </div>
    </div>
  );
}

function ActivityForm({
  activity,
  dpias,
  dpiasFailed,
  onCancel,
  onSaved,
}: {
  activity: Activity | null;
  dpias: DpiaOption[];
  dpiasFailed: boolean;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(activity ? formFrom(activity) : EMPTY_FORM);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const problems: string[] = [];
  if (!form.name.trim()) problems.push('Name the activity.');
  if (!form.description.trim()) problems.push('Describe what is done.');
  if (!form.department.trim()) problems.push('Say which team does it.');
  if (!form.legalBasis) problems.push('Choose the basis it rests on.');
  if (!form.retentionPeriod.trim()) problems.push('Say how long the information is kept.');

  const save = useMutation({
    mutationFn: () => {
      const lists = Object.fromEntries(LIST_FIELDS.map(({ key }) => [key, toLines(form[key])]));
      // An amendment sends null for an emptied optional field so it is
      // cleared; a new record simply leaves it out.
      const optional = (value: string) => (value.trim() ? value.trim() : activity ? null : undefined);
      // Safeguards only describe transfers, and a linked assessment only
      // stands behind an activity that needs one; with the reason gone, so is
      // the field, rather than a hidden value riding along.
      const hasTransfers = toLines(form.thirdCountryTransfers).length > 0;
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        department: form.department.trim(),
        legalBasis: form.legalBasis,
        retentionPeriod: form.retentionPeriod.trim(),
        dataCategories: form.dataCategories,
        dpiaRequired: form.dpiaRequired,
        legalBasisDetails: optional(form.legalBasisDetails),
        retentionJustification: optional(form.retentionJustification),
        transferSafeguards: optional(hasTransfers ? form.transferSafeguards : ''),
        dpiaId: form.dpiaRequired && form.dpiaId ? form.dpiaId : activity ? null : undefined,
        nextReviewDate: form.nextReviewDate ? fromDateInput(form.nextReviewDate) : activity ? null : undefined,
        ...lists,
      };
      return activity ? api.patch(`/gdpr/ropa/${activity.id}`, body) : api.post('/gdpr/ropa', body);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-ropa'] });
      toast.success(activity ? 'Activity amended.' : 'Activity recorded.');
      onSaved((response.data as { data: Activity }).data.id);
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That was not saved.'),
  });

  const field = (name: string) => `ropa-${name}`;
  const transfersNamed = toLines(form.thirdCountryTransfers).length > 0;

  return (
    <div className="card mb-6 space-y-4">
      <h2 className="font-semibold text-slate-900 dark:text-white">{activity ? `Amend: ${activity.name}` : 'Record an activity'}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={field('name')} className="block text-xs text-slate-500">
            Name
          </label>
          <input id={field('name')} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Safety plan storage" className="input w-full text-sm" />
        </div>
        <div>
          <label htmlFor={field('department')} className="block text-xs text-slate-500">
            Team
          </label>
          <input id={field('department')} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Trust & Safety" className="input w-full text-sm" />
        </div>
      </div>

      <div>
        <label htmlFor={field('description')} className="block text-xs text-slate-500">
          What is done with the information
        </label>
        <textarea id={field('description')} value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="input w-full text-sm" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={field('basis')} className="block text-xs text-slate-500">
            The basis it rests on
          </label>
          <select id={field('basis')} value={form.legalBasis} onChange={(e) => set('legalBasis', e.target.value)} className="input w-full text-sm">
            <option value="">Choose…</option>
            {LEGAL_BASES.map((basis) => (
              <option key={basis.value} value={basis.value}>
                {basis.label}
                {basis.hint ? ` (${basis.hint})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={field('basis-details')} className="block text-xs text-slate-500">
            Why that basis applies (optional)
          </label>
          <input id={field('basis-details')} value={form.legalBasisDetails} onChange={(e) => set('legalBasisDetails', e.target.value)} className="input w-full text-sm" />
        </div>
      </div>

      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-slate-500">Kinds of information</legend>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          {DATA_CATEGORIES.map((category) => (
            <label key={category.value} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.dataCategories.includes(category.value)}
                onChange={(e) =>
                  set('dataCategories', e.target.checked ? [...form.dataCategories, category.value] : form.dataCategories.filter((value) => value !== category.value))
                }
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                {category.label}
                {category.hint && <span className="block text-xs text-slate-500">{category.hint}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        {LIST_FIELDS.map(({ key, label, hint }) => (
          <div key={key}>
            <label htmlFor={field(key)} className="block text-xs text-slate-500">
              {label}
            </label>
            <textarea id={field(key)} value={form[key]} onChange={(e) => set(key, e.target.value)} rows={3} placeholder={hint} className="input w-full text-sm" />
          </div>
        ))}
        {transfersNamed && (
          <div>
            <label htmlFor={field('safeguards')} className="block text-xs text-slate-500">
              How those transfers are protected
            </label>
            <textarea
              id={field('safeguards')}
              value={form.transferSafeguards}
              onChange={(e) => set('transferSafeguards', e.target.value)}
              rows={3}
              placeholder="APP 8 contract terms, standard contractual clauses, adequacy…"
              className="input w-full text-sm"
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={field('retention')} className="block text-xs text-slate-500">
            How long it is kept
          </label>
          <input id={field('retention')} value={form.retentionPeriod} onChange={(e) => set('retentionPeriod', e.target.value)} placeholder="Until the account is closed, then 30 days" className="input w-full text-sm" />
        </div>
        <div>
          <label htmlFor={field('retention-why')} className="block text-xs text-slate-500">
            Why that long (optional)
          </label>
          <input id={field('retention-why')} value={form.retentionJustification} onChange={(e) => set('retentionJustification', e.target.value)} className="input w-full text-sm" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={form.dpiaRequired} onChange={(e) => set('dpiaRequired', e.target.checked)} className="rounded border-slate-300" />
            An impact assessment is needed for this
          </label>
          {form.dpiaRequired && (
            <div>
              <label htmlFor={field('dpia')} className="block text-xs text-slate-500">
                The assessment behind it
              </label>
              {dpiasFailed ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">The assessments could not be loaded, so one cannot be linked right now.</p>
              ) : (
                <select id={field('dpia')} value={form.dpiaId} onChange={(e) => set('dpiaId', e.target.value)} className="input w-full text-sm">
                  <option value="">None linked yet</option>
                  {dpias.map((dpia) => (
                    <option key={dpia.id} value={dpia.id}>
                      {dpia.title} ({labelOf(DPIA_STATUSES, dpia.status)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor={field('next-review')} className="block text-xs text-slate-500">
            Review again by (optional)
          </label>
          <input id={field('next-review')} type="date" value={form.nextReviewDate} onChange={(e) => set('nextReviewDate', e.target.value)} className="input w-full text-sm" />
        </div>
      </div>

      {problems.length > 0 && (form.name || form.description || form.department) && (
        <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending || problems.length > 0} className="btn-primary text-sm">
          {save.isPending ? 'Saving…' : activity ? 'Save the amendment' : 'Record the activity'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ActivityPanel({
  activity,
  dpias,
  onClose,
  onEdit,
}: {
  activity: Activity;
  dpias: DpiaOption[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-ropa'] });

  const reviewed = useMutation({
    mutationFn: () => api.patch(`/gdpr/ropa/${activity.id}`, { reviewed: true }),
    onSuccess: () => {
      refresh();
      toast.success('Recorded as reviewed today.');
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That was not recorded.'),
  });

  const retire = useMutation({
    mutationFn: () => api.delete(`/gdpr/ropa/${activity.id}`),
    onSuccess: () => {
      refresh();
      toast.success('Retired. It stays on the record.');
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'It was not retired.'),
  });

  const reinstate = useMutation({
    mutationFn: () => api.patch(`/gdpr/ropa/${activity.id}`, { isActive: true }),
    onSuccess: () => {
      refresh();
      toast.success('Back in use.');
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'It was not reinstated.'),
  });

  const linked = activity.dpiaId ? dpias.find((dpia) => dpia.id === activity.dpiaId) : null;
  const rows: Array<[string, string | string[] | null]> = [
    ['Kinds of information', activity.dataCategories.map((value) => labelOf(DATA_CATEGORIES, value))],
    ['Purposes', activity.purposes],
    ['Whose information', activity.dataSubjectCategories],
    ['What is collected', activity.dataElements],
    ['Who receives it', activity.recipients],
    ['Countries outside Australia', activity.thirdCountryTransfers],
    ['How those transfers are protected', activity.transferSafeguards],
    ['How it is protected', activity.securityMeasures],
    ['Service providers', activity.subprocessors],
    ['Why that basis', activity.legalBasisDetails],
    ['Why it is kept that long', activity.retentionJustification],
  ];

  return (
    <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6" aria-label="Processing activity">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      <div className="pr-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{activity.name}</h2>
        <p className="text-xs text-slate-500">
          {activity.department} · {labelOf(LEGAL_BASES, activity.legalBasis)} · kept {activity.retentionPeriod}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{activity.description}</p>
      </div>

      <dl className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
        {rows
          .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(value)))
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{Array.isArray(value) ? value.join(', ') : value}</dd>
            </div>
          ))}
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Impact assessment</dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {!activity.dpiaRequired ? (
              'Not needed'
            ) : activity.dpiaId ? (
              <Link href="/admin/dpia" className="text-primary-600 hover:underline">
                {linked ? `${linked.title} (${labelOf(DPIA_STATUSES, linked.status)})` : 'Linked assessment'}
              </Link>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">Needed, and none is linked</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Reviews</dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {activity.lastReviewDate ? `Last reviewed ${longDate(activity.lastReviewDate)}` : 'Never reviewed'}
            {activity.nextReviewDate ? ` · next by ${longDate(activity.nextReviewDate)}` : ''}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button type="button" onClick={onEdit} className="btn-outline text-sm">
          Amend
        </button>
        {activity.isActive && (
          <button type="button" onClick={() => reviewed.mutate()} disabled={reviewed.isPending} className="btn-outline text-sm">
            {reviewed.isPending ? 'Recording…' : 'Reviewed today'}
          </button>
        )}
        {activity.isActive ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Retire this activity? It stays on the record, marked as no longer done.')) retire.mutate();
            }}
            disabled={retire.isPending}
            className="text-sm text-slate-500 hover:underline"
          >
            Retire
          </button>
        ) : (
          <button type="button" onClick={() => reinstate.mutate()} disabled={reinstate.isPending} className="text-sm text-slate-500 hover:underline">
            Back in use
          </button>
        )}
      </div>
    </aside>
  );
}
