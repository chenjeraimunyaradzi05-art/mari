'use client';

/**
 * The lead register. Everything the site's forms capture (waitlist, sales
 * enquiries, partners, press, influencers) and anything pasted in from a
 * spreadsheet, with a status, an owner and notes. The hub's partnership,
 * press, influencer and waitlist views are this page filtered by source.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Users, Upload, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Source = 'WAITLIST' | 'CONTACT_SALES' | 'PARTNER' | 'PRESS' | 'INFLUENCER' | 'EVENT' | 'REFERRAL' | 'WEBSITE' | 'IMPORT' | 'OTHER';
type Status = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
type Lead = {
  id: string;
  email: string;
  name: string | null;
  organisation: string | null;
  role: string | null;
  source: Source;
  status: Status;
  interest: string | null;
  message: string | null;
  notes: string | null;
  ownerId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  campaign: { id: string; name: string } | null;
};

const SOURCES: Source[] = ['WAITLIST', 'CONTACT_SALES', 'PARTNER', 'PRESS', 'INFLUENCER', 'EVENT', 'REFERRAL', 'WEBSITE', 'IMPORT', 'OTHER'];
const STATUSES: Status[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
const TONE: Record<Status, string> = { NEW: 'bg-amber-100 text-amber-800', CONTACTED: 'bg-blue-100 text-blue-800', QUALIFIED: 'bg-purple-100 text-purple-800', CONVERTED: 'bg-emerald-100 text-emerald-800', LOST: 'bg-slate-100 text-slate-600' };
const TITLES: Partial<Record<Source, string>> = { WAITLIST: 'Waitlist', CONTACT_SALES: 'Sales enquiries', PARTNER: 'Partnerships', PRESS: 'Press', INFLUENCER: 'Influencers' };
const label = (v: string) => v.replace(/_/g, ' ').toLowerCase();
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get('source');
  const campaignId = searchParams.get('campaignId') ?? undefined;
  const [source, setSource] = useState<'' | Source>(SOURCES.includes(sourceParam as Source) ? (sourceParam as Source) : '');
  const [status, setStatus] = useState<'' | Status>('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [importing, setImporting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [importSource, setImportSource] = useState<Source>('IMPORT');

  const leads = useQuery({
    queryKey: ['admin-leads', source, status, q, campaignId],
    queryFn: () => api.get('/admin/marketing/leads', { params: { ...(source ? { source } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}), ...(campaignId ? { campaignId } : {}) } }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Lead[]) : []),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not save');

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/admin/marketing/leads/${id}`, data),
    onSuccess: () => {
      refresh();
      toast.success('Saved');
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/marketing/leads/${id}`),
    onSuccess: () => {
      refresh();
      setSelectedId(null);
    },
    onError,
  });
  const importLeads = useMutation({
    mutationFn: () => {
      // One lead per line: email, then optional name and organisation, separated by commas or tabs.
      const rows = pasted
        .split('\n')
        .map((line) => line.split(/[\t,]/).map((c) => c.trim()))
        .filter((cells) => cells[0])
        .map(([email, name, organisation]) => ({ email, name, organisation }));
      return api.post('/admin/marketing/leads/import', { source: importSource, rows });
    },
    onSuccess: (res) => {
      refresh();
      setImporting(false);
      setPasted('');
      toast.success(`${res.data?.data?.imported ?? 0} imported, ${res.data?.data?.skipped ?? 0} skipped`);
    },
    onError,
  });

  const current = leads.data?.find((l) => l.id === selectedId) ?? null;
  const title = (source && TITLES[source]) || 'Leads';

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin/marketing" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Marketing hub
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Users className="h-7 w-7 text-primary-600" /> {title}
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{leads.data ? `${leads.data.length} shown` : 'Loading'} · the site's forms land here as they are submitted.</p>
        </div>
        {!importing && (
          <button type="button" onClick={() => setImporting(true)} className="btn-outline inline-flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4" /> Paste a list
          </button>
        )}
      </div>

      {importing && (
        <div className="card mb-6 space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">One per line: email, name, organisation (commas or tabs). The same email in the same source is one lead.</p>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder={'ana@byte.co, Ana Ruiz, Byte Studio\nmei@example.com'} aria-label="Leads to import" className="input w-full font-mono text-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <select value={importSource} onChange={(e) => setImportSource(e.target.value as Source)} aria-label="Source" className="input text-sm">
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => importLeads.mutate()} disabled={importLeads.isPending || !pasted.trim()} className="btn-primary text-sm">
              Import
            </button>
            <button type="button" onClick={() => setImporting(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name, organisation" aria-label="Search" className="input min-w-[240px] flex-1 text-sm" />
        <select value={source} onChange={(e) => setSource(e.target.value as '' | Source)} aria-label="Source" className="input text-sm">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | Status)} aria-label="Status" className="input text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1')}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {leads.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (leads.data?.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-slate-500">No leads match.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Who</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Arrived</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leads.data!.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => {
                      setSelectedId(l.id);
                      setNotes(l.notes ?? '');
                    }}
                    className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === l.id && 'bg-primary-50 dark:bg-primary-900/20')}
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900 dark:text-white">{l.name || l.email}</div>
                      <div className="text-xs text-slate-500">
                        {l.name ? `${l.email} · ` : ''}
                        {l.organisation || ''}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {label(l.source)}
                      {l.campaign ? <span className="block text-xs text-slate-500">{l.campaign.name}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE[l.status])}>{label(l.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {current && (
          <aside className="card relative h-fit space-y-3 lg:sticky lg:top-6">
            <button type="button" onClick={() => setSelectedId(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <div>
              <h2 className="pr-8 text-lg font-semibold text-slate-900 dark:text-white">{current.name || current.email}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <a href={`mailto:${current.email}`} className="text-primary-600 hover:underline">
                  {current.email}
                </a>
                {current.organisation ? ` · ${current.organisation}` : ''}
                {current.role ? ` · ${current.role}` : ''}
              </p>
              <p className="text-xs text-slate-500">
                {label(current.source)}
                {current.interest ? ` · interest: ${current.interest}` : ''}
                {current.utmCampaign ? ` · utm ${current.utmCampaign}` : ''}
                {current.lastContactedAt ? ` · contacted ${formatDistanceToNow(new Date(current.lastContactedAt), { addSuffix: true })}` : ''}
              </p>
            </div>
            {current.message && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{current.message}</p>}
            <select value={current.status} onChange={(e) => update.mutate({ id: current.id, data: { status: e.target.value } })} aria-label="Status" className="input w-full text-sm">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes" aria-label="Notes" className="input w-full text-sm" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => update.mutate({ id: current.id, data: { notes: notes || null } })} disabled={update.isPending} className="btn-primary text-sm">
                Save notes
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Remove this lead?')) remove.mutate(current.id);
                }}
                className="ml-auto text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
