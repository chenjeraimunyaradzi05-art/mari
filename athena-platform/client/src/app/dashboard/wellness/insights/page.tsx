'use client';

/**
 * What the days are saying: the trends over the weeks, the patterns
 * between one thing and another, the signs a doctor would want to hear
 * about, and the recommendations that follow. Then the report for a
 * consultation, as a download or as a link handed to a practitioner that
 * expires when she says.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Activity, Download, FileText, Link2, Printer, Trash2 } from 'lucide-react';
import { wellnessApi, wellnessError, type Insight } from '@/lib/wellness-api';
import { CrisisStrip, Empty, ErrorBox, HealthDisclaimer, InsightCard, Loading, PageTitle, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Check, Field, LineChart, Notes, Panel, SelectInput, Stat, inputClass } from '@/components/strategy/StrategyUi';
import { downloadText, shareOrCopy } from '@/lib/download';

type Insights = { window: { from: string; to: string; days: number }; coverage: { checkinDays: number; sleepDays: number; activityDays: number; periodDays: number; hydrationDays: number }; averages: { mood: number | null; stress: number | null; anxiety: number | null; energy: number | null; sleepHours: number | null; activityMinutesPerWeek: number | null; glassesPerDay: number | null }; trends: Array<{ metric: string; label: string; weekly: Array<{ weekStart: string; value: number | null }>; direction: string; change: number | null }>; patterns: Insight[]; risks: Insight[]; recommendations: Insight[]; notes: string[] };
type Share = { id: string; token: string; label: string | null; scope: string[]; expiresAt: string; revokedAt: string | null; openedCount: number; days: number; anonymous?: boolean };
type Reference = { shareScopes: Array<{ key: string; label: string }> };

export default function InsightsPage() {
  const [days, setDays] = useState('90');
  const insights = useLoad<Insights>(() => wellnessApi.insights(Number(days)), [days]);
  const shares = useLoad<Share[]>(() => wellnessApi.shares());
  const ref = useLoad<Reference>(() => wellnessApi.reference());
  const [scope, setScope] = useState<string[]>(['checkins', 'sleep', 'cycle', 'symptoms', 'medications']);
  const [label, setLabel] = useState('');
  const [expires, setExpires] = useState('7');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const r = insights.data;

  const csv = async () => {
    try { const res = await wellnessApi.reportCsv(Number(days)); downloadText(`athena-health-${new Date().toISOString().slice(0, 10)}.csv`, String(res.data), 'text/csv;charset=utf-8'); } catch (err) { toast.error(wellnessError(err, 'The export could not be built.')); }
  };
  const json = async () => {
    try { const res = await wellnessApi.report(Number(days)); downloadText(`athena-health-report-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(res.data?.data, null, 2), 'application/json'); } catch (err) { toast.error(wellnessError(err, 'The report could not be built.')); }
  };
  const createShare = async () => {
    setBusy(true);
    try { await wellnessApi.createShare({ scope, days: Number(days), expiresInDays: Number(expires), label: label || undefined, anonymous }); toast.success('Link created'); setLabel(''); shares.reload(); } catch (err) { toast.error(wellnessError(err, 'The link could not be created.')); } finally { setBusy(false); }
  };
  const copy = async (s: Share) => {
    const url = `${window.location.origin}/wellness/share/${s.token}`;
    const outcome = await shareOrCopy({ title: 'My health summary', url });
    toast.success(outcome === 'copied' ? 'Link copied' : outcome === 'shared' ? 'Shared' : url);
  };
  const revoke = async (s: Share) => { try { await wellnessApi.revokeShare(s.id); shares.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be withdrawn.')); } };

  const trend = (metric: string) => r?.trends.find((t) => t.metric === metric);
  const series = (metric: string, color: string) => { const t = trend(metric); return t ? { label: t.label, color, values: t.weekly.map((w) => w.value ?? 0) } : null; };
  const labels = trend('mood')?.weekly.map((w) => fmtDay(w.weekStart, { day: 'numeric', month: 'short' })) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Activity} kicker="Wellness" title="What the days are saying" blurb="Patterns from your own records, explained, with a source under each. A prompt for a conversation, never a diagnosis." action={<div className="w-40"><SelectInput value={days} onChange={setDays} options={[{ value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '180', label: 'Last 6 months' }, { value: '365', label: 'Last year' }]} /></div>} />
      <WellnessNav current="/dashboard/wellness/insights" />
      {insights.loading && <Loading label="Reading the days" />}
      <ErrorBox error={insights.error} />
      {r && (
        <>
          {r.risks.some((x) => x.crisis) && <CrisisStrip />}
          <Panel title={`${fmtDay(r.window.from, { day: 'numeric', month: 'short' })} to ${fmtDay(r.window.to, { day: 'numeric', month: 'short' })}`} intro={`${r.coverage.checkinDays} check-ins, ${r.coverage.sleepDays} nights, ${r.coverage.activityDays} days with movement, ${r.coverage.periodDays} period days.`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <Stat label="Mood" value={r.averages.mood?.toString() ?? '–'} sub="of 5" /><Stat label="Stress" value={r.averages.stress?.toString() ?? '–'} sub="of 5" /><Stat label="Anxiety" value={r.averages.anxiety?.toString() ?? '–'} sub="of 5" /><Stat label="Energy" value={r.averages.energy?.toString() ?? '–'} sub="of 5" />
              <Stat label="Sleep" value={r.averages.sleepHours !== null ? `${r.averages.sleepHours} h` : '–'} /><Stat label="Movement" value={r.averages.activityMinutesPerWeek !== null ? `${r.averages.activityMinutesPerWeek} min` : '–'} sub="a week" /><Stat label="Water" value={r.averages.glassesPerDay !== null ? `${r.averages.glassesPerDay}` : '–'} sub="glasses a day" />
            </div>
            {r.coverage.checkinDays >= 3 && (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mood, stress, anxiety, energy by week</h3><div className="mt-2"><LineChart money={false} height={160} labels={labels} series={[series('mood', '#f43f5e'), series('stress', '#f59e0b'), series('anxiety', '#a855f7'), series('energy', '#10b981')].filter((s): s is NonNullable<typeof s> => Boolean(s))} /></div></div>
                <div><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sleep hours and movement minutes by week</h3><div className="mt-2"><LineChart money={false} height={160} labels={labels} series={[series('sleepHours', '#0ea5e9'), series('activityMinutes', '#14b8a6')].filter((s): s is NonNullable<typeof s> => Boolean(s))} /></div></div>
              </div>
            )}
            <Notes items={r.notes} title="How this is read" />
          </Panel>

          {r.risks.length > 0 && <section><h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Worth raising with someone</h2><div className="grid gap-3 md:grid-cols-2">{r.risks.map((i) => <InsightCard key={i.key} insight={i} />)}</div></section>}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Patterns</h2>
            {r.patterns.length ? <div className="grid gap-3 md:grid-cols-2">{r.patterns.map((i) => <InsightCard key={i.key} insight={i} />)}</div> : <Empty title="Nothing to say yet" body="Patterns need about a week of check-ins, and the cycle ones need two logged periods. Keep going." action={<Link href="/dashboard/wellness/track" className="btn-primary text-sm">Log today</Link>} />}
          </section>
          {r.recommendations.length > 0 && <section><h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">What might help</h2><div className="grid gap-3 md:grid-cols-2">{r.recommendations.map((i) => <InsightCard key={i.key} insight={i} />)}</div></section>}

          <Panel id="report" icon={FileText} title="For your doctor" intro="A summary of this window with the averages, the flags, the cycle, the symptoms and the medications. Download it, or hand over a link that expires.">
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/wellness/report" className="btn-primary inline-flex items-center gap-2 text-sm"><Printer className="h-4 w-4" /> Print it, with the charts</Link>
              <button type="button" onClick={csv} className="btn-secondary inline-flex items-center gap-2 text-sm"><Download className="h-4 w-4" /> Every entry as CSV</button>
              <button type="button" onClick={json} className="btn-secondary inline-flex items-center gap-2 text-sm"><Download className="h-4 w-4" /> The summary</button>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">A link for a practitioner</h3>
              <p className="mt-1 text-xs text-slate-500">Choose what it shows. It opens without an account, counts how often it was opened, and you can withdraw it at any time.</p>
              <div className="mt-3 flex flex-wrap gap-3">{(ref.data?.shareScopes ?? []).map((s) => <Check key={s.key} label={s.label} checked={scope.includes(s.key)} onChange={(v) => setScope((x) => (v ? [...x, s.key] : x.filter((k) => k !== s.key)))} />)}</div>
              <div className="mt-3"><Check checked={anonymous} onChange={setAnonymous} label="Leave my name off" hint="The summary opens as “A member”. For a practitioner you have not met yet, or a second opinion." /></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                <Field label="Label" hint="Who it is for, so you recognise it later."><input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} className={inputClass} placeholder="Dr Nguyen, 24 Sep" /></Field>
                <Field label="Expires"><SelectInput value={expires} onChange={setExpires} options={[{ value: '1', label: 'In a day' }, { value: '7', label: 'In a week' }, { value: '30', label: 'In a month' }]} /></Field>
                <button type="button" onClick={createShare} disabled={busy || scope.length === 0} className="btn-primary mb-1 inline-flex items-center gap-2 text-sm disabled:opacity-50"><Link2 className="h-4 w-4" /> Create link</button>
              </div>
              {(shares.data ?? []).filter((s) => !s.revokedAt).length > 0 && (
                <ul className="mt-4 space-y-2">
                  {(shares.data ?? []).filter((s) => !s.revokedAt).map((s) => {
                    const dead = new Date(s.expiresAt) < new Date();
                    return <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><div><p className="font-medium text-slate-800 dark:text-slate-200">{s.label || 'Health summary'} <span className="font-normal text-slate-500">· {s.scope.length} sections · {s.days} days{s.anonymous ? ' · no name' : ''}</span></p><p className="text-xs text-slate-500">{dead ? 'Expired' : `Expires ${new Date(s.expiresAt).toLocaleDateString('en-AU')}`} · opened {s.openedCount} time{s.openedCount === 1 ? '' : 's'}</p></div><div className="flex gap-2">{!dead && <button type="button" onClick={() => copy(s)} className="btn-ghost text-xs">Copy link</button>}<button type="button" onClick={() => revoke(s)} className="btn-ghost inline-flex items-center gap-1 text-xs text-slate-500"><Trash2 className="h-3.5 w-3.5" /> Withdraw</button></div></li>;
                  })}
                </ul>
              )}
            </div>
          </Panel>
        </>
      )}
      <HealthDisclaimer />
    </div>
  );
}
