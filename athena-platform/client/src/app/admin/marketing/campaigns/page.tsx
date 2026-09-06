'use client';

/**
 * Campaigns: a channel, a budget, dates, a utm name that credits leads to the
 * campaign when it arrives on a form, and how many leads it has brought in.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Megaphone, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Channel = 'EMAIL' | 'SOCIAL' | 'PAID_SOCIAL' | 'SEARCH' | 'PARTNER' | 'EVENT' | 'PRESS' | 'REFERRAL' | 'IN_APP' | 'INFLUENCER';
type Status = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
type Campaign = {
  id: string;
  name: string;
  objective: string | null;
  channel: Channel;
  status: Status;
  audience: string | null;
  budgetCents: number | null;
  spentCents: number;
  startsAt: string | null;
  endsAt: string | null;
  utmCampaign: string | null;
  notes: string | null;
  _count: { leads: number };
};

const CHANNELS: Channel[] = ['EMAIL', 'SOCIAL', 'PAID_SOCIAL', 'SEARCH', 'PARTNER', 'EVENT', 'PRESS', 'REFERRAL', 'IN_APP', 'INFLUENCER'];
const STATUSES: Status[] = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED'];
const TONE: Record<Status, string> = { DRAFT: 'bg-slate-100 text-slate-700', SCHEDULED: 'bg-blue-100 text-blue-800', ACTIVE: 'bg-emerald-100 text-emerald-800', PAUSED: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-slate-200 text-slate-700' };
const label = (v: string) => v.replace(/_/g, ' ').toLowerCase();
const aud = (cents: number | null) => (cents == null ? '–' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(cents / 100));
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const emptyForm = { name: '', channel: 'EMAIL' as Channel, objective: '', audience: '', budget: '', startsAt: '', endsAt: '', utmCampaign: '' };

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spent, setSpent] = useState('');
  const [notes, setNotes] = useState('');

  const campaigns = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () => api.get('/admin/marketing/campaigns'),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Campaign[]) : []),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not save');

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/marketing/campaigns', {
        name: form.name,
        channel: form.channel,
        objective: form.objective || null,
        audience: form.audience || null,
        budgetCents: form.budget ? Math.round(Number(form.budget) * 100) : null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        utmCampaign: form.utmCampaign || null,
      }),
    onSuccess: () => {
      refresh();
      setCreating(false);
      setForm(emptyForm);
      toast.success('Campaign created as a draft');
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/admin/marketing/campaigns/${id}`, data),
    onSuccess: () => {
      refresh();
      toast.success('Saved');
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/marketing/campaigns/${id}`),
    onSuccess: () => {
      refresh();
      setSelectedId(null);
      toast.success('Campaign removed');
    },
    onError,
  });

  const current = campaigns.data?.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin/marketing" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Marketing hub
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Megaphone className="h-7 w-7 text-primary-600" /> Campaigns
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">A campaign's utm name on a link credits every lead that arrives through it.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> New campaign
          </button>
        )}
      </div>

      {creating && (
        <div className="card mb-6 grid gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" aria-label="Name" className="input text-sm" />
          <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })} aria-label="Channel" className="input text-sm">
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
          <input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Objective, e.g. 500 waitlist signups from founders" aria-label="Objective" className="input text-sm sm:col-span-2" />
          <input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Audience" aria-label="Audience" className="input text-sm" />
          <input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} type="number" min={0} placeholder="Budget (AUD)" aria-label="Budget" className="input text-sm" />
          <input value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} type="date" aria-label="Starts" className="input text-sm" />
          <input value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} type="date" aria-label="Ends" className="input text-sm" />
          <input value={form.utmCampaign} onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })} placeholder="utm_campaign, e.g. spring-launch" aria-label="UTM campaign" className="input text-sm sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()} className="btn-primary text-sm">
              Create draft
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : 'grid-cols-1')}>
        <div>
          {campaigns.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (campaigns.data?.length ?? 0) === 0 ? (
            <div className="card p-10 text-center text-slate-500">No campaigns yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {campaigns.data!.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setSpent(c.spentCents ? String(c.spentCents / 100) : '');
                      setNotes(c.notes ?? '');
                    }}
                    className={cn('flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === c.id && 'bg-primary-50 dark:bg-primary-900/20')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900 dark:text-white">{c.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {label(c.channel)}
                        {c.utmCampaign ? ` · utm ${c.utmCampaign}` : ''}
                        {c.startsAt ? ` · from ${new Date(c.startsAt).toLocaleDateString('en-AU')}` : ''}
                      </span>
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {c._count.leads} {c._count.leads === 1 ? 'lead' : 'leads'}
                    </span>
                    <span className="text-sm text-slate-500">
                      {aud(c.spentCents)} / {aud(c.budgetCents)}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', TONE[c.status])}>{label(c.status)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {current && (
          <aside className="card h-fit space-y-3 lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.name}</h2>
            {current.objective && <p className="text-sm text-slate-600 dark:text-slate-300">{current.objective}</p>}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Channel</dt>
                <dd>{label(current.channel)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Audience</dt>
                <dd>{current.audience || '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Leads</dt>
                <dd>
                  <Link href={`/admin/marketing/leads?campaignId=${current.id}`} className="text-primary-600 hover:underline">
                    {current._count.leads}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Budget</dt>
                <dd>{aud(current.budgetCents)}</dd>
              </div>
            </dl>
            <select value={current.status} onChange={(e) => update.mutate({ id: current.id, data: { status: e.target.value } })} aria-label="Status" className="input w-full text-sm">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Spent so far (AUD)
              <input value={spent} onChange={(e) => setSpent(e.target.value)} type="number" min={0} className="input mt-1 w-full text-sm" />
            </label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes" aria-label="Notes" className="input w-full text-sm" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => update.mutate({ id: current.id, data: { spentCents: spent ? Math.round(Number(spent) * 100) : 0, notes: notes || null } })} disabled={update.isPending} className="btn-primary text-sm">
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove "${current.name}"? Its leads stay, uncredited.`)) remove.mutate(current.id);
                }}
                className="ml-auto inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
