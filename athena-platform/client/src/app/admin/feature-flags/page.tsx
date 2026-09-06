'use client';

/**
 * Feature flags and maintenance mode. Flags gate features per rollout
 * percentage and allow/deny lists; maintenance mode closes the platform with
 * a banner. Both have had routes since the flag service was written; this is
 * the first screen that reaches them.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Flag, Loader2, Plus, Trash2, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  allowList: string[];
  denyList: string[];
  tags: string[];
  updatedAt: string;
};
type Maintenance = { enabled: boolean; message: string; startedAt: string | null; endsAt: string | null; updatedBy: string | null; updatedAt: string | null };

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message;

export default function FeatureFlagsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '', rolloutPercentage: '100' });
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  const flags = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => api.get('/feature-flags'),
    select: (r) => (Array.isArray(r.data?.flags) ? (r.data.flags as FeatureFlag[]) : []),
  });
  const maintenance = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => api.get('/admin/maintenance'),
    // The operations router answers with the state itself, not under `data`.
    select: (r) => (r.data?.data ?? r.data) as Maintenance,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    queryClient.invalidateQueries({ queryKey: ['maintenance'] });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not save');

  const create = useMutation({
    mutationFn: () =>
      api.post('/feature-flags', {
        key: form.key.trim(),
        name: form.name.trim() || form.key.trim(),
        description: form.description.trim() || undefined,
        enabled: false,
        rolloutPercentage: Number(form.rolloutPercentage) || 100,
      }),
    onSuccess: () => {
      refresh();
      setCreating(false);
      setForm({ key: '', name: '', description: '', rolloutPercentage: '100' });
      toast.success('Flag created, off');
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ key, data }: { key: string; data: Record<string, unknown> }) => api.patch(`/feature-flags/${key}`, data),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (key: string) => api.delete(`/feature-flags/${key}`),
    onSuccess: () => {
      refresh();
      toast.success('Flag removed');
    },
    onError,
  });
  const setMaintenance = useMutation({
    mutationFn: (enabled: boolean) => api.post('/admin/maintenance', { enabled, ...(maintenanceMessage.trim() ? { message: maintenanceMessage.trim() } : {}) }),
    onSuccess: (_r, enabled) => {
      refresh();
      toast.success(enabled ? 'Maintenance mode is on. Members see the banner.' : 'Maintenance mode is off.');
    },
    onError,
  });

  const keyOk = /^[a-z0-9][a-z0-9_.-]{1,60}$/.test(form.key.trim());

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>

      <section className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Wrench className="h-5 w-5 text-amber-600" /> Maintenance mode
            </h2>
            {maintenance.data ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {maintenance.data.enabled ? (
                  <>
                    <span className="font-medium text-amber-700">On</span>
                    {maintenance.data.startedAt && ` since ${formatDistanceToNow(new Date(maintenance.data.startedAt), { addSuffix: true })}`}. Banner: “{maintenance.data.message}”
                  </>
                ) : (
                  'Off. The platform is open.'
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Loading…</p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[320px]">
            <input value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} maxLength={300} placeholder={maintenance.data?.message || 'Banner text members see'} aria-label="Maintenance banner" className="input text-sm" />
            {maintenance.data?.enabled ? (
              <button type="button" onClick={() => setMaintenance.mutate(false)} disabled={setMaintenance.isPending} className="btn-primary text-sm">
                Turn maintenance off
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Close the platform for maintenance? Members see the banner and cannot use the app until you turn it off.')) setMaintenance.mutate(true);
                }}
                disabled={setMaintenance.isPending}
                className="btn-outline text-sm"
              >
                Turn maintenance on
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Flag className="h-7 w-7 text-primary-600" /> Feature flags
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">A flag is on for a member when it is enabled and she falls inside the rollout, unless she is on the deny list; the allow list always wins.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> New flag
          </button>
        )}
      </div>

      {creating && (
        <div className="card mb-4 grid gap-3 sm:grid-cols-2">
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })} placeholder="key, e.g. new-feed" aria-label="Key" className="input text-sm" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" aria-label="Name" className="input text-sm" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What it gates" aria-label="Description" className="input text-sm sm:col-span-2" />
          <input value={form.rolloutPercentage} onChange={(e) => setForm({ ...form, rolloutPercentage: e.target.value })} type="number" min={0} max={100} placeholder="Rollout %" aria-label="Rollout percentage" className="input text-sm" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !keyOk} className="btn-primary text-sm">
              Create (off)
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
          {!keyOk && form.key && <p className="text-xs text-red-600 sm:col-span-2">Keys are lowercase letters, digits, dots, dashes and underscores.</p>}
        </div>
      )}

      {flags.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (flags.data?.length ?? 0) === 0 ? (
        <div className="card p-10 text-center text-slate-500">No flags yet.</div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
          {flags.data!.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 p-4">
              <button
                type="button"
                role="switch"
                aria-checked={f.enabled}
                aria-label={`${f.enabled ? 'Disable' : 'Enable'} ${f.name}`}
                onClick={() => update.mutate({ key: f.key, data: { enabled: !f.enabled } })}
                disabled={update.isPending}
                className={cn('relative h-6 w-11 flex-shrink-0 rounded-full transition', f.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700')}
              >
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', f.enabled ? 'left-[22px]' : 'left-0.5')} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-white">
                  {f.name} <code className="ml-1 rounded bg-slate-100 px-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{f.key}</code>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {f.description || 'No description'} · changed {formatDistanceToNow(new Date(f.updatedAt), { addSuffix: true })}
                  {f.allowList.length > 0 && ` · ${f.allowList.length} always on`}
                  {f.denyList.length > 0 && ` · ${f.denyList.length} always off`}
                </p>
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                Rollout
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={f.rolloutPercentage}
                  aria-label={`Rollout percentage for ${f.name}`}
                  onBlur={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value)));
                    if (v !== f.rolloutPercentage) update.mutate({ key: f.key, data: { rolloutPercentage: v } });
                  }}
                  className="input w-20 py-1 text-sm"
                />
                %
              </label>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove the flag "${f.key}"? Code that checks it will see it as off.`)) remove.mutate(f.key);
                }}
                disabled={remove.isPending}
                aria-label={`Remove ${f.name}`}
                className="p-1 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
