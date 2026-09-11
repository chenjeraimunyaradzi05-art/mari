/**
 * The wellness reminders: a dose due in the next hour that has not been
 * logged, a script running low, the "how did your visit go" the day after
 * an appointment, the weekly circle check-in on meeting day, a goal
 * review that has come round, the daily check-in at the hour a member
 * chose, and a habit at its reminder time.
 *
 * Every reminder is keyed so it is sent once however often the sweep runs,
 * and none of them names a medication or a condition: the notification
 * says a dose is due and the page says which. The sweep runs every half
 * hour in the API process, like the grant reminders.
 */

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { addDays, daysBetween, isoDay, localParts, minutesOf } from './wellness-dates';

const DAY = 86400000;

export interface Reminder {
  userId: string;
  kind: 'WELLNESS_DOSE' | 'WELLNESS_REFILL' | 'WELLNESS_VISIT' | 'WELLNESS_CIRCLE' | 'WELLNESS_GOAL_REVIEW' | 'WELLNESS_CHECKIN' | 'WELLNESS_HABIT';
  key: string;
  title: string;
  message: string;
  link: string;
  data?: Record<string, unknown>;
}

export interface MedicationLike {
  id: string;
  userId: string;
  timezone: string;
  times: string[];
  daysOfWeek: number[];
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  repeatsLeft?: number | null;
  nextRefillDue?: string | null;
}

/** Doses whose time falls in the next sixty minutes of the member's day and are not yet logged. */
export function dosesDue(meds: MedicationLike[], logged: Set<string>, now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const m of meds) {
    if (!m.isActive) continue;
    const local = localParts(now, m.timezone);
    if (local.day < isoDay(m.startDate)) continue;
    if (m.endDate && local.day > isoDay(m.endDate)) continue;
    if (m.daysOfWeek.length && !m.daysOfWeek.includes(local.weekday)) continue;
    const nowMin = local.hour * 60 + local.minute;
    for (const t of m.times) {
      const tMin = minutesOf(t);
      if (tMin < nowMin || tMin >= nowMin + 60) continue;
      const key = `${m.id}:${local.day}:${t}`;
      if (logged.has(key)) continue;
      out.push({ userId: m.userId, kind: 'WELLNESS_DOSE', key, title: 'A dose is due', message: `Your ${t} dose is coming up. Open medications to mark it taken.`, link: '/dashboard/wellness/medications', data: { medicationId: m.id, day: local.day, time: t } });
    }
  }
  return out;
}

/** A refill a week out, or a script down to its last repeat, once a week. */
export function refillsDue(meds: MedicationLike[], now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const m of meds) {
    if (!m.isActive) continue;
    const local = localParts(now, m.timezone);
    const dueSoon = m.nextRefillDue ? daysBetween(local.day, isoDay(m.nextRefillDue)) <= 7 : false;
    const lastRepeat = typeof m.repeatsLeft === 'number' && m.repeatsLeft <= 1;
    if (!dueSoon && !lastRepeat) continue;
    const week = addDays(local.day, -((new Date(local.day).getUTCDay() + 6) % 7));
    out.push({ userId: m.userId, kind: 'WELLNESS_REFILL', key: `${m.id}:${week}`, title: 'A script needs renewing', message: dueSoon ? 'A refill is due within the week. Reorder it, or book the GP if there are no repeats left.' : 'One of your medications is on its last repeat. Book the GP before it runs out.', link: '/dashboard/wellness/medications', data: { medicationId: m.id } });
  }
  return out;
}

export interface BookingLike {
  id: string;
  userId: string;
  scheduledAt: Date | string;
  durationMinutes: number;
  status: string;
  followUpCheckSentAt?: Date | string | null;
}

/** The day after a visit: how did it go, and the review that only a real visit can leave. */
export function visitFollowUps(bookings: BookingLike[], now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const b of bookings) {
    if (b.followUpCheckSentAt) continue;
    const end = new Date(b.scheduledAt).getTime() + b.durationMinutes * 60000;
    const done = b.status === 'COMPLETED' || (b.status === 'CONFIRMED' && end < now.getTime());
    if (!done) continue;
    if (now.getTime() - end < 3 * 3600000) continue;
    if (now.getTime() - end > 7 * DAY) continue;
    out.push({ userId: b.userId, kind: 'WELLNESS_VISIT', key: b.id, title: 'How did your visit go?', message: 'Log how you are feeling, keep a note of what was said, and leave a rating for the next woman looking.', link: `/dashboard/wellness/bookings?visit=${b.id}`, data: { bookingId: b.id } });
  }
  return out;
}

export interface CircleLike {
  id: string;
  name: string;
  startsOn: string;
  weeks: number;
  meetingDay: number;
  status: string;
  members: Array<{ userId: string; leftAt?: Date | string | null; timezone?: string }>;
  checkIns: Array<{ userId: string; week: number }>;
}

export function currentWeek(startsOn: string, weeks: number, today: string): number | null {
  const d = daysBetween(isoDay(startsOn), isoDay(today));
  if (d < 0) return null;
  const w = Math.floor(d / 7) + 1;
  return w > weeks ? null : w;
}

/** On meeting day, every member who has not checked in for the week. */
export function circleCheckInsDue(circles: CircleLike[], now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const c of circles) {
    if (c.status !== 'RUNNING' && c.status !== 'OPEN') continue;
    for (const m of c.members) {
      if (m.leftAt) continue;
      const local = localParts(now, m.timezone || 'Australia/Sydney');
      if (local.weekday !== c.meetingDay) continue;
      const week = currentWeek(c.startsOn, c.weeks, local.day);
      if (!week) continue;
      if (c.checkIns.some((ci) => ci.userId === m.userId && ci.week === week)) continue;
      out.push({ userId: m.userId, kind: 'WELLNESS_CIRCLE', key: `${c.id}:${m.userId}:${week}`, title: `${c.name}: week ${week} check-in`, message: 'It is circle day. Share a win, a blocker and the next step before you meet.', link: `/dashboard/wellness/circles/${c.id}`, data: { circleId: c.id, week } });
    }
  }
  return out;
}

export interface GoalLikeForReview { id: string; userId: string; nextReviewOn: string; status: string; label?: string | null; metric: string }

export function goalReviewsDue(goals: GoalLikeForReview[], today: string): Reminder[] {
  return goals.filter((g) => g.status === 'ACTIVE' && isoDay(g.nextReviewOn) <= isoDay(today)).map((g) => ({
    userId: g.userId, kind: 'WELLNESS_GOAL_REVIEW' as const, key: `${g.id}:${isoDay(g.nextReviewOn)}`, title: 'Time to review a goal',
    message: `${g.label || g.metric.toLowerCase().replace(/_/g, ' ')}: see how the last month went and keep, raise or ease it.`, link: '/dashboard/wellness/habits#goals', data: { goalId: g.id },
  }));
}

export interface CheckInSettingLike { userId: string; checkInReminderHour: number | null; timezone: string }

export function checkInRemindersDue(settings: CheckInSettingLike[], loggedToday: Set<string>, now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const s of settings) {
    if (s.checkInReminderHour === null || s.checkInReminderHour === undefined) continue;
    const local = localParts(now, s.timezone);
    if (local.hour !== s.checkInReminderHour) continue;
    if (loggedToday.has(`${s.userId}:${local.day}`)) continue;
    out.push({ userId: s.userId, kind: 'WELLNESS_CHECKIN', key: `${s.userId}:${local.day}`, title: 'A minute for yourself', message: 'Mood, stress, energy. Four taps, and the patterns keep building.', link: '/dashboard/wellness/track', data: { day: local.day } });
  }
  return out;
}

export interface HabitLike { id: string; userId: string; name: string; reminderTime: string | null; timezone: string; isArchived: boolean }

export function habitRemindersDue(habits: HabitLike[], loggedToday: Set<string>, now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const h of habits) {
    if (h.isArchived || !h.reminderTime) continue;
    const local = localParts(now, h.timezone);
    const tMin = minutesOf(h.reminderTime);
    const nowMin = local.hour * 60 + local.minute;
    if (tMin < nowMin || tMin >= nowMin + 60) continue;
    if (loggedToday.has(`${h.id}:${local.day}`)) continue;
    out.push({ userId: h.userId, kind: 'WELLNESS_HABIT', key: `${h.id}:${local.day}`, title: h.name, message: 'Your habit is due about now. Tick it off when it is done.', link: '/dashboard/wellness/habits', data: { habitId: h.id, day: local.day } });
  }
  return out;
}

// ------------------------------------------------------------------ the sweep

export async function runWellnessSweep(now = new Date()): Promise<{ due: number; sent: number }> {
  const today = isoDay(now);
  const since = new Date(now.getTime() - 9 * DAY);

  const [meds, doseEntries, bookings, circles, goals, settings, checkinsToday, habits, habitLogsToday] = await Promise.all([
    prisma.medication.findMany({ where: { isActive: true }, select: { id: true, userId: true, times: true, daysOfWeek: true, startDate: true, endDate: true, isActive: true, repeatsLeft: true, nextRefillDue: true, user: { select: { timezone: true } } } }),
    prisma.healthEntry.findMany({ where: { kind: 'MEDICATION_DOSE', day: { gte: new Date(now.getTime() - 2 * DAY) } }, select: { refId: true, day: true, payload: true } }),
    prisma.healthBooking.findMany({ where: { status: { in: ['CONFIRMED', 'COMPLETED'] }, followUpCheckSentAt: null, scheduledAt: { gte: new Date(now.getTime() - 8 * DAY), lte: now } }, select: { id: true, userId: true, scheduledAt: true, durationMinutes: true, status: true, followUpCheckSentAt: true } }),
    prisma.wellnessCircle.findMany({ where: { status: { in: ['OPEN', 'RUNNING'] }, startsOn: { lte: now } }, select: { id: true, name: true, startsOn: true, weeks: true, meetingDay: true, status: true, members: { where: { leftAt: null }, select: { userId: true, leftAt: true, user: { select: { timezone: true } } } }, checkIns: { select: { userId: true, week: true } } } }),
    prisma.wellnessGoal.findMany({ where: { status: 'ACTIVE', nextReviewOn: { lte: now } }, select: { id: true, userId: true, nextReviewOn: true, status: true, label: true, metric: true } }),
    prisma.healthSettings.findMany({ where: { checkInReminderHour: { not: null } }, select: { userId: true, checkInReminderHour: true, user: { select: { timezone: true } } } }),
    prisma.healthEntry.findMany({ where: { kind: 'CHECKIN', day: { gte: new Date(now.getTime() - 2 * DAY) } }, select: { userId: true, day: true } }),
    prisma.habit.findMany({ where: { isArchived: false, reminderTime: { not: null } }, select: { id: true, userId: true, name: true, reminderTime: true, isArchived: true, user: { select: { timezone: true } } } }),
    prisma.habitLog.findMany({ where: { done: true, day: { gte: new Date(now.getTime() - 2 * DAY) } }, select: { habitId: true, day: true } }),
  ]);

  // Dose logs are encrypted; the key needs the time, which is in the payload.
  const { decryptJson } = await import('./health-crypto');
  const logged = new Set<string>();
  for (const e of doseEntries) {
    const p = decryptJson<{ time?: string }>(e.payload);
    if (e.refId && p?.time) logged.add(`${e.refId}:${isoDay(e.day)}:${p.time}`);
  }

  const due: Reminder[] = [
    ...dosesDue(meds.map((m) => ({ ...m, timezone: m.user.timezone, startDate: isoDay(m.startDate), endDate: m.endDate ? isoDay(m.endDate) : null, nextRefillDue: m.nextRefillDue ? isoDay(m.nextRefillDue) : null })), logged, now),
    ...refillsDue(meds.map((m) => ({ ...m, timezone: m.user.timezone, startDate: isoDay(m.startDate), endDate: m.endDate ? isoDay(m.endDate) : null, nextRefillDue: m.nextRefillDue ? isoDay(m.nextRefillDue) : null })), now),
    ...visitFollowUps(bookings, now),
    ...circleCheckInsDue(circles.map((c) => ({ ...c, startsOn: isoDay(c.startsOn), members: c.members.map((m) => ({ userId: m.userId, leftAt: m.leftAt, timezone: m.user.timezone })) })), now),
    ...goalReviewsDue(goals.map((g) => ({ ...g, nextReviewOn: isoDay(g.nextReviewOn) })), today),
    ...checkInRemindersDue(settings.map((s) => ({ userId: s.userId, checkInReminderHour: s.checkInReminderHour, timezone: s.user.timezone })), new Set(checkinsToday.map((c) => `${c.userId}:${isoDay(c.day)}`)), now),
    ...habitRemindersDue(habits.map((h) => ({ ...h, timezone: h.user.timezone })), new Set(habitLogsToday.map((l) => `${l.habitId}:${isoDay(l.day)}`)), now),
  ];
  if (due.length === 0) return { due: 0, sent: 0 };

  const recent = await prisma.notification.findMany({
    where: { type: 'SYSTEM', createdAt: { gte: since }, data: { path: ['kind'], string_starts_with: 'WELLNESS_' } },
    select: { data: true },
  });
  const already = new Set(recent.map((n) => { const d = n.data as { kind?: string; key?: string } | null; return `${d?.kind}:${d?.key}`; }));

  let sent = 0;
  for (const r of due) {
    if (already.has(`${r.kind}:${r.key}`)) continue;
    await prisma.notification.create({ data: { userId: r.userId, type: 'SYSTEM', title: r.title, message: r.message, link: r.link, data: { kind: r.kind, key: r.key, ...(r.data ?? {}) } } });
    if (r.kind === 'WELLNESS_VISIT') await prisma.healthBooking.update({ where: { id: r.key }, data: { followUpCheckSentAt: now, ...(bookings.find((b) => b.id === r.key)?.status === 'CONFIRMED' ? { status: 'COMPLETED' } : {}) } });
    if (r.kind === 'WELLNESS_GOAL_REVIEW') {
      const g = goals.find((x) => x.id === (r.data as { goalId: string }).goalId);
      if (g) await prisma.wellnessGoal.update({ where: { id: g.id }, data: { nextReviewOn: new Date(`${addDays(today, 28)}T00:00:00.000Z`) } });
    }
    sent += 1;
  }
  return { due: due.length, sent };
}

let timer: NodeJS.Timeout | null = null;

export function startWellnessSweeper(intervalMs = 30 * 60 * 1000): void {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = () => runWellnessSweep().then((r) => { if (r.sent > 0) logger.info('Wellness reminders sent', r); }).catch((err) => logger.warn('Wellness reminder sweep failed', { error: (err as Error).message }));
  setTimeout(run, 90_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopWellnessSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
