/**
 * The wellness routes: the health trackers and what they reveal, the
 * medications and the notes, the share link for a doctor, the mental load
 * tracker, the moderated forums, the support circles, the practitioner
 * directory with bookings and verified reviews, and the habits, challenges
 * and goals.
 *
 * Health records are encrypted at rest and decrypted only for the member
 * (and, for a booking's reason and a share link, the practitioner she
 * chose). The reference, the library and the K10 are open so the public
 * page can show them; everything else is hers and needs a session.
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { logger } from '../utils/logger';
import { awardAchievement, getUserAchievements } from '../services/engagement.service';
import { encryptJson, decryptJson } from '../services/wellness/health-crypto';
import { buildBookingIcs, buildCircleIcs } from '../services/wellness/wellness-calendar';
import { addDays, dayDate, daysBetween, isoDay, localParts, weekStart } from '../services/wellness/wellness-dates';
import { predictCycle, type PeriodDayLike } from '../services/wellness/cycle.service';
import { assessK10, buildDoctorReport, buildInsights, entriesToCsv, type ActivityLog, type CheckInLog, type HydrationLog, type SleepLog, type SymptomLog } from '../services/wellness/health-insights.service';
import { analyseMentalLoad } from '../services/wellness/mental-load.service';
import { achievementForStreak, celebrate, challengeLeaderboard, goalProgress, goalReviewText, milestoneReached, streakFrom, templateByKey, weekProgress, type GoalData } from '../services/wellness/habits.service';
import { detectCrisisLanguage, excerpt, isModeratorRole, normaliseWarning, presentAuthor } from '../services/wellness/forum.service';
import { availableSlots, canCancel, nextAvailableDays, normaliseAvailability, recomputeRating, slugify, type Availability } from '../services/wellness/practitioners.service';
import { currentWeek } from '../services/wellness/wellness-reminders.service';
import {
  ACTIVITY_TYPES, CIRCLE_TOPICS, CONTENT_WARNINGS, COPING_STRATEGIES, CRISIS_LINES, HABIT_TEMPLATES, K10_OPTIONS, K10_QUESTIONS, LIBRARY, LIBRARY_AS_AT,
  MENTAL_LOAD_CATEGORIES, MODALITIES, PERIOD_SYMPTOMS, PRACTITIONER_KINDS, SHARE_SCOPES, SPECIALTIES, DELEGATION_TEMPLATES,
} from '../services/wellness/wellness-library';

const router = Router();

// ------------------------------------------------------------------ helpers

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
  }
  return parsed.data;
}

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });

/** Where the web app lives, for links written into files that leave the app. */
const clientBase = () => (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a day as YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'a time as HH:MM');
const scale = z.coerce.number().int().min(1).max(5);
const uuid = z.string().uuid();

async function memberTimezone(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return u?.timezone || 'Australia/Sydney';
}

/** The member's day: what the client sent, or today in her timezone. */
async function memberDay(req: AuthRequest): Promise<string> {
  const q = typeof req.query.today === 'string' ? req.query.today : typeof req.query.day === 'string' ? req.query.day : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return localParts(new Date(), await memberTimezone(req.user!.id)).day;
}

const DEFAULT_TRACKERS = { checkin: true, sleep: true, cycle: true, activity: true, nutrition: false, hydration: true, medications: true };

async function getSettings(userId: string) {
  const existing = await prisma.healthSettings.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.healthSettings.create({ data: { userId, trackers: DEFAULT_TRACKERS } });
}

type Kind = 'CHECKIN' | 'SLEEP' | 'ACTIVITY' | 'NUTRITION' | 'HYDRATION' | 'PERIOD' | 'SYMPTOM' | 'MEDICATION_DOSE';
const KINDS: Kind[] = ['CHECKIN', 'SLEEP', 'ACTIVITY', 'NUTRITION', 'HYDRATION', 'PERIOD', 'SYMPTOM', 'MEDICATION_DOSE'];
const DAILY_KINDS = new Set<Kind>(['CHECKIN', 'SLEEP', 'HYDRATION', 'PERIOD']);
const TRACKER_FOR: Record<Kind, keyof typeof DEFAULT_TRACKERS | null> = { CHECKIN: 'checkin', SLEEP: 'sleep', ACTIVITY: 'activity', NUTRITION: 'nutrition', HYDRATION: 'hydration', PERIOD: 'cycle', SYMPTOM: null, MEDICATION_DOSE: 'medications' };

/** Where a record came from when it was not typed in: apple-health, google-fit, athena-csv. Imports replace their own earlier rows by it. */
const source = z.string().max(30).optional();

const PAYLOADS: Record<Kind, z.ZodTypeAny> = {
  CHECKIN: z.object({ mood: scale, stress: scale, anxiety: scale, energy: scale, note: z.string().max(500).optional(), tags: z.array(z.string().max(30)).max(10).optional(), source }),
  SLEEP: z.object({ hours: z.coerce.number().min(0).max(24), quality: scale.optional(), bedtime: hhmm.optional(), wakeTime: hhmm.optional(), note: z.string().max(300).optional(), source }),
  // A day's step count from a phone is movement without a session, so minutes may be zero when steps are given.
  ACTIVITY: z.object({ type: z.string().min(1).max(30), minutes: z.coerce.number().int().min(0).max(600), intensity: z.enum(['light', 'moderate', 'vigorous']).optional(), steps: z.coerce.number().int().min(0).max(100000).optional(), note: z.string().max(300).optional(), source })
    .refine((a) => a.minutes >= 1 || (a.steps ?? 0) >= 1, { message: 'minutes: at least a minute, or a step count', path: ['minutes'] }),
  NUTRITION: z.object({ meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), description: z.string().max(200).optional(), calories: z.coerce.number().min(0).max(5000).optional(), protein: z.coerce.number().min(0).max(500).optional(), carbs: z.coerce.number().min(0).max(1000).optional(), fat: z.coerce.number().min(0).max(500).optional(), vegServes: z.coerce.number().min(0).max(20).optional(), source }),
  HYDRATION: z.object({ glasses: z.coerce.number().min(0).max(30), source }),
  PERIOD: z.object({ flow: z.enum(['spotting', 'light', 'medium', 'heavy']), pain: z.coerce.number().int().min(0).max(5).optional(), symptoms: z.array(z.string().max(30)).max(12).optional(), note: z.string().max(300).optional(), source }),
  SYMPTOM: z.object({ name: z.string().min(1).max(60), severity: scale, note: z.string().max(300).optional(), bookingId: uuid.optional(), source }),
  MEDICATION_DOSE: z.object({ medicationId: uuid, time: hhmm, status: z.enum(['taken', 'skipped']) }),
};

interface Entry { id: string; kind: Kind; day: string; at: string; refId: string | null; payload: Record<string, unknown> | null }

function present(e: { id: string; kind: string; day: Date; at: Date; refId: string | null; payload: string }): Entry {
  return { id: e.id, kind: e.kind as Kind, day: isoDay(e.day), at: e.at.toISOString(), refId: e.refId, payload: decryptJson(e.payload) };
}

async function loadEntries(userId: string, kinds: Kind[], from: string, to: string): Promise<Entry[]> {
  const rows = await prisma.healthEntry.findMany({ where: { userId, kind: { in: kinds }, day: { gte: dayDate(from), lte: dayDate(to) } }, orderBy: [{ day: 'asc' }, { at: 'asc' }] });
  return rows.map(present);
}

const pick = <T>(entries: Entry[], kind: Kind, map: (e: Entry) => T | null): T[] => entries.filter((e) => e.kind === kind && e.payload).map(map).filter((x): x is T => x !== null);
const toCheckins = (entries: Entry[]): CheckInLog[] => pick(entries, 'CHECKIN', (e) => ({ day: e.day, mood: Number(e.payload!.mood), stress: Number(e.payload!.stress), anxiety: Number(e.payload!.anxiety), energy: Number(e.payload!.energy) }));
const toSleep = (entries: Entry[]): SleepLog[] => pick(entries, 'SLEEP', (e) => ({ day: e.day, hours: Number(e.payload!.hours), quality: e.payload!.quality ? Number(e.payload!.quality) : undefined }));
const toActivity = (entries: Entry[]): ActivityLog[] => pick(entries, 'ACTIVITY', (e) => ({ day: e.day, type: String(e.payload!.type), minutes: Number(e.payload!.minutes), intensity: e.payload!.intensity as string | undefined, steps: e.payload!.steps ? Number(e.payload!.steps) : undefined }));
const toHydration = (entries: Entry[]): HydrationLog[] => pick(entries, 'HYDRATION', (e) => ({ day: e.day, glasses: Number(e.payload!.glasses) }));
const toPeriod = (entries: Entry[]): PeriodDayLike[] => pick(entries, 'PERIOD', (e) => ({ day: e.day, flow: e.payload!.flow as string, pain: e.payload!.pain ? Number(e.payload!.pain) : 0, symptoms: (e.payload!.symptoms as string[]) ?? [] }));
const toSymptoms = (entries: Entry[]): SymptomLog[] => pick(entries, 'SYMPTOM', (e) => ({ day: e.day, name: String(e.payload!.name), severity: Number(e.payload!.severity), note: e.payload!.note as string | undefined }));

async function insightsInput(userId: string, today: string, days: number) {
  const settings = await getSettings(userId);
  const from = addDays(today, -(days - 1));
  const entries = await loadEntries(userId, ['CHECKIN', 'SLEEP', 'ACTIVITY', 'HYDRATION', 'SYMPTOM'], from, today);
  const periodEntries = await loadEntries(userId, ['PERIOD'], addDays(today, -400), today);
  return {
    today, days, checkins: toCheckins(entries), sleep: toSleep(entries), activity: toActivity(entries), hydration: toHydration(entries), symptoms: toSymptoms(entries), periodDays: toPeriod(periodEntries),
    cycleLengthHint: settings.cycleLengthHint, periodLengthHint: settings.periodLengthHint, settings,
  };
}

async function medicationsFor(userId: string, activeOnly = true) {
  const meds = await prisma.medication.findMany({ where: { userId, ...(activeOnly ? { isActive: true } : {}) }, orderBy: { createdAt: 'asc' } });
  return meds.map((m) => ({ ...m, startDate: isoDay(m.startDate), endDate: m.endDate ? isoDay(m.endDate) : null, nextRefillDue: m.nextRefillDue ? isoDay(m.nextRefillDue) : null, details: decryptJson<{ name?: string; dose?: string; instructions?: string; prescribedBy?: string; pharmacy?: string; notes?: string }>(m.details) ?? { name: 'Unreadable' } }));
}

async function checkinStreakAward(userId: string, today: string) {
  const rows = await prisma.healthEntry.findMany({ where: { userId, kind: 'CHECKIN', day: { gte: dayDate(addDays(today, -60)) } }, select: { day: true } });
  const streak = streakFrom(rows.map((r) => isoDay(r.day)), today);
  await awardAchievement(userId, 'FIRST_CHECKIN').catch(() => false);
  if (streak.current >= 7) await awardAchievement(userId, 'CHECKIN_STREAK_7').catch(() => false);
  if (streak.current >= 30) await awardAchievement(userId, 'CHECKIN_STREAK_30').catch(() => false);
  return streak;
}

const AUTHOR_SELECT = { id: true, firstName: true, lastName: true, displayName: true, avatar: true, role: true, practitionerProfile: { select: { isVerified: true, kind: true } } } as const;

// ---------------------------------------------------------------- reference

router.get('/reference', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, {
      asAt: LIBRARY_AS_AT, kinds: KINDS, trackers: Object.keys(DEFAULT_TRACKERS), activityTypes: ACTIVITY_TYPES, periodSymptoms: PERIOD_SYMPTOMS,
      k10: { questions: K10_QUESTIONS, options: K10_OPTIONS }, mentalLoadCategories: MENTAL_LOAD_CATEGORIES, contentWarnings: CONTENT_WARNINGS, circleTopics: CIRCLE_TOPICS,
      habitTemplates: HABIT_TEMPLATES, practitionerKinds: PRACTITIONER_KINDS, modalities: MODALITIES, specialties: SPECIALTIES, shareScopes: SHARE_SCOPES, crisisLines: CRISIS_LINES,
    });
  } catch (error) { next(error); }
});

router.get('/library', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const articles = await prisma.article.findMany({ where: { status: 'PUBLISHED', tags: { has: 'wellness' } }, orderBy: { publishedAt: 'desc' }, take: 6, select: { slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true } }).catch(() => []);
    ok(res, { asAt: LIBRARY_AS_AT, topics: LIBRARY, strategies: COPING_STRATEGIES, crisisLines: CRISIS_LINES, articles });
  } catch (error) { next(error); }
});

router.post('/k10', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { answers } = parse(z.object({ answers: z.array(z.coerce.number().int().min(1).max(5)).length(10) }), req.body);
    ok(res, assessK10(answers));
  } catch (error) { next(error); }
});

// ----------------------------------------------------------------- settings

router.get('/settings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { ok(res, await getSettings(req.user!.id)); } catch (error) { next(error); }
});

const settingsSchema = z.object({
  trackers: z.record(z.boolean()).optional(),
  cycleLengthHint: z.coerce.number().int().min(15).max(90).nullable().optional(),
  periodLengthHint: z.coerce.number().int().min(1).max(14).nullable().optional(),
  hiddenWarnings: z.array(z.string().max(40)).max(20).optional(),
  anonymousByDefault: z.boolean().optional(),
  checkInReminderHour: z.coerce.number().int().min(0).max(23).nullable().optional(),
  shareWithPractitioners: z.boolean().optional(),
});

router.put('/settings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(settingsSchema, req.body);
    const current = await getSettings(req.user!.id);
    const trackers = { ...(current.trackers as Record<string, boolean>), ...(data.trackers ?? {}) };
    const updated = await prisma.healthSettings.update({ where: { userId: req.user!.id }, data: { ...data, trackers } });
    ok(res, updated);
  } catch (error) { next(error); }
});

router.delete('/data', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const [entries, meds, notes, shares, load, habits, goals] = await prisma.$transaction([
      prisma.healthEntry.deleteMany({ where: { userId } }),
      prisma.medication.deleteMany({ where: { userId } }),
      prisma.healthNote.deleteMany({ where: { userId } }),
      prisma.healthShare.deleteMany({ where: { userId } }),
      prisma.mentalLoadEntry.deleteMany({ where: { userId } }),
      prisma.habit.deleteMany({ where: { userId } }),
      prisma.wellnessGoal.deleteMany({ where: { userId } }),
      prisma.healthSettings.deleteMany({ where: { userId } }),
    ]);
    logger.info('Wellness data deleted at the member\'s request', { userId });
    ok(res, { entries: entries.count, medications: meds.count, notes: notes.count, shares: shares.count, mentalLoad: load.count, habits: habits.count, goals: goals.count });
  } catch (error) { next(error); }
});

// ------------------------------------------------------------------ entries

const entrySchema = z.object({ kind: z.enum(KINDS as [Kind, ...Kind[]]), day: isoDaySchema.optional(), at: z.string().datetime().optional(), payload: z.record(z.unknown()), add: z.boolean().optional() });

async function saveEntry(userId: string, input: z.infer<typeof entrySchema>, fallbackDay: string, trackers: Record<string, boolean>) {
  const tracker = TRACKER_FOR[input.kind];
  if (tracker && trackers[tracker] === false) throw new ApiError(400, 'That tracker is switched off in your wellness settings');
  const payload = parse(PAYLOADS[input.kind], input.payload) as Record<string, unknown>;
  const day = input.day ?? fallbackDay;
  if (daysBetween(day, fallbackDay) < 0 && input.kind !== 'MEDICATION_DOSE') throw new ApiError(400, 'That day has not happened yet');
  let refId: string | null = null;
  if (input.kind === 'MEDICATION_DOSE') {
    const med = await prisma.medication.findFirst({ where: { id: String(payload.medicationId), userId }, select: { id: true } });
    if (!med) throw new ApiError(404, 'Medication not found');
    refId = med.id;
    const existing = await prisma.healthEntry.findMany({ where: { userId, kind: 'MEDICATION_DOSE', refId, day: dayDate(day) } });
    const same = existing.find((e) => decryptJson<{ time?: string }>(e.payload)?.time === payload.time);
    if (same) return present(await prisma.healthEntry.update({ where: { id: same.id }, data: { payload: encryptJson(payload), at: new Date() } }));
  }
  if (input.kind === 'SYMPTOM' && payload.bookingId) {
    const booking = await prisma.healthBooking.findFirst({ where: { id: String(payload.bookingId), userId }, select: { id: true } });
    if (!booking) throw new ApiError(404, 'Booking not found');
    refId = booking.id;
  }
  if (DAILY_KINDS.has(input.kind)) {
    const existing = await prisma.healthEntry.findFirst({ where: { userId, kind: input.kind, day: dayDate(day) } });
    if (existing) {
      let next = payload;
      if (input.kind === 'HYDRATION' && input.add) {
        const prev = decryptJson<{ glasses?: number }>(existing.payload);
        next = { glasses: Math.min(30, Number(prev?.glasses ?? 0) + Number(payload.glasses)) };
      }
      return present(await prisma.healthEntry.update({ where: { id: existing.id }, data: { payload: encryptJson(next), at: input.at ? new Date(input.at) : new Date() } }));
    }
  }
  return present(await prisma.healthEntry.create({ data: { userId, kind: input.kind, day: dayDate(day), at: input.at ? new Date(input.at) : new Date(), payload: encryptJson(payload), refId } }));
}

router.get('/entries', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({ kind: z.string().optional(), from: isoDaySchema.optional(), to: isoDaySchema.optional(), today: isoDaySchema.optional() }), req.query);
    const today = await memberDay(req);
    const to = q.to ?? today;
    const from = q.from ?? addDays(to, -29);
    if (daysBetween(from, to) > 366 || daysBetween(from, to) < 0) throw new ApiError(400, 'The range has to be up to a year, oldest first');
    const kinds = q.kind ? (q.kind.split(',').filter((k): k is Kind => KINDS.includes(k as Kind))) : KINDS;
    ok(res, { from, to, entries: await loadEntries(req.user!.id, kinds, from, to) });
  } catch (error) { next(error); }
});

router.post('/entries', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(entrySchema, req.body);
    const today = await memberDay(req);
    const settings = await getSettings(req.user!.id);
    const entry = await saveEntry(req.user!.id, input, today, settings.trackers as Record<string, boolean>);
    const streak = input.kind === 'CHECKIN' ? await checkinStreakAward(req.user!.id, today) : null;
    ok(res, { entry, streak }, 201);
  } catch (error) { next(error); }
});

/**
 * A batch from an Apple Health or Google Fit export, or the app's own CSV.
 * Records that carry a source replace the earlier rows from that same source
 * on the same day, so a file imported twice leaves one copy, not two. The
 * daily kinds (a check-in, a night's sleep, water, a period day) replace
 * themselves regardless.
 */
router.post('/entries/import', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { entries } = parse(z.object({ entries: z.array(entrySchema.omit({ add: true })).min(1).max(500) }), req.body);
    const today = await memberDay(req);
    const settings = await getSettings(req.user!.id);
    const userId = req.user!.id;

    const sourced = new Map<string, { kind: Kind; source: string; days: Set<string> }>();
    for (const e of entries) {
      const src = typeof e.payload?.source === 'string' ? e.payload.source : null;
      if (!src || DAILY_KINDS.has(e.kind) || e.kind === 'MEDICATION_DOSE') continue;
      const key = `${e.kind}:${src}`;
      const group = sourced.get(key) ?? { kind: e.kind, source: src, days: new Set<string>() };
      group.days.add(e.day ?? today);
      sourced.set(key, group);
    }
    let replaced = 0;
    for (const group of sourced.values()) {
      const rows = await prisma.healthEntry.findMany({ where: { userId, kind: group.kind, day: { in: Array.from(group.days).map(dayDate) } }, select: { id: true, payload: true } });
      const stale = rows.filter((r) => decryptJson<{ source?: string }>(r.payload)?.source === group.source).map((r) => r.id);
      if (stale.length) {
        const r = await prisma.healthEntry.deleteMany({ where: { id: { in: stale }, userId } });
        replaced += r.count;
      }
    }

    let imported = 0;
    const errors: string[] = [];
    for (const e of entries) {
      try { await saveEntry(userId, e, today, settings.trackers as Record<string, boolean>); imported += 1; } catch (err) { if (errors.length < 10) errors.push(`${e.kind} ${e.day ?? ''}: ${(err as Error).message}`); }
    }
    ok(res, { imported, failed: entries.length - imported, replaced, errors }, 201);
  } catch (error) { next(error); }
});

router.patch('/entries/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.healthEntry.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new ApiError(404, 'Entry not found');
    const { payload } = parse(z.object({ payload: z.record(z.unknown()) }), req.body);
    const clean = parse(PAYLOADS[existing.kind as Kind], payload);
    ok(res, present(await prisma.healthEntry.update({ where: { id: existing.id }, data: { payload: encryptJson(clean) } })));
  } catch (error) { next(error); }
});

router.delete('/entries/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.healthEntry.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (r.count === 0) throw new ApiError(404, 'Entry not found');
    res.status(204).send();
  } catch (error) { next(error); }
});

// -------------------------------------------------------------------- today

router.get('/today', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const today = await memberDay(req);
    const settings = await getSettings(userId);
    const input = await insightsInput(userId, today, 60);
    const todays = (await loadEntries(userId, ['CHECKIN', 'SLEEP', 'HYDRATION', 'PERIOD', 'ACTIVITY', 'NUTRITION'], today, today));
    const cycle = predictCycle({ days: input.periodDays, today, cycleLengthHint: settings.cycleLengthHint, periodLengthHint: settings.periodLengthHint });
    const insights = buildInsights(input);
    const [habits, logs, meds, doses, goals, nextBooking, memberships, checkinDays] = await Promise.all([
      prisma.habit.findMany({ where: { userId, isArchived: false }, orderBy: { createdAt: 'asc' } }),
      prisma.habitLog.findMany({ where: { habit: { userId }, done: true, day: { gte: dayDate(addDays(today, -120)) } }, select: { habitId: true, day: true } }),
      medicationsFor(userId),
      prisma.healthEntry.findMany({ where: { userId, kind: 'MEDICATION_DOSE', day: dayDate(today) } }),
      prisma.wellnessGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.healthBooking.findFirst({ where: { userId, status: { in: ['REQUESTED', 'CONFIRMED'] }, scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: 'asc' }, include: { practitioner: { select: { id: true, slug: true, name: true, kind: true } } } }),
      prisma.wellnessCircleMember.findMany({ where: { userId, leftAt: null, circle: { status: { in: ['OPEN', 'RUNNING'] } } }, include: { circle: { select: { id: true, name: true, topic: true, startsOn: true, weeks: true, meetingDay: true, meetingTime: true, status: true, checkIns: { where: { userId }, select: { week: true } } } } } }),
      prisma.healthEntry.findMany({ where: { userId, kind: 'CHECKIN', day: { gte: dayDate(addDays(today, -60)) } }, select: { day: true } }),
    ]);
    const weekday = localParts(new Date(`${today}T12:00:00Z`), 'UTC').weekday;
    const takenToday = doses.map((d) => decryptJson<{ time?: string; status?: string; medicationId?: string }>(d.payload)).filter(Boolean) as Array<{ time?: string; status?: string; medicationId?: string }>;
    const goalData: GoalData = { sleep: input.sleep, activity: input.activity, checkins: input.checkins, hydration: input.hydration };
    ok(res, {
      today, settings,
      todays: Object.fromEntries(['CHECKIN', 'SLEEP', 'HYDRATION', 'PERIOD'].map((k) => [k, todays.find((e) => e.kind === k) ?? null])),
      activityToday: todays.filter((e) => e.kind === 'ACTIVITY'),
      checkinStreak: streakFrom(checkinDays.map((r) => isoDay(r.day)), today),
      cycle: { phase: cycle.phase, dayOfCycle: cycle.dayOfCycle, nextPeriod: cycle.nextPeriod, daysUntilNextPeriod: cycle.daysUntilNextPeriod, fertileWindow: cycle.fertileWindow, confidence: cycle.confidence, hasData: cycle.hasData },
      habits: habits.map((h) => { const days = logs.filter((l) => l.habitId === h.id).map((l) => isoDay(l.day)); return { id: h.id, name: h.name, difficulty: h.difficulty, streak: streakFrom(days, today), week: weekProgress(days, today, h.targetPerWeek) }; }),
      medications: meds.filter((m) => m.startDate <= today && (!m.endDate || m.endDate >= today) && (m.daysOfWeek.length === 0 || m.daysOfWeek.includes(weekday))).map((m) => ({ id: m.id, name: m.details.name, dose: m.details.dose, times: m.times.map((t) => ({ time: t, status: takenToday.find((d) => d.medicationId === m.id && d.time === t)?.status ?? null })) })),
      goals: goals.map((g) => { const p = goalProgress({ metric: g.metric, target: g.target, period: g.period, startedOn: isoDay(g.startedOn) }, goalData, today, 4); return { ...p, id: g.id, label: g.label ?? p.label }; }),
      nextBooking,
      circles: memberships.map((m) => { const week = currentWeek(isoDay(m.circle.startsOn), m.circle.weeks, today); return { id: m.circle.id, name: m.circle.name, topic: m.circle.topic, meetingDay: m.circle.meetingDay, meetingTime: m.circle.meetingTime, status: m.circle.status, week, checkedIn: week ? m.circle.checkIns.some((c) => c.week === week) : false }; }),
      headline: insights.risks[0] ?? insights.patterns[0] ?? null,
      coverage: insights.coverage,
    });
  } catch (error) { next(error); }
});

// ------------------------------------------------------------ cycle, insights

router.get('/cycle', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const settings = await getSettings(req.user!.id);
    const entries = await loadEntries(req.user!.id, ['PERIOD'], addDays(today, -400), today);
    ok(res, { ...predictCycle({ days: toPeriod(entries), today, cycleLengthHint: settings.cycleLengthHint, periodLengthHint: settings.periodLengthHint }), symptomsVocabulary: PERIOD_SYMPTOMS });
  } catch (error) { next(error); }
});

router.get('/insights', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(14, Number(req.query.days) || 90));
    const today = await memberDay(req);
    ok(res, buildInsights(await insightsInput(req.user!.id, today, days)));
  } catch (error) { next(error); }
});

async function reportFor(userId: string, today: string, days: number) {
  const input = await insightsInput(userId, today, days);
  const meds = await medicationsFor(userId);
  const adherence = await adherenceFor(userId, today, 30, meds);
  return buildDoctorReport({ ...input, medications: meds.map((m) => ({ name: m.details.name ?? 'Medication', dose: m.details.dose, times: m.times, prescribedBy: m.details.prescribedBy, adherencePct: adherence.perMedication.find((a) => a.id === m.id)?.pct ?? null })) });
}

router.get('/report', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(14, Number(req.query.days) || 90));
    ok(res, await reportFor(req.user!.id, await memberDay(req), days));
  } catch (error) { next(error); }
});

router.get('/report.csv', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, Math.max(14, Number(req.query.days) || 90));
    const today = await memberDay(req);
    const entries = await loadEntries(req.user!.id, KINDS.filter((k) => k !== 'MEDICATION_DOSE'), addDays(today, -(days - 1)), today);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="athena-health-${today}.csv"`);
    res.send(entriesToCsv(entries.map((e) => ({ kind: e.kind, day: e.day, at: e.at, payload: e.payload }))));
  } catch (error) { next(error); }
});

// ------------------------------------------------------------------- shares

router.get('/shares', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { ok(res, await prisma.healthShare.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 })); } catch (error) { next(error); }
});

const shareSchema = z.object({ scope: z.array(z.enum(SHARE_SCOPES.map((s) => s.key) as [string, ...string[]])).min(1), days: z.coerce.number().int().min(14).max(365).optional(), expiresInDays: z.coerce.number().int().min(1).max(30).optional(), label: z.string().max(80).optional(), bookingId: uuid.optional(), anonymous: z.boolean().optional() });

router.post('/shares', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(shareSchema, req.body);
    const settings = await getSettings(req.user!.id);
    if (!settings.shareWithPractitioners) throw new ApiError(400, 'Sharing with practitioners is switched off in your wellness settings');
    if (data.bookingId) {
      const booking = await prisma.healthBooking.findFirst({ where: { id: data.bookingId, userId: req.user!.id } });
      if (!booking) throw new ApiError(404, 'Booking not found');
    }
    const share = await prisma.healthShare.create({ data: { userId: req.user!.id, token: randomBytes(24).toString('base64url'), scope: data.scope, days: data.days ?? 90, label: data.label, bookingId: data.bookingId, anonymous: data.anonymous ?? false, expiresAt: new Date(Date.now() + (data.expiresInDays ?? 7) * 86400000) } });
    if (data.bookingId) await prisma.healthBooking.update({ where: { id: data.bookingId }, data: { shareId: share.id } });
    ok(res, share, 201);
  } catch (error) { next(error); }
});

router.delete('/shares/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.healthShare.updateMany({ where: { id: req.params.id, userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (r.count === 0) throw new ApiError(404, 'Share not found');
    res.status(204).send();
  } catch (error) { next(error); }
});

/** Open by token: what a practitioner sees when the member hands her the link. */
router.get('/share/:token', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const share = await prisma.healthShare.findUnique({ where: { token: req.params.token }, include: { user: { select: { firstName: true, lastName: true, timezone: true } } } });
    if (!share || share.revokedAt || share.expiresAt < new Date()) throw new ApiError(404, 'This link has expired or been withdrawn');
    const today = localParts(new Date(), share.user.timezone).day;
    const full = await reportFor(share.userId, today, share.days);
    const scope = new Set(share.scope);
    const report = {
      generatedAt: full.generatedAt, window: full.window,
      checkins: scope.has('checkins') ? full.checkins : null,
      sleep: scope.has('sleep') ? full.sleep : null,
      activity: scope.has('activity') ? full.activity : null,
      cycle: scope.has('cycle') ? full.cycle : null,
      symptoms: scope.has('symptoms') || scope.has('cycle') ? full.symptoms : [],
      medications: scope.has('medications') ? full.medications : [],
      flags: full.flags, notes: full.notes,
    };
    let mentalLoad = null;
    if (scope.has('mental-load')) {
      const rows = await prisma.mentalLoadEntry.findMany({ where: { userId: share.userId, day: { gte: dayDate(addDays(today, -27)) } } });
      mentalLoad = analyseMentalLoad(rows.map((r) => ({ day: isoDay(r.day), category: r.category, task: r.task, minutes: r.minutes, carriedBy: r.carriedBy })), { today, weeks: 4 });
    }
    await prisma.healthShare.update({ where: { id: share.id }, data: { openedCount: { increment: 1 }, lastOpenedAt: new Date() } });
    const memberName = share.anonymous ? 'A member' : [share.user.firstName, share.user.lastName].filter(Boolean).join(' ') || 'A member';
    ok(res, { memberName, anonymous: share.anonymous, label: share.label, scope: share.scope, expiresAt: share.expiresAt, report, mentalLoad });
  } catch (error) { next(error); }
});

// -------------------------------------------------------------- medications

const medicationSchema = z.object({
  name: z.string().min(1).max(80), dose: z.string().max(60).optional(), instructions: z.string().max(200).optional(), prescribedBy: z.string().max(80).optional(), pharmacy: z.string().max(80).optional(), notes: z.string().max(500).optional(),
  times: z.array(hhmm).max(6).optional(), daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(), startDate: isoDaySchema.optional(), endDate: isoDaySchema.nullable().optional(),
  repeatsLeft: z.coerce.number().int().min(0).max(99).nullable().optional(), nextRefillDue: isoDaySchema.nullable().optional(), isActive: z.boolean().optional(),
});

async function adherenceFor(userId: string, today: string, days: number, meds: Awaited<ReturnType<typeof medicationsFor>>) {
  const from = addDays(today, -(days - 1));
  const doses = await prisma.healthEntry.findMany({ where: { userId, kind: 'MEDICATION_DOSE', day: { gte: dayDate(from), lte: dayDate(today) } } });
  const logged = doses.map((d) => ({ day: isoDay(d.day), refId: d.refId, ...(decryptJson<{ time?: string; status?: string }>(d.payload) ?? {}) }));
  const perMedication = meds.map((m) => {
    let expected = 0;
    for (let d = from; d <= today; d = addDays(d, 1)) {
      if (d < m.startDate || (m.endDate && d > m.endDate)) continue;
      const wd = localParts(new Date(`${d}T12:00:00Z`), 'UTC').weekday;
      if (m.daysOfWeek.length && !m.daysOfWeek.includes(wd)) continue;
      expected += m.times.length;
    }
    const mine = logged.filter((l) => l.refId === m.id);
    const taken = mine.filter((l) => l.status === 'taken').length;
    const skipped = mine.filter((l) => l.status === 'skipped').length;
    return { id: m.id, name: m.details.name, expected, taken, skipped, pct: expected ? Math.min(100, Math.round((taken / expected) * 100)) : null };
  });
  const expected = perMedication.reduce((a, b) => a + b.expected, 0);
  const taken = perMedication.reduce((a, b) => a + b.taken, 0);
  return { days, perMedication, overallPct: expected ? Math.min(100, Math.round((taken / expected) * 100)) : null };
}

router.get('/medications', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const meds = await medicationsFor(req.user!.id, false);
    const adherence = await adherenceFor(req.user!.id, today, 30, meds.filter((m) => m.isActive));
    const todaysDoses = await prisma.healthEntry.findMany({ where: { userId: req.user!.id, kind: 'MEDICATION_DOSE', day: dayDate(today) } });
    const logged = todaysDoses.map((d) => ({ refId: d.refId, ...(decryptJson<{ time?: string; status?: string }>(d.payload) ?? {}) }));
    ok(res, { today, medications: meds.map((m) => ({ ...m, today: m.times.map((t) => ({ time: t, status: logged.find((l) => l.refId === m.id && l.time === t)?.status ?? null })), refillSoon: Boolean(m.nextRefillDue && daysBetween(today, m.nextRefillDue) <= 7) || (typeof m.repeatsLeft === 'number' && m.repeatsLeft <= 1) })), adherence });
  } catch (error) { next(error); }
});

router.post('/medications', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(medicationSchema, req.body);
    const today = await memberDay(req);
    const count = await prisma.medication.count({ where: { userId: req.user!.id, isActive: true } });
    if (count >= 30) throw new ApiError(400, 'Thirty active medications is the most the tracker keeps');
    const { name, dose, instructions, prescribedBy, pharmacy, notes, ...rest } = data;
    const med = await prisma.medication.create({ data: { userId: req.user!.id, details: encryptJson({ name, dose, instructions, prescribedBy, pharmacy, notes }), times: rest.times ?? [], daysOfWeek: rest.daysOfWeek ?? [], startDate: dayDate(rest.startDate ?? today), endDate: rest.endDate ? dayDate(rest.endDate) : null, repeatsLeft: rest.repeatsLeft ?? null, nextRefillDue: rest.nextRefillDue ? dayDate(rest.nextRefillDue) : null } });
    ok(res, (await medicationsFor(req.user!.id, false)).find((m) => m.id === med.id), 201);
  } catch (error) { next(error); }
});

router.patch('/medications/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.medication.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new ApiError(404, 'Medication not found');
    const data = parse(medicationSchema.partial(), req.body);
    const details = { ...(decryptJson<Record<string, unknown>>(existing.details) ?? {}) };
    for (const k of ['name', 'dose', 'instructions', 'prescribedBy', 'pharmacy', 'notes'] as const) if (data[k] !== undefined) details[k] = data[k];
    await prisma.medication.update({ where: { id: existing.id }, data: {
      details: encryptJson(details), ...(data.times ? { times: data.times } : {}), ...(data.daysOfWeek ? { daysOfWeek: data.daysOfWeek } : {}),
      ...(data.startDate ? { startDate: dayDate(data.startDate) } : {}), ...(data.endDate !== undefined ? { endDate: data.endDate ? dayDate(data.endDate) : null } : {}),
      ...(data.repeatsLeft !== undefined ? { repeatsLeft: data.repeatsLeft } : {}), ...(data.nextRefillDue !== undefined ? { nextRefillDue: data.nextRefillDue ? dayDate(data.nextRefillDue) : null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    } });
    ok(res, (await medicationsFor(req.user!.id, false)).find((m) => m.id === existing.id));
  } catch (error) { next(error); }
});

router.delete('/medications/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.medication.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (r.count === 0) throw new ApiError(404, 'Medication not found');
    await prisma.healthEntry.deleteMany({ where: { userId: req.user!.id, kind: 'MEDICATION_DOSE', refId: req.params.id } });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.post('/medications/:id/doses', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(z.object({ day: isoDaySchema.optional(), time: hhmm, status: z.enum(['taken', 'skipped']) }), req.body);
    const today = await memberDay(req);
    const settings = await getSettings(req.user!.id);
    const entry = await saveEntry(req.user!.id, { kind: 'MEDICATION_DOSE', day: body.day ?? today, payload: { medicationId: req.params.id, time: body.time, status: body.status } }, today, settings.trackers as Record<string, boolean>);
    ok(res, entry, 201);
  } catch (error) { next(error); }
});

router.get('/medications/adherence', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(180, Math.max(7, Number(req.query.days) || 30));
    ok(res, await adherenceFor(req.user!.id, await memberDay(req), days, await medicationsFor(req.user!.id)));
  } catch (error) { next(error); }
});

// -------------------------------------------------------------------- notes

const noteSchema = z.object({ title: z.string().min(1).max(120), body: z.string().max(5000), bookingId: uuid.nullable().optional() });
const presentNote = (n: { id: string; bookingId: string | null; content: string; createdAt: Date; updatedAt: Date }) => ({ id: n.id, bookingId: n.bookingId, ...(decryptJson<{ title?: string; body?: string }>(n.content) ?? { title: 'Unreadable', body: '' }), createdAt: n.createdAt, updatedAt: n.updatedAt });

router.get('/notes', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bookingId = typeof req.query.bookingId === 'string' ? req.query.bookingId : undefined;
    const notes = await prisma.healthNote.findMany({ where: { userId: req.user!.id, ...(bookingId ? { bookingId } : {}) }, orderBy: { updatedAt: 'desc' }, take: 200 });
    ok(res, notes.map(presentNote));
  } catch (error) { next(error); }
});

router.post('/notes', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(noteSchema, req.body);
    if (data.bookingId) {
      const booking = await prisma.healthBooking.findFirst({ where: { id: data.bookingId, userId: req.user!.id }, select: { id: true } });
      if (!booking) throw new ApiError(404, 'Booking not found');
    }
    const note = await prisma.healthNote.create({ data: { userId: req.user!.id, bookingId: data.bookingId ?? null, content: encryptJson({ title: data.title, body: data.body }) } });
    ok(res, presentNote(note), 201);
  } catch (error) { next(error); }
});

router.patch('/notes/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.healthNote.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new ApiError(404, 'Note not found');
    const data = parse(noteSchema.partial(), req.body);
    const current = decryptJson<{ title?: string; body?: string }>(existing.content) ?? {};
    const note = await prisma.healthNote.update({ where: { id: existing.id }, data: { content: encryptJson({ title: data.title ?? current.title, body: data.body ?? current.body }), ...(data.bookingId !== undefined ? { bookingId: data.bookingId } : {}) } });
    ok(res, presentNote(note));
  } catch (error) { next(error); }
});

router.delete('/notes/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.healthNote.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (r.count === 0) throw new ApiError(404, 'Note not found');
    res.status(204).send();
  } catch (error) { next(error); }
});

// -------------------------------------------------------------- mental load

router.get('/mental-load', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const weeks = Math.min(26, Math.max(1, Number(req.query.weeks) || 4));
    const today = await memberDay(req);
    const from = addDays(weekStart(today), -7 * (weeks - 1));
    const [rows, recent] = await Promise.all([
      prisma.mentalLoadEntry.findMany({ where: { userId: req.user!.id, day: { gte: dayDate(from), lte: dayDate(today) } }, orderBy: [{ day: 'desc' }, { createdAt: 'desc' }] }),
      loadEntries(req.user!.id, ['CHECKIN'], addDays(today, -13), today),
    ]);
    const entries = rows.map((r) => ({ id: r.id, day: isoDay(r.day), category: r.category, task: r.task, minutes: r.minutes, carriedBy: r.carriedBy }));
    const checkins = toCheckins(recent);
    const analysis = analyseMentalLoad(entries, { today, weeks, recentEnergy: checkins.map((c) => c.energy), recentStress: checkins.map((c) => c.stress) });
    ok(res, { today, entries, analysis, categories: MENTAL_LOAD_CATEGORIES, templates: DELEGATION_TEMPLATES });
  } catch (error) { next(error); }
});

router.post('/mental-load', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(z.object({ day: isoDaySchema.optional(), category: z.enum(MENTAL_LOAD_CATEGORIES.map((c) => c.key) as [string, ...string[]]), task: z.string().min(1).max(120), minutes: z.coerce.number().int().min(1).max(1440), carriedBy: z.enum(['ME', 'PARTNER', 'SHARED', 'OTHER']).optional() }), req.body);
    const today = await memberDay(req);
    const row = await prisma.mentalLoadEntry.create({ data: { userId: req.user!.id, day: dayDate(data.day ?? today), category: data.category as never, task: data.task, minutes: data.minutes, carriedBy: (data.carriedBy ?? 'ME') as never } });
    ok(res, { ...row, day: isoDay(row.day) }, 201);
  } catch (error) { next(error); }
});

router.delete('/mental-load/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.mentalLoadEntry.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (r.count === 0) throw new ApiError(404, 'Entry not found');
    res.status(204).send();
  } catch (error) { next(error); }
});

// ------------------------------------------------------------------- forums

const postSelect = { id: true, forumId: true, authorId: true, isAnonymous: true, title: true, body: true, contentWarning: true, isHidden: true, hiddenReason: true, isPinned: true, isLocked: true, crisisFlagged: true, replyCount: true, supportCount: true, lastReplyAt: true, createdAt: true, updatedAt: true, author: { select: AUTHOR_SELECT }, forum: { select: { slug: true, name: true } } } as const;

function presentPost(p: { id: string; forumId: string; authorId: string; isAnonymous: boolean; title: string; body: string; contentWarning: string | null; isHidden: boolean; hiddenReason: string | null; isPinned: boolean; isLocked: boolean; crisisFlagged: boolean; replyCount: number; supportCount: number; lastReplyAt: Date | null; createdAt: Date; updatedAt: Date; author: { id: string; firstName: string | null; lastName: string | null; displayName: string | null; avatar: string | null; role: string }; forum: { slug: string; name: string } }, viewerId: string, full: boolean, supported: Set<string>) {
  return {
    id: p.id, forum: p.forum, title: p.title, body: full ? p.body : excerpt(p.body), contentWarning: p.contentWarning, isHidden: p.isHidden, hiddenReason: p.hiddenReason, isPinned: p.isPinned, isLocked: p.isLocked,
    replyCount: p.replyCount, supportCount: p.supportCount, lastReplyAt: p.lastReplyAt, createdAt: p.createdAt, updatedAt: p.updatedAt,
    author: presentAuthor(p.author, p.isAnonymous, viewerId, isModeratorRole(p.author.role)), supportedByMe: supported.has(p.id), canEdit: p.authorId === viewerId,
  };
}

router.get('/forums', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const forums = await prisma.wellnessForum.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    const latest = await prisma.wellnessPost.groupBy({ by: ['forumId'], where: { isHidden: false }, _max: { createdAt: true, lastReplyAt: true }, _count: { _all: true } });
    ok(res, { forums: forums.map((f) => { const l = latest.find((x) => x.forumId === f.id); return { ...f, postCount: l?._count._all ?? 0, lastActivityAt: l?._max.lastReplyAt ?? l?._max.createdAt ?? null }; }), crisisLines: CRISIS_LINES.slice(0, 6), contentWarnings: CONTENT_WARNINGS });
  } catch (error) { next(error); }
});

router.get('/forums/:slug', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const forum = await prisma.wellnessForum.findUnique({ where: { slug: req.params.slug } });
    if (!forum || !forum.isActive) throw new ApiError(404, 'Forum not found');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const moderator = isModeratorRole(req.user!.role);
    const where = { forumId: forum.id, ...(moderator ? {} : { OR: [{ isHidden: false }, { authorId: req.user!.id }] }) };
    const [posts, total] = await Promise.all([
      prisma.wellnessPost.findMany({ where, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit, select: postSelect }),
      prisma.wellnessPost.count({ where }),
    ]);
    const supported = new Set((await prisma.wellnessSupport.findMany({ where: { userId: req.user!.id, postId: { in: posts.map((p) => p.id) } }, select: { postId: true } })).map((s) => s.postId));
    const settings = await getSettings(req.user!.id);
    ok(res, { forum, posts: posts.map((p) => presentPost(p, req.user!.id, false, supported)), page, limit, total, isModerator: moderator, crisisLines: CRISIS_LINES.slice(0, 6), viewer: { hiddenWarnings: settings.hiddenWarnings, anonymousByDefault: settings.anonymousByDefault } });
  } catch (error) { next(error); }
});

const postSchema = z.object({ title: z.string().min(5).max(140), body: z.string().min(20).max(5000), isAnonymous: z.boolean().optional(), contentWarning: z.string().max(40).nullable().optional() });

router.post('/forums/:slug/posts', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const forum = await prisma.wellnessForum.findUnique({ where: { slug: req.params.slug } });
    if (!forum || !forum.isActive) throw new ApiError(404, 'Forum not found');
    const data = parse(postSchema, req.body);
    const settings = await getSettings(req.user!.id);
    const crisis = detectCrisisLanguage(`${data.title}\n${data.body}`);
    const post = await prisma.wellnessPost.create({ data: { forumId: forum.id, authorId: req.user!.id, isAnonymous: data.isAnonymous ?? settings.anonymousByDefault, title: data.title.trim(), body: data.body.trim(), contentWarning: normaliseWarning(data.contentWarning), crisisFlagged: crisis.flagged }, select: postSelect });
    await prisma.wellnessForum.update({ where: { id: forum.id }, data: { postCount: { increment: 1 } } });
    if (crisis.flagged) {
      await prisma.adminFlag.create({ data: { userId: req.user!.id, type: 'SAFETY_CONCERN', severity: 'HIGH', flaggedById: req.user!.id, reason: 'Language about suicide or self-harm in a wellness forum post; the crisis lines were shown to the author', notes: `Post ${post.id}` } }).catch((err) => logger.warn('Could not raise a safety flag', { error: (err as Error).message }));
    }
    ok(res, { post: presentPost(post, req.user!.id, true, new Set()), crisis: crisis.flagged ? { flagged: true, message: 'It sounds like things are very hard right now. Your post is up, and these lines are staffed this minute.', lines: CRISIS_LINES.slice(0, 5) } : { flagged: false } }, 201);
  } catch (error) { next(error); }
});

router.get('/forum-posts/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.wellnessPost.findUnique({ where: { id: req.params.id }, select: postSelect });
    const moderator = isModeratorRole(req.user!.role);
    if (!post || (post.isHidden && !moderator && post.authorId !== req.user!.id)) throw new ApiError(404, 'Post not found');
    const replies = await prisma.wellnessReply.findMany({ where: { postId: post.id, ...(moderator ? {} : { OR: [{ isHidden: false }, { authorId: req.user!.id }] }) }, orderBy: { createdAt: 'asc' }, include: { author: { select: AUTHOR_SELECT } } });
    const supported = await prisma.wellnessSupport.findFirst({ where: { postId: post.id, userId: req.user!.id }, select: { id: true } });
    const settings = await getSettings(req.user!.id);
    ok(res, {
      post: presentPost(post, req.user!.id, true, new Set(supported ? [post.id] : [])),
      replies: replies.map((r) => ({ id: r.id, body: r.body, isHidden: r.isHidden, isFromModerator: r.isFromModerator, createdAt: r.createdAt, author: presentAuthor(r.author, r.isAnonymous, req.user!.id, r.isFromModerator), canEdit: r.authorId === req.user!.id })),
      isModerator: moderator, crisisLines: CRISIS_LINES.slice(0, 6), guidelines: post.forum, viewer: { hiddenWarnings: settings.hiddenWarnings, anonymousByDefault: settings.anonymousByDefault },
    });
  } catch (error) { next(error); }
});

router.post('/forum-posts/:id/replies', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.wellnessPost.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true, isLocked: true, isHidden: true, title: true, forum: { select: { slug: true } } } });
    if (!post || post.isHidden) throw new ApiError(404, 'Post not found');
    if (post.isLocked) throw new ApiError(400, 'This thread is closed to new replies');
    const data = parse(z.object({ body: z.string().min(2).max(3000), isAnonymous: z.boolean().optional() }), req.body);
    const settings = await getSettings(req.user!.id);
    const crisis = detectCrisisLanguage(data.body);
    const moderator = isModeratorRole(req.user!.role);
    const reply = await prisma.wellnessReply.create({ data: { postId: post.id, authorId: req.user!.id, isAnonymous: moderator ? false : (data.isAnonymous ?? settings.anonymousByDefault), isFromModerator: moderator, body: data.body.trim() }, include: { author: { select: AUTHOR_SELECT } } });
    await prisma.wellnessPost.update({ where: { id: post.id }, data: { replyCount: { increment: 1 }, lastReplyAt: new Date() } });
    if (post.authorId !== req.user!.id) {
      await prisma.notification.create({ data: { userId: post.authorId, type: 'SYSTEM', title: 'Someone replied in the wellness forum', message: `A reply on "${post.title.slice(0, 60)}".`, link: `/dashboard/wellness/forums/${post.forum.slug}/${post.id}`, data: { kind: 'WELLNESS_REPLY', postId: post.id } } }).catch(() => null);
    }
    ok(res, { reply: { id: reply.id, body: reply.body, isHidden: reply.isHidden, isFromModerator: reply.isFromModerator, createdAt: reply.createdAt, author: presentAuthor(reply.author, reply.isAnonymous, req.user!.id, reply.isFromModerator), canEdit: true }, crisis: crisis.flagged ? { flagged: true, lines: CRISIS_LINES.slice(0, 5) } : { flagged: false } }, 201);
  } catch (error) { next(error); }
});

router.post('/forum-posts/:id/support', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.wellnessPost.findUnique({ where: { id: req.params.id }, select: { id: true, isHidden: true } });
    if (!post || post.isHidden) throw new ApiError(404, 'Post not found');
    const existing = await prisma.wellnessSupport.findUnique({ where: { postId_userId: { postId: post.id, userId: req.user!.id } } });
    if (existing) {
      await prisma.wellnessSupport.delete({ where: { id: existing.id } });
      const updated = await prisma.wellnessPost.update({ where: { id: post.id }, data: { supportCount: { decrement: 1 } }, select: { supportCount: true } });
      return ok(res, { supported: false, supportCount: Math.max(0, updated.supportCount) });
    }
    await prisma.wellnessSupport.create({ data: { postId: post.id, userId: req.user!.id } });
    const updated = await prisma.wellnessPost.update({ where: { id: post.id }, data: { supportCount: { increment: 1 } }, select: { supportCount: true } });
    ok(res, { supported: true, supportCount: updated.supportCount });
  } catch (error) { next(error); }
});

router.post('/forum-posts/:id/report', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.wellnessPost.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true } });
    if (!post) throw new ApiError(404, 'Post not found');
    const data = parse(z.object({ reason: z.enum(['HARASSMENT', 'HATE_SPEECH', 'SPAM', 'MISINFORMATION', 'INAPPROPRIATE', 'OTHER']), description: z.string().max(1000).optional() }), req.body);
    if (post.authorId === req.user!.id) throw new ApiError(400, 'You can delete your own post instead');
    const report = await prisma.contentReport.create({ data: { reporterId: req.user!.id, contentType: 'WELLNESS_POST', contentId: post.id, reportedUserId: post.authorId, reason: data.reason, description: data.description } });
    ok(res, { id: report.id, status: report.status }, 201);
  } catch (error) { next(error); }
});

router.patch('/forum-posts/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.wellnessPost.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true, isLocked: true } });
    if (!post) throw new ApiError(404, 'Post not found');
    const moderator = isModeratorRole(req.user!.role);
    const data = parse(z.object({ title: z.string().min(5).max(140).optional(), body: z.string().min(20).max(5000).optional(), contentWarning: z.string().max(40).nullable().optional(), isHidden: z.boolean().optional(), hiddenReason: z.string().max(200).nullable().optional(), isPinned: z.boolean().optional(), isLocked: z.boolean().optional() }), req.body);
    const update: Prisma.WellnessPostUpdateInput = {};
    if (post.authorId === req.user!.id && !post.isLocked) {
      if (data.title) update.title = data.title.trim();
      if (data.body) update.body = data.body.trim();
      if (data.contentWarning !== undefined) update.contentWarning = normaliseWarning(data.contentWarning);
    }
    if (moderator) {
      if (data.isHidden !== undefined) { update.isHidden = data.isHidden; update.hiddenReason = data.isHidden ? (data.hiddenReason ?? 'Removed by a moderator') : null; }
      if (data.isPinned !== undefined) update.isPinned = data.isPinned;
      if (data.isLocked !== undefined) update.isLocked = data.isLocked;
    }
    if (Object.keys(update).length === 0) throw new ApiError(403, 'Nothing here you can change');
    const updated = await prisma.wellnessPost.update({ where: { id: post.id }, data: update, select: postSelect });
    ok(res, presentPost(updated, req.user!.id, true, new Set()));
  } catch (error) { next(error); }
});

router.delete('/forum-posts/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.wellnessPost.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true, forumId: true } });
    if (!post) throw new ApiError(404, 'Post not found');
    if (post.authorId !== req.user!.id && !isModeratorRole(req.user!.role)) throw new ApiError(403, 'Only the author or a moderator can remove a post');
    await prisma.wellnessPost.delete({ where: { id: post.id } });
    await prisma.wellnessForum.update({ where: { id: post.forumId }, data: { postCount: { decrement: 1 } } }).catch(() => null);
    res.status(204).send();
  } catch (error) { next(error); }
});

router.patch('/forum-replies/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reply = await prisma.wellnessReply.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true } });
    if (!reply) throw new ApiError(404, 'Reply not found');
    const moderator = isModeratorRole(req.user!.role);
    const data = parse(z.object({ body: z.string().min(2).max(3000).optional(), isHidden: z.boolean().optional() }), req.body);
    const update: Prisma.WellnessReplyUpdateInput = {};
    if (reply.authorId === req.user!.id && data.body) update.body = data.body.trim();
    if (moderator && data.isHidden !== undefined) update.isHidden = data.isHidden;
    if (Object.keys(update).length === 0) throw new ApiError(403, 'Nothing here you can change');
    const updated = await prisma.wellnessReply.update({ where: { id: reply.id }, data: update });
    ok(res, { id: updated.id, body: updated.body, isHidden: updated.isHidden });
  } catch (error) { next(error); }
});

router.delete('/forum-replies/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reply = await prisma.wellnessReply.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true, postId: true } });
    if (!reply) throw new ApiError(404, 'Reply not found');
    if (reply.authorId !== req.user!.id && !isModeratorRole(req.user!.role)) throw new ApiError(403, 'Only the author or a moderator can remove a reply');
    await prisma.wellnessReply.delete({ where: { id: reply.id } });
    await prisma.wellnessPost.update({ where: { id: reply.postId }, data: { replyCount: { decrement: 1 } } }).catch(() => null);
    res.status(204).send();
  } catch (error) { next(error); }
});

// ------------------------------------------------------------------ circles

const circleSchema = z.object({
  name: z.string().min(3).max(80), topic: z.string().min(2).max(40), description: z.string().min(10).max(1500), capacity: z.coerce.number().int().min(3).max(8).optional(), weeks: z.coerce.number().int().min(4).max(12).optional(),
  startsOn: isoDaySchema, meetingDay: z.coerce.number().int().min(0).max(6), meetingTime: hhmm, format: z.enum(['VIDEO', 'ASYNC', 'IN_PERSON']).optional(), meetingLink: z.string().url().max(300).nullable().optional(), location: z.string().max(160).nullable().optional(),
});

function presentCircle(c: { id: string; name: string; topic: string; description: string; facilitatorId: string; capacity: number; weeks: number; startsOn: Date; meetingDay: number; meetingTime: string; format: string; meetingLink: string | null; location: string | null; status: string; isFeatured: boolean; createdAt: Date; facilitator: { id: string; firstName: string | null; lastName: string | null; displayName: string | null; avatar: string | null; role: string }; members: Array<{ userId: string; leftAt: Date | null }> }, viewerId: string, today: string) {
  const active = c.members.filter((m) => !m.leftAt);
  const isMember = active.some((m) => m.userId === viewerId);
  const week = currentWeek(isoDay(c.startsOn), c.weeks, today);
  const endsOn = addDays(isoDay(c.startsOn), c.weeks * 7 - 1);
  return {
    id: c.id, name: c.name, topic: c.topic, description: c.description, capacity: c.capacity, weeks: c.weeks, startsOn: isoDay(c.startsOn), endsOn, meetingDay: c.meetingDay, meetingTime: c.meetingTime, format: c.format,
    meetingLink: isMember ? c.meetingLink : null, location: isMember ? c.location : null, status: c.status, isFeatured: c.isFeatured, createdAt: c.createdAt,
    facilitator: presentAuthor(c.facilitator, false, viewerId), memberCount: active.length, spotsLeft: Math.max(0, c.capacity - active.length), isMember, isFacilitator: c.facilitatorId === viewerId, currentWeek: week,
  };
}

const circleInclude = { facilitator: { select: AUTHOR_SELECT }, members: { select: { userId: true, leftAt: true } } } as const;

router.get('/circles', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const status = typeof req.query.status === 'string' && ['OPEN', 'RUNNING', 'COMPLETED', 'CANCELLED'].includes(req.query.status) ? req.query.status as 'OPEN' : undefined;
    const topic = typeof req.query.topic === 'string' ? req.query.topic : undefined;
    const mine = req.query.mine === 'true';
    const circles = await prisma.wellnessCircle.findMany({
      where: { ...(status ? { status } : mine ? {} : { status: { in: ['OPEN', 'RUNNING'] } }), ...(topic ? { topic } : {}), ...(mine ? { members: { some: { userId: req.user!.id, leftAt: null } } } : {}) },
      orderBy: [{ isFeatured: 'desc' }, { startsOn: 'asc' }], take: 60, include: circleInclude,
    });
    ok(res, { today, circles: circles.map((c) => presentCircle(c, req.user!.id, today)), topics: CIRCLE_TOPICS });
  } catch (error) { next(error); }
});

router.post('/circles', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(circleSchema, req.body);
    const today = await memberDay(req);
    if (daysBetween(today, data.startsOn) < -7) throw new ApiError(400, 'A circle can start up to a week ago, not earlier');
    const facilitating = await prisma.wellnessCircle.count({ where: { facilitatorId: req.user!.id, status: { in: ['OPEN', 'RUNNING'] } } });
    if (facilitating >= 3) throw new ApiError(400, 'Three running circles is the most one person can facilitate');
    const circle = await prisma.wellnessCircle.create({ data: { name: data.name.trim(), topic: data.topic.trim().toLowerCase(), description: data.description.trim(), facilitatorId: req.user!.id, capacity: data.capacity ?? 6, weeks: data.weeks ?? 8, startsOn: dayDate(data.startsOn), meetingDay: data.meetingDay, meetingTime: data.meetingTime, format: data.format ?? 'VIDEO', meetingLink: data.meetingLink ?? null, location: data.location ?? null, status: daysBetween(data.startsOn, today) >= 0 ? 'RUNNING' : 'OPEN', members: { create: { userId: req.user!.id, role: 'FACILITATOR' } } }, include: circleInclude });
    ok(res, presentCircle(circle, req.user!.id, today), 201);
  } catch (error) { next(error); }
});

router.get('/circles/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const circle = await prisma.wellnessCircle.findUnique({ where: { id: req.params.id }, include: { ...circleInclude, members: { where: { leftAt: null }, include: { user: { select: AUTHOR_SELECT } } }, checkIns: { orderBy: { createdAt: 'asc' }, include: { user: { select: AUTHOR_SELECT } } } } });
    if (!circle) throw new ApiError(404, 'Circle not found');
    const base = presentCircle({ ...circle, members: circle.members.map((m) => ({ userId: m.userId, leftAt: m.leftAt })) }, req.user!.id, today);
    const strategies = COPING_STRATEGIES.filter((s) => s.topics.includes(circle.topic)).slice(0, 5);
    const schedule = Array.from({ length: circle.weeks }, (_, i) => { const ws = addDays(isoDay(circle.startsOn), i * 7); const offset = (circle.meetingDay - localParts(new Date(`${ws}T12:00:00Z`), 'UTC').weekday + 7) % 7; return { week: i + 1, day: addDays(ws, offset), time: circle.meetingTime }; });
    if (!base.isMember) return ok(res, { ...base, strategies: strategies.length ? strategies : COPING_STRATEGIES.slice(0, 3), schedule, members: [], checkIns: [], myCheckIns: [] });
    ok(res, {
      ...base, strategies: strategies.length ? strategies : COPING_STRATEGIES.slice(0, 3), schedule,
      members: circle.members.map((m) => ({ ...presentAuthor(m.user, false, req.user!.id), role: m.role, joinedAt: m.joinedAt, continueRequested: m.continueRequested })),
      checkIns: circle.checkIns.filter((c) => base.currentWeek !== null && c.week === base.currentWeek).map((c) => ({ id: c.id, week: c.week, mood: c.mood, wins: c.wins, blockers: c.blockers, nextStep: c.nextStep, createdAt: c.createdAt, author: presentAuthor(c.user, false, req.user!.id) })),
      myCheckIns: circle.checkIns.filter((c) => c.userId === req.user!.id).map((c) => ({ id: c.id, week: c.week, mood: c.mood, wins: c.wins, blockers: c.blockers, nextStep: c.nextStep, createdAt: c.createdAt })),
      continueRequests: circle.members.filter((m) => m.continueRequested).length,
    });
  } catch (error) { next(error); }
});

/** The circle's meetings as a weekly series, for a member's calendar. */
router.get('/circles/:id/ics', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const circle = await prisma.wellnessCircle.findUnique({ where: { id: req.params.id }, include: { members: { where: { userId: req.user!.id, leftAt: null }, select: { id: true } } } });
    if (!circle || circle.members.length === 0) throw new ApiError(404, 'Circle not found');
    const ics = buildCircleIcs({
      id: circle.id, name: circle.name, topic: circle.topic, startsOn: isoDay(circle.startsOn), weeks: circle.weeks, meetingDay: circle.meetingDay, meetingTime: circle.meetingTime,
      format: circle.format, meetingLink: circle.meetingLink, location: circle.location, appUrl: `${clientBase()}/dashboard/wellness/circles/${circle.id}`,
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="athena-circle-${circle.id.slice(0, 8)}.ics"`);
    res.send(ics);
  } catch (error) { next(error); }
});

router.post('/circles/:id/join', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const circle = await prisma.wellnessCircle.findUnique({ where: { id: req.params.id }, include: circleInclude });
    if (!circle) throw new ApiError(404, 'Circle not found');
    if (circle.status !== 'OPEN' && circle.status !== 'RUNNING') throw new ApiError(400, 'This circle is not taking members');
    const active = circle.members.filter((m) => !m.leftAt);
    if (active.some((m) => m.userId === req.user!.id)) throw new ApiError(400, 'You are already in this circle');
    if (active.length >= circle.capacity) throw new ApiError(400, 'This circle is full. Small on purpose; start another or watch for the next cycle.');
    const joined = await prisma.wellnessCircleMember.count({ where: { userId: req.user!.id, leftAt: null, circle: { status: { in: ['OPEN', 'RUNNING'] } } } });
    if (joined >= 3) throw new ApiError(400, 'Three circles at once is plenty');
    await prisma.wellnessCircleMember.upsert({ where: { circleId_userId: { circleId: circle.id, userId: req.user!.id } }, create: { circleId: circle.id, userId: req.user!.id }, update: { leftAt: null, joinedAt: new Date() } });
    await awardAchievement(req.user!.id, 'CIRCLE_JOINED').catch(() => false);
    if (circle.facilitatorId !== req.user!.id) await prisma.notification.create({ data: { userId: circle.facilitatorId, type: 'SYSTEM', title: 'Someone joined your circle', message: `${circle.name} has a new member.`, link: `/dashboard/wellness/circles/${circle.id}`, data: { kind: 'WELLNESS_CIRCLE_JOIN', circleId: circle.id } } }).catch(() => null);
    const fresh = await prisma.wellnessCircle.findUnique({ where: { id: circle.id }, include: circleInclude });
    ok(res, presentCircle(fresh!, req.user!.id, await memberDay(req)));
  } catch (error) { next(error); }
});

router.post('/circles/:id/leave', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.wellnessCircleMember.findUnique({ where: { circleId_userId: { circleId: req.params.id, userId: req.user!.id } } });
    if (!member || member.leftAt) throw new ApiError(404, 'You are not in this circle');
    if (member.role === 'FACILITATOR') throw new ApiError(400, 'A facilitator closes the circle rather than leaving it');
    await prisma.wellnessCircleMember.update({ where: { id: member.id }, data: { leftAt: new Date() } });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.post('/circles/:id/check-ins', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const circle = await prisma.wellnessCircle.findUnique({ where: { id: req.params.id }, select: { id: true, startsOn: true, weeks: true, status: true, members: { where: { userId: req.user!.id, leftAt: null }, select: { id: true } } } });
    if (!circle || circle.members.length === 0) throw new ApiError(404, 'Circle not found');
    const data = parse(z.object({ week: z.coerce.number().int().min(1).max(12).optional(), mood: scale, wins: z.string().max(1000), blockers: z.string().max(1000), nextStep: z.string().max(500) }), req.body);
    const week = data.week ?? currentWeek(isoDay(circle.startsOn), circle.weeks, today);
    if (!week) throw new ApiError(400, 'This circle is not in a week you can check in for');
    if (week > circle.weeks) throw new ApiError(400, 'That week is past the end of the cycle');
    const checkIn = await prisma.wellnessCircleCheckIn.upsert({ where: { circleId_userId_week: { circleId: circle.id, userId: req.user!.id, week } }, create: { circleId: circle.id, userId: req.user!.id, week, mood: data.mood, wins: data.wins.trim(), blockers: data.blockers.trim(), nextStep: data.nextStep.trim() }, update: { mood: data.mood, wins: data.wins.trim(), blockers: data.blockers.trim(), nextStep: data.nextStep.trim() } });
    ok(res, checkIn, 201);
  } catch (error) { next(error); }
});

router.post('/circles/:id/continue', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.wellnessCircleMember.updateMany({ where: { circleId: req.params.id, userId: req.user!.id, leftAt: null }, data: { continueRequested: true } });
    if (r.count === 0) throw new ApiError(404, 'You are not in this circle');
    const count = await prisma.wellnessCircleMember.count({ where: { circleId: req.params.id, leftAt: null, continueRequested: true } });
    ok(res, { continueRequests: count });
  } catch (error) { next(error); }
});

router.patch('/circles/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const circle = await prisma.wellnessCircle.findUnique({ where: { id: req.params.id }, select: { id: true, facilitatorId: true, weeks: true } });
    if (!circle) throw new ApiError(404, 'Circle not found');
    if (circle.facilitatorId !== req.user!.id && !isModeratorRole(req.user!.role)) throw new ApiError(403, 'Only the facilitator can change a circle');
    const data = parse(z.object({ name: z.string().min(3).max(80).optional(), description: z.string().min(10).max(1500).optional(), status: z.enum(['OPEN', 'RUNNING', 'COMPLETED', 'CANCELLED']).optional(), meetingLink: z.string().url().max(300).nullable().optional(), location: z.string().max(160).nullable().optional(), meetingTime: hhmm.optional(), extendWeeks: z.coerce.number().int().min(1).max(12).optional(), isFeatured: z.boolean().optional() }), req.body);
    const { extendWeeks, isFeatured, ...rest } = data;
    const updated = await prisma.wellnessCircle.update({ where: { id: circle.id }, data: { ...rest, ...(extendWeeks ? { weeks: Math.min(52, circle.weeks + extendWeeks), status: 'RUNNING' } : {}), ...(isFeatured !== undefined && isModeratorRole(req.user!.role) ? { isFeatured } : {}) }, include: circleInclude });
    if (extendWeeks) await prisma.wellnessCircleMember.updateMany({ where: { circleId: circle.id }, data: { continueRequested: false } });
    ok(res, presentCircle(updated, req.user!.id, await memberDay(req)));
  } catch (error) { next(error); }
});

// ------------------------------------------------------------ practitioners

const practitionerCard = (p: { id: string; slug: string; name: string; kind: string; headline: string; qualifications: string[]; modalities: string[]; specialties: string[]; languages: string[]; suburb: string | null; city: string | null; state: string | null; telehealth: boolean; inPerson: boolean; bulkBilling: boolean; medicareRebate: boolean; privateHealth: boolean; feeFrom: Prisma.Decimal | null; feeNote: string | null; website: string | null; phone: string | null; bookingUrl: string | null; acceptsBookings: boolean; isVerified: boolean; ratingAvg: Prisma.Decimal; ratingCount: number }) => ({
  id: p.id, slug: p.slug, name: p.name, kind: p.kind, kindLabel: PRACTITIONER_KINDS.find((k) => k.key === p.kind)?.label ?? p.kind, headline: p.headline, qualifications: p.qualifications, modalities: p.modalities, specialties: p.specialties, languages: p.languages,
  suburb: p.suburb, city: p.city, state: p.state, telehealth: p.telehealth, inPerson: p.inPerson, bulkBilling: p.bulkBilling, medicareRebate: p.medicareRebate, privateHealth: p.privateHealth, feeFrom: p.feeFrom === null ? null : Number(p.feeFrom), feeNote: p.feeNote,
  website: p.website, phone: p.phone, bookingUrl: p.bookingUrl, acceptsBookings: p.acceptsBookings, isVerified: p.isVerified, ratingAvg: Number(p.ratingAvg), ratingCount: p.ratingCount,
});

router.get('/practitioners', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({ kind: z.string().optional(), state: z.string().max(3).optional(), city: z.string().max(60).optional(), q: z.string().max(80).optional(), telehealth: z.string().optional(), inPerson: z.string().optional(), bulkBilling: z.string().optional(), privateHealth: z.string().optional(), acceptsBookings: z.string().optional(), modality: z.string().max(40).optional(), specialty: z.string().max(40).optional(), language: z.string().max(40).optional(), page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(50).optional() }), req.query);
    const page = q.page ?? 1; const limit = q.limit ?? 20;
    const and: Prisma.HealthPractitionerWhereInput[] = [];
    if (q.bulkBilling === 'true') and.push({ OR: [{ bulkBilling: true }, { medicareRebate: true }] });
    if (q.q) and.push({ OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { headline: { contains: q.q, mode: 'insensitive' } }, { bio: { contains: q.q, mode: 'insensitive' } }, { specialties: { has: q.q } }] });
    const where: Prisma.HealthPractitionerWhereInput = {
      isActive: true, isVerified: true,
      ...(q.kind && PRACTITIONER_KINDS.some((k) => k.key === q.kind) ? { kind: q.kind as never } : {}),
      ...(q.state ? { state: q.state.toUpperCase() } : {}), ...(q.city ? { city: { contains: q.city, mode: 'insensitive' } } : {}),
      ...(q.telehealth === 'true' ? { telehealth: true } : {}), ...(q.inPerson === 'true' ? { inPerson: true } : {}), ...(q.privateHealth === 'true' ? { privateHealth: true } : {}), ...(q.acceptsBookings === 'true' ? { acceptsBookings: true } : {}),
      ...(q.modality ? { modalities: { has: q.modality } } : {}), ...(q.specialty ? { specialties: { has: q.specialty } } : {}), ...(q.language ? { languages: { hasSome: Array.from(new Set([q.language, q.language.toLowerCase(), q.language.charAt(0).toUpperCase() + q.language.slice(1).toLowerCase()])) } } : {}),
      ...(and.length ? { AND: and } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.healthPractitioner.findMany({ where, orderBy: [{ acceptsBookings: 'desc' }, { ratingAvg: 'desc' }, { ratingCount: 'desc' }, { name: 'asc' }], skip: (page - 1) * limit, take: limit }),
      prisma.healthPractitioner.count({ where }),
    ]);
    // For the ones that take bookings here, the first day with a free slot in the next fortnight.
    const bookable = rows.filter((r) => r.acceptsBookings);
    const nextFree = new Map<string, string | null>();
    if (bookable.length) {
      const today = await memberDay(req);
      const ownerIds = bookable.map((r) => r.ownerUserId).filter((x): x is string => Boolean(x));
      const [owners, booked] = await Promise.all([
        ownerIds.length ? prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, timezone: true } }) : Promise.resolve([] as Array<{ id: string; timezone: string }>),
        prisma.healthBooking.findMany({ where: { practitionerId: { in: bookable.map((r) => r.id) }, status: { in: ['REQUESTED', 'CONFIRMED'] }, scheduledAt: { gte: new Date() } }, select: { practitionerId: true, scheduledAt: true, durationMinutes: true } }),
      ]);
      for (const r of bookable) {
        const tz = owners.find((o) => o.id === r.ownerUserId)?.timezone;
        nextFree.set(r.id, nextAvailableDays({ availability: r.availability as Availability | null, slotMinutes: r.slotMinutes, timezone: tz, booked: booked.filter((b) => b.practitionerId === r.id), from: today, days: 14 })[0]?.day ?? null);
      }
    }
    ok(res, { practitioners: rows.map((r) => ({ ...practitionerCard(r), nextFree: nextFree.get(r.id) ?? null })), page, limit, total, kinds: PRACTITIONER_KINDS, modalities: MODALITIES, specialties: SPECIALTIES });
  } catch (error) { next(error); }
});

router.get('/practitioners/:slug', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await prisma.healthPractitioner.findFirst({ where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }], isActive: true } });
    if (!p || (!p.isVerified && p.ownerUserId !== req.user!.id && !isModeratorRole(req.user!.role))) throw new ApiError(404, 'Practitioner not found');
    const today = await memberDay(req);
    const tz = p.ownerUserId ? await memberTimezone(p.ownerUserId) : undefined;
    const moderator = isModeratorRole(req.user!.role);
    const [reviews, booked] = await Promise.all([
      prisma.healthReview.findMany({ where: { practitionerId: p.id, ...(moderator ? {} : { isHidden: false }) }, orderBy: { createdAt: 'desc' }, take: 5, include: { user: { select: { firstName: true } } } }),
      p.acceptsBookings ? prisma.healthBooking.findMany({ where: { practitionerId: p.id, status: { in: ['REQUESTED', 'CONFIRMED'] }, scheduledAt: { gte: new Date() } }, select: { scheduledAt: true, durationMinutes: true } }) : Promise.resolve([]),
    ]);
    ok(res, {
      ...practitionerCard(p), bio: p.bio, ahpraNumber: p.ahpraNumber, slotMinutes: p.slotMinutes, availability: p.availability, isOwner: p.ownerUserId === req.user!.id, canModerate: moderator,
      reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, isHidden: r.isHidden, createdAt: r.createdAt, by: r.user.firstName ? `${r.user.firstName.slice(0, 1)}.` : 'A member' })),
      nextAvailable: p.acceptsBookings ? nextAvailableDays({ availability: p.availability as Availability | null, slotMinutes: p.slotMinutes, timezone: tz, booked, from: today, days: 14 }) : [],
      timezone: tz ?? 'Australia/Brisbane',
    });
  } catch (error) { next(error); }
});

router.get('/practitioners/:id/slots', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await prisma.healthPractitioner.findUnique({ where: { id: req.params.id } });
    if (!p || !p.isActive || !p.acceptsBookings) throw new ApiError(404, 'This practitioner does not take bookings here');
    const { day } = parse(z.object({ day: isoDaySchema }), req.query);
    const booked = await prisma.healthBooking.findMany({ where: { practitionerId: p.id, status: { in: ['REQUESTED', 'CONFIRMED'] }, scheduledAt: { gte: dayDate(addDays(day, -1)), lte: dayDate(addDays(day, 2)) } }, select: { scheduledAt: true, durationMinutes: true } });
    const tz = p.ownerUserId ? await memberTimezone(p.ownerUserId) : undefined;
    ok(res, { day, slots: availableSlots({ availability: p.availability as Availability | null, slotMinutes: p.slotMinutes, timezone: tz, day, booked }), timezone: tz ?? 'Australia/Brisbane' });
  } catch (error) { next(error); }
});

router.get('/practitioners/:id/reviews', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const [reviews, total] = await Promise.all([
      prisma.healthReview.findMany({ where: { practitionerId: req.params.id, isHidden: false }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20, include: { user: { select: { firstName: true } } } }),
      prisma.healthReview.count({ where: { practitionerId: req.params.id, isHidden: false } }),
    ]);
    ok(res, { reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, by: r.user.firstName ? `${r.user.firstName.slice(0, 1)}.` : 'A member' })), page, total });
  } catch (error) { next(error); }
});

const bookingInclude = { practitioner: { select: { id: true, slug: true, name: true, kind: true, headline: true, telehealth: true, inPerson: true, ownerUserId: true } }, review: { select: { id: true, rating: true, comment: true } } } as const;
const presentBooking = (b: { id: string; practitionerId: string; userId: string; scheduledAt: Date; durationMinutes: number; mode: string; reason: string | null; status: string; practitionerNote: string | null; meetingLink: string | null; shareId: string | null; followUpOfId: string | null; createdAt: Date; practitioner: { id: string; slug: string; name: string; kind: string; headline: string; telehealth: boolean; inPerson: boolean }; review: { id: string; rating: number; comment: string | null } | null }, forPractitioner = false) => ({
  id: b.id, scheduledAt: b.scheduledAt, durationMinutes: b.durationMinutes, mode: b.mode, status: b.status, reason: b.reason ? (decryptJson<{ text?: string }>(b.reason)?.text ?? null) : null, practitionerNote: b.practitionerNote, meetingLink: b.meetingLink, shareId: b.shareId, followUpOfId: b.followUpOfId, createdAt: b.createdAt,
  practitioner: { id: b.practitioner.id, slug: b.practitioner.slug, name: b.practitioner.name, kind: b.practitioner.kind, headline: b.practitioner.headline }, review: b.review, canCancel: !forPractitioner && (b.status === 'REQUESTED' || (b.status === 'CONFIRMED' && canCancel(b.scheduledAt))),
});

router.post('/practitioners/:id/bookings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await prisma.healthPractitioner.findUnique({ where: { id: req.params.id } });
    if (!p || !p.isActive || !p.isVerified || !p.acceptsBookings) throw new ApiError(404, 'This practitioner does not take bookings here');
    if (p.ownerUserId === req.user!.id) throw new ApiError(400, 'You cannot book yourself');
    const data = parse(z.object({ scheduledAt: z.string().datetime(), mode: z.enum(['TELEHEALTH', 'IN_PERSON']).optional(), reason: z.string().max(1000).optional(), shareScope: z.array(z.string()).max(8).optional(), shareDays: z.coerce.number().int().min(14).max(365).optional() }), req.body);
    const mode = data.mode ?? (p.telehealth ? 'TELEHEALTH' : 'IN_PERSON');
    if (mode === 'TELEHEALTH' && !p.telehealth) throw new ApiError(400, 'This practitioner does not offer telehealth');
    if (mode === 'IN_PERSON' && !p.inPerson) throw new ApiError(400, 'This practitioner does not see people in person');
    const start = new Date(data.scheduledAt);
    const tz = p.ownerUserId ? await memberTimezone(p.ownerUserId) : undefined;
    const day = localParts(start, tz ?? 'Australia/Brisbane').day;
    const booked = await prisma.healthBooking.findMany({ where: { practitionerId: p.id, status: { in: ['REQUESTED', 'CONFIRMED'] }, scheduledAt: { gte: dayDate(addDays(day, -1)), lte: dayDate(addDays(day, 2)) } }, select: { scheduledAt: true, durationMinutes: true } });
    const slots = availableSlots({ availability: p.availability as Availability | null, slotMinutes: p.slotMinutes, timezone: tz, day, booked });
    if (!slots.some((s) => s.start === start.toISOString())) throw new ApiError(400, 'That time is not free. Pick one of the offered slots.');
    const booking = await prisma.healthBooking.create({ data: { practitionerId: p.id, userId: req.user!.id, scheduledAt: start, durationMinutes: p.slotMinutes, mode, reason: data.reason ? encryptJson({ text: data.reason.trim() }) : null }, include: bookingInclude });
    let share = null;
    if (data.shareScope && data.shareScope.length) {
      const settings = await getSettings(req.user!.id);
      const scope = data.shareScope.filter((s) => SHARE_SCOPES.some((x) => x.key === s));
      if (settings.shareWithPractitioners && scope.length) {
        share = await prisma.healthShare.create({ data: { userId: req.user!.id, token: randomBytes(24).toString('base64url'), scope, days: data.shareDays ?? 90, label: `${p.name}, ${day}`, bookingId: booking.id, expiresAt: new Date(start.getTime() + 7 * 86400000) } });
        await prisma.healthBooking.update({ where: { id: booking.id }, data: { shareId: share.id } });
      }
    }
    if (p.ownerUserId) await prisma.notification.create({ data: { userId: p.ownerUserId, type: 'SYSTEM', title: 'A new booking request', message: `${mode === 'TELEHEALTH' ? 'Telehealth' : 'In person'}, ${start.toISOString().slice(0, 16).replace('T', ' ')} UTC. Confirm it from your practice page.`, link: '/dashboard/wellness/practice', data: { kind: 'WELLNESS_BOOKING', bookingId: booking.id } } }).catch(() => null);
    ok(res, { booking: presentBooking({ ...booking, shareId: share?.id ?? null }), share }, 201);
  } catch (error) { next(error); }
});

router.patch('/practitioners/:id/verify', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { isVerified } = parse(z.object({ isVerified: z.boolean() }), req.body);
    const p = await prisma.healthPractitioner.update({ where: { id: req.params.id }, data: { isVerified } });
    if (p.ownerUserId) await prisma.notification.create({ data: { userId: p.ownerUserId, type: 'SYSTEM', title: isVerified ? 'Your practice profile is live' : 'Your practice profile is hidden', message: isVerified ? 'Members can now find and book you in the wellness directory.' : 'An admin has taken your profile out of the directory. Check the practice page for what to fix.', link: '/dashboard/wellness/practice', data: { kind: 'WELLNESS_VERIFY' } } }).catch(() => null);
    ok(res, practitionerCard(p));
  } catch (error) { next(error); }
});

// ----------------------------------------------------------------- practice

const practiceSchema = z.object({
  name: z.string().min(2).max(100), kind: z.enum(PRACTITIONER_KINDS.map((k) => k.key).filter((k) => k !== 'SERVICE') as [string, ...string[]]), headline: z.string().min(5).max(140), bio: z.string().min(20).max(3000),
  qualifications: z.array(z.string().max(80)).max(10).optional(), modalities: z.array(z.string().max(40)).max(12).optional(), specialties: z.array(z.string().max(40)).max(15).optional(), languages: z.array(z.string().max(40)).max(10).optional(),
  suburb: z.string().max(60).nullable().optional(), city: z.string().max(60).nullable().optional(), state: z.string().max(3).nullable().optional(),
  telehealth: z.boolean().optional(), inPerson: z.boolean().optional(), bulkBilling: z.boolean().optional(), medicareRebate: z.boolean().optional(), privateHealth: z.boolean().optional(),
  feeFrom: z.coerce.number().min(0).max(5000).nullable().optional(), feeNote: z.string().max(160).nullable().optional(), ahpraNumber: z.string().max(20).nullable().optional(), website: z.string().url().max(300).nullable().optional(), phone: z.string().max(30).nullable().optional(), bookingUrl: z.string().url().max(300).nullable().optional(),
  availability: z.record(z.array(z.tuple([hhmm, hhmm]))).optional(), slotMinutes: z.coerce.number().int().min(10).max(180).optional(), acceptsBookings: z.boolean().optional(),
});

router.get('/practice', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await prisma.healthPractitioner.findUnique({ where: { ownerUserId: req.user!.id } });
    const counts = p ? await prisma.healthBooking.groupBy({ by: ['status'], where: { practitionerId: p.id }, _count: { _all: true } }) : [];
    ok(res, { profile: p ? { ...practitionerCard(p), bio: p.bio, ahpraNumber: p.ahpraNumber, availability: p.availability, slotMinutes: p.slotMinutes, isActive: p.isActive } : null, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])), kinds: PRACTITIONER_KINDS.filter((k) => k.key !== 'SERVICE'), modalities: MODALITIES, specialties: SPECIALTIES });
  } catch (error) { next(error); }
});

router.put('/practice', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(practiceSchema, req.body);
    const existing = await prisma.healthPractitioner.findUnique({ where: { ownerUserId: req.user!.id } });
    const { availability, ...rest } = data;
    const payload = { ...rest, kind: rest.kind as never, availability: availability ? (normaliseAvailability(availability) as Prisma.InputJsonValue) : existing?.availability === null ? Prisma.JsonNull : undefined };
    let p;
    if (existing) {
      p = await prisma.healthPractitioner.update({ where: { id: existing.id }, data: { ...payload, availability: availability ? (normaliseAvailability(availability) as Prisma.InputJsonValue) : undefined } });
    } else {
      let slug = slugify(data.name);
      if (await prisma.healthPractitioner.findUnique({ where: { slug } })) slug = `${slug}-${randomBytes(2).toString('hex')}`;
      p = await prisma.healthPractitioner.create({ data: { ...payload, availability: availability ? (normaliseAvailability(availability) as Prisma.InputJsonValue) : undefined, slug, ownerUserId: req.user!.id, isVerified: false } });
      logger.info('A practitioner profile was created and awaits verification', { practitionerId: p.id });
    }
    ok(res, { ...practitionerCard(p), bio: p.bio, ahpraNumber: p.ahpraNumber, availability: p.availability, slotMinutes: p.slotMinutes, pendingVerification: !p.isVerified }, existing ? 200 : 201);
  } catch (error) { next(error); }
});

router.get('/practice/bookings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await prisma.healthPractitioner.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true } });
    if (!p) throw new ApiError(404, 'You have no practice profile yet');
    const bookings = await prisma.healthBooking.findMany({ where: { practitionerId: p.id }, orderBy: { scheduledAt: 'desc' }, take: 200, include: { ...bookingInclude, user: { select: { firstName: true, lastName: true, email: true } } } });
    ok(res, bookings.map((b) => ({ ...presentBooking(b, true), member: { name: [b.user.firstName, b.user.lastName].filter(Boolean).join(' ') || 'A member', email: b.user.email } })));
  } catch (error) { next(error); }
});

router.patch('/practice/bookings/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await prisma.healthPractitioner.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true, name: true } });
    if (!p) throw new ApiError(404, 'You have no practice profile yet');
    const booking = await prisma.healthBooking.findFirst({ where: { id: req.params.id, practitionerId: p.id } });
    if (!booking) throw new ApiError(404, 'Booking not found');
    const data = parse(z.object({ status: z.enum(['CONFIRMED', 'DECLINED', 'COMPLETED', 'NO_SHOW']).optional(), meetingLink: z.string().url().max(300).nullable().optional(), practitionerNote: z.string().max(1000).nullable().optional() }), req.body);
    const updated = await prisma.healthBooking.update({ where: { id: booking.id }, data, include: bookingInclude });
    if (data.status && data.status !== booking.status) {
      const words: Record<string, string> = { CONFIRMED: 'confirmed', DECLINED: 'declined', COMPLETED: 'marked as done', NO_SHOW: 'marked as missed' };
      await prisma.notification.create({ data: { userId: booking.userId, type: 'SYSTEM', title: `Your appointment was ${words[data.status]}`, message: `${p.name}, ${booking.scheduledAt.toISOString().slice(0, 10)}.${data.status === 'DECLINED' ? ' You can pick another time or another practitioner.' : ''}`, link: '/dashboard/wellness/bookings', data: { kind: 'WELLNESS_BOOKING_STATUS', bookingId: booking.id } } }).catch(() => null);
    }
    ok(res, presentBooking(updated, true));
  } catch (error) { next(error); }
});

// ----------------------------------------------------------------- bookings

router.get('/bookings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bookings = await prisma.healthBooking.findMany({ where: { userId: req.user!.id }, orderBy: { scheduledAt: 'desc' }, take: 100, include: bookingInclude });
    const now = Date.now();
    const shares = await prisma.healthShare.findMany({ where: { userId: req.user!.id, bookingId: { in: bookings.map((b) => b.id) } }, select: { id: true, bookingId: true, token: true, expiresAt: true, revokedAt: true, openedCount: true } });
    const notes = await prisma.healthNote.groupBy({ by: ['bookingId'], where: { userId: req.user!.id, bookingId: { not: null } }, _count: { _all: true } });
    const all = bookings.map((b) => ({ ...presentBooking(b), share: shares.find((s) => s.bookingId === b.id) ?? null, noteCount: notes.find((n) => n.bookingId === b.id)?._count._all ?? 0 }));
    ok(res, { upcoming: all.filter((b) => new Date(b.scheduledAt).getTime() >= now && ['REQUESTED', 'CONFIRMED'].includes(b.status)).reverse(), past: all.filter((b) => new Date(b.scheduledAt).getTime() < now || !['REQUESTED', 'CONFIRMED'].includes(b.status)) });
  } catch (error) { next(error); }
});

router.patch('/bookings/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.healthBooking.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: bookingInclude });
    if (!booking) throw new ApiError(404, 'Booking not found');
    parse(z.object({ status: z.literal('CANCELLED') }), req.body);
    if (!['REQUESTED', 'CONFIRMED'].includes(booking.status)) throw new ApiError(400, 'This booking is already over');
    if (booking.status === 'CONFIRMED' && !canCancel(booking.scheduledAt)) throw new ApiError(400, 'Confirmed bookings can be cancelled up to twenty-four hours before. Please contact the practitioner directly.');
    const updated = await prisma.healthBooking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' }, include: bookingInclude });
    if (booking.practitioner.ownerUserId) await prisma.notification.create({ data: { userId: booking.practitioner.ownerUserId, type: 'SYSTEM', title: 'A booking was cancelled', message: `${booking.scheduledAt.toISOString().slice(0, 16).replace('T', ' ')} UTC is free again.`, link: '/dashboard/wellness/practice', data: { kind: 'WELLNESS_BOOKING_CANCEL', bookingId: booking.id } } }).catch(() => null);
    ok(res, presentBooking(updated));
  } catch (error) { next(error); }
});

/** The appointment as a calendar file, for the member's own calendar. */
router.get('/bookings/:id/ics', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.healthBooking.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { practitioner: { select: { name: true, kind: true, suburb: true, city: true, state: true } } } });
    if (!booking) throw new ApiError(404, 'Booking not found');
    const p = booking.practitioner;
    const ics = buildBookingIcs({
      id: booking.id, scheduledAt: booking.scheduledAt, durationMinutes: booking.durationMinutes, mode: booking.mode, practitionerName: p.name,
      kindLabel: PRACTITIONER_KINDS.find((k) => k.key === p.kind)?.label, meetingLink: booking.meetingLink, location: [p.suburb, p.city, p.state].filter(Boolean).join(', ') || null,
      appUrl: `${clientBase()}/dashboard/wellness/bookings?visit=${booking.id}`,
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="athena-appointment-${isoDay(booking.scheduledAt)}.ics"`);
    res.send(ics);
  } catch (error) { next(error); }
});

/** A moderator can take a review out of the average without deleting the visit it came from. */
router.patch('/reviews/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isModeratorRole(req.user!.role)) throw new ApiError(403, 'Only a moderator can hide a review');
    const { isHidden } = parse(z.object({ isHidden: z.boolean() }), req.body);
    const existing = await prisma.healthReview.findUnique({ where: { id: req.params.id }, select: { id: true, practitionerId: true } });
    if (!existing) throw new ApiError(404, 'Review not found');
    const review = await prisma.healthReview.update({ where: { id: existing.id }, data: { isHidden } });
    const all = await prisma.healthReview.findMany({ where: { practitionerId: existing.practitionerId }, select: { rating: true, isHidden: true } });
    await prisma.healthPractitioner.update({ where: { id: existing.practitionerId }, data: recomputeRating(all) });
    ok(res, { id: review.id, isHidden: review.isHidden });
  } catch (error) { next(error); }
});

router.post('/bookings/:id/review', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.healthBooking.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (booking.status !== 'COMPLETED') throw new ApiError(400, 'Only a completed visit can be rated. That is what makes the ratings mean something.');
    const data = parse(z.object({ rating: scale, comment: z.string().max(1000).optional() }), req.body);
    const review = await prisma.healthReview.upsert({ where: { bookingId: booking.id }, create: { practitionerId: booking.practitionerId, userId: req.user!.id, bookingId: booking.id, rating: data.rating, comment: data.comment?.trim() || null }, update: { rating: data.rating, comment: data.comment?.trim() || null } });
    const all = await prisma.healthReview.findMany({ where: { practitionerId: booking.practitionerId }, select: { rating: true, isHidden: true } });
    await prisma.healthPractitioner.update({ where: { id: booking.practitionerId }, data: recomputeRating(all) });
    ok(res, review, 201);
  } catch (error) { next(error); }
});

router.post('/bookings/:id/follow-up', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const original = await prisma.healthBooking.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { practitioner: true } });
    if (!original) throw new ApiError(404, 'Booking not found');
    const p = original.practitioner;
    if (!p.isActive || !p.acceptsBookings) throw new ApiError(400, 'This practitioner is no longer taking bookings here');
    const data = parse(z.object({ scheduledAt: z.string().datetime(), mode: z.enum(['TELEHEALTH', 'IN_PERSON']).optional() }), req.body);
    const start = new Date(data.scheduledAt);
    const tz = p.ownerUserId ? await memberTimezone(p.ownerUserId) : undefined;
    const day = localParts(start, tz ?? 'Australia/Brisbane').day;
    const booked = await prisma.healthBooking.findMany({ where: { practitionerId: p.id, status: { in: ['REQUESTED', 'CONFIRMED'] }, scheduledAt: { gte: dayDate(addDays(day, -1)), lte: dayDate(addDays(day, 2)) } }, select: { scheduledAt: true, durationMinutes: true } });
    if (!availableSlots({ availability: p.availability as Availability | null, slotMinutes: p.slotMinutes, timezone: tz, day, booked }).some((s) => s.start === start.toISOString())) throw new ApiError(400, 'That time is not free. Pick one of the offered slots.');
    const booking = await prisma.healthBooking.create({ data: { practitionerId: p.id, userId: req.user!.id, scheduledAt: start, durationMinutes: p.slotMinutes, mode: data.mode ?? original.mode, reason: encryptJson({ text: 'Follow-up' }), followUpOfId: original.id }, include: bookingInclude });
    if (p.ownerUserId) await prisma.notification.create({ data: { userId: p.ownerUserId, type: 'SYSTEM', title: 'A follow-up booking request', message: 'Confirm it from your practice page.', link: '/dashboard/wellness/practice', data: { kind: 'WELLNESS_BOOKING', bookingId: booking.id } } }).catch(() => null);
    ok(res, presentBooking(booking), 201);
  } catch (error) { next(error); }
});

// ------------------------------------------------------------------- badges

/** The wellness badges: the streaks, the circle, the month of a goal met. Earned ones first. */
router.get('/badges', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const all = await getUserAchievements(req.user!.id);
    const badges = all.achievements.filter((a) => a.category === 'wellness').map((a) => ({ id: a.id, name: a.name, description: a.description, icon: a.icon, xp: a.xp, earned: a.earned, earnedAt: a.earnedAt ?? null }))
      .sort((a, b) => Number(b.earned) - Number(a.earned));
    ok(res, { badges, earned: badges.filter((b) => b.earned).length, total: badges.length });
  } catch (error) { next(error); }
});

// ------------------------------------------------------------------- habits

async function habitsWithProgress(userId: string, today: string) {
  const [habits, logs] = await Promise.all([
    prisma.habit.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.habitLog.findMany({ where: { habit: { userId }, done: true, day: { gte: dayDate(addDays(today, -400)) } }, select: { habitId: true, day: true } }),
  ]);
  return habits.map((h) => {
    const days = logs.filter((l) => l.habitId === h.id).map((l) => isoDay(l.day));
    const t = h.templateKey ? templateByKey(h.templateKey) : undefined;
    return { id: h.id, name: h.name, templateKey: h.templateKey, difficulty: h.difficulty, targetPerWeek: h.targetPerWeek, cue: h.cue, reminderTime: h.reminderTime, evidenceNote: h.evidenceNote ?? t?.evidenceNote ?? null, evidenceUrl: h.evidenceUrl ?? t?.evidenceUrl ?? null, isArchived: h.isArchived, createdAt: h.createdAt, streak: streakFrom(days, today), week: weekProgress(days, today, h.targetPerWeek) };
  });
}

router.get('/habits', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const habits = await habitsWithProgress(req.user!.id, today);
    ok(res, { today, habits: habits.filter((h) => !h.isArchived), archived: habits.filter((h) => h.isArchived).length, templates: HABIT_TEMPLATES });
  } catch (error) { next(error); }
});

const habitSchema = z.object({ templateKey: z.string().max(40).optional(), name: z.string().min(2).max(80).optional(), difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(), targetPerWeek: z.coerce.number().int().min(1).max(7).optional(), cue: z.string().max(160).nullable().optional(), reminderTime: hhmm.nullable().optional() });

async function createHabit(userId: string, data: z.infer<typeof habitSchema>) {
  const t = data.templateKey ? templateByKey(data.templateKey) : undefined;
  if (data.templateKey && !t) throw new ApiError(400, 'Unknown habit template');
  const name = data.name?.trim() || t?.name;
  if (!name) throw new ApiError(400, 'A habit needs a name or a template');
  const active = await prisma.habit.count({ where: { userId, isArchived: false } });
  if (active >= 12) throw new ApiError(400, 'Twelve habits at once is too many to keep; archive one first');
  return prisma.habit.create({ data: { userId, name, templateKey: t?.key ?? null, difficulty: data.difficulty ?? t?.difficulty ?? 'MEDIUM', targetPerWeek: data.targetPerWeek ?? t?.targetPerWeek ?? 7, cue: data.cue ?? t?.cue ?? null, reminderTime: data.reminderTime ?? null, evidenceNote: t?.evidenceNote ?? null, evidenceUrl: t?.evidenceUrl ?? null } });
}

router.post('/habits', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const habit = await createHabit(req.user!.id, parse(habitSchema, req.body));
    const today = await memberDay(req);
    ok(res, (await habitsWithProgress(req.user!.id, today)).find((h) => h.id === habit.id), 201);
  } catch (error) { next(error); }
});

router.patch('/habits/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.habit.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new ApiError(404, 'Habit not found');
    const data = parse(habitSchema.omit({ templateKey: true }).extend({ isArchived: z.boolean().optional() }), req.body);
    await prisma.habit.update({ where: { id: existing.id }, data: { ...(data.name ? { name: data.name.trim() } : {}), ...(data.difficulty ? { difficulty: data.difficulty } : {}), ...(data.targetPerWeek ? { targetPerWeek: data.targetPerWeek } : {}), ...(data.cue !== undefined ? { cue: data.cue } : {}), ...(data.reminderTime !== undefined ? { reminderTime: data.reminderTime } : {}), ...(data.isArchived !== undefined ? { isArchived: data.isArchived } : {}) } });
    ok(res, (await habitsWithProgress(req.user!.id, await memberDay(req))).find((h) => h.id === existing.id));
  } catch (error) { next(error); }
});

router.delete('/habits/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.habit.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (r.count === 0) throw new ApiError(404, 'Habit not found');
    res.status(204).send();
  } catch (error) { next(error); }
});

router.post('/habits/:id/log', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const habit = await prisma.habit.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!habit) throw new ApiError(404, 'Habit not found');
    const data = parse(z.object({ day: isoDaySchema.optional(), done: z.boolean().optional(), note: z.string().max(200).optional() }), req.body);
    const today = await memberDay(req);
    const day = data.day ?? today;
    if (daysBetween(day, today) < 0) throw new ApiError(400, 'That day has not happened yet');
    if (daysBetween(day, today) > 14) throw new ApiError(400, 'Only the last two weeks can be logged after the fact');
    const before = await prisma.habitLog.findMany({ where: { habitId: habit.id, done: true }, select: { day: true } });
    const prev = streakFrom(before.map((l) => isoDay(l.day)), today);
    const log = await prisma.habitLog.upsert({ where: { habitId_day: { habitId: habit.id, day: dayDate(day) } }, create: { habitId: habit.id, day: dayDate(day), done: data.done ?? true, note: data.note }, update: { done: data.done ?? true, note: data.note } });
    const after = await prisma.habitLog.findMany({ where: { habitId: habit.id, done: true }, select: { day: true } });
    const days = after.map((l) => isoDay(l.day));
    const streak = streakFrom(days, today);
    const milestone = log.done ? milestoneReached(prev.current, streak.current) : null;
    const ach = milestone ? achievementForStreak(streak.current) : null;
    if (ach) await awardAchievement(req.user!.id, ach).catch(() => false);
    ok(res, { log: { ...log, day: isoDay(log.day) }, streak, week: weekProgress(days, today, habit.targetPerWeek), milestone, celebration: log.done ? celebrate(streak.current, habit.name) : null }, 201);
  } catch (error) { next(error); }
});

// --------------------------------------------------------------- challenges

const challengeInclude = { createdBy: { select: AUTHOR_SELECT }, members: { select: { userId: true, habitId: true } } } as const;
const presentChallenge = (c: { id: string; name: string; description: string; habitTemplateKey: string | null; startsOn: Date; endsOn: Date; isPublic: boolean; createdById: string; createdAt: Date; createdBy: { id: string; firstName: string | null; lastName: string | null; displayName: string | null; avatar: string | null; role: string }; members: Array<{ userId: string; habitId: string | null }> }, viewerId: string, today: string) => ({
  id: c.id, name: c.name, description: c.description, habitTemplateKey: c.habitTemplateKey, template: c.habitTemplateKey ? templateByKey(c.habitTemplateKey) ?? null : null, startsOn: isoDay(c.startsOn), endsOn: isoDay(c.endsOn), isPublic: c.isPublic, createdAt: c.createdAt,
  createdBy: presentAuthor(c.createdBy, false, viewerId), memberCount: c.members.length, joined: c.members.some((m) => m.userId === viewerId), myHabitId: c.members.find((m) => m.userId === viewerId)?.habitId ?? null, isCreator: c.createdById === viewerId,
  phase: today < isoDay(c.startsOn) ? 'upcoming' : today > isoDay(c.endsOn) ? 'finished' : 'running', daysLeft: Math.max(0, daysBetween(today, isoDay(c.endsOn))),
});

router.get('/challenges', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const rows = await prisma.wellnessChallenge.findMany({ where: { OR: [{ isPublic: true, endsOn: { gte: dayDate(addDays(today, -1)) } }, { members: { some: { userId: req.user!.id } } }, { createdById: req.user!.id }] }, orderBy: { startsOn: 'asc' }, take: 60, include: challengeInclude });
    ok(res, { today, challenges: rows.map((c) => presentChallenge(c, req.user!.id, today)) });
  } catch (error) { next(error); }
});

router.post('/challenges', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(z.object({ name: z.string().min(3).max(80), description: z.string().min(10).max(1000), habitTemplateKey: z.string().max(40).nullable().optional(), startsOn: isoDaySchema, endsOn: isoDaySchema, isPublic: z.boolean().optional(), habitId: uuid.optional() }), req.body);
    const today = await memberDay(req);
    if (daysBetween(data.startsOn, data.endsOn) < 6 || daysBetween(data.startsOn, data.endsOn) > 90) throw new ApiError(400, 'A challenge runs from one week to three months');
    if (daysBetween(today, data.startsOn) < -7) throw new ApiError(400, 'A challenge can start up to a week ago');
    if (data.habitTemplateKey && !templateByKey(data.habitTemplateKey)) throw new ApiError(400, 'Unknown habit template');
    const habitId = await habitForChallenge(req.user!.id, data.habitTemplateKey ?? null, data.habitId);
    const c = await prisma.wellnessChallenge.create({ data: { name: data.name.trim(), description: data.description.trim(), habitTemplateKey: data.habitTemplateKey ?? null, startsOn: dayDate(data.startsOn), endsOn: dayDate(data.endsOn), isPublic: data.isPublic ?? true, createdById: req.user!.id, members: { create: { userId: req.user!.id, habitId } } }, include: challengeInclude });
    ok(res, presentChallenge(c, req.user!.id, today), 201);
  } catch (error) { next(error); }
});

async function habitForChallenge(userId: string, templateKey: string | null, habitId?: string): Promise<string | null> {
  if (habitId) {
    const h = await prisma.habit.findFirst({ where: { id: habitId, userId }, select: { id: true } });
    if (!h) throw new ApiError(404, 'Habit not found');
    return h.id;
  }
  if (!templateKey) return null;
  const existing = await prisma.habit.findFirst({ where: { userId, templateKey, isArchived: false }, select: { id: true } });
  if (existing) return existing.id;
  return (await createHabit(userId, { templateKey })).id;
}

router.get('/challenges/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const c = await prisma.wellnessChallenge.findUnique({ where: { id: req.params.id }, include: { ...challengeInclude, members: { include: { user: { select: AUTHOR_SELECT } } } } });
    if (!c) throw new ApiError(404, 'Challenge not found');
    const base = presentChallenge({ ...c, members: c.members.map((m) => ({ userId: m.userId, habitId: m.habitId })) }, req.user!.id, today);
    if (!c.isPublic && !base.joined) throw new ApiError(404, 'Challenge not found');
    const habitIds = c.members.map((m) => m.habitId).filter((x): x is string => Boolean(x));
    const logs = await prisma.habitLog.findMany({ where: { habitId: { in: habitIds }, done: true, day: { gte: c.startsOn, lte: c.endsOn } }, select: { habitId: true, day: true } });
    const leaderboard = challengeLeaderboard(c.members.map((m) => ({ userId: m.userId, name: presentAuthor(m.user, false, req.user!.id).name, isYou: m.userId === req.user!.id, doneDays: logs.filter((l) => l.habitId === m.habitId).map((l) => isoDay(l.day)) })), base.startsOn, base.endsOn, today);
    ok(res, { ...base, leaderboard });
  } catch (error) { next(error); }
});

router.post('/challenges/:id/join', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const c = await prisma.wellnessChallenge.findUnique({ where: { id: req.params.id }, include: challengeInclude });
    if (!c || !c.isPublic) throw new ApiError(404, 'Challenge not found');
    if (isoDay(c.endsOn) < today) throw new ApiError(400, 'This challenge has finished');
    if (c.members.some((m) => m.userId === req.user!.id)) throw new ApiError(400, 'You are already in');
    const data = parse(z.object({ habitId: uuid.optional() }), req.body ?? {});
    const habitId = await habitForChallenge(req.user!.id, c.habitTemplateKey, data.habitId);
    await prisma.wellnessChallengeMember.create({ data: { challengeId: c.id, userId: req.user!.id, habitId } });
    const fresh = await prisma.wellnessChallenge.findUnique({ where: { id: c.id }, include: challengeInclude });
    ok(res, presentChallenge(fresh!, req.user!.id, today));
  } catch (error) { next(error); }
});

// -------------------------------------------------------------------- goals

const METRICS = ['SLEEP_HOURS', 'ACTIVITY_SESSIONS', 'ACTIVITY_MINUTES', 'CHECKIN_DAYS', 'HYDRATION_GLASSES', 'MEDITATION_DAYS', 'STEPS'] as const;
const goalSchema = z.object({ metric: z.enum(METRICS), target: z.coerce.number().min(0.5).max(100000), period: z.enum(['DAY', 'WEEK']).optional(), label: z.string().max(80).nullable().optional(), reviewEveryWeeks: z.coerce.number().int().min(2).max(12).optional() });

async function goalsWithProgress(userId: string, today: string) {
  const goals = await prisma.wellnessGoal.findMany({ where: { userId, status: { in: ['ACTIVE', 'PAUSED', 'ACHIEVED'] } }, orderBy: { createdAt: 'asc' } });
  if (goals.length === 0) return [];
  const entries = await loadEntries(userId, ['SLEEP', 'ACTIVITY', 'CHECKIN', 'HYDRATION'], addDays(today, -70), today);
  const data: GoalData = { sleep: toSleep(entries), activity: toActivity(entries), checkins: toCheckins(entries), hydration: toHydration(entries) };
  return goals.map((g) => ({ id: g.id, metric: g.metric, target: g.target, period: g.period, label: g.label, startedOn: isoDay(g.startedOn), reviewEveryWeeks: g.reviewEveryWeeks, nextReviewOn: isoDay(g.nextReviewOn), status: g.status, reviewDue: isoDay(g.nextReviewOn) <= today, progress: goalProgress({ metric: g.metric, target: g.target, period: g.period, startedOn: isoDay(g.startedOn) }, data, today) }));
}

router.get('/goals', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    ok(res, { today, goals: await goalsWithProgress(req.user!.id, today), metrics: METRICS });
  } catch (error) { next(error); }
});

router.post('/goals', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(goalSchema, req.body);
    const today = await memberDay(req);
    const active = await prisma.wellnessGoal.count({ where: { userId: req.user!.id, status: 'ACTIVE' } });
    if (active >= 8) throw new ApiError(400, 'Eight goals at once is too many; pause or archive one first');
    const period = data.period ?? (['SLEEP_HOURS', 'HYDRATION_GLASSES', 'STEPS'].includes(data.metric) ? 'DAY' : 'WEEK');
    const g = await prisma.wellnessGoal.create({ data: { userId: req.user!.id, metric: data.metric, target: data.target, period, label: data.label ?? null, startedOn: dayDate(today), reviewEveryWeeks: data.reviewEveryWeeks ?? 4, nextReviewOn: dayDate(addDays(today, (data.reviewEveryWeeks ?? 4) * 7)) } });
    ok(res, (await goalsWithProgress(req.user!.id, today)).find((x) => x.id === g.id), 201);
  } catch (error) { next(error); }
});

router.patch('/goals/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const g = await prisma.wellnessGoal.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!g) throw new ApiError(404, 'Goal not found');
    const data = parse(goalSchema.partial().omit({ metric: true }).extend({ status: z.enum(['ACTIVE', 'PAUSED', 'ACHIEVED', 'ARCHIVED']).optional() }), req.body);
    await prisma.wellnessGoal.update({ where: { id: g.id }, data: { ...(data.target ? { target: data.target } : {}), ...(data.label !== undefined ? { label: data.label } : {}), ...(data.reviewEveryWeeks ? { reviewEveryWeeks: data.reviewEveryWeeks } : {}), ...(data.status ? { status: data.status } : {}), ...(data.period ? { period: data.period } : {}) } });
    const today = await memberDay(req);
    ok(res, (await goalsWithProgress(req.user!.id, today)).find((x) => x.id === g.id) ?? { id: g.id, status: data.status });
  } catch (error) { next(error); }
});

router.delete('/goals/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.wellnessGoal.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (r.count === 0) throw new ApiError(404, 'Goal not found');
    res.status(204).send();
  } catch (error) { next(error); }
});

router.post('/goals/:id/review', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = await memberDay(req);
    const current = (await goalsWithProgress(req.user!.id, today)).find((x) => x.id === req.params.id);
    if (!current) throw new ApiError(404, 'Goal not found');
    const data = parse(z.object({ decision: z.enum(['keep', 'raise', 'ease', 'achieved', 'suggest']).optional(), target: z.coerce.number().min(0.5).max(100000).optional() }), req.body ?? {});
    const suggestion = goalReviewText(current.progress, Math.max(1, Math.round(daysBetween(current.startedOn, today) / 7)));
    if (!data.decision || data.decision === 'suggest') return ok(res, { goal: current, suggestion });
    const target = data.target ?? (data.decision === 'raise' || data.decision === 'ease' ? suggestion.suggestedTarget : current.target);
    await prisma.wellnessGoal.update({ where: { id: current.id }, data: { target, status: data.decision === 'achieved' ? 'ACHIEVED' : 'ACTIVE', nextReviewOn: dayDate(addDays(today, current.reviewEveryWeeks * 7)), weeksMet: current.progress.weeksMet, bestStreakWeeks: Math.max(current.progress.bestStreakWeeks, 0) } });
    if (current.progress.currentStreakWeeks >= 4) await awardAchievement(req.user!.id, 'GOAL_MONTH').catch(() => false);
    ok(res, { goal: (await goalsWithProgress(req.user!.id, today)).find((x) => x.id === current.id), suggestion });
  } catch (error) { next(error); }
});

export default router;
