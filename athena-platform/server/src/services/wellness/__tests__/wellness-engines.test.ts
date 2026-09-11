import { describe, it, expect } from '@jest/globals';
import { addDays, daysBetween, localParts, weekStart, zonedToUtc, pearson } from '../wellness-dates';
import { encryptJson, decryptJson } from '../health-crypto';
import { cycleStats, groupPeriods, predictCycle } from '../cycle.service';
import { assessK10, buildDoctorReport, buildInsights, entriesToCsv, type CheckInLog, type SleepLog } from '../health-insights.service';
import { analyseMentalLoad } from '../mental-load.service';
import { challengeLeaderboard, goalProgress, goalReviewText, milestoneReached, streakFrom, weekProgress } from '../habits.service';
import { detectCrisisLanguage, normaliseWarning, presentAuthor } from '../forum.service';
import { availableSlots, canCancel, normaliseAvailability, recomputeRating } from '../practitioners.service';
import { checkInRemindersDue, circleCheckInsDue, currentWeek, dosesDue, goalReviewsDue, habitRemindersDue, refillsDue, visitFollowUps } from '../wellness-reminders.service';
import { CRISIS_LINES, FORUM_SEEDS, HABIT_TEMPLATES, LIBRARY, SERVICE_SEEDS } from '../wellness-library';

describe('days and zones', () => {
  it('does day arithmetic on ISO days and finds the Monday', () => {
    expect(addDays('2026-09-11', 3)).toBe('2026-09-14');
    expect(daysBetween('2026-09-01', '2026-09-11')).toBe(10);
    expect(weekStart('2026-09-11')).toBe('2026-09-07');
    expect(weekStart('2026-09-13')).toBe('2026-09-07');
  });

  it('reads the wall clock in a zone and turns it back into an instant', () => {
    const at = new Date('2026-09-11T00:30:00Z');
    const bris = localParts(at, 'Australia/Brisbane');
    expect(bris.day).toBe('2026-09-11');
    expect(bris.hour).toBe(10);
    expect(bris.minute).toBe(30);
    expect(zonedToUtc('2026-09-11', '10:30', 'Australia/Brisbane').toISOString()).toBe('2026-09-11T00:30:00.000Z');
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
  });
});

describe('health records at rest', () => {
  it('round-trips and refuses a tampered record', () => {
    const sealed = encryptJson({ mood: 4, note: 'fine' });
    expect(sealed).not.toContain('mood');
    expect(decryptJson(sealed)).toEqual({ mood: 4, note: 'fine' });
    expect(decryptJson(sealed.slice(0, -4) + 'AAAA')).toBeNull();
  });
});

describe('the cycle', () => {
  const period = (start: string, len = 5, flow = 'medium', pain = 2) => Array.from({ length: len }, (_, i) => ({ day: addDays(start, i), flow, pain }));

  it('groups logged days into periods and measures the cycles', () => {
    const days = [...period('2026-05-01'), ...period('2026-05-29'), ...period('2026-06-26'), ...period('2026-07-24')];
    const periods = groupPeriods(days);
    expect(periods).toHaveLength(4);
    expect(periods[0].length).toBe(5);
    const stats = cycleStats(periods);
    expect(stats.cyclesCounted).toBe(3);
    expect(stats.averageCycle).toBe(28);
    expect(stats.variability).toBe(0);
  });

  it('predicts the next period, the phase and the window from her own history', () => {
    const days = [...period('2026-05-01'), ...period('2026-05-29'), ...period('2026-06-26'), ...period('2026-07-24')];
    const p = predictCycle({ days, today: '2026-08-05' });
    expect(p.nextPeriod).toBe('2026-08-21');
    expect(p.dayOfCycle).toBe(13);
    expect(p.ovulation).toBe('2026-08-07');
    expect(p.fertileWindow).toEqual({ start: '2026-08-02', end: '2026-08-08' });
    expect(p.phase).toBe('fertile');
    expect(p.confidence).toBe('medium');
    expect(predictCycle({ days, today: '2026-07-26' }).phase).toBe('menstrual');
    expect(predictCycle({ days, today: '2026-08-15' }).phase).toBe('luteal');
    expect(predictCycle({ days, today: '2026-07-30' }).phase).toBe('follicular');
  });

  it('flags irregular, overdue and painful cycles, and uses the hint with no history', () => {
    const irregular = [...period('2026-03-01'), ...period('2026-03-24'), ...period('2026-05-02'), ...period('2026-05-27')];
    const p = predictCycle({ days: irregular, today: '2026-06-10' });
    expect(p.flags.map((f) => f.key)).toContain('irregular');
    const late = predictCycle({ days: [...period('2026-05-01'), ...period('2026-05-29')], today: '2026-07-10' });
    expect(late.daysOverdue).toBeGreaterThan(7);
    expect(late.flags.map((f) => f.key)).toContain('overdue');
    const painful = predictCycle({ days: [...period('2026-05-01', 5, 'heavy', 5), ...period('2026-05-29', 5, 'heavy', 4)], today: '2026-06-05' });
    expect(painful.flags.map((f) => f.key)).toEqual(expect.arrayContaining(['heavy', 'painful']));
    const none = predictCycle({ days: [], today: '2026-06-05', cycleLengthHint: 30 });
    expect(none.hasData).toBe(false);
    expect(none.cycleLength).toBe(30);
  });
});

describe('insights', () => {
  const today = '2026-09-11';
  const checkins: CheckInLog[] = [];
  const sleep: SleepLog[] = [];
  for (let i = 59; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const short = i % 3 === 0;
    sleep.push({ day, hours: short ? 5.5 : 7.5, quality: short ? 2 : 4 });
    checkins.push({ day, mood: short ? 2 : 4, stress: 3, anxiety: 3, energy: short ? 2 : 4 });
  }

  it('finds that sleep and mood move together, and averages the window', () => {
    const r = buildInsights({ today, days: 60, checkins, sleep, activity: [], hydration: [], periodDays: [] });
    expect(r.coverage.checkinDays).toBe(60);
    expect(r.patterns.map((p) => p.key)).toContain('sleep-mood');
    expect(r.averages.sleepHours).toBeCloseTo(6.83, 1);
    expect(r.recommendations.map((x) => x.key)).toContain('sleep');
  });

  it('sees anxiety rise before a period across two cycles', () => {
    const periodDays = [...[0, 1, 2, 3].map((i) => ({ day: addDays('2026-07-20', i), flow: 'medium' })), ...[0, 1, 2, 3].map((i) => ({ day: addDays('2026-08-17', i), flow: 'medium' })), ...[0, 1, 2].map((i) => ({ day: addDays('2026-09-14', i), flow: 'medium' }))];
    const cyc: CheckInLog[] = [];
    for (let i = 70; i >= 0; i -= 1) {
      const day = addDays(today, -i);
      const before = [1, 2, 3, 4, 5, 6, 7].some((k) => daysBetween(day, '2026-07-20') === k || daysBetween(day, '2026-08-17') === k || daysBetween(day, '2026-09-14') === k);
      cyc.push({ day, mood: 4, stress: 3, anxiety: before ? 5 : 2, energy: 3 });
    }
    const r = buildInsights({ today, days: 75, checkins: cyc, sleep: [], activity: [], hydration: [], periodDays });
    const pattern = r.patterns.find((p) => p.key === 'cycle-anxiety');
    expect(pattern).toBeDefined();
    expect(pattern!.body).toMatch(/before a period/);
  });

  it('raises two weeks of low mood as a risk with the crisis lines attached', () => {
    const low = Array.from({ length: 14 }, (_, i) => ({ day: addDays(today, -i), mood: 1, stress: 4, anxiety: 3, energy: 2 }));
    const r = buildInsights({ today, days: 30, checkins: low, sleep: [], activity: [], hydration: [], periodDays: [] });
    const risk = r.risks.find((x) => x.key === 'low-mood-fortnight');
    expect(risk?.crisis).toBe(true);
    expect(r.recommendations.map((x) => x.key)).toContain('talk');
    expect(r.risks.map((x) => x.key)).toContain('burnout-signs');
  });

  it('scores the K10 the way the ABS bands it and builds a report a doctor can read', () => {
    expect(assessK10(Array(10).fill(1)).band).toBe('low');
    expect(assessK10(Array(10).fill(2)).band).toBe('mild');
    expect(assessK10([3, 3, 3, 3, 3, 2, 2, 2, 2, 2]).band).toBe('moderate');
    expect(assessK10(Array(10).fill(4)).band).toBe('severe');
    expect(() => assessK10([1, 2])).toThrow();
    const report = buildDoctorReport({ today, days: 60, checkins, sleep, activity: [{ day: today, type: 'walk', minutes: 30 }], hydration: [], periodDays: [], symptoms: [{ day: today, name: 'Headache', severity: 4 }], medications: [{ name: 'Iron', dose: '1 tablet' }] });
    expect(report.sleep.shortNights).toBe(20);
    expect(report.symptoms[0].name).toBe('Headache');
    expect(report.medications).toHaveLength(1);
    const csv = entriesToCsv([{ kind: 'CHECKIN', day: today, at: `${today}T08:00:00Z`, payload: { mood: 4, note: 'ok, "fine"' } }]);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('"ok, ""fine"""');
  });
});

describe('the mental load', () => {
  const today = '2026-09-11';
  it('sums the invisible work, sees who carries it, and warns when it looks like burnout', () => {
    const entries = [];
    for (let i = 0; i < 28; i += 1) {
      const day = addDays(today, -i);
      entries.push({ day, category: 'PLANNING', task: 'Meals and the school calendar', minutes: 60, carriedBy: 'ME' as const });
      entries.push({ day, category: 'CHILDCARE', task: 'Bedtime', minutes: 60, carriedBy: 'SHARED' as const });
      entries.push({ day, category: 'ADMIN', task: 'Bills', minutes: 30, carriedBy: 'ME' as const });
      entries.push({ day, category: 'HOUSEHOLD', task: 'Cooking', minutes: 45, carriedBy: 'PARTNER' as const });
    }
    const a = analyseMentalLoad(entries, { today, weeks: 4, recentEnergy: [2, 2, 1, 2, 2, 3], recentStress: [4, 5, 4, 4, 5] });
    expect(a.totalHours).toBeGreaterThan(80);
    expect(a.myShare).toBeGreaterThan(50);
    expect(a.invisibleShare).toBeGreaterThan(40);
    expect(a.byCategory[0].category).toBe('PLANNING');
    expect(a.burnout.level).toBe('high');
    expect(a.delegation[0].ask).toContain('Meals and the school calendar');
    expect(a.conversationCard).toMatch(/hours/);
    expect(a.impactLabel).toBeDefined();
  });

  it('says so when nothing is logged', () => {
    const a = analyseMentalLoad([], { today });
    expect(a.totalHours).toBe(0);
    expect(a.burnout.level).toBe('ok');
    expect(a.conversationCard).toBe('');
  });
});

describe('habits and goals', () => {
  const today = '2026-09-11';

  it('counts a streak that ends today or yesterday, and the week against the target', () => {
    const days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'];
    const s = streakFrom(days, today);
    expect(s.current).toBe(4);
    expect(s.doneToday).toBe(false);
    expect(streakFrom([...days, today], today).current).toBe(5);
    expect(streakFrom(['2026-09-01', '2026-09-02'], today).current).toBe(0);
    expect(streakFrom(['2026-09-01', '2026-09-02'], today).longest).toBe(2);
    const w = weekProgress(days, today, 5);
    expect(w.weekStart).toBe('2026-09-07');
    expect(w.done).toBe(4);
    expect(w.met).toBe(false);
    expect(w.days.filter((d) => d.future)).toHaveLength(2);
  });

  it('knows which milestone was just crossed', () => {
    expect(milestoneReached(6, 7)).toBe(7);
    expect(milestoneReached(7, 8)).toBeNull();
    expect(milestoneReached(0, 3)).toBe(3);
    expect(milestoneReached(29, 31)).toBe(30);
  });

  it('reads a goal from the trackers and suggests the next height', () => {
    const sleep = Array.from({ length: 56 }, (_, i) => ({ day: addDays(today, -i), hours: i < 28 ? 7.5 : 6 }));
    const p = goalProgress({ metric: 'SLEEP_HOURS', target: 7, period: 'DAY', startedOn: addDays(today, -56) }, { sleep, activity: [], checkins: [], hydration: [] }, today);
    expect(p.current).toBe(7.5);
    expect(p.met).toBe(true);
    expect(p.history.length).toBeGreaterThanOrEqual(6);
    expect(goalReviewText(p, 8).verdict).toBe('raise');
    const sessions = goalProgress({ metric: 'ACTIVITY_SESSIONS', target: 3, period: 'WEEK', startedOn: addDays(today, -14) }, { sleep: [], activity: [{ day: today, type: 'walk', minutes: 30 }, { day: addDays(today, -1), type: 'run', minutes: 20 }], checkins: [], hydration: [] }, today);
    expect(sessions.current).toBe(2);
    expect(sessions.met).toBe(false);
    const never = goalProgress({ metric: 'ACTIVITY_SESSIONS', target: 5, period: 'WEEK', startedOn: addDays(today, -35) }, { sleep: [], activity: Array.from({ length: 5 }, (_, i) => ({ day: addDays(today, -7 * i - 1), type: 'walk', minutes: 30 })), checkins: [], hydration: [] }, today);
    expect(goalReviewText(never, 5).verdict).toBe('ease');
  });

  it('ranks a challenge by days done', () => {
    const board = challengeLeaderboard([
      { userId: 'a', name: 'Ada', doneDays: ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'] },
      { userId: 'b', name: 'Bea', doneDays: ['2026-09-08', '2026-09-10'], isYou: true },
    ], '2026-09-07', '2026-09-20', today);
    expect(board[0].name).toBe('Ada');
    expect(board[0].rank).toBe(1);
    expect(board[1].isYou).toBe(true);
    expect(board[0].possible).toBe(5);
  });
});

describe('the forums', () => {
  it('reaches for the lines when a post sounds like crisis, and stays quiet otherwise', () => {
    expect(detectCrisisLanguage('Some days I want to die and I cannot go on').flagged).toBe(true);
    expect(detectCrisisLanguage('I have been so tired lately and the anxiety is loud').flagged).toBe(false);
    expect(detectCrisisLanguage('thinking about self-harm again').matches).toContain('self-harm');
  });

  it('hides an anonymous author from everyone but herself', () => {
    const author = { id: 'u1', firstName: 'Mei', lastName: 'Lin', displayName: null, avatar: null };
    expect(presentAuthor(author, true, 'u2').name).toBe('A member');
    expect(presentAuthor(author, true, 'u1').name).toBe('You, anonymously');
    expect(presentAuthor(author, true, 'u2').id).toBeNull();
    expect(presentAuthor(author, false, 'u2').name).toBe('Mei Lin');
    expect(normaliseWarning('pregnancy loss')).toBe('Pregnancy loss');
    expect(normaliseWarning('')).toBeNull();
  });
});

describe('the practitioner directory', () => {
  it('offers only the free slots, not the past, and not the booked', () => {
    const now = new Date('2026-09-14T00:00:00Z'); // Monday 10:00 in Brisbane
    const slots = availableSlots({ availability: { '1': [['09:00', '12:00']] }, slotMinutes: 60, timezone: 'Australia/Brisbane', day: '2026-09-14', booked: [{ scheduledAt: '2026-09-14T01:00:00Z', durationMinutes: 60 }], now, leadMinutes: 0 });
    // 09:00 has passed, 11:00 (01:00Z) is booked, 10:00 is now (not strictly after), so only... 10:00 starts at now, allowed with lead 0.
    expect(slots.map((s) => s.label)).toEqual(['10:00']);
    expect(availableSlots({ availability: { '1': [['09:00', '12:00']] }, slotMinutes: 60, timezone: 'Australia/Brisbane', day: '2026-09-13', booked: [], now })).toEqual([]);
    expect(normaliseAvailability({ 1: [['09:00', '17:00'], ['18:00', '17:00']], 9: [['09:00', '10:00']] })).toEqual({ '1': [['09:00', '17:00']] });
    expect(recomputeRating([{ rating: 5 }, { rating: 4 }, { rating: 1, isHidden: true }])).toEqual({ ratingAvg: 4.5, ratingCount: 2 });
    expect(canCancel(new Date(Date.now() + 2 * 86400000))).toBe(true);
    expect(canCancel(new Date(Date.now() + 3600000))).toBe(false);
  });
});

describe('the reminders', () => {
  const now = new Date('2026-09-14T22:10:00Z'); // 08:10 Tuesday in Brisbane
  const med = { id: 'm1', userId: 'u1', timezone: 'Australia/Brisbane', times: ['08:30', '20:00'], daysOfWeek: [], startDate: '2026-09-01', isActive: true };

  it('reminds of a dose in the next hour unless it is logged', () => {
    expect(dosesDue([med], new Set(), now).map((r) => r.key)).toEqual(['m1:2026-09-15:08:30']);
    expect(dosesDue([med], new Set(['m1:2026-09-15:08:30']), now)).toHaveLength(0);
    expect(dosesDue([{ ...med, daysOfWeek: [1] }], new Set(), now)).toHaveLength(0);
    expect(dosesDue([med], new Set(), now)[0].message).not.toMatch(/Iron|medication name/);
  });

  it('flags a refill and the last repeat once a week', () => {
    const r = refillsDue([{ ...med, nextRefillDue: '2026-09-18' }, { ...med, id: 'm2', repeatsLeft: 1 }, { ...med, id: 'm3', repeatsLeft: 4, nextRefillDue: '2026-10-30' }], now);
    expect(r.map((x) => x.data?.medicationId)).toEqual(['m1', 'm2']);
    expect(r[0].key).toBe('m1:2026-09-14');
  });

  it('asks how the visit went the day after, once', () => {
    const r = visitFollowUps([
      { id: 'b1', userId: 'u1', scheduledAt: '2026-09-13T23:00:00Z', durationMinutes: 50, status: 'CONFIRMED' },
      { id: 'b2', userId: 'u1', scheduledAt: '2026-09-13T23:00:00Z', durationMinutes: 50, status: 'CONFIRMED', followUpCheckSentAt: new Date() },
      { id: 'b3', userId: 'u1', scheduledAt: '2026-09-14T21:00:00Z', durationMinutes: 50, status: 'CONFIRMED' },
    ], now);
    expect(r.map((x) => x.key)).toEqual(['b1']);
  });

  it('nudges circle members on meeting day for the week they have not checked in', () => {
    const circle = { id: 'c1', name: 'Burnout circle', startsOn: '2026-09-01', weeks: 8, meetingDay: 2, status: 'RUNNING', members: [{ userId: 'u1', timezone: 'Australia/Brisbane' }, { userId: 'u2', timezone: 'Australia/Brisbane' }], checkIns: [{ userId: 'u2', week: 2 }] };
    expect(currentWeek('2026-09-01', 8, '2026-09-15')).toBe(3);
    const r = circleCheckInsDue([circle], now);
    expect(r.map((x) => x.userId)).toEqual(['u1', 'u2']);
    expect(r[0].key).toBe('c1:u1:3');
    expect(circleCheckInsDue([{ ...circle, meetingDay: 4 }], now)).toHaveLength(0);
  });

  it('brings a goal review round, and the daily check-in and a habit at their hour', () => {
    expect(goalReviewsDue([{ id: 'g1', userId: 'u1', nextReviewOn: '2026-09-14', status: 'ACTIVE', metric: 'SLEEP_HOURS' }, { id: 'g2', userId: 'u1', nextReviewOn: '2026-10-01', status: 'ACTIVE', metric: 'STEPS' }], '2026-09-14').map((r) => r.key)).toEqual(['g1:2026-09-14']);
    expect(checkInRemindersDue([{ userId: 'u1', checkInReminderHour: 8, timezone: 'Australia/Brisbane' }, { userId: 'u2', checkInReminderHour: 20, timezone: 'Australia/Brisbane' }], new Set(), now).map((r) => r.userId)).toEqual(['u1']);
    expect(checkInRemindersDue([{ userId: 'u1', checkInReminderHour: 8, timezone: 'Australia/Brisbane' }], new Set(['u1:2026-09-15']), now)).toHaveLength(0);
    expect(habitRemindersDue([{ id: 'h1', userId: 'u1', name: 'Walk', reminderTime: '08:45', timezone: 'Australia/Brisbane', isArchived: false }], new Set(), now)).toHaveLength(1);
    expect(habitRemindersDue([{ id: 'h1', userId: 'u1', name: 'Walk', reminderTime: '12:00', timezone: 'Australia/Brisbane', isArchived: false }], new Set(), now)).toHaveLength(0);
  });
});

describe('the reference', () => {
  it('is real, Australian and complete', () => {
    expect(CRISIS_LINES.find((l) => l.name === 'Lifeline')?.phone).toBe('13 11 14');
    expect(FORUM_SEEDS).toHaveLength(8);
    expect(LIBRARY).toHaveLength(8);
    expect(LIBRARY.every((t) => t.items.every((i) => i.url.startsWith('https://') && i.source))).toBe(true);
    expect(HABIT_TEMPLATES.every((t) => t.evidenceUrl.startsWith('https://'))).toBe(true);
    expect(SERVICE_SEEDS.every((s) => s.kind === 'SERVICE' && s.website.startsWith('https://'))).toBe(true);
    expect(new Set(SERVICE_SEEDS.map((s) => s.slug)).size).toBe(SERVICE_SEEDS.length);
  });
});
