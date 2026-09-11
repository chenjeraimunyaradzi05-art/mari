/**
 * Insights from a member's own records: the trends over the weeks, the
 * patterns between one thing and another (sleep and mood, the days before
 * a period and anxiety, movement and energy), the signs a doctor would
 * want to hear about, and the recommendations that follow, each tied to a
 * published Australian source.
 *
 * Everything is rule-based and explained. A pattern is only reported when
 * there is enough data to mean something, and every risk says plainly
 * that it is a prompt to talk to someone, not a diagnosis.
 */

import { addDays, daysBetween, isoDay, mean, pearson, round1, weekStart } from './wellness-dates';
import { groupPeriods, predictCycle, type CyclePrediction, type PeriodDayLike } from './cycle.service';
import { CRISIS_LINES, K10_QUESTIONS, LIBRARY, type LibraryItem } from './wellness-library';

export interface CheckInLog { day: string; mood: number; stress: number; anxiety: number; energy: number; note?: string }
export interface SleepLog { day: string; hours: number; quality?: number }
export interface ActivityLog { day: string; type: string; minutes: number; intensity?: string; steps?: number }
export interface HydrationLog { day: string; glasses: number }
export interface SymptomLog { day: string; name: string; severity: number; note?: string }

export interface InsightSource { name: string; url: string }

export interface Insight {
  key: string;
  kind: 'pattern' | 'trend' | 'risk' | 'recommendation';
  title: string;
  body: string;
  strength?: 'weak' | 'moderate' | 'strong';
  source?: InsightSource;
  action?: { label: string; href: string };
  crisis?: boolean;
}

export interface MetricTrend {
  metric: string;
  label: string;
  weekly: Array<{ weekStart: string; value: number | null; n: number }>;
  average: number | null;
  direction: 'up' | 'down' | 'steady' | 'unknown';
  change: number | null;
}

export interface InsightsInput {
  today: string;
  days?: number;
  checkins: CheckInLog[];
  sleep: SleepLog[];
  activity: ActivityLog[];
  hydration: HydrationLog[];
  periodDays: PeriodDayLike[];
  symptoms?: SymptomLog[];
  cycleLengthHint?: number | null;
  periodLengthHint?: number | null;
}

export interface InsightsResult {
  window: { from: string; to: string; days: number };
  coverage: { checkinDays: number; sleepDays: number; activityDays: number; periodDays: number; hydrationDays: number };
  averages: { mood: number | null; stress: number | null; anxiety: number | null; energy: number | null; sleepHours: number | null; sleepQuality: number | null; activityMinutesPerWeek: number | null; glassesPerDay: number | null };
  trends: MetricTrend[];
  patterns: Insight[];
  risks: Insight[];
  recommendations: Insight[];
  cycle: CyclePrediction;
  notes: string[];
}

const byDay = <T extends { day: string }>(rows: T[]): Map<string, T> => {
  const m = new Map<string, T>();
  for (const r of rows) m.set(isoDay(r.day), r);
  return m;
};

const item = (key: string): LibraryItem | undefined => LIBRARY.flatMap((t) => t.items).find((i) => i.key === key);
const src = (key: string): InsightSource | undefined => {
  const i = item(key);
  return i ? { name: i.source, url: i.url } : undefined;
};

function trend(metric: string, label: string, rows: Array<{ day: string; value: number }>, from: string, to: string, threshold: number): MetricTrend {
  const weeks: Array<{ weekStart: string; values: number[] }> = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) weeks.push({ weekStart: w, values: [] });
  for (const r of rows) {
    const ws = weekStart(isoDay(r.day));
    const bucket = weeks.find((b) => b.weekStart === ws);
    if (bucket) bucket.values.push(r.value);
  }
  const weekly = weeks.map((w) => ({ weekStart: w.weekStart, value: mean(w.values) === null ? null : round1(mean(w.values)!), n: w.values.length }));
  const withData = weekly.filter((w) => w.value !== null);
  const average = mean(rows.map((r) => r.value));
  let direction: MetricTrend['direction'] = 'unknown';
  let change: number | null = null;
  if (withData.length >= 3) {
    const recent = mean(withData.slice(-2).map((w) => w.value!))!;
    const earlier = mean(withData.slice(0, -2).map((w) => w.value!))!;
    change = round1(recent - earlier);
    direction = change > threshold ? 'up' : change < -threshold ? 'down' : 'steady';
  }
  return { metric, label, weekly, average: average === null ? null : round1(average), direction, change };
}

export function buildInsights(input: InsightsInput): InsightsResult {
  const to = isoDay(input.today);
  const days = Math.min(365, Math.max(14, input.days ?? 90));
  const from = addDays(to, -(days - 1));
  const inWindow = <T extends { day: string }>(rows: T[]) => rows.filter((r) => { const d = isoDay(r.day); return d >= from && d <= to; });

  const checkins = inWindow(input.checkins);
  const sleep = inWindow(input.sleep);
  const activity = inWindow(input.activity);
  const hydration = inWindow(input.hydration);
  const periodDays = input.periodDays;
  const symptoms = inWindow(input.symptoms ?? []);

  const checkinMap = byDay(checkins);
  const sleepMap = byDay(sleep);
  const activityByDay = new Map<string, number>();
  for (const a of activity) activityByDay.set(isoDay(a.day), (activityByDay.get(isoDay(a.day)) ?? 0) + a.minutes);
  const hydrationMap = byDay(hydration);

  const weeksInWindow = Math.max(1, days / 7);
  const averages: InsightsResult['averages'] = {
    mood: r1(mean(checkins.map((c) => c.mood))),
    stress: r1(mean(checkins.map((c) => c.stress))),
    anxiety: r1(mean(checkins.map((c) => c.anxiety))),
    energy: r1(mean(checkins.map((c) => c.energy))),
    sleepHours: r1(mean(sleep.map((s) => s.hours))),
    sleepQuality: r1(mean(sleep.filter((s) => s.quality).map((s) => s.quality!))),
    activityMinutesPerWeek: activity.length ? Math.round(activity.reduce((a, b) => a + b.minutes, 0) / weeksInWindow) : null,
    glassesPerDay: r1(mean(hydration.map((h) => h.glasses))),
  };

  const trends: MetricTrend[] = [
    trend('mood', 'Mood', checkins.map((c) => ({ day: c.day, value: c.mood })), from, to, 0.3),
    trend('stress', 'Stress', checkins.map((c) => ({ day: c.day, value: c.stress })), from, to, 0.3),
    trend('anxiety', 'Anxiety', checkins.map((c) => ({ day: c.day, value: c.anxiety })), from, to, 0.3),
    trend('energy', 'Energy', checkins.map((c) => ({ day: c.day, value: c.energy })), from, to, 0.3),
    trend('sleepHours', 'Sleep, hours', sleep.map((s) => ({ day: s.day, value: s.hours })), from, to, 0.5),
    trend('activityMinutes', 'Movement, minutes', Array.from(activityByDay.entries()).map(([day, value]) => ({ day, value })), from, to, 15),
  ];

  const patterns: Insight[] = [];
  const risks: Insight[] = [];
  const recommendations: Insight[] = [];
  const notes: string[] = [];

  // ------------------------------------------------------------ cycle patterns
  const cycle = predictCycle({ days: periodDays, today: to, cycleLengthHint: input.cycleLengthHint, periodLengthHint: input.periodLengthHint });
  const periods = groupPeriods(periodDays);
  if (periods.length >= 2 && checkins.length >= 10) {
    const rel: Array<{ offset: number; c: CheckInLog }> = [];
    for (const p of periods) {
      for (const c of checkins) {
        const off = daysBetween(p.start, isoDay(c.day));
        if (off >= -10 && off <= 6) rel.push({ offset: off, c });
      }
    }
    const pre = rel.filter((r) => r.offset >= -7 && r.offset <= -1);
    const rest = rel.filter((r) => r.offset < -7 || r.offset > 4);
    const during = rel.filter((r) => r.offset >= 0 && r.offset <= 4);
    const metric = (rows: typeof rel, k: keyof CheckInLog) => mean(rows.map((r) => Number(r.c[k])));
    if (pre.length >= 4 && rest.length >= 4) {
      for (const [k, label, higherIsWorse] of [['anxiety', 'anxiety', true], ['stress', 'stress', true], ['mood', 'mood', false], ['energy', 'energy', false]] as Array<[keyof CheckInLog, string, boolean]>) {
        const a = metric(pre, k)!;
        const b = metric(rest, k)!;
        const diff = higherIsWorse ? a - b : b - a;
        if (diff >= 0.7) {
          const perDay = new Map<number, number[]>();
          for (const r of pre) perDay.set(r.offset, [...(perDay.get(r.offset) ?? []), Number(r.c[k])]);
          let peakOffset = -3;
          let peakVal = higherIsWorse ? -1 : 99;
          for (const [off, vals] of perDay) {
            const v = mean(vals)!;
            if (higherIsWorse ? v > peakVal : v < peakVal) { peakVal = v; peakOffset = off; }
          }
          patterns.push({
            key: `cycle-${k}`, kind: 'pattern', strength: diff >= 1.2 ? 'strong' : 'moderate',
            title: higherIsWorse ? `Your ${label} rises in the week before your period` : `Your ${label} dips in the week before your period`,
            body: `Across ${periods.length} cycles, ${label} averaged ${round1(a)} in the seven days before a period against ${round1(b)} the rest of the month, ${higherIsWorse ? 'peaking' : 'lowest'} about ${Math.abs(peakOffset)} day${Math.abs(peakOffset) === 1 ? '' : 's'} before. That is the shape of premenstrual symptoms, and it is common; knowing the day helps you plan the hard things around it.`,
            source: src('cycle-basics'),
          });
        }
      }
    }
    if (during.length >= 4 && rest.length >= 4) {
      const e = metric(during, 'energy')!;
      const r = metric(rest, 'energy')!;
      if (r - e >= 0.7) patterns.push({ key: 'cycle-energy-period', kind: 'pattern', strength: 'moderate', title: 'Energy is lowest on period days', body: `Energy averaged ${round1(e)} during your period against ${round1(r)} otherwise. Iron loss and pain both do this; if it is heavy, the iron is worth checking.`, source: src('iron-women') });
    }
  }

  // ---------------------------------------------------------- sleep and mood
  {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [day, s] of sleepMap) {
      const c = checkinMap.get(day);
      if (c) { xs.push(s.hours); ys.push(c.mood); }
    }
    const r = pearson(xs, ys);
    if (xs.length >= 8 && r !== null && r >= 0.3) {
      const short = [] as number[]; const long = [] as number[];
      xs.forEach((h, i) => (h < 6.5 ? short : long).push(ys[i]));
      const a = mean(short); const b = mean(long);
      patterns.push({
        key: 'sleep-mood', kind: 'pattern', strength: r >= 0.5 ? 'strong' : 'moderate',
        title: 'Sleep and your mood move together',
        body: a !== null && b !== null && short.length >= 3
          ? `On nights under six and a half hours your mood the next day averaged ${round1(a)}; after seven or more it averaged ${round1(b)} (${xs.length} days compared). Sleep is the most direct lever you have.`
          : `Across ${xs.length} days, more sleep went with better mood (correlation ${round1(r)}). Sleep is the most direct lever you have.`,
        source: src('sleep-hygiene'),
      });
    }
  }

  // ------------------------------------------------------- movement and mood
  {
    const active: number[] = []; const activeE: number[] = []; const still: number[] = []; const stillE: number[] = [];
    for (const [day, c] of checkinMap) {
      if ((activityByDay.get(day) ?? 0) >= 20) { active.push(c.mood); activeE.push(c.energy); } else { still.push(c.mood); stillE.push(c.energy); }
    }
    if (active.length >= 4 && still.length >= 4) {
      const dm = mean(active)! - mean(still)!;
      const de = mean(activeE)! - mean(stillE)!;
      if (dm >= 0.5 || de >= 0.5) {
        patterns.push({ key: 'movement-mood', kind: 'pattern', strength: Math.max(dm, de) >= 1 ? 'strong' : 'moderate', title: 'Days you move are better days', body: `On days with twenty minutes or more of movement your mood averaged ${round1(mean(active)!)} and energy ${round1(mean(activeE)!)}, against ${round1(mean(still)!)} and ${round1(mean(stillE)!)} on days without (${active.length} against ${still.length} days).`, source: src('activity-guidelines') });
      }
    }
  }

  // ------------------------------------------------------ hydration and energy
  {
    const wet: number[] = []; const dry: number[] = [];
    for (const [day, h] of hydrationMap) {
      const c = checkinMap.get(day);
      if (!c) continue;
      if (h.glasses >= 6) wet.push(c.energy); else if (h.glasses <= 3) dry.push(c.energy);
    }
    if (wet.length >= 4 && dry.length >= 4 && mean(wet)! - mean(dry)! >= 0.5) {
      patterns.push({ key: 'hydration-energy', kind: 'pattern', strength: 'moderate', title: 'Water shows up in your energy', body: `Energy averaged ${round1(mean(wet)!)} on days with six or more glasses and ${round1(mean(dry)!)} on days with three or fewer.`, source: { name: 'Eat for Health (NHMRC)', url: 'https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/water' } });
    }
  }

  // ------------------------------------------------------------------ trends
  for (const t of trends) {
    if (t.direction === 'unknown' || t.change === null) continue;
    const worse = (t.metric === 'stress' || t.metric === 'anxiety') ? t.direction === 'up' : t.direction === 'down';
    if (t.direction === 'steady') continue;
    patterns.push({
      key: `trend-${t.metric}`, kind: 'trend', strength: 'moderate',
      title: `${t.label} has been ${t.direction === 'up' ? 'rising' : 'falling'}`,
      body: `${t.label} over the last fortnight is ${Math.abs(t.change)} ${t.metric === 'sleepHours' ? 'hours' : t.metric === 'activityMinutes' ? 'minutes a day' : 'points'} ${t.direction === 'up' ? 'higher' : 'lower'} than the weeks before.${worse ? ' Worth noticing before it becomes the new normal.' : ' Whatever you changed, it is working.'}`,
    });
  }

  // ------------------------------------------------------------------- risks
  const last14 = checkins.filter((c) => daysBetween(isoDay(c.day), to) <= 13);
  if (last14.length >= 7) {
    const low = last14.filter((c) => c.mood <= 2).length;
    if (low / last14.length >= 0.6) {
      risks.push({ key: 'low-mood-fortnight', kind: 'risk', title: 'Two weeks of low mood', body: `You logged low mood on ${low} of the last ${last14.length} days. Two weeks is the point at which doctors want to hear about it, because it is where support starts to help most. A GP visit is the usual first step; a mental health treatment plan brings a Medicare rebate to psychology sessions.`, source: { name: 'Beyond Blue', url: 'https://www.beyondblue.org.au' }, action: { label: 'Find a psychologist or GP', href: '/dashboard/wellness/practitioners?kind=PSYCHOLOGIST' }, crisis: true });
    }
    const anxious = last14.filter((c) => c.anxiety >= 4).length;
    if (anxious / last14.length >= 0.6) {
      risks.push({ key: 'high-anxiety-fortnight', kind: 'risk', title: 'Anxiety has been high for a fortnight', body: `Anxiety was 4 or 5 on ${anxious} of the last ${last14.length} days. Anxiety that stays is very treatable; MindSpot's free online course and a GP are both good first moves.`, source: src('mindspot'), action: { label: 'MindSpot, free and online', href: 'https://www.mindspot.org.au' } });
    }
    const stressed = last14.filter((c) => c.stress >= 4).length;
    if (stressed / last14.length >= 0.7 && (mean(last14.map((c) => c.energy)) ?? 5) <= 2.5) {
      risks.push({ key: 'burnout-signs', kind: 'risk', title: 'The shape of burnout', body: 'High stress and low energy together for two weeks is how burnout looks in the numbers. The mental load tracker can show what is filling the days; a conversation about what to put down usually matters more than another coping strategy.', action: { label: 'Open the mental load tracker', href: '/dashboard/wellness/mental-load' } });
    }
  }
  const sleep14 = sleep.filter((s) => daysBetween(isoDay(s.day), to) <= 13);
  if (sleep14.length >= 5) {
    const avg = mean(sleep14.map((s) => s.hours))!;
    if (avg < 6) risks.push({ key: 'short-sleep', kind: 'risk', title: `Averaging ${round1(avg)} hours of sleep`, body: 'Under six hours a night, sustained, affects mood, concentration and blood sugar. If it is because you cannot sleep rather than because you will not, insomnia is treated without medication and the treatment works.', source: src('insomnia-cbti') });
  }
  for (const f of cycle.flags) {
    risks.push({ key: `cycle-${f.key}`, kind: 'risk', title: f.title, body: f.body, source: src(f.key === 'painful' ? 'endometriosis' : 'cycle-basics'), action: { label: 'Find a GP or gynaecologist', href: '/dashboard/wellness/practitioners?kind=GP' } });
  }
  const weeksLogged = new Set(activity.map((a) => weekStart(isoDay(a.day)))).size;
  if (weeksLogged >= 2 && (averages.activityMinutesPerWeek ?? 0) < 150) {
    risks.push({ key: 'under-active', kind: 'risk', title: 'Under the movement guideline', body: `About ${averages.activityMinutesPerWeek} minutes a week against the 150 the guideline asks for. Walking counts, and the mood pattern above is the reason to bother.`, source: src('activity-guidelines') });
  }
  const severe = symptoms.filter((s) => s.severity >= 4);
  if (severe.length >= 3) {
    const names = Array.from(new Set(severe.map((s) => s.name))).slice(0, 3).join(', ');
    risks.push({ key: 'recurring-symptoms', kind: 'risk', title: 'Symptoms that keep coming back', body: `You logged ${names} at severity 4 or more ${severe.length} times. Take the report with you; a pattern on paper is taken more seriously than a memory.`, action: { label: 'The report for your doctor', href: '/dashboard/wellness/insights#report' } });
  }

  // ---------------------------------------------------------- recommendations
  const rec = (key: string, title: string, body: string, libKey: string, href?: string) => {
    const i = item(libKey);
    recommendations.push({ key, kind: 'recommendation', title, body, source: i ? { name: i.source, url: i.url } : undefined, action: href ? { label: 'Open', href } : i ? { label: i.title, href: i.url } : undefined });
  };
  if ((averages.sleepHours !== null && averages.sleepHours < 7) || (averages.sleepQuality !== null && averages.sleepQuality < 3)) rec('sleep', 'Start with sleep', 'Same wake time every day, morning light, screens off an hour before bed. Boring, and the most effective thing on this page.', 'sleep-hygiene');
  if ((averages.stress ?? 0) >= 3.5 || (averages.anxiety ?? 0) >= 3.5) rec('stress', 'Ten minutes a day for the mind', 'A daily mindfulness practice lowers stress and anxiety in trial after trial. Smiling Mind is free and Australian; the CCI workbooks go deeper.', 'smiling-mind');
  if (weeksLogged >= 2 && (averages.activityMinutesPerWeek ?? 0) < 150) rec('move', 'Walk five times this week', 'Thirty minutes, five days, reaches the guideline. Add it as a habit and the streak does the nagging.', 'activity-guidelines', '/dashboard/wellness/habits?template=walk-30');
  if (averages.glassesPerDay !== null && averages.glassesPerDay < 5) rec('water', 'A glass with every meal and every coffee', 'Eight glasses is about the adequate intake for women. The energy pattern above is the reason.', 'sleep-hygiene', '/dashboard/wellness/habits?template=water-8');
  if (cycle.flags.length > 0) rec('hormones', 'Read up before the appointment', 'Jean Hailes explains what a normal range is and what to ask. Take the cycle summary from the report with you.', 'cycle-basics');
  if (risks.some((r) => r.key === 'low-mood-fortnight')) rec('talk', 'Talk to someone this week', 'A GP can write a mental health treatment plan in one visit. If it feels like too much to arrange, Beyond Blue will talk it through first.', 'beyond-blue-anxiety', '/dashboard/wellness/practitioners?kind=GP');
  if (risks.some((r) => r.key === 'burnout-signs')) rec('load', 'Put something down', 'Log a week of the invisible work in the mental load tracker, then use the delegation script for the heaviest category.', 'cci-workbooks', '/dashboard/wellness/mental-load');
  if (recommendations.length === 0 && checkins.length >= 7) rec('keep-going', 'Keep logging', 'The patterns need a few weeks of days to show. Nothing here is flagging, which is worth knowing too.', 'beyond-blue-anxiety', '/dashboard/wellness/track');

  if (checkins.length < 7) notes.push('Patterns need at least a week of check-ins, and the cycle ones need two logged periods.');
  notes.push('Rule-based, from your own records, and explained. None of it is a diagnosis; a pattern is a prompt for a conversation with a professional.');

  return {
    window: { from, to, days },
    coverage: { checkinDays: checkins.length, sleepDays: sleep.length, activityDays: activityByDay.size, periodDays: periodDays.length, hydrationDays: hydration.length },
    averages, trends, patterns, risks, recommendations, cycle, notes,
  };
}

function r1(n: number | null): number | null {
  return n === null ? null : round1(n);
}

// ------------------------------------------------------------------- K10

export interface K10Result {
  score: number;
  band: 'low' | 'mild' | 'moderate' | 'severe';
  label: string;
  meaning: string;
  nextStep: string;
  crisisLines: typeof CRISIS_LINES;
  source: InsightSource;
}

/** The Kessler 10, scored the way the Australian Bureau of Statistics reports it. */
export function assessK10(answers: number[]): K10Result {
  if (answers.length !== K10_QUESTIONS.length || answers.some((a) => !Number.isInteger(a) || a < 1 || a > 5)) {
    throw new Error('Ten answers between 1 and 5 are needed');
  }
  const score = answers.reduce((a, b) => a + b, 0);
  const band: K10Result['band'] = score <= 15 ? 'low' : score <= 21 ? 'mild' : score <= 29 ? 'moderate' : 'severe';
  const labels = { low: 'Likely to be well', mild: 'Mild distress', moderate: 'Moderate distress', severe: 'High distress' };
  const meanings = {
    low: 'Your answers put you in the range most people without a mental health condition report. Keep the check-ins going; they will show a change early.',
    mild: 'Some distress over the last four weeks. Common, and it often passes; sleep, movement and talking to someone are the first things to try.',
    moderate: 'A level of distress where support makes a real difference. A GP can write a mental health treatment plan in one visit, which brings a Medicare rebate to psychology sessions.',
    severe: 'A high level of distress. Please talk to a GP this week, and if things feel unsafe at any point, the lines below are staffed now.',
  };
  const next = {
    low: 'Set a wellness goal or a habit and come back in a month.',
    mild: 'Try a coping strategy from the library, and log a check-in each day so you can see the direction.',
    moderate: 'Book a GP; ask for a mental health treatment plan. MindSpot and This Way Up are free while you wait.',
    severe: 'Call Beyond Blue on 1300 22 4636 or Lifeline on 13 11 14, and book a GP for this week.',
  };
  return { score, band, label: labels[band], meaning: meanings[band], nextStep: next[band], crisisLines: band === 'severe' || band === 'moderate' ? CRISIS_LINES.slice(0, 5) : CRISIS_LINES.slice(1, 4), source: { name: 'Australian Bureau of Statistics, Kessler Psychological Distress Scale', url: 'https://www.abs.gov.au/statistics/health/mental-health' } };
}

// ---------------------------------------------------------- doctor report

export interface DoctorReportInput extends InsightsInput {
  medications?: Array<{ name: string; dose?: string; times?: string[]; prescribedBy?: string; adherencePct?: number | null }>;
}

export interface DoctorReport {
  generatedAt: string;
  window: { from: string; to: string; days: number };
  checkins: { days: number; mood: number | null; stress: number | null; anxiety: number | null; energy: number | null; lowMoodDays: number };
  sleep: { nights: number; averageHours: number | null; shortNights: number; averageQuality: number | null };
  activity: { sessions: number; minutesPerWeek: number | null; types: Array<{ type: string; minutes: number }> };
  cycle: { periods: number; averageCycle: number | null; variability: number | null; averagePeriod: number | null; lastPeriodStart: string | null; flags: string[] };
  symptoms: Array<{ name: string; times: number; maxSeverity: number; lastDay: string }>;
  medications: DoctorReportInput['medications'];
  flags: string[];
  notes: string[];
}

export function buildDoctorReport(input: DoctorReportInput): DoctorReport {
  const insights = buildInsights(input);
  const { from, to } = insights.window;
  const inWindow = <T extends { day: string }>(rows: T[]) => rows.filter((r) => isoDay(r.day) >= from && isoDay(r.day) <= to);
  const checkins = inWindow(input.checkins);
  const sleep = inWindow(input.sleep);
  const activity = inWindow(input.activity);
  const symptoms = inWindow(input.symptoms ?? []);

  const types = new Map<string, number>();
  for (const a of activity) types.set(a.type, (types.get(a.type) ?? 0) + a.minutes);
  const symptomMap = new Map<string, { times: number; maxSeverity: number; lastDay: string }>();
  for (const s of symptoms) {
    const cur = symptomMap.get(s.name) ?? { times: 0, maxSeverity: 0, lastDay: '' };
    cur.times += 1; cur.maxSeverity = Math.max(cur.maxSeverity, s.severity); if (isoDay(s.day) > cur.lastDay) cur.lastDay = isoDay(s.day);
    symptomMap.set(s.name, cur);
  }

  return {
    generatedAt: new Date().toISOString(),
    window: insights.window,
    checkins: { days: checkins.length, mood: insights.averages.mood, stress: insights.averages.stress, anxiety: insights.averages.anxiety, energy: insights.averages.energy, lowMoodDays: checkins.filter((c) => c.mood <= 2).length },
    sleep: { nights: sleep.length, averageHours: insights.averages.sleepHours, shortNights: sleep.filter((s) => s.hours < 6).length, averageQuality: insights.averages.sleepQuality },
    activity: { sessions: activity.length, minutesPerWeek: insights.averages.activityMinutesPerWeek, types: Array.from(types.entries()).map(([type, minutes]) => ({ type, minutes })).sort((a, b) => b.minutes - a.minutes) },
    cycle: { periods: insights.cycle.periods.length, averageCycle: insights.cycle.stats.averageCycle, variability: insights.cycle.stats.variability, averagePeriod: insights.cycle.stats.averagePeriod, lastPeriodStart: insights.cycle.lastPeriodStart, flags: insights.cycle.flags.map((f) => f.title) },
    symptoms: Array.from(symptomMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.times - a.times),
    medications: input.medications ?? [],
    flags: insights.risks.map((r) => r.title),
    notes: ['Self-reported by the patient in the ATHENA app; scales run 1 (lowest) to 5 (highest). Generated for a consultation, not a clinical record.'],
  };
}

/** The entries as rows for a CSV a doctor or the member can open in a spreadsheet. */
export function entriesToCsv(rows: Array<{ kind: string; day: string; at: string; payload: Record<string, unknown> | null }>): string {
  const header = ['kind', 'day', 'at', 'field', 'value'];
  const lines = [header.join(',')];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) {
    const payload = r.payload ?? {};
    const keys = Object.keys(payload);
    if (keys.length === 0) lines.push([r.kind, r.day, r.at, '', ''].map(esc).join(','));
    for (const k of keys) lines.push([r.kind, r.day, r.at, k, payload[k]].map(esc).join(','));
  }
  return lines.join('\n');
}
