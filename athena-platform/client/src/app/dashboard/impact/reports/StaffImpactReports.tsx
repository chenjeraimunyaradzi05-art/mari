'use client';

/**
 * Staff publishing, correcting and withdrawing impact reports.
 *
 * Nothing could write an impact report, so the page above this panel could
 * only ever say none had been published. Staff now count a period here and
 * publish it. They choose the period, the region and optionally one
 * community, and write the narrative; they never type a figure. The server
 * counts every number from the platform's records and refuses a period still
 * running or a report so small it could point at the women in it. A
 * correction recounts or rewrites the narrative and says why; a withdrawal
 * takes the report down and says why. All of it is in the audit log under the
 * name of whoever did it.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export const COMMUNITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'FIRST_NATIONS', label: 'First Nations' },
  { value: 'REFUGEE_IMMIGRANT', label: 'Refugee & Immigrant' },
  { value: 'DV_SURVIVOR', label: 'DV Survivor' },
  { value: 'DISABILITY', label: 'Disability' },
  { value: 'LGBTQIA', label: 'LGBTQIA+' },
  { value: 'SINGLE_PARENT', label: 'Single Parent' },
  { value: 'RURAL_REGIONAL', label: 'Rural & Regional' },
  { value: 'GENERAL', label: 'General' },
];
const REGIONS = ['ANZ', 'US', 'SEA', 'MEA', 'UK', 'EU', 'ROW'];

type Figures = {
  totalUsersSupported: number;
  employmentGained: number;
  housingSecured: number;
  qualificationsObtained: number;
  businessesStarted: number;
  safetyAchieved: number;
  avgIncomeIncrease: number | null;
};
type Basis = {
  period: { label: string; description: string };
  outcomesRecorded: number;
  outcomesVerified: number;
  programmeMembers: number;
  incomeReports: number;
};
type Preview = { figures: Figures; basis: Basis; publishable: boolean; refusal: string | null };
type StaffReport = Figures & {
  id: string;
  reportPeriod: string;
  communityType: string | null;
  region: string;
  narrativeSummary: string | null;
  basis: Basis | null;
  createdAt: string;
};

const FIGURE_LABELS: Array<[keyof Figures, string]> = [
  ['totalUsersSupported', 'Women supported'],
  ['employmentGained', 'Gained employment'],
  ['housingSecured', 'Secured housing'],
  ['qualificationsObtained', 'Obtained a qualification'],
  ['businessesStarted', 'Started a business'],
  ['safetyAchieved', 'Reached safety'],
];

const inputClass = 'w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700';
const labelClass = 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

const serverMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
};

const communityLabel = (value: string | null) => (value ? COMMUNITY_OPTIONS.find((c) => c.value === value)?.label ?? value : 'All communities');

function FiguresTable({ figures }: { figures: Figures }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {FIGURE_LABELS.map(([key, label]) => (
        <div key={key}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{figures[key] ?? 0}</dd>
        </div>
      ))}
      <div>
        <dt className="text-xs text-slate-500">Average income increase</dt>
        <dd className="font-semibold text-slate-900 dark:text-white">{figures.avgIncomeIncrease === null ? 'Too few to average' : `$${figures.avgIncomeIncrease.toLocaleString('en-AU')}`}</dd>
      </div>
    </dl>
  );
}

function BasisLine({ basis }: { basis: Basis }) {
  return (
    <p className="text-xs text-slate-500">
      {basis.period.description}: {basis.outcomesRecorded} outcome{basis.outcomesRecorded === 1 ? '' : 's'} recorded by members ({basis.outcomesVerified} verified by staff), and{' '}
      {basis.programmeMembers} {basis.programmeMembers === 1 ? 'woman' : 'women'} who began or completed a programme.
    </p>
  );
}

function PublishedReport({ report, onChanged }: { report: StaffReport; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [narrative, setNarrative] = useState(report.narrativeSummary ?? '');
  const [recount, setRecount] = useState(false);
  const [busy, setBusy] = useState<'correct' | 'withdraw' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const correct = async () => {
    setBusy('correct');
    setResult(null);
    try {
      const narrativeChanged = narrative.trim() !== (report.narrativeSummary ?? '').trim();
      const res = await api.patch(`/impact/admin/reports/${report.id}`, {
        reason,
        ...(recount ? { recount: true } : {}),
        ...(narrativeChanged ? { narrativeSummary: narrative.trim() || null } : {}),
      });
      setResult({ ok: true, text: res.data?.message || 'Corrected.' });
      setReason('');
      setRecount(false);
      onChanged();
    } catch (err) {
      setResult({ ok: false, text: serverMessage(err, 'The report could not be corrected. Nothing was changed.') });
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    setBusy('withdraw');
    setResult(null);
    try {
      await api.post(`/impact/admin/reports/${report.id}/withdraw`, { reason });
      onChanged();
    } catch (err) {
      setResult({ ok: false, text: serverMessage(err, 'The report could not be withdrawn. It is still published.') });
      setBusy(null);
    }
  };

  return (
    <li className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-900 dark:text-white">
          {report.reportPeriod} · {communityLabel(report.communityType)} · {report.region}
        </p>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">
          {open ? 'Close' : 'Correct or withdraw'}
        </button>
      </div>
      <FiguresTable figures={report} />
      {report.basis && <BasisLine basis={report.basis} />}
      {open && (
        <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div>
            <label htmlFor={`narrative-${report.id}`} className={labelClass}>Narrative</label>
            <textarea id={`narrative-${report.id}`} value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={3} className={cn('mt-1', inputClass)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={recount} onChange={(e) => setRecount(e.target.checked)} /> Recount the figures from the records as they stand now
          </label>
          <div>
            <label htmlFor={`reason-${report.id}`} className={labelClass}>Why</label>
            <textarea id={`reason-${report.id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Goes into the audit log with your name" className={cn('mt-1', inputClass)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={correct} disabled={busy !== null} className="btn-primary inline-flex items-center gap-2">
              {busy === 'correct' && <Loader2 className="h-4 w-4 animate-spin" />} Save correction
            </button>
            <button type="button" onClick={withdraw} disabled={busy !== null} className="btn-secondary inline-flex items-center gap-2 text-red-600">
              {busy === 'withdraw' && <Loader2 className="h-4 w-4 animate-spin" />} Withdraw report
            </button>
          </div>
          {result && (
            <p role={result.ok ? 'status' : 'alert'} className={cn('text-sm', result.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>
              {result.text}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** The whole panel: shown to admins only, by the page that mounts it. */
export function StaffImpactReports({ onPublished }: { onPublished?: () => void }) {
  const [period, setPeriod] = useState('');
  const [community, setCommunity] = useState('');
  const [region, setRegion] = useState('ANZ');
  const [narrative, setNarrative] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'count' | 'publish' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [published, setPublished] = useState<StaffReport[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const loadPublished = useCallback(async () => {
    setListState('loading');
    try {
      const res = await api.get('/impact/admin/reports');
      setPublished((res.data?.data as StaffReport[]) || []);
      setListState('ready');
    } catch {
      setListState('failed');
    }
  }, []);

  useEffect(() => {
    void loadPublished();
  }, [loadPublished]);

  const scope = () => ({ period: period.trim(), ...(community ? { communityType: community } : {}), region });

  const count = async () => {
    setBusy('count');
    setPreview(null);
    setMessage(null);
    try {
      const res = await api.get('/impact/admin/reports/preview', { params: scope() });
      setPreview(res.data?.data as Preview);
    } catch (err) {
      setMessage({ ok: false, text: serverMessage(err, 'The period could not be counted.') });
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    setBusy('publish');
    setMessage(null);
    try {
      const res = await api.post('/impact/admin/reports', { ...scope(), ...(narrative.trim() ? { narrativeSummary: narrative.trim() } : {}) });
      setMessage({ ok: true, text: res.data?.message || 'Published.' });
      setPreview(null);
      setNarrative('');
      void loadPublished();
      onPublished?.();
    } catch (err) {
      setMessage({ ok: false, text: serverMessage(err, 'The report could not be published. Nothing was saved.') });
    } finally {
      setBusy(null);
    }
  };

  const changed = () => {
    void loadPublished();
    onPublished?.();
  };

  return (
    <section aria-labelledby="staff-impact-reports" className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 id="staff-impact-reports" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <BarChart3 className="h-5 w-5 text-rose-600" /> Staff: publish an impact report
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Every figure is counted from ATHENA&rsquo;s records for the period; none is typed in. A period still running, or one with fewer than five women, is not published. Everything here is recorded in the audit log under your name.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="report-period" className={labelClass}>Period</label>
          <input id="report-period" value={period} onChange={(e) => { setPeriod(e.target.value); setPreview(null); }} placeholder="Q3-2026, FY2026, 2026 or 2026-09" className={cn('mt-1', inputClass)} />
        </div>
        <div>
          <label htmlFor="report-community" className={labelClass}>Community</label>
          <select id="report-community" value={community} onChange={(e) => { setCommunity(e.target.value); setPreview(null); }} className={cn('mt-1', inputClass)}>
            <option value="">All communities</option>
            {COMMUNITY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="report-region" className={labelClass}>Region</label>
          <select id="report-region" value={region} onChange={(e) => { setRegion(e.target.value); setPreview(null); }} className={cn('mt-1', inputClass)}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" onClick={count} disabled={busy !== null || !period.trim()} className="btn-secondary inline-flex items-center gap-2">
        {busy === 'count' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Count this period
      </button>

      {preview && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <FiguresTable figures={preview.figures} />
          <BasisLine basis={preview.basis} />
          {preview.refusal ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {preview.refusal}
            </p>
          ) : (
            <>
              <div>
                <label htmlFor="report-narrative" className={labelClass}>Narrative (optional)</label>
                <textarea id="report-narrative" value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={3} className={cn('mt-1', inputClass)} />
              </div>
              <button type="button" onClick={publish} disabled={busy !== null} className="btn-primary inline-flex items-center gap-2">
                {busy === 'publish' && <Loader2 className="h-4 w-4 animate-spin" />} Publish this report
              </button>
            </>
          )}
        </div>
      )}

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={cn('text-sm', message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>
          {message.text}
        </p>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Published reports</h3>
        {listState === 'loading' ? (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : listState === 'failed' ? (
          <p role="alert" className="text-sm text-red-600">
            The published reports could not be loaded just now.{' '}
            <button type="button" onClick={() => void loadPublished()} className="font-medium underline">Try again</button>
          </p>
        ) : published.length === 0 ? (
          <p className="text-sm text-slate-500">None published yet.</p>
        ) : (
          <ul className="space-y-3">
            {published.map((report) => (
              <PublishedReport key={report.id} report={report} onChanged={changed} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default StaffImpactReports;
