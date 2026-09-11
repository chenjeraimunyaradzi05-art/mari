'use client';

/**
 * The mental load: log the invisible work as it happens, see it summed
 * by category and by who carried it, get the burnout warning early, and
 * take the words for handing a category over. The conversation card is
 * the week in a paragraph a partner can actually read.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Plus, Scale as ScaleIcon, Trash2 } from 'lucide-react';
import { localDay, wellnessApi, wellnessError } from '@/lib/wellness-api';
import { Chip, Empty, ErrorBox, HealthDisclaimer, Loading, PageTitle, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Bars, Field, LineChart, Notes, NumberInput, Panel, SelectInput, Stat, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Data = {
  today: string; entries: Array<{ id: string; day: string; category: string; task: string; minutes: number; carriedBy: string }>;
  analysis: { window: { from: string; to: string; weeks: number }; totalHours: number; myHours: number; myShare: number; invisibleShare: number; byCategory: Array<{ category: string; label: string; invisible: boolean; hours: number; myHours: number; share: number; tasks: string[] }>; byCarrier: Array<{ carrier: string; label: string; hours: number; share: number }>; weekly: Array<{ weekStart: string; myHours: number; totalHours: number }>; impactScore: number; impactLabel: string; burnout: { level: string; title: string; reasons: string[]; advice: string }; delegation: Array<{ category: string; label: string; hours: number; ask: string; handover: string[]; boundary: string }>; conversationCard: string; notes: string[] };
  categories: Array<{ key: string; label: string; invisible: boolean; examples: string }>;
};

const CARRIERS = [{ value: 'ME', label: 'Me' }, { value: 'SHARED', label: 'Shared' }, { value: 'PARTNER', label: 'My partner' }, { value: 'OTHER', label: 'Someone else' }];

export default function MentalLoadPage() {
  const [weeks, setWeeks] = useState('4');
  const data = useLoad<Data>(() => wellnessApi.mentalLoad(Number(weeks)), [weeks]);
  const [form, setForm] = useState({ day: localDay(), category: 'PLANNING', task: '', minutes: '30', carriedBy: 'ME' });
  const [busy, setBusy] = useState(false);
  const a = data.data?.analysis;

  const add = async () => {
    if (!form.task.trim()) return;
    setBusy(true);
    try { await wellnessApi.addLoad({ day: form.day, category: form.category, task: form.task.trim(), minutes: num(form.minutes, 30), carriedBy: form.carriedBy }); setForm((f) => ({ ...f, task: '' })); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be logged.')); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { try { await wellnessApi.deleteLoad(id); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be removed.')); } };
  const copyCard = async () => { if (!a?.conversationCard) return; try { await navigator.clipboard.writeText(a.conversationCard); toast.success('Copied'); } catch { toast.error('Copy did not work; select the text instead.'); } };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={ScaleIcon} kicker="Wellness" title="The mental load" blurb="The planning, remembering, admin and emotional work that nobody sees. Log it as it happens and the picture builds on its own." action={<div className="w-40"><SelectInput value={weeks} onChange={setWeeks} options={[{ value: '1', label: 'This week' }, { value: '4', label: 'Last 4 weeks' }, { value: '12', label: 'Last 12 weeks' }]} /></div>} />
      <WellnessNav current="/dashboard/wellness/mental-load" />

      <Panel icon={Plus} title="Log it" intro="Five minutes counts. Who carried it is the point of the exercise.">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Day"><input type="date" value={form.day} max={localDay()} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} className={inputClass} /></Field>
          <Field label="Category"><SelectInput value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={(data.data?.categories ?? [{ key: 'PLANNING', label: 'Planning', invisible: true, examples: '' }]).map((c) => ({ value: c.key, label: c.label }))} /></Field>
          <Field label="What" hint={data.data?.categories.find((c) => c.key === form.category)?.examples}><input value={form.task} onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && add()} maxLength={120} className={inputClass} placeholder="School forms, dinner plan, Mum's appointment" /></Field>
          <Field label="Minutes"><NumberInput value={form.minutes} onChange={(v) => setForm((f) => ({ ...f, minutes: v }))} min={1} max={1440} /></Field>
          <Field label="Carried by"><SelectInput value={form.carriedBy} onChange={(v) => setForm((f) => ({ ...f, carriedBy: v }))} options={CARRIERS} /></Field>
          <button type="button" onClick={add} disabled={busy || !form.task.trim()} className="btn-primary mb-1 text-sm disabled:opacity-50">Add</button>
        </div>
      </Panel>

      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {a && data.data && (
        <>
          {data.data.entries.length === 0 ? <Empty title="Nothing logged in this window" body="Add the first thing you did today that nobody asked you to do." /> : (
            <>
              <Panel title={`${fmtDay(a.window.from, { day: 'numeric', month: 'short' })} to ${fmtDay(a.window.to, { day: 'numeric', month: 'short' })}`} intro={`${a.totalHours} hours logged. ${a.myShare}% carried by you, ${a.invisibleShare}% of it invisible work.`}>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Stat label="Yours" value={`${a.myHours} h`} sub={`${a.myShare}% of the total`} big />
                  <Stat label="Impact" value={`${a.impactScore}`} sub={`${a.impactLabel}. Invisible work weighted up.`} tone={a.impactScore >= 75 ? 'rose' : a.impactScore >= 45 ? 'warn' : 'plain'} />
                  <Stat label="Invisible share" value={`${a.invisibleShare}%`} sub="planning, admin, emotional" />
                  <Stat label={a.burnout.title} value={a.burnout.level === 'high' ? 'Act now' : a.burnout.level === 'watch' ? 'Watch' : 'Fine'} tone={a.burnout.level === 'high' ? 'rose' : a.burnout.level === 'watch' ? 'warn' : 'good'} />
                </div>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">By category</h3><div className="mt-2"><Bars rows={a.byCategory.map((c) => ({ label: `${c.label}${c.invisible ? ' (invisible)' : ''}`, value: c.hours, display: `${c.hours} h · ${c.share}%`, color: c.invisible ? 'bg-purple-400' : 'bg-rose-400' }))} /></div></div>
                  <div><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Who carried it</h3><div className="mt-2"><Bars rows={a.byCarrier.map((c) => ({ label: c.label, value: c.hours, display: `${c.hours} h · ${c.share}%`, color: c.carrier === 'ME' ? 'bg-rose-400' : c.carrier === 'PARTNER' ? 'bg-sky-400' : 'bg-slate-400' }))} /></div>
                    {a.weekly.length > 1 && <div className="mt-4"><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Your hours by week</h3><div className="mt-2"><LineChart money={false} height={120} labels={a.weekly.map((w) => fmtDay(w.weekStart, { day: 'numeric', month: 'short' }))} series={[{ label: 'Yours', color: '#f43f5e', values: a.weekly.map((w) => w.myHours) }, { label: 'Everyone', color: '#94a3b8', values: a.weekly.map((w) => w.totalHours) }]} /></div></div>}
                  </div>
                </div>
                <Notes items={a.notes} />
              </Panel>

              <Panel title={a.burnout.title} intro={a.burnout.advice}>
                {a.burnout.reasons.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">{a.burnout.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                {a.burnout.reasons.length === 0 && <p className="text-sm text-slate-500">Nothing in the numbers is flagging. Keep logging; the check-ins feed this too.</p>}
              </Panel>

              {a.delegation.length > 0 && (
                <Panel title="Handing it over" intro="The heaviest categories that are yours, with a script each. Ask for the whole thing, not help with it.">
                  <div className="grid gap-4 md:grid-cols-3">
                    {a.delegation.map((d) => (
                      <div key={d.category} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                        <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-white">{d.label}</h3><Chip tone="rose">{d.hours} h yours</Chip></div>
                        <p className="mt-2 text-sm italic leading-6 text-slate-700 dark:text-slate-300">“{d.ask}”</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-400">{d.handover.map((h) => <li key={h}>{h}</li>)}</ul>
                        <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">The boundary: “{d.boundary}”</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {a.conversationCard && (
                <Panel title="The conversation card" intro="The window in a paragraph, for the person you share a home with." aside={<button type="button" onClick={copyCard} className="btn-secondary inline-flex items-center gap-2 text-sm"><Copy className="h-4 w-4" /> Copy</button>}>
                  <blockquote className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200">{a.conversationCard}</blockquote>
                </Panel>
              )}

              <Panel title="What you logged">
                <ul className="space-y-1.5">
                  {data.data.entries.slice(0, 60).map((e) => <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><span className="min-w-0 truncate text-slate-800 dark:text-slate-200"><span className="mr-2 text-xs text-slate-500">{fmtDay(e.day, { day: 'numeric', month: 'short' })}</span>{e.task} <span className={cn('ml-1 text-xs', e.carriedBy === 'ME' ? 'text-rose-600' : 'text-slate-500')}>· {e.minutes} min · {CARRIERS.find((c) => c.value === e.carriedBy)?.label.toLowerCase()}</span></span><button type="button" onClick={() => remove(e.id)} className="text-slate-400 hover:text-rose-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></li>)}
                </ul>
              </Panel>
            </>
          )}
        </>
      )}
      <HealthDisclaimer />
    </div>
  );
}
