'use client';

/**
 * The report, laid out to print: the window, what is worth raising, the
 * averages, the two trend charts, the cycle, the symptoms, the medications
 * and the patterns, on paper a GP can read in a minute. Print to PDF from
 * here, or download the numbers.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Download, FileText, Printer } from 'lucide-react';
import { useAuth } from '@/lib/hooks';
import { wellnessApi, wellnessError, type Insight } from '@/lib/wellness-api';
import { ErrorBox, HealthDisclaimer, Loading, PageTitle, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { LineChart, SelectInput, Stat } from '@/components/strategy/StrategyUi';
import { downloadText } from '@/lib/download';

type Insights = { window: { from: string; to: string; days: number }; coverage: { checkinDays: number; sleepDays: number; activityDays: number; periodDays: number }; averages: { mood: number | null; stress: number | null; anxiety: number | null; energy: number | null; sleepHours: number | null; activityMinutesPerWeek: number | null; glassesPerDay: number | null }; trends: Array<{ metric: string; label: string; weekly: Array<{ weekStart: string; value: number | null }> }>; patterns: Insight[]; risks: Insight[]; recommendations: Insight[]; notes: string[] };
type Report = { generatedAt: string; window: { from: string; to: string; days: number }; checkins: { days: number; lowMoodDays: number }; sleep: { nights: number; averageHours: number | null; shortNights: number; averageQuality: number | null }; activity: { sessions: number; minutesPerWeek: number | null; types: Array<{ type: string; minutes: number }> }; cycle: { periods: number; averageCycle: number | null; variability: number | null; averagePeriod: number | null; lastPeriodStart: string | null; flags: string[] }; symptoms: Array<{ name: string; times: number; maxSeverity: number; lastDay: string }>; medications: Array<{ name: string; dose?: string; times?: string[]; prescribedBy?: string; adherencePct?: number | null }>; flags: string[]; notes: string[] };

const n = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? '–' : `${v}${suffix}`);

export default function ReportPage() {
  const { user } = useAuth();
  const [days, setDays] = useState('90');
  const insights = useLoad<Insights>(() => wellnessApi.insights(Number(days)), [days]);
  const report = useLoad<Report>(() => wellnessApi.report(Number(days)), [days]);
  const i = insights.data;
  const r = report.data;

  const csv = async () => { try { const res = await wellnessApi.reportCsv(Number(days)); downloadText(`athena-health-${new Date().toISOString().slice(0, 10)}.csv`, String(res.data), 'text/csv;charset=utf-8'); } catch (err) { toast.error(wellnessError(err, 'The export could not be built.')); } };
  const json = () => { if (r) downloadText(`athena-health-report-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(r, null, 2), 'application/json'); };
  const series = (metric: string, color: string) => { const t = i?.trends.find((x) => x.metric === metric); return t ? { label: t.label, color, values: t.weekly.map((w) => w.value ?? 0) } : null; };
  const labels = i?.trends.find((t) => t.metric === 'mood')?.weekly.map((w) => fmtDay(w.weekStart, { day: 'numeric', month: 'short' })) ?? [];
  const keep = <T,>(xs: Array<T | null>) => xs.filter((s): s is T => Boolean(s));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 print:max-w-none print:space-y-4 print:p-0">
      <div className="print:hidden">
        <PageTitle icon={FileText} kicker="Wellness" title="For your doctor" blurb="The window on one page, with the charts. Print it, save it as a PDF, or hand over a link from the insights page instead." action={<div className="w-40"><SelectInput value={days} onChange={setDays} options={[{ value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '180', label: 'Last 6 months' }, { value: '365', label: 'Last year' }]} /></div>} />
        <div className="mt-4"><WellnessNav current="/dashboard/wellness/insights" /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2 text-sm"><Printer className="h-4 w-4" /> Print, or save as PDF</button>
          <button type="button" onClick={csv} className="btn-secondary inline-flex items-center gap-2 text-sm"><Download className="h-4 w-4" /> Every entry as CSV</button>
          <button type="button" onClick={json} disabled={!r} className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"><Download className="h-4 w-4" /> The summary as JSON</button>
          <Link href="/dashboard/wellness/insights#report" className="btn-ghost text-sm">A link that expires instead</Link>
        </div>
      </div>
      {(insights.loading || report.loading) && <Loading label="Building the report" />}
      <ErrorBox error={insights.error || report.error} />
      {i && r && (
        <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 print:border-0 print:p-0">
          <header>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Health summary for a consultation</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Health summary'}</h1>
            <p className="text-sm text-slate-500">{fmtDay(r.window.from, { day: 'numeric', month: 'short', year: 'numeric' })} to {fmtDay(r.window.to, { day: 'numeric', month: 'short', year: 'numeric' })}, {r.window.days} days · {i.coverage.checkinDays} check-ins, {i.coverage.sleepDays} nights, {i.coverage.activityDays} days with movement, {i.coverage.periodDays} period days · generated {new Date(r.generatedAt).toLocaleDateString('en-AU')}</p>
          </header>

          {r.flags.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-900/10 print:break-inside-avoid">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">Worth raising</h2>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-800 dark:text-slate-200">{r.flags.map((f) => <li key={f}>{f}</li>)}</ul>
            </section>
          )}

          <section className="print:break-inside-avoid">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Averages <span className="font-normal text-slate-500">(scales run 1, lowest, to 5)</span></h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <Stat label="Mood" value={n(i.averages.mood)} /><Stat label="Stress" value={n(i.averages.stress)} /><Stat label="Anxiety" value={n(i.averages.anxiety)} /><Stat label="Energy" value={n(i.averages.energy)} />
              <Stat label="Sleep" value={n(i.averages.sleepHours, ' h')} sub={`${r.sleep.shortNights} nights under 6 h`} /><Stat label="Movement" value={n(i.averages.activityMinutesPerWeek, ' min')} sub="a week" /><Stat label="Low mood days" value={String(r.checkins.lowMoodDays)} sub="mood 1 or 2" />
            </div>
          </section>

          {i.coverage.checkinDays >= 3 && (
            <section className="grid gap-5 md:grid-cols-2 print:break-inside-avoid">
              <div><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mood, stress, anxiety, energy by week</h3><div className="mt-2"><LineChart money={false} height={150} labels={labels} series={keep([series('mood', '#f43f5e'), series('stress', '#f59e0b'), series('anxiety', '#a855f7'), series('energy', '#10b981')])} /></div></div>
              <div><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sleep hours and movement minutes by week</h3><div className="mt-2"><LineChart money={false} height={150} labels={labels} series={keep([series('sleepHours', '#0ea5e9'), series('activityMinutes', '#14b8a6')])} /></div></div>
            </section>
          )}

          {r.cycle.periods > 0 && (
            <section className="print:break-inside-avoid">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cycle</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Periods logged" value={String(r.cycle.periods)} /><Stat label="Average cycle" value={n(r.cycle.averageCycle, ' days')} /><Stat label="Variation" value={n(r.cycle.variability, ' days')} /><Stat label="Last period" value={r.cycle.lastPeriodStart ? fmtDay(r.cycle.lastPeriodStart, { day: 'numeric', month: 'short', year: 'numeric' }) : '–'} /></div>
              {r.cycle.flags.length > 0 && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{r.cycle.flags.join(' · ')}</p>}
            </section>
          )}

          {r.symptoms.length > 0 && (
            <section className="print:break-inside-avoid">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Symptoms</h2>
              <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Symptom</th><th>Times</th><th>Worst</th><th>Last</th></tr></thead><tbody>{r.symptoms.map((s) => <tr key={s.name} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1 text-slate-800 dark:text-slate-200">{s.name}</td><td>{s.times}</td><td>{s.maxSeverity}/5</td><td>{fmtDay(s.lastDay)}</td></tr>)}</tbody></table>
            </section>
          )}

          {r.medications.length > 0 && (
            <section className="print:break-inside-avoid">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Medications and supplements</h2>
              <ul className="mt-2 space-y-1 text-sm">{r.medications.map((m, idx) => <li key={idx} className="text-slate-800 dark:text-slate-200"><span className="font-medium">{m.name}</span>{m.dose ? `, ${m.dose}` : ''}{m.times?.length ? ` at ${m.times.join(', ')}` : ''}{m.prescribedBy ? ` (${m.prescribedBy})` : ''}{m.adherencePct !== null && m.adherencePct !== undefined ? ` · ${m.adherencePct}% of doses logged taken` : ''}</li>)}</ul>
            </section>
          )}

          {(i.patterns.length > 0 || i.risks.length > 0) && (
            <section className="print:break-inside-avoid">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Patterns in the records</h2>
              <ul className="mt-2 space-y-2 text-sm">{[...i.risks, ...i.patterns].map((p) => <li key={p.key}><span className="font-medium text-slate-800 dark:text-slate-200">{p.title}.</span> <span className="text-slate-600 dark:text-slate-400">{p.body}</span></li>)}</ul>
            </section>
          )}

          <footer className="text-xs text-slate-500">{r.notes.join(' ')} {i.notes.join(' ')}</footer>
        </article>
      )}
      <div className="print:hidden"><HealthDisclaimer /></div>
    </div>
  );
}
