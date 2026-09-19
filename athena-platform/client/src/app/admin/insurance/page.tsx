'use client';

/**
 * Insurance, from the platform's side. Two things live here: the products
 * members can apply for (the catalogue used to have no way in but SQL, so
 * /dashboard/finance/insurance was always empty) and the applications they
 * make. Insurers quote, approve and issue policies outside the platform;
 * whoever handles the partnership records the result here and the member is
 * told in the app and by email.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { adminApiMessage, adminCatalogueApi, listFromText, type InsuranceType } from '@/lib/admin-catalogue-api';
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
  const [tab, setTab] = useState<'applications' | 'products'>('applications');

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <ShieldCheck className="h-7 w-7 text-blue-600" /> Insurance
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">The products members can apply for, and what the insurers decided.</p>
      </div>
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Insurance sections">
        {(
          [
            ['applications', 'Applications'],
            ['products', 'Products'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-medium', tab === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'applications' ? <ApplicationsPanel /> : <ProductsPanel />}
    </div>
  );
}

function ApplicationsPanel() {
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
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">Record the insurer's quote, decision and policy details. The member is told in the app and by email.</p>
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
    </>
  );
}

// ---------------------------------------------------------------- products

type Product = {
  id: string;
  provider: string;
  name: string;
  type: InsuranceType;
  description: string | null;
  coverageAmount: string | number | null;
  premiumMonthly: string | number | null;
  premiumAnnual: string | number | null;
  waitingPeriod: number | null;
  benefitPeriod: number | null;
  features: string[];
  exclusions: string[];
  commissionPct: string | number | null;
  isActive: boolean;
  applicationCount: number;
};
type ProductForm = {
  provider: string;
  name: string;
  type: InsuranceType;
  description: string;
  coverageAmount: string;
  premiumMonthly: string;
  premiumAnnual: string;
  waitingPeriod: string;
  benefitPeriod: string;
  features: string;
  exclusions: string;
  commissionPct: string;
  isActive: boolean;
};

const PRODUCT_TYPES: Array<[InsuranceType, string]> = [
  ['INCOME_PROTECTION', 'Income protection'],
  ['LIFE', 'Life'],
  ['TPD', 'Total and permanent disability'],
  ['TRAUMA', 'Trauma'],
  ['HEALTH', 'Health'],
];
const emptyProduct: ProductForm = { provider: '', name: '', type: 'INCOME_PROTECTION', description: '', coverageAmount: '', premiumMonthly: '', premiumAnnual: '', waitingPeriod: '', benefitPeriod: '', features: '', exclusions: '', commissionPct: '', isActive: true };
const str = (v: string | number | null) => (v === null || v === undefined ? '' : String(v));
const productToForm = (p: Product): ProductForm => ({
  provider: p.provider,
  name: p.name,
  type: p.type,
  description: p.description ?? '',
  coverageAmount: str(p.coverageAmount),
  premiumMonthly: str(p.premiumMonthly),
  premiumAnnual: str(p.premiumAnnual),
  waitingPeriod: str(p.waitingPeriod),
  benefitPeriod: str(p.benefitPeriod),
  features: p.features.join(', '),
  exclusions: p.exclusions.join(', '),
  commissionPct: str(p.commissionPct),
  isActive: p.isActive,
});
const numberOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function ProductsPanel() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'all' | InsuranceType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyProduct);

  const list = useQuery({
    queryKey: ['admin-insurance-products', type],
    queryFn: () => adminCatalogueApi.insuranceProducts.list(type === 'all' ? undefined : { type }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Product[]) : []),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-insurance-products'] });

  const payload = () => ({
    provider: form.provider.trim(),
    name: form.name.trim(),
    type: form.type,
    description: form.description.trim() || null,
    coverageAmount: numberOrNull(form.coverageAmount),
    premiumMonthly: numberOrNull(form.premiumMonthly),
    premiumAnnual: numberOrNull(form.premiumAnnual),
    waitingPeriod: numberOrNull(form.waitingPeriod),
    benefitPeriod: numberOrNull(form.benefitPeriod),
    features: listFromText(form.features),
    exclusions: listFromText(form.exclusions),
    commissionPct: numberOrNull(form.commissionPct),
    isActive: form.isActive,
  });
  const save = useMutation({
    mutationFn: () => (creating ? adminCatalogueApi.insuranceProducts.create(payload()) : adminCatalogueApi.insuranceProducts.update(selectedId!, payload())),
    onSuccess: (r) => {
      refresh();
      toast.success(creating ? 'Product added.' : 'Saved.');
      if (creating) {
        setCreating(false);
        setSelectedId(r.data?.data?.id ?? null);
      }
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not save that'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminCatalogueApi.insuranceProducts.remove(id),
    onSuccess: () => {
      refresh();
      toast.success('Product removed.');
      setSelectedId(null);
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not remove that product'),
  });

  const open = (p: Product) => {
    setCreating(false);
    setSelectedId(p.id);
    setForm(productToForm(p));
  };
  const startNew = () => {
    setSelectedId(null);
    setForm(emptyProduct);
    setCreating(true);
  };
  const current = creating ? null : (list.data?.find((p) => p.id === selectedId) ?? null);
  const panelOpen = creating || !!current;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input py-1.5 text-sm" aria-label="Product type">
          <option value="all">All types</option>
          {PRODUCT_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button type="button" onClick={startNew} className="btn-primary ml-auto inline-flex items-center gap-1 py-1.5 text-sm">
          <Plus className="h-4 w-4" /> New product
        </button>
      </div>

      <div className={cn('grid gap-6', panelOpen ? 'lg:grid-cols-[minmax(0,1fr)_440px]' : 'grid-cols-1')}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-slate-500">No products yet. Add the ones an insurer has agreed to offer and members will see them.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Cover</th>
                  <th className="px-4 py-2">Premium</th>
                  <th className="px-4 py-2">Applications</th>
                  <th className="px-4 py-2">Listed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data!.map((p) => (
                  <tr key={p.id} onClick={() => open(p)} className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === p.id && 'bg-blue-50 dark:bg-blue-900/20')}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.provider}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{PRODUCT_TYPES.find(([v]) => v === p.type)?.[1] ?? p.type}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.coverageAmount === null ? '–' : aud(p.coverageAmount)}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.premiumMonthly === null ? '–' : `${aud(p.premiumMonthly)}/mo`}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.applicationCount}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}>{p.isActive ? 'active' : 'inactive'}</span>
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
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{creating ? 'New product' : current?.name}</h2>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="prod-provider" className="text-xs font-medium text-slate-600 dark:text-slate-300">Insurer</label>
                  <input id="prod-provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} required minLength={2} maxLength={120} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="prod-name" className="text-xs font-medium text-slate-600 dark:text-slate-300">Product name</label>
                  <input id="prod-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={160} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="prod-type" className="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
                  <select id="prod-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as InsuranceType })} className="input mt-1 w-full text-sm">
                    {PRODUCT_TYPES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-cover" className="text-xs font-medium text-slate-600 dark:text-slate-300">Cover amount (AUD)</label>
                  <input id="prod-cover" type="number" min={0} value={form.coverageAmount} onChange={(e) => setForm({ ...form, coverageAmount: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="prod-monthly" className="text-xs font-medium text-slate-600 dark:text-slate-300">Premium a month (AUD)</label>
                  <input id="prod-monthly" type="number" min={0} step="0.01" value={form.premiumMonthly} onChange={(e) => setForm({ ...form, premiumMonthly: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="prod-annual" className="text-xs font-medium text-slate-600 dark:text-slate-300">Premium a year (AUD)</label>
                  <input id="prod-annual" type="number" min={0} step="0.01" value={form.premiumAnnual} onChange={(e) => setForm({ ...form, premiumAnnual: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="prod-waiting" className="text-xs font-medium text-slate-600 dark:text-slate-300">Waiting period (days)</label>
                  <input id="prod-waiting" type="number" min={0} max={730} value={form.waitingPeriod} onChange={(e) => setForm({ ...form, waitingPeriod: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="prod-benefit" className="text-xs font-medium text-slate-600 dark:text-slate-300">Benefit period (months)</label>
                  <input id="prod-benefit" type="number" min={0} max={600} value={form.benefitPeriod} onChange={(e) => setForm({ ...form, benefitPeriod: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="prod-description" className="text-xs font-medium text-slate-600 dark:text-slate-300">Description</label>
                  <textarea id="prod-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={2000} className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="prod-features" className="text-xs font-medium text-slate-600 dark:text-slate-300">Features</label>
                  <input id="prod-features" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="comma separated" className="input mt-1 w-full text-sm" />
                </div>
                <div className="col-span-2">
                  <label htmlFor="prod-exclusions" className="text-xs font-medium text-slate-600 dark:text-slate-300">Exclusions</label>
                  <input id="prod-exclusions" value={form.exclusions} onChange={(e) => setForm({ ...form, exclusions: e.target.value })} placeholder="comma separated" className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="prod-commission" className="text-xs font-medium text-slate-600 dark:text-slate-300">ATHENA commission (%)</label>
                  <input id="prod-commission" type="number" min={0} max={100} step="0.1" value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-300" /> Listed for members
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={save.isPending} className="btn-primary flex-1 py-2 text-sm">
                  {creating ? 'Add product' : 'Save changes'}
                </button>
                {current && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Remove this product? Only possible while nobody has applied for it.')) remove.mutate(current.id);
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
