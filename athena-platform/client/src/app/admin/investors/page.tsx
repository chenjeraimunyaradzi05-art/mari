'use client';

/**
 * The investor directory and the introductions founders ask for, from the
 * platform's side. The directory had no way in but SQL, and an introduction
 * request could never leave REQUESTED: nothing on the platform could approve,
 * make or decline it. Staff enter the investors they have verified here, and
 * when they make an introduction they record it and the founder is told in
 * the app and by email.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, HeartHandshake, Loader2, Plus, Trash2, Users, X } from 'lucide-react';
import {
  adminApiMessage,
  adminCatalogueApi,
  listFromText,
  type IntroductionDecision,
  type IntroductionStatus,
  type InvestorType,
} from '@/lib/admin-catalogue-api';
import { cn } from '@/lib/utils';

type Investor = {
  id: string;
  name: string;
  type: InvestorType;
  description: string | null;
  minCheckSize: string | number | null;
  maxCheckSize: string | number | null;
  stages: string[];
  industries: string[];
  regions: string[];
  thesis: string | null;
  website: string | null;
  linkedinUrl: string | null;
  portfolioCompanies: unknown;
  isActive: boolean;
  isVerified: boolean;
  introductionCount: number;
};
type Introduction = {
  id: string;
  status: IntroductionStatus;
  message: string | null;
  requestedAt: string;
  introducedAt: string | null;
  respondedAt: string | null;
  outcome: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  investor: { id: string; name: string; type: string };
};

const TYPES: Array<[InvestorType, string]> = [
  ['ANGEL', 'Angel'],
  ['VC', 'Venture capital'],
  ['CORPORATE_VC', 'Corporate VC'],
  ['FAMILY_OFFICE', 'Family office'],
  ['ACCELERATOR', 'Accelerator'],
  ['GOVERNMENT', 'Government'],
];
const INTRO_TONE: Record<IntroductionStatus, string> = {
  REQUESTED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  INTRODUCED: 'bg-emerald-100 text-emerald-800',
  MEETING_SCHEDULED: 'bg-emerald-200 text-emerald-900',
  DECLINED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-600',
};
const DECISIONS: Array<[IntroductionDecision, string]> = [
  ['APPROVED', 'Approved, arranging it'],
  ['INTRODUCED', 'Introduced'],
  ['MEETING_SCHEDULED', 'Meeting scheduled'],
  ['DECLINED', 'Declined'],
  ['EXPIRED', 'Expired'],
];

const aud = (v: unknown) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(v));
const cheque = (i: Investor) => {
  if (i.minCheckSize === null && i.maxCheckSize === null) return 'not published';
  if (i.minCheckSize !== null && i.maxCheckSize !== null) return `${aud(i.minCheckSize)} – ${aud(i.maxCheckSize)}`;
  return i.minCheckSize !== null ? `from ${aud(i.minCheckSize)}` : `up to ${aud(i.maxCheckSize)}`;
};
const founderName = (u: Introduction['user']) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
const portfolioText = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').join(', ') : '');

export default function AdminInvestorsPage() {
  const [tab, setTab] = useState<'directory' | 'introductions'>('directory');

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Users className="h-7 w-7 text-primary-600" /> Investors
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">The directory founders search, and the warm introductions they ask for.</p>
      </div>
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Investor sections">
        {(
          [
            ['directory', 'Directory'],
            ['introductions', 'Introductions'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-medium', tab === key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'directory' ? <DirectoryPanel /> : <IntroductionsPanel />}
    </div>
  );
}

// ---------------------------------------------------------------- directory

type InvestorForm = {
  name: string;
  type: InvestorType;
  description: string;
  minCheckSize: string;
  maxCheckSize: string;
  stages: string;
  industries: string;
  regions: string;
  thesis: string;
  website: string;
  linkedinUrl: string;
  portfolioCompanies: string;
  isActive: boolean;
  isVerified: boolean;
};
const emptyInvestor: InvestorForm = { name: '', type: 'ANGEL', description: '', minCheckSize: '', maxCheckSize: '', stages: '', industries: '', regions: '', thesis: '', website: '', linkedinUrl: '', portfolioCompanies: '', isActive: true, isVerified: false };
const investorToForm = (i: Investor): InvestorForm => ({
  name: i.name,
  type: i.type,
  description: i.description ?? '',
  minCheckSize: i.minCheckSize === null ? '' : String(i.minCheckSize),
  maxCheckSize: i.maxCheckSize === null ? '' : String(i.maxCheckSize),
  stages: i.stages.join(', '),
  industries: i.industries.join(', '),
  regions: i.regions.join(', '),
  thesis: i.thesis ?? '',
  website: i.website ?? '',
  linkedinUrl: i.linkedinUrl ?? '',
  portfolioCompanies: portfolioText(i.portfolioCompanies),
  isActive: i.isActive,
  isVerified: i.isVerified,
});

function DirectoryPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | InvestorType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<InvestorForm>(emptyInvestor);

  const list = useQuery({
    queryKey: ['admin-investors', search, type],
    queryFn: () => adminCatalogueApi.investors.list({ ...(search.trim() ? { search: search.trim() } : {}), ...(type === 'all' ? {} : { type }) }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Investor[]) : []),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-investors'] });

  const payload = () => ({
    name: form.name.trim(),
    type: form.type,
    description: form.description.trim() || null,
    minCheckSize: form.minCheckSize === '' ? null : Number(form.minCheckSize),
    maxCheckSize: form.maxCheckSize === '' ? null : Number(form.maxCheckSize),
    stages: listFromText(form.stages),
    industries: listFromText(form.industries),
    regions: listFromText(form.regions),
    thesis: form.thesis.trim() || null,
    website: form.website.trim() || null,
    linkedinUrl: form.linkedinUrl.trim() || null,
    portfolioCompanies: listFromText(form.portfolioCompanies),
    isActive: form.isActive,
    isVerified: form.isVerified,
  });
  const save = useMutation({
    mutationFn: () => (creating ? adminCatalogueApi.investors.create(payload()) : adminCatalogueApi.investors.update(selectedId!, payload())),
    onSuccess: (r) => {
      refresh();
      toast.success(creating ? 'Investor added.' : 'Saved.');
      if (creating) {
        setCreating(false);
        setSelectedId(r.data?.data?.id ?? null);
      }
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not save that'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminCatalogueApi.investors.remove(id),
    onSuccess: () => {
      refresh();
      toast.success('Investor removed.');
      setSelectedId(null);
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not remove that investor'),
  });

  const open = (i: Investor) => {
    setCreating(false);
    setSelectedId(i.id);
    setForm(investorToForm(i));
  };
  const startNew = () => {
    setSelectedId(null);
    setForm(emptyInvestor);
    setCreating(true);
  };
  const current = creating ? null : (list.data?.find((i) => i.id === selectedId) ?? null);
  const panelOpen = creating || !!current;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="investor-search" className="sr-only">Search investors</label>
        <input id="investor-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="input w-56 py-1.5 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input py-1.5 text-sm" aria-label="Investor type">
          <option value="all">All types</option>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button type="button" onClick={startNew} className="btn-primary ml-auto inline-flex items-center gap-1 py-1.5 text-sm">
          <Plus className="h-4 w-4" /> New investor
        </button>
      </div>

      <div className={cn('grid gap-6', panelOpen ? 'lg:grid-cols-[minmax(0,1fr)_440px]' : 'grid-cols-1')}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-slate-500">No investors here yet. Add the ones you have verified and founders will see them.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Investor</th>
                  <th className="px-4 py-2">Cheque</th>
                  <th className="px-4 py-2">Stages</th>
                  <th className="px-4 py-2">Intros</th>
                  <th className="px-4 py-2">Listed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data!.map((i) => (
                  <tr key={i.id} onClick={() => open(i)} className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === i.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {i.name}
                        {i.isVerified && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Verified</span>}
                      </div>
                      <div className="text-xs text-slate-500">{TYPES.find(([v]) => v === i.type)?.[1] ?? i.type}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{cheque(i)}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{i.stages.length ? i.stages.join(', ') : '–'}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{i.introductionCount}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', i.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}>{i.isActive ? 'active' : 'inactive'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {panelOpen && (
          <aside className="card relative h-fit lg:sticky lg:top-6">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setSelectedId(null);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{creating ? 'New investor' : current?.name}</h2>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label htmlFor="inv-name" className="text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
                  <input id="inv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={160} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="inv-type" className="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
                  <select id="inv-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as InvestorType })} className="input mt-1 w-full text-sm">
                    {TYPES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="inv-website" className="text-xs font-medium text-slate-600 dark:text-slate-300">Website</label>
                  <input id="inv-website" type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="inv-min" className="text-xs font-medium text-slate-600 dark:text-slate-300">Smallest cheque (AUD)</label>
                  <input id="inv-min" type="number" min={0} value={form.minCheckSize} onChange={(e) => setForm({ ...form, minCheckSize: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="inv-max" className="text-xs font-medium text-slate-600 dark:text-slate-300">Largest cheque (AUD)</label>
                  <input id="inv-max" type="number" min={0} value={form.maxCheckSize} onChange={(e) => setForm({ ...form, maxCheckSize: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inv-stages" className="text-xs font-medium text-slate-600 dark:text-slate-300">Stages</label>
                  <input id="inv-stages" value={form.stages} onChange={(e) => setForm({ ...form, stages: e.target.value })} placeholder="Pre-seed, Seed, Series A" className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inv-industries" className="text-xs font-medium text-slate-600 dark:text-slate-300">Industries</label>
                  <input id="inv-industries" value={form.industries} onChange={(e) => setForm({ ...form, industries: e.target.value })} placeholder="Health, Climate, Fintech" className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inv-regions" className="text-xs font-medium text-slate-600 dark:text-slate-300">Regions</label>
                  <input id="inv-regions" value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} placeholder="QLD, ANZ" className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inv-thesis" className="text-xs font-medium text-slate-600 dark:text-slate-300">Thesis</label>
                  <textarea id="inv-thesis" value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} rows={2} maxLength={2000} className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inv-description" className="text-xs font-medium text-slate-600 dark:text-slate-300">Description</label>
                  <textarea id="inv-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={2000} className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inv-portfolio" className="text-xs font-medium text-slate-600 dark:text-slate-300">Portfolio companies</label>
                  <input id="inv-portfolio" value={form.portfolioCompanies} onChange={(e) => setForm({ ...form, portfolioCompanies: e.target.value })} placeholder="comma separated" className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inv-linkedin" className="text-xs font-medium text-slate-600 dark:text-slate-300">LinkedIn</label>
                  <input id="inv-linkedin" type="url" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://" className="input mt-1 w-full text-sm" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-300" /> Listed for founders
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} className="rounded border-slate-300" /> Verified by ATHENA
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={save.isPending} className="btn-primary flex-1 py-2 text-sm">
                  {creating ? 'Add investor' : 'Save changes'}
                </button>
                {current && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Remove this investor? Only possible while no founder has asked to meet them.')) remove.mutate(current.id);
                    }}
                    disabled={remove.isPending}
                    className="btn-secondary inline-flex items-center gap-1 py-2 text-sm text-red-700"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                )}
              </div>
            </form>
          </aside>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- introductions

function IntroductionsPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | IntroductionStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<IntroductionDecision>('APPROVED');
  const [outcome, setOutcome] = useState('');

  const list = useQuery({
    queryKey: ['admin-introductions', status],
    queryFn: () => adminCatalogueApi.introductions.list(status === 'all' ? undefined : { status }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Introduction[]) : []),
  });
  const save = useMutation({
    mutationFn: (id: string) => adminCatalogueApi.introductions.decide(id, { status: decision, ...(outcome.trim() ? { outcome: outcome.trim() } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-introductions'] });
      toast.success('Recorded. The founder has been told.');
      setOutcome('');
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not record that'),
  });

  const current = list.data?.find((i) => i.id === selectedId) ?? null;

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input py-1.5 text-sm" aria-label="Introduction status">
          <option value="all">All requests</option>
          <option value="REQUESTED">Waiting</option>
          <option value="APPROVED">Approved</option>
          <option value="INTRODUCED">Introduced</option>
          <option value="MEETING_SCHEDULED">Meeting scheduled</option>
          <option value="DECLINED">Declined</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1')}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-slate-500">No introduction requests here.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Founder</th>
                  <th className="px-4 py-2">Investor</th>
                  <th className="px-4 py-2">Requested</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data!.map((i) => (
                  <tr key={i.id} onClick={() => setSelectedId(i.id)} className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === i.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">{founderName(i.user)}</div>
                      <div className="text-xs text-slate-500">{i.user.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-slate-900 dark:text-white">{i.investor.name}</div>
                      <div className="text-xs text-slate-500">{i.investor.type.replace(/_/g, ' ').toLowerCase()}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{ago(i.requestedAt)}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', INTRO_TONE[i.status])}>{i.status.replace(/_/g, ' ').toLowerCase()}</span>
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
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <HeartHandshake className="h-3.5 w-3.5" /> Introduction
              </p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.investor.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {founderName(current.user)} · <a href={`mailto:${current.user.email}`} className="text-primary-600 hover:underline">{current.user.email}</a>
              </p>
            </div>
            {current.message && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Her message</p>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">{current.message}</p>
              </div>
            )}
            <dl className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <dt>Requested</dt>
                <dd>{ago(current.requestedAt)}</dd>
              </div>
              {current.introducedAt && (
                <div className="flex justify-between">
                  <dt>Introduced</dt>
                  <dd>{ago(current.introducedAt)}</dd>
                </div>
              )}
              {current.respondedAt && (
                <div className="flex justify-between">
                  <dt>Last answered</dt>
                  <dd>{ago(current.respondedAt)}</dd>
                </div>
              )}
            </dl>
            {current.outcome && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{current.outcome}</p>}
            <div className="space-y-2">
              <label htmlFor="intro-decision" className="text-xs font-medium text-slate-600 dark:text-slate-300">Decision</label>
              <select id="intro-decision" value={decision} onChange={(e) => setDecision(e.target.value as IntroductionDecision)} className="input w-full text-sm">
                {DECISIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <label htmlFor="intro-outcome" className="text-xs font-medium text-slate-600 dark:text-slate-300">A note the founder reads (optional)</label>
              <textarea id="intro-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3} maxLength={1000} className="input w-full text-sm" />
              <button type="button" onClick={() => save.mutate(current.id)} disabled={save.isPending} className="btn-primary w-full py-2 text-sm">
                Record and tell the founder
              </button>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
