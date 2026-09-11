/**
 * The cycle: periods grouped from the days a member logged, the lengths
 * between them, and a prediction of the next period and the fertile
 * window from her own history. Where there is no history yet the typical
 * length she entered is used, and the confidence says so.
 *
 * The arithmetic is the standard one (ovulation about fourteen days before
 * the next period; the fertile window the five days before it and the day
 * after). It is a planning estimate, not contraception, and the page says
 * that in as many words.
 */

import { addDays, daysBetween, isoDay, mean, round1 } from './wellness-dates';

export interface PeriodDayLike {
  day: string;
  flow?: string;
  pain?: number;
  symptoms?: string[];
}

export interface CyclePeriod {
  start: string;
  end: string;
  length: number;
  heaviest: string | null;
  maxPain: number;
  symptoms: string[];
}

export interface CycleStats {
  cyclesCounted: number;
  cycleLengths: number[];
  averageCycle: number | null;
  shortestCycle: number | null;
  longestCycle: number | null;
  variability: number | null;
  periodLengths: number[];
  averagePeriod: number | null;
}

export type CyclePhase = 'menstrual' | 'follicular' | 'fertile' | 'luteal' | 'unknown';

export interface CyclePrediction {
  hasData: boolean;
  today: string;
  lastPeriodStart: string | null;
  dayOfCycle: number | null;
  phase: CyclePhase;
  cycleLength: number;
  periodLength: number;
  nextPeriod: string | null;
  daysUntilNextPeriod: number | null;
  daysOverdue: number;
  ovulation: string | null;
  fertileWindow: { start: string; end: string } | null;
  following: string[];
  confidence: 'none' | 'low' | 'medium' | 'high';
  flags: Array<{ key: string; title: string; body: string }>;
  stats: CycleStats;
  periods: CyclePeriod[];
  notes: string[];
}

const FLOW_RANK: Record<string, number> = { spotting: 1, light: 2, medium: 3, heavy: 4 };

/** Consecutive logged days become one period; a gap of more than three days starts another. */
export function groupPeriods(days: PeriodDayLike[]): CyclePeriod[] {
  const sorted = [...days].map((d) => ({ ...d, day: isoDay(d.day) })).sort((a, b) => a.day.localeCompare(b.day));
  const out: CyclePeriod[] = [];
  let current: CyclePeriod | null = null;
  for (const d of sorted) {
    if (current && daysBetween(current.end, d.day) <= 3) {
      current.end = d.day;
      current.length = daysBetween(current.start, current.end) + 1;
      if ((FLOW_RANK[d.flow ?? ''] ?? 0) > (FLOW_RANK[current.heaviest ?? ''] ?? 0)) current.heaviest = d.flow ?? null;
      current.maxPain = Math.max(current.maxPain, d.pain ?? 0);
      for (const s of d.symptoms ?? []) if (!current.symptoms.includes(s)) current.symptoms.push(s);
    } else {
      current = { start: d.day, end: d.day, length: 1, heaviest: d.flow ?? null, maxPain: d.pain ?? 0, symptoms: [...(d.symptoms ?? [])] };
      out.push(current);
    }
  }
  return out;
}

export function cycleStats(periods: CyclePeriod[]): CycleStats {
  const starts = periods.map((p) => p.start);
  const cycleLengths: number[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    const len = daysBetween(starts[i - 1], starts[i]);
    if (len >= 15 && len <= 90) cycleLengths.push(len);
  }
  const recent = cycleLengths.slice(-6);
  const periodLengths = periods.map((p) => p.length).filter((l) => l >= 1 && l <= 14);
  const avg = mean(recent);
  return {
    cyclesCounted: recent.length,
    cycleLengths: recent,
    averageCycle: avg === null ? null : Math.round(avg),
    shortestCycle: recent.length ? Math.min(...recent) : null,
    longestCycle: recent.length ? Math.max(...recent) : null,
    variability: recent.length >= 2 ? Math.max(...recent) - Math.min(...recent) : null,
    periodLengths: periodLengths.slice(-6),
    averagePeriod: periodLengths.length ? Math.round(mean(periodLengths.slice(-6))!) : null,
  };
}

export interface PredictInput {
  days: PeriodDayLike[];
  today: string;
  cycleLengthHint?: number | null;
  periodLengthHint?: number | null;
}

export function predictCycle(input: PredictInput): CyclePrediction {
  const today = isoDay(input.today);
  const periods = groupPeriods(input.days);
  const stats = cycleStats(periods);
  const cycleLength = Math.min(90, Math.max(15, stats.averageCycle ?? input.cycleLengthHint ?? 28));
  const periodLength = Math.min(14, Math.max(1, stats.averagePeriod ?? input.periodLengthHint ?? 5));
  const notes: string[] = [];
  const flags: CyclePrediction['flags'] = [];

  const base: CyclePrediction = {
    hasData: periods.length > 0, today, lastPeriodStart: null, dayOfCycle: null, phase: 'unknown', cycleLength, periodLength,
    nextPeriod: null, daysUntilNextPeriod: null, daysOverdue: 0, ovulation: null, fertileWindow: null, following: [], confidence: 'none', flags, stats, periods, notes,
  };

  if (periods.length === 0) {
    notes.push('Log the first day of your period and the prediction starts from there.');
    return base;
  }

  const last = periods[periods.length - 1];
  const lastStart = last.start;
  const dayOfCycle = daysBetween(lastStart, today) + 1;

  // The next period: the last start plus the cycle length, carried forward
  // if that date has passed but a new period has not been logged.
  const nextPeriod = addDays(lastStart, cycleLength);
  let daysOverdue = 0;
  if (daysBetween(nextPeriod, today) > 0) {
    daysOverdue = daysBetween(nextPeriod, today);
  }
  const daysUntil = daysBetween(today, nextPeriod);

  // Ovulation about fourteen days before the next period; the window is the
  // five days before and the day after.
  const ovulationThisCycle = addDays(nextPeriod, -14);
  const windowThisCycle = { start: addDays(ovulationThisCycle, -5), end: addDays(ovulationThisCycle, 1) };

  let phase: CyclePhase;
  const inPeriodNow = daysBetween(last.end, today) <= 1 && dayOfCycle <= Math.max(periodLength, last.length) + 1;
  if (inPeriodNow || dayOfCycle <= periodLength) phase = 'menstrual';
  else if (daysOverdue > 0) phase = 'luteal';
  else if (daysBetween(today, windowThisCycle.start) > 0) phase = 'follicular';
  else if (daysBetween(today, windowThisCycle.end) >= 0) phase = 'fertile';
  else phase = 'luteal';

  // If this cycle's window has passed, the one worth showing is the next.
  let ovulation = ovulationThisCycle;
  let fertile = windowThisCycle;
  if (daysBetween(windowThisCycle.end, today) > 0 && daysOverdue === 0) {
    ovulation = addDays(addDays(nextPeriod, cycleLength), -14);
    fertile = { start: addDays(ovulation, -5), end: addDays(ovulation, 1) };
  }

  const following: string[] = [];
  for (let i = 1; i <= 2; i += 1) following.push(addDays(nextPeriod, cycleLength * i));

  let confidence: CyclePrediction['confidence'] = 'low';
  if (stats.cyclesCounted >= 4 && (stats.variability ?? 99) <= 7) confidence = 'high';
  else if (stats.cyclesCounted >= 2) confidence = 'medium';

  if (stats.cyclesCounted >= 3 && (stats.variability ?? 0) > 8) {
    flags.push({ key: 'irregular', title: 'Your cycles vary a lot', body: `Your last ${stats.cyclesCounted} cycles ran from ${stats.shortestCycle} to ${stats.longestCycle} days. Variation over about eight days is worth mentioning to a GP; thyroid, PCOS and perimenopause all show up this way.` });
  }
  if (stats.cyclesCounted >= 2 && (stats.averageCycle ?? 28) > 35) {
    flags.push({ key: 'long', title: 'Long cycles', body: `An average of ${stats.averageCycle} days is longer than the usual 21 to 35. Common, and usually fine, but a GP can rule out the things that cause it.` });
  }
  if (stats.cyclesCounted >= 2 && (stats.averageCycle ?? 28) < 21) {
    flags.push({ key: 'short', title: 'Short cycles', body: `An average of ${stats.averageCycle} days is shorter than the usual range. Worth a conversation, especially with heavy bleeding.` });
  }
  if (daysOverdue > 7) {
    flags.push({ key: 'overdue', title: `${daysOverdue} days later than expected`, body: 'Stress, travel, illness and a change in weight can all delay a period. If pregnancy is possible, a test now is accurate. If it is more than a couple of weeks, see a GP.' });
  }
  const recentPeriods = periods.slice(-3);
  const heavy = recentPeriods.filter((p) => p.heaviest === 'heavy').length;
  if (heavy >= 2) {
    flags.push({ key: 'heavy', title: 'Heavy bleeding, more than once', body: 'Heavy periods drain iron and are the most common reason women are tired without knowing why. A GP can check iron and look at the causes, several of which are treatable.' });
  }
  const painful = recentPeriods.filter((p) => p.maxPain >= 4).length;
  if (painful >= 2) {
    flags.push({ key: 'painful', title: 'Pain that stops your day', body: 'Period pain that needs you to lie down or miss things is not something to push through. Endometriosis takes an average of six and a half years to diagnose in Australia, largely because women are told it is normal.' });
  }

  notes.push(`Cycle length ${stats.averageCycle ? `averaged from your last ${stats.cyclesCounted} cycles` : input.cycleLengthHint ? 'from the typical length you entered' : 'assumed at 28 days until there is history'}: ${cycleLength} days.`);
  notes.push('Ovulation is estimated at fourteen days before the next period; the fertile window is the five days before it and the day after. Sperm survive up to five days, an egg about one.');
  notes.push('An estimate for planning. It is not a method of contraception and it is not a fertility diagnosis.');

  return {
    ...base,
    lastPeriodStart: lastStart,
    dayOfCycle,
    phase,
    nextPeriod,
    daysUntilNextPeriod: daysUntil,
    daysOverdue,
    ovulation,
    fertileWindow: fertile,
    following,
    confidence,
    flags,
  };
}

export const phaseLabel = (phase: CyclePhase): string => ({ menstrual: 'Period', follicular: 'Follicular phase', fertile: 'Fertile window', luteal: 'Luteal phase', unknown: 'Not enough logged yet' }[phase]);

export function averagePainAndFlow(periods: CyclePeriod[]): { averagePain: number | null; heavyShare: number } {
  const recent = periods.slice(-6);
  const pain = mean(recent.map((p) => p.maxPain));
  const heavy = recent.length ? recent.filter((p) => p.heaviest === 'heavy').length / recent.length : 0;
  return { averagePain: pain === null ? null : round1(pain), heavyShare: Math.round(heavy * 100) };
}
