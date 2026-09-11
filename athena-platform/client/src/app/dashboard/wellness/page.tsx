'use client';

/**
 * Today. The quick check-in if it is not done, where she is in her cycle,
 * the habits due, the doses due, the goals, the next appointment, the
 * circles meeting this week, and the one thing the insights want her to
 * know. Everything else is a tap away.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { CalendarHeart, Check, Droplets, HeartPulse, Leaf, Pill, Stethoscope, Target, Users } from 'lucide-react';
import { wellnessApi, wellnessError, type Insight } from '@/lib/wellness-api';
import { CrisisStrip, DayDots, ErrorBox, HealthDisclaimer, InsightCard, Loading, PageTitle, Scale, WellnessNav, fmtDay, fmtWhen, useLoad } from '@/components/wellness/WellnessUi';
import { Panel, Stat } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Today = {
  today: string; settings: { trackers: Record<string, boolean> };
  todays: { CHECKIN: { payload: { mood: number; stress: number; anxiety: number; energy: number } } | null; SLEEP: { payload: { hours: number } } | null; HYDRATION: { payload: { glasses: number } } | null; PERIOD: { payload: { flow: string } } | null };
  activityToday: Array<{ payload: { type: string; minutes: number } }>;
  checkinStreak: { current: number; longest: number };
  cycle: { phase: string; dayOfCycle: number | null; nextPeriod: string | null; daysUntilNextPeriod: number | null; fertileWindow: { start: string; end: string } | null; confidence: string; hasData: boolean };
  habits: Array<{ id: string; name: string; streak: { current: number; doneToday: boolean }; week: { done: number; target: number; days: Array<{ day: string; done: boolean; future: boolean }> } }>;
  medications: Array<{ id: string; name?: string; dose?: string; times: Array<{ time: string; status: string | null }> }>;
  goals: Array<{ id: string; label: string | null; metric: string; unit: string; current: number | null; target: number; pct: number; met: boolean }>;
  nextBooking: { id: string; scheduledAt: string; mode: string; status: string; practitioner: { slug: string; name: string; kind: string } } | null;
  circles: Array<{ id: string; name: string; week: number | null; checkedIn: boolean; meetingDay: number; meetingTime: string }>;
  headline: Insight | null;
  coverage: { checkinDays: number };
};

const PHASE: Record<string, { label: string; tone: string }> = { menstrual: { label: 'Your period', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' }, follicular: { label: 'Follicular phase', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' }, fertile: { label: 'Fertile window', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }, luteal: { label: 'Luteal phase', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }, unknown: { label: 'No cycle logged yet', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' } };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function WellnessHome() {
  const today = useLoad<Today>(() => wellnessApi.today());
  const [checkin, setCheckin] = useState<{ mood: number | null; stress: number | null; anxiety: number | null; energy: number | null }>({ mood: null, stress: null, anxiety: null, energy: null });
  const [busy, setBusy] = useState(false);
  const d = today.data;

  const saveCheckin = async () => {
    if (!checkin.mood || !checkin.stress || !checkin.anxiety || !checkin.energy) return;
    setBusy(true);
    try {
      const res = await wellnessApi.addEntry({ kind: 'CHECKIN', payload: checkin });
      const streak = res.data?.data?.streak?.current;
      toast.success(streak > 1 ? `Checked in. ${streak} days in a row.` : 'Checked in.');
      today.reload();
    } catch (err) { toast.error(wellnessError(err, 'That could not be saved.')); } finally { setBusy(false); }
  };

  const tickHabit = async (id: string, day?: string) => {
    try {
      const res = await wellnessApi.logHabit(id, day ? { day } : {});
      if (res.data?.data?.milestone) toast.success(res.data.data.celebration);
      today.reload();
    } catch (err) { toast.error(wellnessError(err, 'That could not be logged.')); }
  };

  const logDose = async (id: string, time: string, status: 'taken' | 'skipped') => {
    try { await wellnessApi.logDose(id, { time, status }); today.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be logged.')); }
  };

  const addWater = async () => {
    try { await wellnessApi.addEntry({ kind: 'HYDRATION', payload: { glasses: 1 }, add: true }); today.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be logged.')); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={HeartPulse} kicker="Wellness" title="Today" blurb="A minute for yourself, and the rest of the picture. Everything here is encrypted and read only by you." action={<Link href="/dashboard/wellness/insights" className="btn-secondary text-sm">What the days are saying</Link>} />
      <WellnessNav current="/dashboard/wellness" />
      {today.loading && <Loading />}
      <ErrorBox error={today.error} />
      {d && (
        <>
          {d.headline?.crisis && <CrisisStrip />}
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <Panel icon={HeartPulse} title={d.todays.CHECKIN ? 'Checked in today' : 'How are you, right now?'} intro={d.todays.CHECKIN ? `Mood ${d.todays.CHECKIN.payload.mood}, stress ${d.todays.CHECKIN.payload.stress}, anxiety ${d.todays.CHECKIN.payload.anxiety}, energy ${d.todays.CHECKIN.payload.energy}. ${d.checkinStreak.current > 1 ? `${d.checkinStreak.current} days in a row.` : ''}` : 'Four taps. The patterns page needs a week of these to start saying anything.'} aside={d.todays.CHECKIN ? <Link href="/dashboard/wellness/track" className="text-sm font-medium text-rose-600 dark:text-rose-400">Change it</Link> : undefined}>
              {!d.todays.CHECKIN && d.settings.trackers.checkin !== false && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Scale label="Mood" words="mood" value={checkin.mood} onChange={(v) => setCheckin((c) => ({ ...c, mood: v }))} />
                    <Scale label="Stress" words="stress" value={checkin.stress} onChange={(v) => setCheckin((c) => ({ ...c, stress: v }))} />
                    <Scale label="Anxiety" words="anxiety" value={checkin.anxiety} onChange={(v) => setCheckin((c) => ({ ...c, anxiety: v }))} />
                    <Scale label="Energy" words="energy" value={checkin.energy} onChange={(v) => setCheckin((c) => ({ ...c, energy: v }))} />
                  </div>
                  <button type="button" onClick={saveCheckin} disabled={busy || !checkin.mood || !checkin.stress || !checkin.anxiety || !checkin.energy} className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"><Check className="h-4 w-4" /> Save today</button>
                </div>
              )}
              {d.todays.CHECKIN && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Sleep last night" value={d.todays.SLEEP ? `${d.todays.SLEEP.payload.hours} h` : '–'} sub={d.todays.SLEEP ? undefined : 'not logged'} />
                  <Stat label="Water" value={`${d.todays.HYDRATION?.payload.glasses ?? 0} glasses`} />
                  <Stat label="Movement" value={`${d.activityToday.reduce((a, b) => a + b.payload.minutes, 0)} min`} />
                  <Stat label="Check-in streak" value={`${d.checkinStreak.current} days`} sub={`best ${d.checkinStreak.longest}`} tone="good" />
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {d.settings.trackers.hydration !== false && <button type="button" onClick={addWater} className="btn-ghost inline-flex items-center gap-1.5 text-sm"><Droplets className="h-4 w-4 text-sky-500" /> A glass of water</button>}
                <Link href="/dashboard/wellness/track#sleep" className="btn-ghost text-sm">Log sleep</Link>
                <Link href="/dashboard/wellness/track#movement" className="btn-ghost text-sm">Log movement</Link>
                <Link href="/dashboard/wellness/track#cycle" className="btn-ghost text-sm">Log a period day</Link>
              </div>
            </Panel>

            <Panel icon={CalendarHeart} title="Your cycle" intro={d.cycle.hasData ? `Day ${d.cycle.dayOfCycle}. ${d.cycle.confidence === 'low' ? 'Prediction from one cycle; it sharpens with each one logged.' : ''}` : 'Log the first day of a period and the prediction starts.'}>
              <span className={cn('inline-flex rounded-full px-3 py-1 text-sm font-semibold', PHASE[d.cycle.phase]?.tone)}>{PHASE[d.cycle.phase]?.label}</span>
              {d.cycle.hasData && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Stat label="Next period" value={d.cycle.daysUntilNextPeriod !== null && d.cycle.daysUntilNextPeriod >= 0 ? `in ${d.cycle.daysUntilNextPeriod} days` : `${Math.abs(d.cycle.daysUntilNextPeriod ?? 0)} days late`} sub={fmtDay(d.cycle.nextPeriod)} />
                  <Stat label="Fertile window" value={d.cycle.fertileWindow ? `${fmtDay(d.cycle.fertileWindow.start, { day: 'numeric', month: 'short' })} to ${fmtDay(d.cycle.fertileWindow.end, { day: 'numeric', month: 'short' })}` : '–'} sub="an estimate, not contraception" />
                </div>
              )}
              <div className="mt-3"><Link href="/dashboard/wellness/track#cycle" className="text-sm font-medium text-rose-600 dark:text-rose-400">The cycle page</Link></div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel icon={Leaf} title="Habits" intro={d.habits.length ? 'Tick what is done.' : 'Nothing yet.'} aside={<Link href="/dashboard/wellness/habits" className="text-sm font-medium text-rose-600 dark:text-rose-400">All habits</Link>}>
              <ul className="space-y-3">
                {d.habits.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{h.name}</p>
                      <p className="text-xs text-slate-500">{h.streak.current} day streak · {h.week.done}/{h.week.target} this week</p>
                    </div>
                    <button type="button" onClick={() => !h.streak.doneToday && tickHabit(h.id)} disabled={h.streak.doneToday} aria-label={`Mark ${h.name} done`} className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition', h.streak.doneToday ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 dark:bg-slate-800')}><Check className="h-4 w-4" /></button>
                  </li>
                ))}
                {d.habits.length === 0 && <li><Link href="/dashboard/wellness/habits" className="text-sm text-rose-600 dark:text-rose-400">Pick one from the templates</Link></li>}
              </ul>
              {d.habits[0] && <div className="mt-3"><DayDots days={d.habits[0].week.days} onToggle={(day) => tickHabit(d.habits[0].id, day)} /></div>}
            </Panel>

            <Panel icon={Pill} title="Doses today" intro={d.medications.length ? 'Tap taken or skipped.' : 'No medications set up.'} aside={<Link href="/dashboard/wellness/medications" className="text-sm font-medium text-rose-600 dark:text-rose-400">Medications</Link>}>
              <ul className="space-y-2">
                {d.medications.flatMap((m) => m.times.map((t) => (
                  <li key={`${m.id}-${t.time}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{m.name}</p><p className="text-xs text-slate-500">{t.time}{m.dose ? ` · ${m.dose}` : ''}</p></div>
                    {t.status ? <span className={cn('text-xs font-semibold', t.status === 'taken' ? 'text-emerald-600' : 'text-amber-600')}>{t.status}</span> : (
                      <div className="flex gap-1"><button type="button" onClick={() => logDose(m.id, t.time, 'taken')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Taken</button><button type="button" onClick={() => logDose(m.id, t.time, 'skipped')} className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Skip</button></div>
                    )}
                  </li>
                )))}
              </ul>
            </Panel>

            <Panel icon={Target} title="Goals" intro={d.goals.length ? 'This week against the target.' : 'Set one and it reads from the trackers.'} aside={<Link href="/dashboard/wellness/habits#goals" className="text-sm font-medium text-rose-600 dark:text-rose-400">Goals</Link>}>
              <ul className="space-y-3">
                {d.goals.map((g) => (
                  <li key={g.id}>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-800 dark:text-slate-200">{g.label || g.metric.toLowerCase().replace(/_/g, ' ')}</span><span className={cn('text-xs font-semibold', g.met ? 'text-emerald-600' : 'text-slate-500')}>{g.current ?? '–'} / {g.target} {g.unit}</span></div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800"><div className={cn('h-2 rounded-full', g.met ? 'bg-emerald-500' : 'bg-rose-400')} style={{ width: `${g.pct}%` }} /></div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel icon={Stethoscope} title="Appointments" intro={d.nextBooking ? `${d.nextBooking.status === 'CONFIRMED' ? 'Confirmed' : 'Requested'}, ${d.nextBooking.mode === 'TELEHEALTH' ? 'telehealth' : 'in person'}.` : 'Nothing booked.'} aside={<Link href="/dashboard/wellness/bookings" className="text-sm font-medium text-rose-600 dark:text-rose-400">All appointments</Link>}>
              {d.nextBooking ? <p className="text-sm text-slate-800 dark:text-slate-200"><span className="font-semibold">{d.nextBooking.practitioner.name}</span>, {fmtWhen(d.nextBooking.scheduledAt)}</p> : <Link href="/dashboard/wellness/practitioners" className="text-sm text-rose-600 dark:text-rose-400">Find a GP, psychologist or specialist</Link>}
            </Panel>
            <Panel icon={Users} title="Circles" intro={d.circles.length ? 'This week.' : 'Small groups, one topic, weekly check-ins.'} aside={<Link href="/dashboard/wellness/circles" className="text-sm font-medium text-rose-600 dark:text-rose-400">Circles</Link>}>
              <ul className="space-y-2">
                {d.circles.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <Link href={`/dashboard/wellness/circles/${c.id}`} className="font-medium text-slate-800 hover:text-rose-600 dark:text-slate-200">{c.name}</Link>
                    <span className="text-xs text-slate-500">{DAYS[c.meetingDay]} {c.meetingTime} · {c.week ? `week ${c.week}` : 'not started'} · {c.checkedIn ? 'checked in' : 'check-in due'}</span>
                  </li>
                ))}
                {d.circles.length === 0 && <li><Link href="/dashboard/wellness/circles" className="text-sm text-rose-600 dark:text-rose-400">See what is open</Link></li>}
              </ul>
            </Panel>
          </div>

          {d.headline && <InsightCard insight={d.headline} />}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><HealthDisclaimer /><Link href="/dashboard/wellness/settings" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">What is collected, and how to delete it</Link></div>
        </>
      )}
    </div>
  );
}
