/**
 * Habits and wellness goals: the streak from the days a habit was done,
 * the week against its target, the milestones worth a celebration, the
 * templates with the evidence behind them, and a goal's progress read
 * from the trackers rather than typed in.
 */

import { addDays, daysBetween, isoDay, mean, round1, weekStart } from './wellness-dates';
import { ACTIVITY_TYPES, HABIT_TEMPLATES, type HabitTemplate } from './wellness-library';
import type { ActivityLog, CheckInLog, HydrationLog, SleepLog } from './health-insights.service';

export interface StreakResult {
  current: number;
  longest: number;
  doneToday: boolean;
  lastDone: string | null;
  totalDone: number;
}

/** A streak counts consecutive days ending today, or ending yesterday if today is not done yet. */
export function streakFrom(doneDays: string[], today: string): StreakResult {
  const days = Array.from(new Set(doneDays.map(isoDay))).sort();
  const set = new Set(days);
  const t = isoDay(today);
  let current = 0;
  let cursor = set.has(t) ? t : addDays(t, -1);
  while (set.has(cursor)) { current += 1; cursor = addDays(cursor, -1); }
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i += 1) {
    run = i > 0 && daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return { current, longest: Math.max(longest, current), doneToday: set.has(t), lastDone: days.length ? days[days.length - 1] : null, totalDone: days.length };
}

export interface WeekProgress {
  weekStart: string;
  done: number;
  target: number;
  pct: number;
  met: boolean;
  days: Array<{ day: string; done: boolean; future: boolean }>;
}

export function weekProgress(doneDays: string[], today: string, targetPerWeek: number): WeekProgress {
  const t = isoDay(today);
  const ws = weekStart(t);
  const set = new Set(doneDays.map(isoDay));
  const days = Array.from({ length: 7 }, (_, i) => { const day = addDays(ws, i); return { day, done: set.has(day), future: day > t }; });
  const done = days.filter((d) => d.done).length;
  const target = Math.min(7, Math.max(1, targetPerWeek));
  return { weekStart: ws, done, target, pct: Math.min(100, Math.round((done / target) * 100)), met: done >= target, days };
}

export const MILESTONES = [3, 7, 14, 21, 30, 60, 100, 365];

export function milestoneReached(previousStreak: number, newStreak: number): number | null {
  const hit = MILESTONES.filter((m) => previousStreak < m && newStreak >= m);
  return hit.length ? hit[hit.length - 1] : null;
}

export function celebrate(streak: number, habitName: string): string {
  if (streak >= 365) return `A year of ${habitName.toLowerCase()}. That is not a habit any more, that is who you are.`;
  if (streak >= 100) return `One hundred days. ${habitName} is yours now.`;
  if (streak >= 60) return `Sixty days in a row. Most people never get here.`;
  if (streak >= 30) return `Thirty days. This is the point where it stops taking effort.`;
  if (streak >= 21) return `Three weeks straight. Keep the chain going.`;
  if (streak >= 14) return `Two weeks. It is starting to feel odd to skip it, which is the whole idea.`;
  if (streak >= 7) return `A full week of ${habitName.toLowerCase()}. Well done.`;
  if (streak >= 3) return `Three days in a row. The hardest three.`;
  return `Done. Day ${streak}.`;
}

export const achievementForStreak = (streak: number): 'HABIT_STREAK_7' | 'HABIT_STREAK_30' | 'HABIT_STREAK_100' | null =>
  streak >= 100 ? 'HABIT_STREAK_100' : streak >= 30 ? 'HABIT_STREAK_30' : streak >= 7 ? 'HABIT_STREAK_7' : null;

export function templateByKey(key: string): HabitTemplate | undefined {
  return HABIT_TEMPLATES.find((t) => t.key === key);
}

// ------------------------------------------------------------------- goals

export interface GoalLike {
  id?: string;
  metric: 'SLEEP_HOURS' | 'ACTIVITY_SESSIONS' | 'ACTIVITY_MINUTES' | 'CHECKIN_DAYS' | 'HYDRATION_GLASSES' | 'MEDITATION_DAYS' | 'STEPS';
  target: number;
  period: 'DAY' | 'WEEK';
  startedOn: string;
}

export interface GoalData {
  sleep: SleepLog[];
  activity: ActivityLog[];
  checkins: CheckInLog[];
  hydration: HydrationLog[];
}

export interface GoalProgress {
  metric: GoalLike['metric'];
  label: string;
  unit: string;
  current: number | null;
  target: number;
  pct: number;
  met: boolean;
  thisWeek: { weekStart: string; value: number | null };
  history: Array<{ weekStart: string; value: number | null; met: boolean }>;
  weeksMet: number;
  currentStreakWeeks: number;
  bestStreakWeeks: number;
  hint: string;
}

const METRIC_META: Record<GoalLike['metric'], { label: string; unit: string; hint: string }> = {
  SLEEP_HOURS: { label: 'Sleep', unit: 'hours a night', hint: 'Averaged over the nights you logged that week.' },
  ACTIVITY_SESSIONS: { label: 'Movement sessions', unit: 'sessions a week', hint: 'Any logged movement of ten minutes or more.' },
  ACTIVITY_MINUTES: { label: 'Movement', unit: 'minutes a week', hint: 'All logged movement, added up.' },
  CHECKIN_DAYS: { label: 'Check-ins', unit: 'days a week', hint: 'Days with a mood check-in.' },
  HYDRATION_GLASSES: { label: 'Water', unit: 'glasses a day', hint: 'Averaged over the days you logged.' },
  MEDITATION_DAYS: { label: 'Mindfulness', unit: 'days a week', hint: 'Days with meditation, breathwork or yoga logged.' },
  STEPS: { label: 'Steps', unit: 'steps a day', hint: 'Averaged over the days with steps logged.' },
};

const mindful = new Set(ACTIVITY_TYPES.filter((t) => t.mindful).map((t) => t.key));

function weekValue(goal: GoalLike, data: GoalData, ws: string): number | null {
  const we = addDays(ws, 6);
  const within = <T extends { day: string }>(rows: T[]) => rows.filter((r) => { const d = isoDay(r.day); return d >= ws && d <= we; });
  switch (goal.metric) {
    case 'SLEEP_HOURS': { const m = mean(within(data.sleep).map((s) => s.hours)); return m === null ? null : round1(m); }
    case 'ACTIVITY_SESSIONS': return within(data.activity).filter((a) => a.minutes >= 10).length;
    case 'ACTIVITY_MINUTES': return within(data.activity).reduce((a, b) => a + b.minutes, 0);
    case 'CHECKIN_DAYS': return new Set(within(data.checkins).map((c) => isoDay(c.day))).size;
    case 'HYDRATION_GLASSES': { const m = mean(within(data.hydration).map((h) => h.glasses)); return m === null ? null : round1(m); }
    case 'MEDITATION_DAYS': return new Set(within(data.activity).filter((a) => mindful.has(a.type)).map((a) => isoDay(a.day))).size;
    case 'STEPS': { const m = mean(within(data.activity).filter((a) => a.steps).map((a) => a.steps!)); return m === null ? null : Math.round(m); }
    default: return null;
  }
}

export function goalProgress(goal: GoalLike, data: GoalData, today: string, historyWeeks = 8): GoalProgress {
  const meta = METRIC_META[goal.metric];
  const t = isoDay(today);
  const thisWs = weekStart(t);
  const startWs = weekStart(isoDay(goal.startedOn));
  const history: GoalProgress['history'] = [];
  for (let i = historyWeeks - 1; i >= 1; i -= 1) {
    const ws = addDays(thisWs, -7 * i);
    if (ws < startWs) continue;
    const value = weekValue(goal, data, ws);
    history.push({ weekStart: ws, value, met: value !== null && value >= goal.target });
  }
  const current = weekValue(goal, data, thisWs);
  const met = current !== null && current >= goal.target;
  const weeksMet = history.filter((h) => h.met).length + (met ? 1 : 0);
  let streak = 0;
  for (const h of [...history].reverse()) { if (h.met) streak += 1; else break; }
  const currentStreakWeeks = met ? streak + 1 : streak;
  let best = 0; let run = 0;
  for (const h of [...history, { weekStart: thisWs, value: current, met }]) { run = h.met ? run + 1 : 0; best = Math.max(best, run); }
  return {
    metric: goal.metric, label: meta.label, unit: meta.unit, current, target: goal.target,
    pct: current === null ? 0 : Math.min(100, Math.round((current / goal.target) * 100)), met,
    thisWeek: { weekStart: thisWs, value: current }, history, weeksMet, currentStreakWeeks, bestStreakWeeks: best, hint: meta.hint,
  };
}

export function goalReviewText(progress: GoalProgress, weeksSinceStart: number): { verdict: 'raise' | 'keep' | 'ease'; text: string; suggestedTarget: number } {
  const recent = progress.history.slice(-4);
  const metCount = recent.filter((h) => h.met).length;
  const logged = recent.filter((h) => h.value !== null).length;
  if (logged === 0) return { verdict: 'keep', text: 'Nothing logged in the last month, so there is nothing to review yet. Keep the goal and log a week.', suggestedTarget: progress.target };
  if (metCount >= 3) {
    const raised = progress.metric === 'SLEEP_HOURS' ? Math.min(9, round1(progress.target + 0.25)) : progress.metric === 'HYDRATION_GLASSES' ? Math.min(12, progress.target + 1) : progress.metric === 'STEPS' ? progress.target + 1000 : Math.min(progress.metric.endsWith('DAYS') || progress.metric === 'ACTIVITY_SESSIONS' ? 7 : 600, progress.target + (progress.metric === 'ACTIVITY_MINUTES' ? 30 : 1));
    return { verdict: 'raise', text: `Met ${metCount} of the last ${logged} weeks after ${weeksSinceStart} weeks on it. The goal has become the floor; raise it a little or keep it and enjoy it.`, suggestedTarget: raised };
  }
  if (metCount === 0) {
    const eased = progress.metric === 'SLEEP_HOURS' ? Math.max(6, round1(progress.target - 0.5)) : progress.metric === 'HYDRATION_GLASSES' ? Math.max(4, progress.target - 1) : progress.metric === 'STEPS' ? Math.max(3000, progress.target - 1500) : Math.max(1, progress.target - (progress.metric === 'ACTIVITY_MINUTES' ? 45 : 1));
    return { verdict: 'ease', text: `Not met in the last ${logged} logged weeks. A goal that is never met stops being motivating; ease it to something you can hit and build from there.`, suggestedTarget: eased };
  }
  return { verdict: 'keep', text: `Met ${metCount} of the last ${logged} weeks. That is a goal at the right height; keep it.`, suggestedTarget: progress.target };
}

// -------------------------------------------------------------- challenges

export interface LeaderboardMember { userId: string; name: string; doneDays: string[]; isYou?: boolean }

export function challengeLeaderboard(members: LeaderboardMember[], startsOn: string, endsOn: string, today: string): Array<{ userId: string; name: string; done: number; possible: number; pct: number; streak: number; isYou: boolean; rank: number }> {
  const to = isoDay(today) < endsOn ? isoDay(today) : endsOn;
  const possible = Math.max(1, daysBetween(startsOn, to) + 1);
  return members.map((m) => {
    const inRange = m.doneDays.map(isoDay).filter((d) => d >= startsOn && d <= endsOn);
    const done = new Set(inRange).size;
    return { userId: m.userId, name: m.name, done, possible, pct: Math.min(100, Math.round((done / possible) * 100)), streak: streakFrom(inRange, to).current, isYou: Boolean(m.isYou), rank: 0 };
  }).sort((a, b) => b.done - a.done || b.streak - a.streak || a.name.localeCompare(b.name)).map((m, i) => ({ ...m, rank: i + 1 }));
}
