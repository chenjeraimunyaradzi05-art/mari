'use client';

/**
 * Habits, challenges and goals. A habit is a streak and a week against
 * its target, with the research behind it one tap away. A challenge is a
 * habit done together with a leaderboard. A goal reads its progress from
 * the trackers, and comes up for review every few weeks.
 */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Check as CheckIcon, Flame, Leaf, Plus, Target, Trash2, Trophy, Users } from 'lucide-react';
import { localDay, wellnessApi, wellnessError, type Author } from '@/lib/wellness-api';
import { Chip, DayDots, Empty, ErrorBox, HealthDisclaimer, Loading, PageTitle, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Field, JumpLinks, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Habit = { id: string; name: string; templateKey: string | null; difficulty: string; targetPerWeek: number; cue: string | null; reminderTime: string | null; evidenceNote: string | null; evidenceUrl: string | null; streak: { current: number; longest: number; doneToday: boolean; totalDone: number }; week: { done: number; target: number; pct: number; met: boolean; days: Array<{ day: string; done: boolean; future: boolean }> } };
type Template = { key: string; name: string; category: string; difficulty: string; targetPerWeek: number; cue: string; evidenceNote: string; evidenceUrl: string };
type Habits = { habits: Habit[]; archived: number; templates: Template[] };
type Challenge = { id: string; name: string; description: string; template: Template | null; startsOn: string; endsOn: string; isPublic: boolean; createdBy: Author; memberCount: number; joined: boolean; phase: string; daysLeft: number; leaderboard?: Array<{ userId: string; name: string; done: number; possible: number; pct: number; streak: number; isYou: boolean; rank: number }> };
type Goal = { id: string; metric: string; target: number; period: string; label: string | null; startedOn: string; reviewEveryWeeks: number; nextReviewOn: string; status: string; reviewDue: boolean; progress: { label: string; unit: string; current: number | null; target: number; pct: number; met: boolean; history: Array<{ weekStart: string; value: number | null; met: boolean }>; weeksMet: number; currentStreakWeeks: number; bestStreakWeeks: number; hint: string } };
const METRICS = [{ value: 'SLEEP_HOURS', label: 'Sleep, hours a night', target: 7.5 }, { value: 'ACTIVITY_SESSIONS', label: 'Movement, sessions a week', target: 3 }, { value: 'ACTIVITY_MINUTES', label: 'Movement, minutes a week', target: 150 }, { value: 'CHECKIN_DAYS', label: 'Check-ins, days a week', target: 5 }, { value: 'HYDRATION_GLASSES', label: 'Water, glasses a day', target: 8 }, { value: 'MEDITATION_DAYS', label: 'Mindfulness, days a week', target: 4 }, { value: 'STEPS', label: 'Steps a day', target: 8000 }];

function HabitsInner() {
  const search = useSearchParams();
  const habits = useLoad<Habits>(() => wellnessApi.habits());
  const challenges = useLoad<{ challenges: Challenge[] }>(() => wellnessApi.challenges());
  const goals = useLoad<{ goals: Goal[] }>(() => wellnessApi.goals());
  const [picking, setPicking] = useState(Boolean(search.get('template')));
  const [custom, setCustom] = useState({ name: '', difficulty: 'MEDIUM', targetPerWeek: '7', cue: '', reminderTime: '' });
  const [newChallenge, setNewChallenge] = useState({ name: '', description: '', habitTemplateKey: '', startsOn: localDay(), endsOn: '', open: false });
  const [newGoal, setNewGoal] = useState({ metric: 'SLEEP_HOURS', target: '7.5', label: '' });
  const [openChallenge, setOpenChallenge] = useState<Challenge | null>(null);
  const [review, setReview] = useState<{ goal: Goal; suggestion: { verdict: string; text: string; suggestedTarget: number } } | null>(null);
  const preset = search.get('template');

  const act = async (fn: () => Promise<unknown>, done?: string, reload: Array<{ reload: () => void }> = [habits]) => { try { const r = await fn(); if (done) toast.success(done); reload.forEach((x) => x.reload()); return r; } catch (err) { toast.error(wellnessError(err, 'That did not work.')); return null; } };
  const addTemplate = (key: string) => act(() => wellnessApi.addHabit({ templateKey: key }), 'Added').then(() => setPicking(false));
  const addCustom = () => act(() => wellnessApi.addHabit({ name: custom.name, difficulty: custom.difficulty, targetPerWeek: num(custom.targetPerWeek, 7), cue: custom.cue || null, reminderTime: custom.reminderTime || null }), 'Added').then(() => { setCustom({ name: '', difficulty: 'MEDIUM', targetPerWeek: '7', cue: '', reminderTime: '' }); setPicking(false); });
  const tick = async (h: Habit, day?: string) => { const res = await wellnessApi.logHabit(h.id, day ? { day, done: !h.week.days.find((d) => d.day === day)?.done } : {}).catch((err) => { toast.error(wellnessError(err, 'That could not be logged.')); return null; }); if (res?.data?.data?.milestone) toast.success(res.data.data.celebration, { duration: 5000 }); habits.reload(); };
  const archive = (h: Habit) => act(() => wellnessApi.updateHabit(h.id, { isArchived: true }), 'Archived');
  const createChallenge = () => act(() => wellnessApi.createChallenge({ name: newChallenge.name, description: newChallenge.description, habitTemplateKey: newChallenge.habitTemplateKey || null, startsOn: newChallenge.startsOn, endsOn: newChallenge.endsOn }), 'Challenge started', [challenges, habits]).then(() => setNewChallenge({ name: '', description: '', habitTemplateKey: '', startsOn: localDay(), endsOn: '', open: false }));
  const openBoard = async (c: Challenge) => { try { const res = await wellnessApi.challenge(c.id); setOpenChallenge(res.data?.data ?? null); } catch (err) { toast.error(wellnessError(err, 'That could not be opened.')); } };
  const addGoal = () => act(() => wellnessApi.addGoal({ metric: newGoal.metric, target: num(newGoal.target), label: newGoal.label || null }), 'Goal set', [goals]);
  const openReview = async (g: Goal) => { try { const res = await wellnessApi.reviewGoal(g.id, { decision: 'suggest' }); setReview({ goal: g, suggestion: res.data?.data?.suggestion }); } catch (err) { toast.error(wellnessError(err, 'That could not be reviewed.')); } };
  const decide = (decision: string, target?: number) => review && act(() => wellnessApi.reviewGoal(review.goal.id, { decision, target }), 'Reviewed', [goals]).then(() => setReview(null));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Leaf} kicker="Wellness" title="Habits and goals" blurb="Small things, kept. A streak for each habit, a challenge to do one with others, and goals that read from what you actually logged." action={<button type="button" onClick={() => setPicking((v) => !v)} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> New habit</button>} />
      <WellnessNav current="/dashboard/wellness/habits" />
      <JumpLinks items={[{ id: 'habits', label: 'Habits' }, { id: 'challenges', label: 'Challenges' }, { id: 'goals', label: 'Goals' }]} />

      {picking && (
        <Panel title="Pick a habit" intro="Each template links to the research behind it. Or write your own.">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(habits.data?.templates ?? []).map((t) => <li key={t.key} className={cn('rounded-xl border p-3', preset === t.key ? 'border-rose-300 bg-rose-50/50 dark:border-rose-800' : 'border-slate-200 dark:border-slate-800')}><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.name}</p><p className="text-xs text-slate-500">{t.targetPerWeek}× a week · {t.difficulty.toLowerCase()} · {t.cue}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t.evidenceNote}</p><div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => addTemplate(t.key)} className="btn-secondary text-xs">Add</button><a href={t.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-500 underline-offset-2 hover:underline">The evidence</a></div></li>)}
          </ul>
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] sm:items-end">
            <Field label="Your own"><input value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} maxLength={80} className={inputClass} placeholder="Piano for ten minutes" /></Field>
            <Field label="Difficulty"><SelectInput value={custom.difficulty} onChange={(v) => setCustom((c) => ({ ...c, difficulty: v }))} options={[{ value: 'EASY', label: 'Easy' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HARD', label: 'Hard' }]} /></Field>
            <Field label="Days a week"><NumberInput value={custom.targetPerWeek} onChange={(v) => setCustom((c) => ({ ...c, targetPerWeek: v }))} min={1} max={7} /></Field>
            <Field label="Cue"><input value={custom.cue} onChange={(e) => setCustom((c) => ({ ...c, cue: e.target.value }))} maxLength={160} className={inputClass} placeholder="After dinner" /></Field>
            <Field label="Remind at"><input type="time" value={custom.reminderTime} onChange={(e) => setCustom((c) => ({ ...c, reminderTime: e.target.value }))} className={inputClass} /></Field>
            <button type="button" onClick={addCustom} disabled={custom.name.trim().length < 2} className="btn-primary mb-1 text-sm disabled:opacity-50">Add</button>
          </div>
        </Panel>
      )}

      <section id="habits" className="scroll-mt-24 space-y-3">
        {habits.loading && <Loading />}
        <ErrorBox error={habits.error} />
        {habits.data && habits.data.habits.length === 0 && !picking && <Empty title="No habits yet" body="Pick one from the templates. Three days is the hardest part; the streak does the rest." action={<button type="button" onClick={() => setPicking(true)} className="btn-primary text-sm">Pick a habit</button>} />}
        {(habits.data?.habits ?? []).map((h) => (
          <div key={h.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900 dark:text-white">{h.name}</h3><Chip>{h.difficulty.toLowerCase()}</Chip>{h.week.met && <Chip tone="emerald">Week done</Chip>}</div>
                <p className="mt-0.5 text-xs text-slate-500">{h.cue ? `${h.cue} · ` : ''}{h.targetPerWeek}× a week{h.reminderTime ? ` · reminder ${h.reminderTime}` : ''} · {h.streak.totalDone} in all</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', h.streak.current > 0 ? 'text-orange-600' : 'text-slate-400')}><Flame className="h-4 w-4" /> {h.streak.current} day{h.streak.current === 1 ? '' : 's'}<span className="ml-1 text-xs font-normal text-slate-500">best {h.streak.longest}</span></span>
                <button type="button" onClick={() => !h.streak.doneToday && tick(h)} disabled={h.streak.doneToday} className={cn('flex h-10 w-10 items-center justify-center rounded-full transition', h.streak.doneToday ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 dark:bg-slate-800')} aria-label={`Mark ${h.name} done today`}><CheckIcon className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><DayDots days={h.week.days} onToggle={(day) => tick(h, day)} /><div className="flex items-center gap-3 text-xs text-slate-500">{h.evidenceUrl && <a href={h.evidenceUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline" title={h.evidenceNote ?? ''}>Why this works</a>}<button type="button" onClick={() => archive(h)} className="inline-flex items-center gap-1 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Archive</button></div></div>
          </div>
        ))}
      </section>

      <section id="challenges" className="scroll-mt-24">
        <Panel icon={Users} title="Challenges" intro="A habit done together, for a week to three months, with a leaderboard. Optional, and friendly." aside={<button type="button" onClick={() => setNewChallenge((c) => ({ ...c, open: !c.open }))} className="btn-secondary text-sm">Start one</button>}>
          {newChallenge.open && (
            <div className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 sm:grid-cols-2">
              <Field label="Name"><input value={newChallenge.name} onChange={(e) => setNewChallenge((c) => ({ ...c, name: e.target.value }))} maxLength={80} className={inputClass} placeholder="October, outside every day" /></Field>
              <Field label="The habit"><SelectInput value={newChallenge.habitTemplateKey} onChange={(v) => setNewChallenge((c) => ({ ...c, habitTemplateKey: v }))} options={[{ value: '', label: 'Any habit of their own' }, ...(habits.data?.templates ?? []).map((t) => ({ value: t.key, label: t.name }))]} /></Field>
              <Field label="What it is" className="sm:col-span-2"><input value={newChallenge.description} onChange={(e) => setNewChallenge((c) => ({ ...c, description: e.target.value }))} maxLength={1000} className={inputClass} /></Field>
              <Field label="Starts"><input type="date" value={newChallenge.startsOn} onChange={(e) => setNewChallenge((c) => ({ ...c, startsOn: e.target.value }))} className={inputClass} /></Field>
              <Field label="Ends"><input type="date" value={newChallenge.endsOn} onChange={(e) => setNewChallenge((c) => ({ ...c, endsOn: e.target.value }))} className={inputClass} /></Field>
              <div className="sm:col-span-2"><button type="button" onClick={createChallenge} disabled={newChallenge.name.trim().length < 3 || newChallenge.description.trim().length < 10 || !newChallenge.endsOn} className="btn-primary text-sm disabled:opacity-50">Start the challenge</button></div>
            </div>
          )}
          {challenges.loading && <Loading />}
          <ul className="grid gap-3 md:grid-cols-2">
            {(challenges.data?.challenges ?? []).map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2"><Chip tone={c.phase === 'running' ? 'emerald' : c.phase === 'upcoming' ? 'sky' : 'slate'}>{c.phase === 'running' ? `${c.daysLeft} days left` : c.phase === 'upcoming' ? `Starts ${fmtDay(c.startsOn)}` : 'Finished'}</Chip>{c.joined && <Chip tone="amber">You are in</Chip>}</div>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">{c.name}</p>
                <p className="text-xs text-slate-500">{c.template ? `${c.template.name} · ` : ''}{c.memberCount} member{c.memberCount === 1 ? '' : 's'} · by {c.createdBy.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{c.description}</p>
                <div className="mt-2 flex gap-2">{!c.joined && c.phase !== 'finished' && <button type="button" onClick={() => act(() => wellnessApi.joinChallenge(c.id), 'You are in', [challenges, habits])} className="btn-primary text-xs">Join</button>}<button type="button" onClick={() => openBoard(c)} className="btn-ghost inline-flex items-center gap-1 text-xs"><Trophy className="h-3.5 w-3.5" /> Leaderboard</button></div>
              </li>
            ))}
            {challenges.data && challenges.data.challenges.length === 0 && <li className="text-sm text-slate-500">None running. Start one and invite the circle.</li>}
          </ul>
          {openChallenge && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{openChallenge.name}</p><button type="button" onClick={() => setOpenChallenge(null)} className="text-xs text-slate-500 underline">Close</button></div>
              <ol className="mt-2 space-y-1 text-sm">{(openChallenge.leaderboard ?? []).map((m) => <li key={m.userId} className={cn('flex items-center justify-between rounded-md px-2 py-1', m.isYou && 'bg-rose-50 dark:bg-rose-900/20')}><span><span className="mr-2 text-xs text-slate-400">{m.rank}</span>{m.name}{m.isYou ? ' (you)' : ''}</span><span className="text-xs text-slate-500">{m.done} of {m.possible} days · {m.streak} streak</span></li>)}</ol>
            </div>
          )}
        </Panel>
      </section>

      <section id="goals" className="scroll-mt-24">
        <Panel icon={Target} title="Goals" intro="Read from the trackers, never typed in. Every few weeks it comes up for review: keep it, raise it, or ease it.">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
            <Field label="Goal"><SelectInput value={newGoal.metric} onChange={(v) => setNewGoal((g) => ({ ...g, metric: v, target: String(METRICS.find((m) => m.value === v)?.target ?? '') }))} options={METRICS.map((m) => ({ value: m.value, label: m.label }))} /></Field>
            <Field label="Target"><NumberInput value={newGoal.target} onChange={(v) => setNewGoal((g) => ({ ...g, target: v }))} min={0.5} step={0.5} /></Field>
            <Field label="Call it"><input value={newGoal.label} onChange={(e) => setNewGoal((g) => ({ ...g, label: e.target.value }))} maxLength={80} className={inputClass} placeholder="Optional" /></Field>
            <button type="button" onClick={addGoal} disabled={!num(newGoal.target)} className="btn-primary mb-1 text-sm disabled:opacity-50">Set goal</button>
          </div>
          {goals.loading && <Loading />}
          <ul className="mt-4 space-y-3">
            {(goals.data?.goals ?? []).map((g) => (
              <li key={g.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-semibold text-slate-900 dark:text-white">{g.label || g.progress.label} <span className="text-sm font-normal text-slate-500">· {g.target} {g.progress.unit}</span></p><p className="text-xs text-slate-500">{g.progress.hint} Met {g.progress.weeksMet} week{g.progress.weeksMet === 1 ? '' : 's'}, {g.progress.currentStreakWeeks} running, best {g.progress.bestStreakWeeks}.{g.status !== 'ACTIVE' ? ` ${g.status.toLowerCase()}.` : ''}</p></div>
                  <div className="flex items-center gap-2">{g.reviewDue && g.status === 'ACTIVE' && <button type="button" onClick={() => openReview(g)} className="btn-primary text-xs">Review now</button>}{!g.reviewDue && g.status === 'ACTIVE' && <button type="button" onClick={() => openReview(g)} className="btn-ghost text-xs">Review</button>}{g.status === 'ACTIVE' ? <button type="button" onClick={() => act(() => wellnessApi.updateGoal(g.id, { status: 'PAUSED' }), 'Paused', [goals])} className="btn-ghost text-xs">Pause</button> : <button type="button" onClick={() => act(() => wellnessApi.updateGoal(g.id, { status: 'ACTIVE' }), 'Resumed', [goals])} className="btn-ghost text-xs">Resume</button>}<button type="button" onClick={() => act(() => wellnessApi.deleteGoal(g.id), 'Removed', [goals])} className="text-slate-400 hover:text-rose-500" aria-label="Remove goal"><Trash2 className="h-4 w-4" /></button></div>
                </div>
                <div className="mt-2 flex items-center gap-3"><div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800"><div className={cn('h-2 rounded-full', g.progress.met ? 'bg-emerald-500' : 'bg-rose-400')} style={{ width: `${g.progress.pct}%` }} /></div><span className={cn('text-xs font-semibold', g.progress.met ? 'text-emerald-600' : 'text-slate-600')}>{g.progress.current ?? '–'} / {g.target}</span></div>
                <div className="mt-2 flex gap-1">{g.progress.history.map((h) => <span key={h.weekStart} title={`${fmtDay(h.weekStart)}: ${h.value ?? 'nothing logged'}`} className={cn('h-2 flex-1 rounded-full', h.met ? 'bg-emerald-400' : h.value === null ? 'bg-slate-100 dark:bg-slate-800' : 'bg-rose-200 dark:bg-rose-900/40')} />)}<span className="h-2 flex-1 rounded-full bg-slate-300 dark:bg-slate-600" title="this week" /></div>
                {review?.goal.id === g.id && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                    <p className="text-slate-800 dark:text-slate-200">{review.suggestion.text}</p>
                    <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => decide('keep')} className="btn-secondary text-xs">Keep {g.target}</button>{review.suggestion.verdict === 'raise' && <button type="button" onClick={() => decide('raise', review.suggestion.suggestedTarget)} className="btn-primary text-xs">Raise to {review.suggestion.suggestedTarget}</button>}{review.suggestion.verdict === 'ease' && <button type="button" onClick={() => decide('ease', review.suggestion.suggestedTarget)} className="btn-primary text-xs">Ease to {review.suggestion.suggestedTarget}</button>}<button type="button" onClick={() => decide('achieved')} className="btn-ghost text-xs">Done with it</button><button type="button" onClick={() => setReview(null)} className="btn-ghost text-xs">Later</button></div>
                  </div>
                )}
              </li>
            ))}
            {goals.data && goals.data.goals.length === 0 && <li className="text-sm text-slate-500">No goals yet. Sleep is the one to start with.</li>}
          </ul>
        </Panel>
      </section>
      <HealthDisclaimer />
    </div>
  );
}

export default function HabitsPage() {
  return <Suspense fallback={<div className="p-6"><Loading /></div>}><HabitsInner /></Suspense>;
}
