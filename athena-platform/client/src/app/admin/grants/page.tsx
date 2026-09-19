'use client';

/**
 * Grants, from the platform's side, in two tabs.
 *
 * Programmes is the directory's only write path. Nothing is seeded, because
 * real programmes change and a stale listing costs a founder a wasted
 * application; staff enter each one from the funder's published page, and
 * the official application link is required for that reason. Every field is
 * one the match scorers read.
 *
 * Applications records what the provider decided. Grant providers are
 * outside organisations; their decision comes back through whoever handles
 * partnerships and is recorded here. The applicant is told in the app and by
 * email the moment it is saved.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ExternalLink, Loader2, Landmark, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { adminGrantsApi, type GrantProgramme, type GrantProgrammeInput, type GrantProviderType } from '@/lib/admin-grants-api';
import { cn } from '@/lib/utils';

const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
const aud = (v: unknown) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(v));

const PROVIDER_TYPES: Array<[GrantProviderType, string]> = [
  ['FEDERAL', 'Federal'],
  ['STATE', 'State'],
  ['PRIVATE_FOUNDATION', 'Foundation'],
  ['CORPORATE', 'Corporate'],
  ['INTERNATIONAL', 'International'],
];
const providerLabel = (type: string) => PROVIDER_TYPES.find(([value]) => value === type)?.[1] ?? type;

// ===========================================================================
// PROGRAMMES
// ===========================================================================

type ProgrammeForm = {
  name: string;
  provider: string;
  providerType: GrantProviderType;
  description: string;
  minFunding: string;
  maxFunding: string;
  industries: string;
  stages: string;
  regions: string;
  tags: string;
  applicationUrl: string;
  isRolling: boolean;
  deadline: string;
  requirements: string;
};

const EMPTY_FORM: ProgrammeForm = {
  name: '',
  provider: '',
  providerType: 'STATE',
  description: '',
  minFunding: '',
  maxFunding: '',
  industries: '',
  stages: '',
  regions: '',
  tags: '',
  applicationUrl: '',
  isRolling: false,
  deadline: '',
  requirements: '',
};

const listOf = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

const toInput = (f: ProgrammeForm): GrantProgrammeInput => ({
  name: f.name.trim(),
  provider: f.provider.trim(),
  providerType: f.providerType,
  description: f.description.trim(),
  minFunding: f.minFunding.trim() ? Number(f.minFunding) : null,
  maxFunding: f.maxFunding.trim() ? Number(f.maxFunding) : null,
  industries: listOf(f.industries),
  stages: listOf(f.stages),
  regions: listOf(f.regions),
  tags: listOf(f.tags),
  requirements: f.requirements.trim() || null,
  applicationUrl: f.applicationUrl.trim(),
  isRolling: f.isRolling,
  deadline: f.isRolling ? null : f.deadline || null,
});

const fromProgramme = (g: GrantProgramme): ProgrammeForm => ({
  name: g.name,
  provider: g.provider,
  providerType: g.providerType,
  description: g.description,
  minFunding: g.minFunding == null ? '' : String(g.minFunding),
  maxFunding: g.maxFunding == null ? '' : String(g.maxFunding),
  industries: g.industries.join(', '),
  stages: g.stages.join(', '),
  regions: g.regions.join(', '),
  tags: g.tags.join(', '),
  applicationUrl: g.applicationUrl ?? '',
  isRolling: g.isRolling,
  deadline: g.deadline ? g.deadline.slice(0, 10) : '',
  requirements: g.requirements?.text ?? '',
});

const funding = (g: GrantProgramme) => {
  const min = g.minFunding == null ? null : Number(g.minFunding);
  const max = g.maxFunding == null ? null : Number(g.maxFunding);
  if (min && max) return `${aud(min)} – ${aud(max)}`;
  if (max) return `Up to ${aud(max)}`;
  if (min) return `From ${aud(min)}`;
  return 'Not stated';
};

const closes = (g: GrantProgramme) => (g.isRolling ? 'Rolling' : g.deadline ? g.deadline.slice(0, 10) : 'To be announced');

function ProgrammesTab() {
  const queryClient = useQueryClient();
  // 'new' opens a blank form; an id opens that programme for editing.
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [form, setForm] = useState<ProgrammeForm>(EMPTY_FORM);
  const set = <K extends keyof ProgrammeForm>(key: K) => (value: ProgrammeForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const list = useQuery({
    queryKey: ['admin-grant-programmes'],
    queryFn: () => adminGrantsApi.list(),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as GrantProgramme[]) : []),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-grant-programmes'] });

  const save = useMutation({
    mutationFn: async () => {
      const res = editing && editing !== 'new' ? await adminGrantsApi.update(editing, toInput(form)) : await adminGrantsApi.create(toInput(form));
      return res.data;
    },
    onSuccess: () => {
      refresh();
      toast.success(editing === 'new' ? 'Listed. Founders can see it now.' : 'Saved.');
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not save that'),
  });

  const toggle = useMutation({
    mutationFn: (g: GrantProgramme) => adminGrantsApi.update(g.id, { isActive: !g.isActive }),
    onSuccess: (_r, g) => {
      refresh();
      toast.success(g.isActive ? 'Paused. It is off the directory until you reactivate it.' : 'Back on the directory.');
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not change that'),
  });

  const open = (target: 'new' | GrantProgramme) => {
    if (target === 'new') {
      setForm(EMPTY_FORM);
      setEditing('new');
    } else {
      setForm(fromProgramme(target));
      setEditing(target.id);
    }
  };

  const close = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const inputClass = 'input w-full text-sm';
  const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300';

  return (
    <div className={cn('grid gap-6', editing ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-1')}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">Entered from the funder&apos;s own page. Nothing here is invented, so the directory stays empty until a real programme is listed.</p>
          <button type="button" onClick={() => open('new')} className="btn-primary inline-flex items-center gap-1.5 py-2 text-sm">
            <Plus className="h-4 w-4" /> List a programme
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <p>No programmes listed yet.</p>
              <p className="mt-1 text-sm">Open a funder&apos;s page, then list it here with the link.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Programme</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Funding</th>
                  <th className="px-4 py-2">Closes</th>
                  <th className="px-4 py-2">Applications</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data!.map((g) => (
                  <tr key={g.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800', editing === g.id && 'bg-emerald-50 dark:bg-emerald-900/20')}>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => open(g)} className="text-left">
                        <span className="block font-medium text-slate-900 hover:underline dark:text-white">{g.name}</span>
                        <span className="block text-xs text-slate-500">{g.provider}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{providerLabel(g.providerType)}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{funding(g)}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{closes(g)}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{g._count?.applications ?? 0}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', g.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}>{g.isActive ? 'live' : 'paused'}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" onClick={() => toggle.mutate(g)} disabled={toggle.isPending} className="text-xs font-medium text-primary-600 hover:underline" aria-label={`${g.isActive ? 'Pause' : 'Reactivate'} ${g.name}`}>
                        {g.isActive ? 'Pause' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <aside className="card relative h-fit lg:sticky lg:top-6">
          <button type="button" onClick={close} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{editing === 'new' ? 'New programme' : 'Edit programme'}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editing === 'new' ? 'From the funder’s page' : form.name}</h2>
            </div>

            <div>
              <label htmlFor="programme-url" className={labelClass}>Official application page</label>
              <input id="programme-url" type="url" required value={form.applicationUrl} onChange={(e) => set('applicationUrl')(e.target.value)} placeholder="https://" className={inputClass} />
              <p className="mt-1 text-[11px] text-slate-500">Where this listing was taken from. Founders apply there.</p>
            </div>
            <div>
              <label htmlFor="programme-name" className={labelClass}>Programme name</label>
              <input id="programme-name" required maxLength={160} value={form.name} onChange={(e) => set('name')(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="programme-provider" className={labelClass}>Funder</label>
                <input id="programme-provider" required maxLength={160} value={form.provider} onChange={(e) => set('provider')(e.target.value)} placeholder="e.g. Queensland Government" className={inputClass} />
              </div>
              <div>
                <label htmlFor="programme-type" className={labelClass}>Kind of funder</label>
                <select id="programme-type" value={form.providerType} onChange={(e) => set('providerType')(e.target.value as GrantProviderType)} className={inputClass}>
                  {PROVIDER_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="programme-description" className={labelClass}>What it funds</label>
              <textarea id="programme-description" required rows={3} maxLength={4000} value={form.description} onChange={(e) => set('description')(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="programme-min" className={labelClass}>From (AUD)</label>
                <input id="programme-min" type="number" min={0} step={1} value={form.minFunding} onChange={(e) => set('minFunding')(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="programme-max" className={labelClass}>Up to (AUD)</label>
                <input id="programme-max" type="number" min={0} step={1} value={form.maxFunding} onChange={(e) => set('maxFunding')(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="programme-industries" className={labelClass}>Industries</label>
              <input id="programme-industries" value={form.industries} onChange={(e) => set('industries')(e.target.value)} placeholder="Comma separated, e.g. Technology, Health" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="programme-stages" className={labelClass}>Stages</label>
                <input id="programme-stages" value={form.stages} onChange={(e) => set('stages')(e.target.value)} placeholder="Idea, Startup, Early, Growth" className={inputClass} />
              </div>
              <div>
                <label htmlFor="programme-regions" className={labelClass}>Regions</label>
                <input id="programme-regions" value={form.regions} onChange={(e) => set('regions')(e.target.value)} placeholder="QLD, NSW or National" className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="programme-tags" className={labelClass}>Who it is for</label>
              <input id="programme-tags" value={form.tags} onChange={(e) => set('tags')(e.target.value)} placeholder="women, indigenous, regional" className={inputClass} />
              <p className="mt-1 text-[11px] text-slate-500">Only what the funder says. These lift the ranking for founders who tick the same box.</p>
            </div>
            <div className="grid grid-cols-2 items-end gap-2">
              <div>
                <label htmlFor="programme-deadline" className={labelClass}>Closes</label>
                <input id="programme-deadline" type="date" value={form.deadline} onChange={(e) => set('deadline')(e.target.value)} disabled={form.isRolling} className={inputClass} />
              </div>
              <label htmlFor="programme-rolling" className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
                <input id="programme-rolling" type="checkbox" checked={form.isRolling} onChange={(e) => set('isRolling')(e.target.checked)} className="rounded border-slate-300" />
                Rolling, no closing date
              </label>
            </div>
            <div>
              <label htmlFor="programme-requirements" className={labelClass}>Eligibility, as the funder wrote it</label>
              <textarea id="programme-requirements" rows={3} maxLength={4000} value={form.requirements} onChange={(e) => set('requirements')(e.target.value)} className={inputClass} />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {form.applicationUrl.trim() && /^https?:\/\//i.test(form.applicationUrl.trim()) ? (
                <a href={form.applicationUrl.trim()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                  Open the funder&apos;s page <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span />
              )}
              <button type="submit" disabled={save.isPending} className="btn-primary py-2 text-sm">
                {save.isPending ? 'Saving…' : editing === 'new' ? 'List it' : 'Save changes'}
              </button>
            </div>
          </form>
        </aside>
      )}
    </div>
  );
}

// ===========================================================================
// APPLICATIONS
// ===========================================================================

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

const name = (u: Application['user']) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

function ApplicationsTab() {
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">Record what the provider decided. The applicant is told in the app and by email.</p>
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

// ===========================================================================
// PAGE
// ===========================================================================

type Tab = 'programmes' | 'applications';

export default function AdminGrantsPage() {
  const [tab, setTab] = useState<Tab>('programmes');

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Landmark className="h-7 w-7 text-emerald-600" /> Grants
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">The programmes founders see, and what their providers decided.</p>
      </div>

      <div role="tablist" aria-label="Grants" className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(
          [
            ['programmes', 'Programmes'],
            ['applications', 'Applications'],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === value ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'programmes' ? <ProgrammesTab /> : <ApplicationsTab />}
    </div>
  );
}
