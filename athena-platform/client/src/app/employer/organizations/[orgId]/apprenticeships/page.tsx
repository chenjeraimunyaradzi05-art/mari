'use client';

/**
 * Apprenticeships, from the provider's side.
 *
 * The server has taken listings, edits, publishing and applications all
 * along and none of it had a screen, so an RTO or a host employer could not
 * put an apprenticeship on the platform at all. A listing starts as a draft,
 * which is why it is only visible to the organizations named on it until it
 * is published.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, GraduationCap, Globe, Loader2, Plus, Users } from 'lucide-react';
import { apprenticeshipApi } from '@/lib/api-extensions';
import { apiMessage } from '@/lib/strategy-api';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';

type Apprenticeship = {
  id: string;
  title: string;
  framework: string;
  level: string;
  status: string;
  durationMonths: number;
  positions?: number | null;
  city?: string | null;
  state?: string | null;
  isRemote?: boolean;
  publishedAt?: string | null;
  createdAt: string;
  rto?: { id: string; name: string } | null;
  hostEmployer?: { id: string; name: string } | null;
  _count?: { applications: number };
};

const LEVELS = [
  ['CERTIFICATE_I', 'Certificate I'],
  ['CERTIFICATE_II', 'Certificate II'],
  ['CERTIFICATE_III', 'Certificate III'],
  ['CERTIFICATE_IV', 'Certificate IV'],
  ['DIPLOMA', 'Diploma'],
  ['ADVANCED_DIPLOMA', 'Advanced diploma'],
] as const;

const TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  OPEN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FILLED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const EMPTY = { title: '', description: '', framework: '', level: 'CERTIFICATE_III', durationMonths: '24', positions: '1', city: '', state: '', wageMin: '', wageMax: '' };

export default function ProviderApprenticeshipsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [showApplications, setShowApplications] = useState<string | null>(null);

  const listings = useQuery({
    queryKey: ['provider-apprenticeships', orgId],
    queryFn: apprenticeshipApi.getMine,
    select: (r) => (r.data?.data ?? []) as Apprenticeship[],
  });

  const applications = useQuery({
    queryKey: ['apprenticeship-applications', showApplications],
    queryFn: () => apprenticeshipApi.getApplicationsFor(showApplications as string),
    select: (r) => (r.data?.data ?? []) as Array<{ id: string; status: string; createdAt: string; applicant?: { displayName?: string | null } | null }>,
    enabled: Boolean(showApplications),
  });

  const create = useMutation({
    mutationFn: () =>
      apprenticeshipApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        framework: form.framework.trim(),
        level: form.level,
        durationMonths: Number(form.durationMonths) || 12,
        positions: Number(form.positions) || 1,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        wageMin: form.wageMin ? Number(form.wageMin) : undefined,
        wageMax: form.wageMax ? Number(form.wageMax) : undefined,
        rtoId: orgId,
      }),
    onSuccess: () => {
      setForm(EMPTY);
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['provider-apprenticeships', orgId] });
      toast.success('Draft created. Publish it when it is ready.');
    },
    onError: (err) => toast.error(apiMessage(err, 'That could not be created.')),
  });

  const publish = useMutation({
    mutationFn: (id: string) => apprenticeshipApi.publish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-apprenticeships', orgId] });
      toast.success('Published. It is now on the public listings.');
    },
    onError: (err) => toast.error(apiMessage(err, 'That could not be published.')),
  });

  const rows = listings.data ?? [];
  const canCreate = form.title.trim() && form.description.trim() && form.framework.trim();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link href={`/employer/organizations/${orgId}`} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:underline dark:text-slate-300">
        <ArrowLeft className="h-4 w-4" /> Back to the organisation
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <GraduationCap className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Apprenticeships</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">What you are offering</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A listing stays a draft, visible only to you, until you publish it.</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" /> {creating ? 'Cancel' : 'New apprenticeship'}
        </Button>
      </div>

      {creating && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Title</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} placeholder="Carpentry apprenticeship" className="input w-full text-sm" />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">What it involves</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={10000} placeholder="Four years on site with a qualified carpenter, one day a week at the training centre." className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Training package or framework</span>
              <input value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })} maxLength={100} placeholder="CPC30220" className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Level</span>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="input w-full text-sm">
                {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Months</span>
              <input type="number" min={1} value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Positions</span>
              <input type="number" min={1} value={form.positions} onChange={(e) => setForm({ ...form, positions: e.target.value })} className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">City</span>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">State</span>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="QLD" className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Wage from, a year</span>
              <input type="number" min={0} value={form.wageMin} onChange={(e) => setForm({ ...form, wageMin: e.target.value })} className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Wage to</span>
              <input type="number" min={0} value={form.wageMax} onChange={(e) => setForm({ ...form, wageMax: e.target.value })} className="input w-full text-sm" />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={() => create.mutate()} disabled={!canCreate || create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save as draft
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pay must meet the award for the trade and the year of the apprenticeship.</p>
          </div>
        </div>
      )}

      {listings.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : listings.isError ? (
        <p className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700">
          These could not be loaded. Only staff of the organisations named on a listing can see it.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-8 text-center dark:border-slate-700">
          <GraduationCap className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">Nothing listed yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create one as a draft, then publish it when the details are settled.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/apprenticeships/${item.id}`} className="font-semibold text-slate-900 hover:underline dark:text-white">{item.title}</Link>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {item.framework} · {LEVELS.find(([v]) => v === item.level)?.[1] ?? item.level} · {item.durationMonths} months
                    {item.city ? ` · ${[item.city, item.state].filter(Boolean).join(', ')}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.publishedAt ? `Published ${formatDate(item.publishedAt)}` : `Created ${formatDate(item.createdAt)}`}
                    {item._count ? ` · ${item._count.applications} application${item._count.applications === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', TONE[item.status] ?? TONE.DRAFT)}>{item.status.toLowerCase()}</span>
                  {item.status === 'DRAFT' && (
                    <Button size="sm" onClick={() => publish.mutate(item.id)} disabled={publish.isPending}>
                      <Globe className="mr-2 h-4 w-4" /> Publish
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setShowApplications(showApplications === item.id ? null : item.id)}>
                    <Users className="mr-2 h-4 w-4" /> Applicants
                  </Button>
                </div>
              </div>

              {showApplications === item.id && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                  {applications.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (applications.data?.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nobody has applied yet.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {applications.data!.map((application) => (
                        <li key={application.id} className="flex items-center justify-between">
                          <span className="text-slate-800 dark:text-slate-200">{application.applicant?.displayName ?? 'An applicant'}</span>
                          <span className="text-xs text-slate-500">{application.status.toLowerCase()} · {formatDate(application.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
