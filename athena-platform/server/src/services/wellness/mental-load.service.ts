/**
 * The mental load tracker: the invisible work logged as it happens,
 * summed by category and by who carried it, the share that is planning
 * and remembering rather than doing, an impact score, an early warning
 * for burnout, and the scripts for handing a category over.
 */

import { addDays, daysBetween, isoDay, mean, round1, weekStart } from './wellness-dates';
import { DELEGATION_TEMPLATES, MENTAL_LOAD_CATEGORIES } from './wellness-library';

export interface LoadEntry {
  id?: string;
  day: string;
  category: string;
  task: string;
  minutes: number;
  carriedBy: 'ME' | 'PARTNER' | 'SHARED' | 'OTHER';
}

export interface MentalLoadAnalysis {
  window: { from: string; to: string; weeks: number };
  totalHours: number;
  myHours: number;
  myShare: number;
  invisibleShare: number;
  byCategory: Array<{ category: string; label: string; invisible: boolean; hours: number; myHours: number; share: number; tasks: string[] }>;
  byCarrier: Array<{ carrier: string; label: string; hours: number; share: number }>;
  weekly: Array<{ weekStart: string; myHours: number; totalHours: number }>;
  impactScore: number;
  impactLabel: string;
  burnout: { level: 'ok' | 'watch' | 'high'; title: string; reasons: string[]; advice: string };
  delegation: Array<{ category: string; label: string; hours: number; ask: string; handover: string[]; boundary: string }>;
  conversationCard: string;
  notes: string[];
}

const CARRIER_LABELS: Record<string, string> = { ME: 'You', PARTNER: 'Your partner', SHARED: 'Shared', OTHER: 'Someone else' };

export interface AnalyseOptions {
  today: string;
  weeks?: number;
  recentEnergy?: number[];
  recentStress?: number[];
}

export function analyseMentalLoad(entries: LoadEntry[], opts: AnalyseOptions): MentalLoadAnalysis {
  const to = isoDay(opts.today);
  const weeks = Math.min(26, Math.max(1, opts.weeks ?? 4));
  const from = addDays(weekStart(to), -7 * (weeks - 1));
  const rows = entries.filter((e) => { const d = isoDay(e.day); return d >= from && d <= to; });
  const notes: string[] = [];

  const mine = (e: LoadEntry) => (e.carriedBy === 'ME' ? e.minutes : e.carriedBy === 'SHARED' ? e.minutes / 2 : 0);
  const totalMin = rows.reduce((a, e) => a + e.minutes, 0);
  const myMin = rows.reduce((a, e) => a + mine(e), 0);
  const invisibleKeys = new Set(MENTAL_LOAD_CATEGORIES.filter((c) => c.invisible).map((c) => c.key));
  const invisibleMin = rows.filter((e) => invisibleKeys.has(e.category)).reduce((a, e) => a + e.minutes, 0);

  const byCategory = MENTAL_LOAD_CATEGORIES.map((c) => {
    const cat = rows.filter((e) => e.category === c.key);
    const hours = cat.reduce((a, e) => a + e.minutes, 0) / 60;
    const myHours = cat.reduce((a, e) => a + mine(e), 0) / 60;
    const tasks = Array.from(new Set(cat.map((e) => e.task.trim()).filter(Boolean))).slice(0, 6);
    return { category: c.key, label: c.label, invisible: c.invisible, hours: round1(hours), myHours: round1(myHours), share: totalMin ? Math.round((hours * 60 / totalMin) * 100) : 0, tasks };
  }).filter((c) => c.hours > 0).sort((a, b) => b.hours - a.hours || b.myHours - a.myHours);

  const byCarrier = (['ME', 'PARTNER', 'SHARED', 'OTHER'] as const).map((carrier) => {
    const min = rows.filter((e) => e.carriedBy === carrier).reduce((a, e) => a + e.minutes, 0);
    return { carrier, label: CARRIER_LABELS[carrier], hours: round1(min / 60), share: totalMin ? Math.round((min / totalMin) * 100) : 0 };
  }).filter((c) => c.hours > 0);

  const weekly: MentalLoadAnalysis['weekly'] = [];
  for (let w = from; w <= to; w = addDays(w, 7)) {
    const inWeek = rows.filter((e) => weekStart(isoDay(e.day)) === w);
    weekly.push({ weekStart: w, myHours: round1(inWeek.reduce((a, e) => a + mine(e), 0) / 60), totalHours: round1(inWeek.reduce((a, e) => a + e.minutes, 0) / 60) });
  }

  // Impact: hours a week you carry, with the invisible categories weighted
  // up because they never stop, scaled so 25 weighted hours a week is 100.
  const weeksElapsed = Math.max(1, Math.min(weeks, Math.ceil((daysBetween(from, to) + 1) / 7)));
  const weighted = rows.reduce((a, e) => a + mine(e) * (invisibleKeys.has(e.category) ? 1.3 : 1), 0) / 60 / weeksElapsed;
  const impactScore = Math.min(100, Math.round((weighted / 25) * 100));
  const impactLabel = impactScore >= 75 ? 'Heavy' : impactScore >= 45 ? 'Substantial' : impactScore >= 20 ? 'Moderate' : 'Light';

  const myHoursPerWeek = myMin / 60 / weeksElapsed;
  const lastTwo = weekly.slice(-2);
  const rising = lastTwo.length === 2 && lastTwo[1].myHours > lastTwo[0].myHours * 1.15 && lastTwo[1].myHours >= 8;
  const energy = opts.recentEnergy && opts.recentEnergy.length >= 5 ? mean(opts.recentEnergy) : null;
  const stress = opts.recentStress && opts.recentStress.length >= 5 ? mean(opts.recentStress) : null;
  const reasons: string[] = [];
  if (myHoursPerWeek >= 20) reasons.push(`You are carrying about ${round1(myHoursPerWeek)} hours a week of this on top of everything else.`);
  else if (myHoursPerWeek >= 12) reasons.push(`About ${round1(myHoursPerWeek)} hours a week is yours.`);
  if (rising) reasons.push(`It went up ${round1(lastTwo[1].myHours - lastTwo[0].myHours)} hours this week on last.`);
  if (energy !== null && energy <= 2.5) reasons.push(`Your energy in the check-ins has averaged ${round1(energy)} out of 5.`);
  if (stress !== null && stress >= 4) reasons.push(`Stress in the check-ins has averaged ${round1(stress)} out of 5.`);
  let level: 'ok' | 'watch' | 'high' = 'ok';
  if ((myHoursPerWeek >= 20 && (rising || (energy !== null && energy <= 2.5) || (stress !== null && stress >= 4))) || reasons.length >= 3) level = 'high';
  else if (reasons.length >= 1) level = 'watch';
  const burnout = {
    level,
    title: level === 'high' ? 'Early warning: this is the shape of burnout' : level === 'watch' ? 'Worth watching' : 'Nothing flagging',
    reasons,
    advice: level === 'high'
      ? 'Burnout is a load problem before it is a resilience problem. Pick the heaviest category below and use the script to hand it over this week, whole, not shared.'
      : level === 'watch' ? 'Keep logging for another fortnight. If the hours or the energy move the wrong way, the tracker will say so.' : 'Log the invisible work as it happens and the picture builds on its own.',
  };

  const delegation = byCategory.filter((c) => c.myHours >= 1).slice(0, 3).map((c) => {
    const t = DELEGATION_TEMPLATES.find((d) => d.category === c.category) ?? DELEGATION_TEMPLATES[DELEGATION_TEMPLATES.length - 1];
    const tasks = c.tasks.length ? c.tasks.slice(0, 3).join(', ') : c.label.toLowerCase();
    return { category: c.category, label: c.label, hours: c.myHours, ask: t.ask.replace('{tasks}', tasks), handover: t.handover, boundary: t.boundary };
  });

  const heaviest = byCategory[0];
  const partnerShare = byCarrier.find((c) => c.carrier === 'PARTNER')?.share ?? 0;
  const conversationCard = rows.length === 0
    ? ''
    : [
      `Over the last ${weeksElapsed === 1 ? 'week' : `${weeksElapsed} weeks`} I logged ${round1(totalMin / 60)} hours of the work that keeps our life running, and about ${round1(myMin / 60)} of those hours (${totalMin ? Math.round((myMin / totalMin) * 100) : 0}%) were mine.`,
      invisibleMin > 0 ? `${Math.round((invisibleMin / totalMin) * 100)}% of it was planning, remembering and admin, the part nobody sees.` : '',
      heaviest ? `The heaviest is ${heaviest.label.toLowerCase()}: ${heaviest.tasks.slice(0, 3).join(', ') || 'most days'}.` : '',
      partnerShare > 0 ? `You carried ${partnerShare}%, and I want to say I noticed.` : '',
      delegation[0] ? `What would help most: ${delegation[0].ask}` : 'What would help most: one category that becomes fully yours, start to finish.',
    ].filter(Boolean).join(' ');

  if (rows.length === 0) notes.push('Nothing logged in this window yet. Add the invisible work as it happens, even five minutes.');
  notes.push('Shared work counts half to each of you. Planning, remembering, admin and emotional labour are weighted up in the impact score because they never clock off.');
  if (partnerShare >= 50) notes.push('Your partner carried at least half in this window. That is worth saying out loud.');

  return {
    window: { from, to, weeks },
    totalHours: round1(totalMin / 60),
    myHours: round1(myMin / 60),
    myShare: totalMin ? Math.round((myMin / totalMin) * 100) : 0,
    invisibleShare: totalMin ? Math.round((invisibleMin / totalMin) * 100) : 0,
    byCategory, byCarrier, weekly, impactScore, impactLabel, burnout, delegation, conversationCard, notes,
  };
}
