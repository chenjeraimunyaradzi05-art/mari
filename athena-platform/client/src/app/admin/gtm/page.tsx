'use client';

/**
 * The go-to-market board: initiatives by area, moved through planned, in
 * progress, blocked and done, with an owner and a due date. The launch
 * checklist that used to be three static bullet points lives here as real
 * items.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Megaphone, Plus, Target, Trash2, TrendingUp, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'PLANNED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
type Initiative = { id: string; title: string; description: string | null; area: string; status: Status; ownerId: string | null; dueAt: string | null; completedAt: string | null; position: number };

const AREAS = ['launch', 'channels', 'funnel', 'partnerships', 'press', 'product'];
const COLUMNS: Array<[Status, string, string]> = [
  ['PLANNED', 'Planned', 'bg-slate-100 text-slate-700'],
  ['IN_PROGRESS', 'In progress', 'bg-blue-100 text-blue-800'],
  ['BLOCKED', 'Blocked', 'bg-red-100 text-red-800'],
  ['DONE', 'Done', 'bg-emerald-100 text-emerald-800'],
];
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

export default function AdminGtmPage() {
  const queryClient = useQueryClient();
  const [area, setArea] = useState<'all' | string>('all');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', area: 'launch', dueAt: '' });

  const initiatives = useQuery({
    queryKey: ['admin-initiatives'],
    queryFn: () => api.get('/admin/marketing/initiatives'),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Initiative[]) : []),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-initiatives'] });
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not save');

  const create = useMutation({
    mutationFn: () => api.post('/admin/marketing/initiatives', { title: form.title, description: form.description || null, area: form.area, dueAt: form.dueAt || null }),
    onSuccess: () => {
      refresh();
      setCreating(false);
      setForm({ title: '', description: '', area: 'launch', dueAt: '' });
    },
    onError,
  });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => api.patch(`/admin/marketing/initiatives/${id}`, { status }),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/marketing/initiatives/${id}`),
    onSuccess: refresh,
    onError,
  });

  const visible = (initiatives.data ?? []).filter((i) => area === 'all' || i.area === area);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Target className="h-7 w-7 text-primary-600" /> Go-to-market
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Launch planning as a board. Every item has an area, a state and, ideally, a date.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['/admin/marketing', 'Marketing hub', Megaphone],
            ['/admin/marketing/leads', 'Leads', Users],
            ['/admin/marketing/funnel', 'Funnel', TrendingUp],
          ].map(([href, l, Icon]) => {
            const I = Icon as typeof Users;
            return (
              <Link key={String(href)} href={String(href)} className="btn-outline inline-flex items-center gap-1 text-sm">
                <I className="h-4 w-4" /> {l as string}
              </Link>
            );
          })}
          {!creating && (
            <button type="button" onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-1 text-sm">
              <Plus className="h-4 w-4" /> Add
            </button>
          )}
        </div>
      </div>

      {creating && (
        <div className="card mb-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What has to happen" aria-label="Title" className="input text-sm" />
          <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} aria-label="Area" className="input text-sm">
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} type="date" aria-label="Due" className="input text-sm" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Detail (optional)" aria-label="Description" className="input text-sm sm:col-span-3" />
          <div className="flex gap-2 sm:col-span-3">
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !form.title.trim()} className="btn-primary text-sm">
              Add
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', ...AREAS].map((a) => (
          <button key={a} type="button" onClick={() => setArea(a)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', area === a ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300')}>
            {a}
          </button>
        ))}
      </div>

      {initiatives.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(([status, title, tone]) => {
            const items = visible.filter((i) => i.status === status);
            return (
              <section key={status} aria-label={title} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                <header className="mb-2 flex items-center justify-between px-1">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tone)}>{title}</span>
                  <span className="text-xs text-slate-500">{items.length}</span>
                </header>
                <ul className="space-y-2">
                  {items.length === 0 && <li className="px-2 py-4 text-center text-xs text-slate-400">Nothing here</li>}
                  {items.map((i) => (
                    <li key={i.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <p className="font-medium text-slate-900 dark:text-white">{i.title}</p>
                      {i.description && <p className="mt-0.5 text-xs text-slate-500">{i.description}</p>}
                      <p className="mt-1 text-[11px] text-slate-400">
                        {i.area}
                        {i.dueAt ? ` · due ${formatDistanceToNow(new Date(i.dueAt), { addSuffix: true })}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {COLUMNS.filter(([s]) => s !== status).map(([s, l]) => (
                          <button key={s} type="button" onClick={() => move.mutate({ id: i.id, status: s })} disabled={move.isPending} className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                            {l}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove "${i.title}"?`)) remove.mutate(i.id);
                          }}
                          className="ml-auto p-0.5 text-slate-400 hover:text-red-600"
                          aria-label={`Remove ${i.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
