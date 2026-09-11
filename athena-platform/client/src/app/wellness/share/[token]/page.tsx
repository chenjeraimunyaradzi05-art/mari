'use client';

/**
 * What a practitioner sees when a member hands her a share link: the
 * summary the member chose to share, for the window she chose, until the
 * link expires or she withdraws it. Open by token; no account needed on
 * the practitioner's side.
 */

import { useParams } from 'next/navigation';
import { Printer, ShieldCheck } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { wellnessApi } from '@/lib/wellness-api';
import { ErrorBox, Loading, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Stat } from '@/components/strategy/StrategyUi';

type Share = {
  memberName: string; label: string | null; scope: string[]; expiresAt: string;
  report: { generatedAt: string; window: { from: string; to: string; days: number }; checkins: { days: number; mood: number | null; stress: number | null; anxiety: number | null; energy: number | null; lowMoodDays: number } | null; sleep: { nights: number; averageHours: number | null; shortNights: number; averageQuality: number | null } | null; activity: { sessions: number; minutesPerWeek: number | null; types: Array<{ type: string; minutes: number }> } | null; cycle: { periods: number; averageCycle: number | null; variability: number | null; averagePeriod: number | null; lastPeriodStart: string | null; flags: string[] } | null; symptoms: Array<{ name: string; times: number; maxSeverity: number; lastDay: string }>; medications: Array<{ name: string; dose?: string; times?: string[]; prescribedBy?: string; adherencePct?: number | null }>; flags: string[]; notes: string[] };
  mentalLoad: { totalHours: number; myHours: number; myShare: number; burnout: { level: string; title: string } } | null;
};

const n = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? '–' : `${v}${suffix}`);

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const share = useLoad<Share>(() => wellnessApi.share(params.token), [params.token]);
  const r = share.data?.report;

  return (
    <PageShell width="narrow" showBack={false}>
      {share.loading && <Loading label="Opening the summary" />}
      {share.error && <ErrorBox error={share.error} />}
      {share.data && r && (
        <div className="space-y-5 print:space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-rose-600"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Shared health summary</span></div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{share.data.memberName}</h1>
              <p className="text-sm text-slate-500">{share.data.label ? `${share.data.label} · ` : ''}{fmtDay(r.window.from)} to {fmtDay(r.window.to)} ({r.window.days} days). Link expires {new Date(share.data.expiresAt).toLocaleDateString('en-AU')}.</p>
            </div>
            <button type="button" onClick={() => window.print()} className="btn-secondary inline-flex items-center gap-2 text-sm print:hidden"><Printer className="h-4 w-4" /> Print</button>
          </div>

          {r.flags.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">Worth raising</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-800 dark:text-slate-200">{r.flags.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}

          {r.checkins && (
            <section>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mood, stress, anxiety and energy <span className="font-normal text-slate-500">({r.checkins.days} days logged, scale 1 to 5)</span></h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat label="Mood" value={n(r.checkins.mood)} /><Stat label="Stress" value={n(r.checkins.stress)} /><Stat label="Anxiety" value={n(r.checkins.anxiety)} /><Stat label="Energy" value={n(r.checkins.energy)} /><Stat label="Low mood days" value={String(r.checkins.lowMoodDays)} sub="mood 1 or 2" />
              </div>
            </section>
          )}
          {r.sleep && (
            <section>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sleep <span className="font-normal text-slate-500">({r.sleep.nights} nights)</span></h2>
              <div className="mt-2 grid grid-cols-3 gap-2"><Stat label="Average" value={n(r.sleep.averageHours, ' h')} /><Stat label="Under 6 hours" value={`${r.sleep.shortNights} nights`} /><Stat label="Quality" value={n(r.sleep.averageQuality, ' / 5')} /></div>
            </section>
          )}
          {r.activity && (
            <section>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Movement</h2>
              <div className="mt-2 grid grid-cols-2 gap-2"><Stat label="A week" value={n(r.activity.minutesPerWeek, ' min')} sub="guideline 150 to 300" /><Stat label="Sessions" value={String(r.activity.sessions)} sub={r.activity.types.slice(0, 3).map((t) => `${t.type} ${t.minutes}m`).join(', ')} /></div>
            </section>
          )}
          {r.cycle && (
            <section>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cycle</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Periods logged" value={String(r.cycle.periods)} /><Stat label="Average cycle" value={n(r.cycle.averageCycle, ' days')} /><Stat label="Variation" value={n(r.cycle.variability, ' days')} /><Stat label="Last period" value={r.cycle.lastPeriodStart ? fmtDay(r.cycle.lastPeriodStart, { day: 'numeric', month: 'short', year: 'numeric' }) : '–'} /></div>
              {r.cycle.flags.length > 0 && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{r.cycle.flags.join(' · ')}</p>}
            </section>
          )}
          {r.symptoms.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Symptoms</h2>
              <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Symptom</th><th>Times</th><th>Worst</th><th>Last</th></tr></thead><tbody>{r.symptoms.map((s) => <tr key={s.name} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1 text-slate-800 dark:text-slate-200">{s.name}</td><td>{s.times}</td><td>{s.maxSeverity}/5</td><td>{fmtDay(s.lastDay)}</td></tr>)}</tbody></table>
            </section>
          )}
          {r.medications.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Medications and supplements</h2>
              <ul className="mt-2 space-y-1 text-sm">{r.medications.map((m, i) => <li key={i} className="text-slate-800 dark:text-slate-200"><span className="font-medium">{m.name}</span>{m.dose ? `, ${m.dose}` : ''}{m.times?.length ? ` at ${m.times.join(', ')}` : ''}{m.prescribedBy ? ` (${m.prescribedBy})` : ''}{m.adherencePct !== null && m.adherencePct !== undefined ? ` · ${m.adherencePct}% of doses logged taken` : ''}</li>)}</ul>
            </section>
          )}
          {share.data.mentalLoad && (
            <section>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mental load, last four weeks</h2>
              <div className="mt-2 grid grid-cols-3 gap-2"><Stat label="Hours logged" value={String(share.data.mentalLoad.totalHours)} /><Stat label="Carried by her" value={`${share.data.mentalLoad.myShare}%`} /><Stat label="Burnout signal" value={share.data.mentalLoad.burnout.level} sub={share.data.mentalLoad.burnout.title} /></div>
            </section>
          )}
          <p className="text-xs text-slate-500">{r.notes.join(' ')} Generated {new Date(r.generatedAt).toLocaleString('en-AU')}.</p>
        </div>
      )}
    </PageShell>
  );
}
