'use client';

/**
 * Public disclosures: the transparency report and the register of service
 * providers.
 *
 * Both public pages read tables that nothing wrote. /help/transparency-report
 * could only ever show its empty state, and the privacy statement sent members
 * to a providers page that had no way to be filled — which also left
 * /data-transfers unable to name a single overseas destination. This is where
 * a quarter's report is counted and published, and where the register is kept.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, FileBarChart, Loader2, Server } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TransparencyReport {
  id: string;
  period: string;
  startDate: string;
  endDate: string;
  totalReports: number;
  actionsTotal: number;
  avgResponseHours: number;
  under24Hours: number;
  under72Hours: number;
  over72Hours: number;
  totalAppeals: number;
  publishedAt: string | null;
  updatedAt: string;
}

interface Subprocessor {
  id: string;
  name: string;
  description: string | null;
  country: string;
  transferMechanism: string | null;
  services: string[];
  dataCategories: string[];
  dpaSignedAt: string | null;
  dpaExpiresAt: string | null;
  isActive: boolean;
}

const DATA_CATEGORIES = ['PII', 'SENSITIVE', 'FINANCIAL', 'UGC', 'BIOMETRIC', 'BEHAVIORAL', 'TECHNICAL'];

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ??
  (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message;

/** The most recent quarter that has finished, in Brisbane time, as the server expects it. */
function lastFinishedQuarter(now = new Date()): string {
  const brisbane = new Date(now.getTime() + 10 * 60 * 60 * 1000);
  const quarter = Math.floor(brisbane.getUTCMonth() / 3) + 1;
  const year = brisbane.getUTCFullYear();
  return quarter === 1 ? `Q4_${year - 1}` : `Q${quarter - 1}_${year}`;
}

const emptyProvider = {
  name: '',
  description: '',
  country: '',
  transferMechanism: '',
  services: '',
  dataCategories: [] as string[],
  dpaSignedAt: '',
};

export default function AdminDisclosuresPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(lastFinishedQuarter());
  const [provider, setProvider] = useState(emptyProvider);

  const reports = useQuery<TransparencyReport[]>({
    queryKey: ['admin-transparency-reports'],
    queryFn: async () => (await api.get('/admin/transparency-reports')).data?.reports ?? [],
  });

  const register = useQuery<Subprocessor[]>({
    queryKey: ['admin-subprocessors'],
    queryFn: async () => (await api.get('/admin/subprocessors')).data?.subprocessors ?? [],
  });

  const compile = useMutation({
    mutationFn: () => api.post('/admin/transparency-reports', { period: period.trim().toUpperCase() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-transparency-reports'] });
      toast.success('Compiled as a draft. Check the figures, then publish.');
    },
    onError: (error) => toast.error(errorMessage(error) || 'That quarter could not be compiled'),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.post(`/admin/transparency-reports/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-transparency-reports'] });
      toast.success('Published');
    },
    onError: (error) => toast.error(errorMessage(error) || 'That report could not be published'),
  });

  const addProvider = useMutation({
    mutationFn: () =>
      api.post('/admin/subprocessors', {
        name: provider.name.trim(),
        description: provider.description.trim() || null,
        country: provider.country.trim(),
        transferMechanism: provider.transferMechanism.trim() || null,
        services: provider.services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        dataCategories: provider.dataCategories,
        dpaSignedAt: provider.dpaSignedAt || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subprocessors'] });
      setProvider(emptyProvider);
      toast.success('Added to the register');
    },
    onError: (error) => toast.error(errorMessage(error) || 'That provider could not be added'),
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/admin/subprocessors/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-subprocessors'] }),
    onError: (error) => toast.error(errorMessage(error) || 'That change could not be saved'),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <Link href="/admin" className="inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Public disclosures</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          What members and regulators are shown about how ATHENA moderates and who handles their information.
        </p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <FileBarChart className="h-5 w-5 text-primary-600" /> Transparency reports
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A finished quarter is counted from the report queue, the moderation log and appeals. It is saved as a draft; it
          appears on{' '}
          <Link href="/help/transparency-report" className="text-primary-600 hover:underline">
            the public page
          </Link>{' '}
          only once you publish it. A published report is never recompiled.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} className="w-32" aria-label="Quarter, for example Q3_2026" />
          <Button onClick={() => compile.mutate()} disabled={compile.isPending || !period.trim()}>
            {compile.isPending ? 'Counting…' : 'Compile quarter'}
          </Button>
        </div>

        <div className="mt-4">
          {reports.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : reports.isError ? (
            <p className="text-sm text-amber-700">The reports could not be loaded. That is not the same as there being none.</p>
          ) : (reports.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No report has been compiled yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Quarter</th>
                  <th className="py-2 pr-4">Reports</th>
                  <th className="py-2 pr-4">Actions</th>
                  <th className="py-2 pr-4">Decided &lt;24h / 24–72h / &gt;72h</th>
                  <th className="py-2 pr-4">Appeals</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(reports.data ?? []).map((report) => (
                  <tr key={report.id}>
                    <td className="py-2 pr-4 font-medium">{report.period.replace('_', ' ')}</td>
                    <td className="py-2 pr-4">{report.totalReports}</td>
                    <td className="py-2 pr-4">{report.actionsTotal}</td>
                    <td className="py-2 pr-4">
                      {report.under24Hours} / {report.under72Hours} / {report.over72Hours}
                    </td>
                    <td className="py-2 pr-4">{report.totalAppeals}</td>
                    <td className="py-2 text-right">
                      {report.publishedAt ? (
                        <span className="text-emerald-700">Published {new Date(report.publishedAt).toLocaleDateString('en-AU')}</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={publish.isPending}
                          onClick={() => {
                            if (window.confirm(`Publish the ${report.period.replace('_', ' ')} report? Once published it cannot be recompiled.`)) {
                              publish.mutate(report.id);
                            }
                          }}
                        >
                          Publish
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Server className="h-5 w-5 text-primary-600" /> Service provider register
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Every provider that handles members&apos; personal information, and where. Active entries appear on{' '}
          <Link href="/privacy/subprocessors" className="text-primary-600 hover:underline">
            the public providers page
          </Link>{' '}
          and decide what /data-transfers reports as overseas. Record a data processing agreement only with the date it was
          signed; without one the page says none is on record.
        </p>

        <div className="mt-4">
          {register.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : register.isError ? (
            <p className="text-sm text-amber-700">The register could not be loaded. That is not the same as it being empty.</p>
          ) : (register.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">The register is empty, so the public page says the list has not been published.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {(register.data ?? []).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <span className={entry.isActive ? 'font-medium' : 'font-medium text-slate-400 line-through'}>{entry.name}</span>
                    <span className="text-slate-500"> · {entry.country}</span>
                    {entry.services.length > 0 && <span className="text-slate-500"> · {entry.services.join(', ')}</span>}
                    <span className="text-slate-500"> · {entry.dpaSignedAt ? `DPA signed ${new Date(entry.dpaSignedAt).toLocaleDateString('en-AU')}` : 'no DPA on record'}</span>
                  </div>
                  <Button size="sm" variant="outline" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: entry.id, isActive: !entry.isActive })}>
                    {entry.isActive ? 'Retire' : 'Reinstate'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          className="mt-6 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            addProvider.mutate();
          }}
        >
          <Input required placeholder="Provider name" value={provider.name} onChange={(e) => setProvider({ ...provider, name: e.target.value })} />
          <Input required placeholder="Country data is held in" value={provider.country} onChange={(e) => setProvider({ ...provider, country: e.target.value })} />
          <Input placeholder="What they do for ATHENA" value={provider.description} onChange={(e) => setProvider({ ...provider, description: e.target.value })} />
          <Input placeholder="Services, comma separated" value={provider.services} onChange={(e) => setProvider({ ...provider, services: e.target.value })} />
          <Input placeholder="Overseas transfer basis (if any)" value={provider.transferMechanism} onChange={(e) => setProvider({ ...provider, transferMechanism: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            DPA signed
            <Input type="date" value={provider.dpaSignedAt} onChange={(e) => setProvider({ ...provider, dpaSignedAt: e.target.value })} />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm text-slate-600 dark:text-slate-300">What it handles</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {DATA_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={provider.dataCategories.includes(category)}
                    onChange={(e) =>
                      setProvider({
                        ...provider,
                        dataCategories: e.target.checked
                          ? [...provider.dataCategories, category]
                          : provider.dataCategories.filter((c) => c !== category),
                      })
                    }
                  />
                  {category.toLowerCase()}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={addProvider.isPending}>
              Add to the register
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
