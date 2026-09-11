'use client';

/**
 * The trackers: the daily check-in, sleep, movement, water, food, the
 * cycle with its prediction, and a symptom. One day at a time, any day in
 * the last year, with the last fortnight in view. Each tracker can be
 * switched off in the privacy settings, and a tracker that is off is not
 * shown here.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Activity, CalendarHeart, ChevronLeft, ChevronRight, Droplets, HeartPulse, Moon, Trash2, Utensils, Thermometer } from 'lucide-react';
import { localDay, wellnessApi, wellnessError, type Entry } from '@/lib/wellness-api';
import { ErrorBox, HealthDisclaimer, Loading, PageTitle, Scale, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Field, JumpLinks, NumberInput, Panel, SelectInput, Stat, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Reference = { activityTypes: Array<{ key: string; label: string }>; periodSymptoms: string[] };
type Cycle = { hasData: boolean; phase: string; dayOfCycle: number | null; nextPeriod: string | null; daysUntilNextPeriod: number | null; daysOverdue: number; ovulation: string | null; fertileWindow: { start: string; end: string } | null; following: string[]; confidence: string; cycleLength: number; periodLength: number; flags: Array<{ key: string; title: string; body: string }>; stats: { cyclesCounted: number; averageCycle: number | null; variability: number | null; averagePeriod: number | null; cycleLengths: number[] }; periods: Array<{ start: string; end: string; length: number; heaviest: string | null; maxPain: number }>; notes: string[] };
type Settings = { trackers: Record<string, boolean>; cycleLengthHint: number | null };

const shift = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };

export default function TrackPage() {
  const [day, setDay] = useState(localDay());
  const ref = useLoad<Reference>(() => wellnessApi.reference());
  const settings = useLoad<Settings>(() => wellnessApi.settings());
  const cycle = useLoad<Cycle>(() => wellnessApi.cycle());
  const range = useLoad<{ entries: Entry[] }>(() => wellnessApi.entries({ from: shift(day, -13), to: day }), [day]);
  const entries = range.data?.entries ?? [];
  const forDay = (kind: string) => entries.filter((e) => e.kind === kind && e.day === day);
  const first = (kind: string) => forDay(kind)[0] ?? null;
  const trackers = settings.data?.trackers ?? {};
  const on = (k: string) => trackers[k] !== false;

  const [checkin, setCheckin] = useState<{ mood: number | null; stress: number | null; anxiety: number | null; energy: number | null; note: string }>({ mood: null, stress: null, anxiety: null, energy: null, note: '' });
  const [sleep, setSleep] = useState({ hours: '', quality: null as number | null, bedtime: '', wakeTime: '' });
  const [move, setMove] = useState({ type: 'walk', minutes: '', intensity: 'moderate', steps: '' });
  const [food, setFood] = useState({ meal: 'lunch', description: '', calories: '', vegServes: '' });
  const [period, setPeriod] = useState({ flow: 'medium', pain: 0 as number, symptoms: [] as string[] });
  const [symptom, setSymptom] = useState({ name: '', severity: null as number | null, note: '' });

  useEffect(() => {
    const c = first('CHECKIN')?.payload as { mood?: number; stress?: number; anxiety?: number; energy?: number; note?: string } | null;
    setCheckin({ mood: c?.mood ?? null, stress: c?.stress ?? null, anxiety: c?.anxiety ?? null, energy: c?.energy ?? null, note: c?.note ?? '' });
    const s = first('SLEEP')?.payload as { hours?: number; quality?: number; bedtime?: string; wakeTime?: string } | null;
    setSleep({ hours: s?.hours !== undefined ? String(s.hours) : '', quality: s?.quality ?? null, bedtime: s?.bedtime ?? '', wakeTime: s?.wakeTime ?? '' });
    const p = first('PERIOD')?.payload as { flow?: string; pain?: number; symptoms?: string[] } | null;
    setPeriod({ flow: p?.flow ?? 'medium', pain: p?.pain ?? 0, symptoms: p?.symptoms ?? [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.data, day]);

  const save = async (kind: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    try {
      await wellnessApi.addEntry({ kind, day, payload, ...extra });
      toast.success('Saved');
      range.reload();
      if (kind === 'PERIOD') cycle.reload();
    } catch (err) { toast.error(wellnessError(err, 'That could not be saved.')); }
  };
  const remove = async (id: string, kind?: string) => {
    try { await wellnessApi.deleteEntry(id); range.reload(); if (kind === 'PERIOD') cycle.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be removed.')); }
  };

  const dayStrip = Array.from({ length: 14 }, (_, i) => shift(day, i - 13));
  const glasses = Number((first('HYDRATION')?.payload as { glasses?: number } | null)?.glasses ?? 0);
  const c = cycle.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={HeartPulse} kicker="Wellness" title="Track" blurb="A day at a time. Log it when it happens, or fill a day in later. Everything is encrypted before it is stored." />
      <WellnessNav current="/dashboard/wellness/track" />
      <JumpLinks items={[{ id: 'checkin', label: 'Check-in' }, { id: 'sleep', label: 'Sleep' }, { id: 'movement', label: 'Movement' }, { id: 'water', label: 'Water and food' }, { id: 'cycle', label: 'Cycle' }, { id: 'symptoms', label: 'Symptoms' }]} />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <button type="button" onClick={() => setDay((d) => shift(d, -1))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
        <div className="flex flex-1 gap-1 overflow-x-auto">
          {dayStrip.map((d) => {
            const has = entries.some((e) => e.day === d);
            return <button key={d} type="button" onClick={() => setDay(d)} className={cn('shrink-0 rounded-lg px-2 py-1 text-xs font-medium', d === day ? 'bg-rose-500 text-white' : has ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{fmtDay(d, { weekday: 'short', day: 'numeric' })}</button>;
          })}
        </div>
        <button type="button" onClick={() => setDay((d) => (d < localDay() ? shift(d, 1) : d))} disabled={day >= localDay()} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800" aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
        <input type="date" value={day} max={localDay()} onChange={(e) => e.target.value && setDay(e.target.value)} className={cn(inputClass, 'w-auto')} aria-label="Pick a day" />
      </div>
      {range.loading && <Loading />}
      <ErrorBox error={range.error} />

      {on('checkin') && (
        <Panel id="checkin" icon={HeartPulse} title={`Check-in, ${fmtDay(day)}`} intro="How the day felt. One a day; saving again replaces it.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Scale label="Mood" words="mood" value={checkin.mood} onChange={(v) => setCheckin((x) => ({ ...x, mood: v }))} />
            <Scale label="Stress" words="stress" value={checkin.stress} onChange={(v) => setCheckin((x) => ({ ...x, stress: v }))} />
            <Scale label="Anxiety" words="anxiety" value={checkin.anxiety} onChange={(v) => setCheckin((x) => ({ ...x, anxiety: v }))} />
            <Scale label="Energy" words="energy" value={checkin.energy} onChange={(v) => setCheckin((x) => ({ ...x, energy: v }))} />
          </div>
          <div className="mt-4"><Field label="A line about the day" hint="Optional. Only you read it."><input value={checkin.note} onChange={(e) => setCheckin((x) => ({ ...x, note: e.target.value }))} maxLength={500} className={inputClass} placeholder="What was going on" /></Field></div>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={!checkin.mood || !checkin.stress || !checkin.anxiety || !checkin.energy} onClick={() => save('CHECKIN', { mood: checkin.mood, stress: checkin.stress, anxiety: checkin.anxiety, energy: checkin.energy, note: checkin.note || undefined })} className="btn-primary text-sm disabled:opacity-50">Save check-in</button>
            {first('CHECKIN') && <button type="button" onClick={() => remove(first('CHECKIN')!.id)} className="btn-ghost inline-flex items-center gap-1 text-sm text-slate-500"><Trash2 className="h-4 w-4" /> Remove</button>}
          </div>
        </Panel>
      )}

      {on('sleep') && (
        <Panel id="sleep" icon={Moon} title="Sleep" intro="The night that ended this morning.">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Hours"><NumberInput value={sleep.hours} onChange={(v) => setSleep((s) => ({ ...s, hours: v }))} step={0.25} min={0} max={24} placeholder="7.5" /></Field>
            <Field label="Bed"><input type="time" value={sleep.bedtime} onChange={(e) => setSleep((s) => ({ ...s, bedtime: e.target.value }))} className={inputClass} /></Field>
            <Field label="Up"><input type="time" value={sleep.wakeTime} onChange={(e) => setSleep((s) => ({ ...s, wakeTime: e.target.value }))} className={inputClass} /></Field>
            <div className="sm:col-span-4"><Scale label="Quality" words="quality" value={sleep.quality} onChange={(v) => setSleep((s) => ({ ...s, quality: v }))} /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={sleep.hours === ''} onClick={() => save('SLEEP', { hours: num(sleep.hours), quality: sleep.quality ?? undefined, bedtime: sleep.bedtime || undefined, wakeTime: sleep.wakeTime || undefined })} className="btn-primary text-sm disabled:opacity-50">Save sleep</button>
            {first('SLEEP') && <button type="button" onClick={() => remove(first('SLEEP')!.id)} className="btn-ghost inline-flex items-center gap-1 text-sm text-slate-500"><Trash2 className="h-4 w-4" /> Remove</button>}
          </div>
        </Panel>
      )}

      {on('activity') && (
        <Panel id="movement" icon={Activity} title="Movement" intro="Walks count. So does dancing in the kitchen. Yoga, meditation and breathwork count toward the mindfulness goal too.">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="What"><SelectInput value={move.type} onChange={(v) => setMove((m) => ({ ...m, type: v }))} options={(ref.data?.activityTypes ?? [{ key: 'walk', label: 'Walk' }]).map((t) => ({ value: t.key, label: t.label }))} /></Field>
            <Field label="Minutes"><NumberInput value={move.minutes} onChange={(v) => setMove((m) => ({ ...m, minutes: v }))} min={1} max={600} placeholder="30" /></Field>
            <Field label="How hard"><SelectInput value={move.intensity} onChange={(v) => setMove((m) => ({ ...m, intensity: v }))} options={[{ value: 'light', label: 'Light' }, { value: 'moderate', label: 'Moderate' }, { value: 'vigorous', label: 'Vigorous' }]} /></Field>
            <Field label="Steps" hint="If your phone counts them."><NumberInput value={move.steps} onChange={(v) => setMove((m) => ({ ...m, steps: v }))} min={0} placeholder="8000" /></Field>
          </div>
          <div className="mt-4"><button type="button" disabled={num(move.minutes) < 1} onClick={() => { save('ACTIVITY', { type: move.type, minutes: num(move.minutes), intensity: move.intensity, steps: move.steps ? num(move.steps) : undefined }); setMove((m) => ({ ...m, minutes: '', steps: '' })); }} className="btn-primary text-sm disabled:opacity-50">Add movement</button></div>
          {forDay('ACTIVITY').length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {forDay('ACTIVITY').map((e) => { const p = e.payload as { type: string; minutes: number; intensity?: string; steps?: number }; return <li key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><span className="text-slate-800 dark:text-slate-200">{p.type}, {p.minutes} min{p.intensity ? `, ${p.intensity}` : ''}{p.steps ? `, ${p.steps} steps` : ''}</span><button type="button" onClick={() => remove(e.id)} className="text-slate-400 hover:text-rose-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></li>; })}
            </ul>
          )}
        </Panel>
      )}

      {(on('hydration') || on('nutrition')) && (
        <Panel id="water" icon={Droplets} title="Water and food" intro={on('nutrition') ? 'Water by the glass. Food only if you want to; calories are optional and never required.' : 'Water by the glass.'}>
          {on('hydration') && (
            <div className="flex flex-wrap items-center gap-3">
              <Stat label="Glasses today" value={String(glasses)} sub="about 2 litres is the adequate intake" />
              <button type="button" onClick={() => save('HYDRATION', { glasses: 1 }, { add: true })} className="btn-primary text-sm">+ One glass</button>
              {glasses > 0 && <button type="button" onClick={() => save('HYDRATION', { glasses: Math.max(0, glasses - 1) })} className="btn-ghost text-sm">− One</button>}
            </div>
          )}
          {on('nutrition') && (
            <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Meal"><SelectInput value={food.meal} onChange={(v) => setFood((f) => ({ ...f, meal: v }))} options={['breakfast', 'lunch', 'dinner', 'snack'].map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))} /></Field>
                <Field label="What" className="sm:col-span-2"><input value={food.description} onChange={(e) => setFood((f) => ({ ...f, description: e.target.value }))} maxLength={200} className={inputClass} placeholder="Oats, a banana, coffee" /></Field>
                <Field label="Veg serves"><NumberInput value={food.vegServes} onChange={(v) => setFood((f) => ({ ...f, vegServes: v }))} min={0} max={20} step={0.5} /></Field>
              </div>
              <div className="mt-3 flex items-end gap-3"><Field label="Calories" hint="Optional."><NumberInput value={food.calories} onChange={(v) => setFood((f) => ({ ...f, calories: v }))} min={0} /></Field><button type="button" onClick={() => { save('NUTRITION', { meal: food.meal, description: food.description || undefined, calories: food.calories ? num(food.calories) : undefined, vegServes: food.vegServes ? num(food.vegServes) : undefined }); setFood((f) => ({ ...f, description: '', calories: '', vegServes: '' })); }} className="btn-primary mb-1 text-sm"><Utensils className="mr-1 inline h-4 w-4" />Add meal</button></div>
              {forDay('NUTRITION').length > 0 && <ul className="mt-3 space-y-1.5">{forDay('NUTRITION').map((e) => { const p = e.payload as { meal: string; description?: string; calories?: number; vegServes?: number }; return <li key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><span className="text-slate-800 dark:text-slate-200">{p.meal}{p.description ? `: ${p.description}` : ''}{p.vegServes ? ` · ${p.vegServes} veg` : ''}{p.calories ? ` · ${p.calories} kcal` : ''}</span><button type="button" onClick={() => remove(e.id)} className="text-slate-400 hover:text-rose-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></li>; })}</ul>}
            </div>
          )}
        </Panel>
      )}

      {on('cycle') && (
        <Panel id="cycle" icon={CalendarHeart} title="Cycle" intro={c?.hasData ? `Day ${c.dayOfCycle} of about ${c.cycleLength}. ${c.stats.cyclesCounted ? `Averaged from your last ${c.stats.cyclesCounted} cycle${c.stats.cyclesCounted === 1 ? '' : 's'}.` : 'Using the typical length from your settings until there is history.'}` : 'Log each day of a period and the prediction starts from the first one.'}>
          {c?.hasData && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Next period" value={c.daysOverdue > 0 ? `${c.daysOverdue} days late` : `in ${c.daysUntilNextPeriod} days`} sub={fmtDay(c.nextPeriod, { day: 'numeric', month: 'short' })} tone={c.daysOverdue > 7 ? 'warn' : 'plain'} />
              <Stat label="Fertile window" value={c.fertileWindow ? `${fmtDay(c.fertileWindow.start, { day: 'numeric', month: 'short' })} – ${fmtDay(c.fertileWindow.end, { day: 'numeric', month: 'short' })}` : '–'} sub={`ovulation about ${fmtDay(c.ovulation, { day: 'numeric', month: 'short' })}`} />
              <Stat label="Average cycle" value={c.stats.averageCycle ? `${c.stats.averageCycle} days` : `${c.cycleLength} days`} sub={c.stats.variability !== null ? `varies by ${c.stats.variability}` : 'assumed'} />
              <Stat label="Confidence" value={c.confidence} sub={c.following.length ? `then ${c.following.map((f) => fmtDay(f, { day: 'numeric', month: 'short' })).join(', ')}` : undefined} />
            </div>
          )}
          {c?.flags.map((f) => <div key={f.key} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-900/20"><p className="font-semibold text-slate-900 dark:text-white">{f.title}</p><p className="mt-0.5 text-slate-700 dark:text-slate-300">{f.body}</p></div>)}
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{first('PERIOD') ? `Period day, ${fmtDay(day)}` : `Log ${fmtDay(day)} as a period day`}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field label="Flow"><SelectInput value={period.flow} onChange={(v) => setPeriod((p) => ({ ...p, flow: v }))} options={['spotting', 'light', 'medium', 'heavy'].map((f) => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))} /></Field>
              <Scale label="Pain" words="pain" min={0} value={period.pain} onChange={(v) => setPeriod((p) => ({ ...p, pain: v }))} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(ref.data?.periodSymptoms ?? []).map((s) => <button key={s} type="button" onClick={() => setPeriod((p) => ({ ...p, symptoms: p.symptoms.includes(s) ? p.symptoms.filter((x) => x !== s) : [...p.symptoms, s] }))} className={cn('rounded-full px-3 py-1 text-xs font-medium', period.symptoms.includes(s) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{s}</button>)}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => save('PERIOD', { flow: period.flow, pain: period.pain, symptoms: period.symptoms })} className="btn-primary text-sm">{first('PERIOD') ? 'Update the day' : 'Log period day'}</button>
              {first('PERIOD') && <button type="button" onClick={() => remove(first('PERIOD')!.id, 'PERIOD')} className="btn-ghost inline-flex items-center gap-1 text-sm text-slate-500"><Trash2 className="h-4 w-4" /> Not a period day</button>}
            </div>
          </div>
          {c && c.periods.length > 0 && <p className="mt-4 text-xs text-slate-500">Last periods: {c.periods.slice(-4).map((p) => `${fmtDay(p.start, { day: 'numeric', month: 'short' })} (${p.length} d${p.heaviest ? `, ${p.heaviest}` : ''})`).join(' · ')}</p>}
          {c && <p className="mt-2 text-xs text-slate-500">{c.notes.join(' ')}</p>}
        </Panel>
      )}

      <Panel id="symptoms" icon={Thermometer} title="A symptom" intro="Anything you want on the record for the doctor: a headache, pelvic pain, a rash, palpitations.">
        <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
          <Field label="What"><input value={symptom.name} onChange={(e) => setSymptom((s) => ({ ...s, name: e.target.value }))} maxLength={60} className={inputClass} placeholder="Migraine" /></Field>
          <Scale label="How bad" words="severity" value={symptom.severity} onChange={(v) => setSymptom((s) => ({ ...s, severity: v }))} />
          <div className="flex items-end"><button type="button" disabled={!symptom.name.trim() || !symptom.severity} onClick={() => { save('SYMPTOM', { name: symptom.name.trim(), severity: symptom.severity, note: symptom.note || undefined }); setSymptom({ name: '', severity: null, note: '' }); }} className="btn-primary w-full text-sm disabled:opacity-50">Add</button></div>
        </div>
        {forDay('SYMPTOM').length > 0 && <ul className="mt-3 space-y-1.5">{forDay('SYMPTOM').map((e) => { const p = e.payload as { name: string; severity: number }; return <li key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><span className="text-slate-800 dark:text-slate-200">{p.name}, {p.severity}/5</span><button type="button" onClick={() => remove(e.id)} className="text-slate-400 hover:text-rose-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></li>; })}</ul>}
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><HealthDisclaimer /><Link href="/dashboard/wellness/insights" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">What the days are saying</Link></div>
    </div>
  );
}
