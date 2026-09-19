/**
 * Admin Catalogue Routes
 *
 * The accelerator, investor and insurance catalogues had read routes and
 * nothing that could write them, so every one of those pages was empty in
 * production unless someone wrote SQL. This router is how staff enter real
 * cohorts and their sessions, real investors and real insurance products, and
 * how a founder's introduction request stops sitting at REQUESTED forever.
 *
 * Nothing here invents data. The catalogues start empty and staff enter what
 * they have verified. The one default is the blueprint's twelve-week
 * curriculum (section 9.2), offered as the sessions of a new cohort so staff
 * edit dates and meeting links rather than typing twelve titles by hand.
 *
 * Guards are attached per route rather than with router.use, so this router
 * can sit in front of admin.routes.ts without re-authenticating every
 * /api/admin request it does not handle (the same arrangement as
 * admin-operations.routes.ts).
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { sendEmail } from '../utils/email';
import { logger } from '../utils/logger';

const router = Router();

const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

// ============================================================================
// SHARED VALIDATION
// ============================================================================

/** A form sends '' for a field left blank; store that as null, not ''. */
const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

const isoDate = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'must be a valid date');

const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());
const optionalUrl = z.preprocess(emptyToNull, z.string().trim().url().max(500).nullable().optional());
const optionalMoney = z.preprocess(emptyToNull, z.coerce.number().min(0).max(1_000_000_000).nullable().optional());
const optionalInt = (max: number) => z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(max).nullable().optional());
const stringList = (max: number, length = 120) =>
  z.array(z.string().trim().min(1).max(length)).max(max);

function parseBody<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
  }
  return parsed.data;
}

/** Strip the keys a PATCH did not send, so Prisma leaves those columns alone. */
function sentFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(data) as Array<keyof T>) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);

/** In-app notification plus an email, the way the grant and insurance reviews tell a member. */
async function tellMember(userId: string, subject: string, line: string, link: string) {
  await prisma.notification.create({ data: { userId, type: 'SYSTEM', title: subject, message: line, link } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
  if (!user?.email) return;
  const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const greeting = user.firstName ? `Hi ${user.firstName},` : 'Hi,';
  await sendEmail({
    to: user.email,
    subject,
    text: `${greeting}\n\n${line}\n\nSee the details: ${base}${link}\n\nATHENA`,
    html: `<p>${greeting}</p><p>${line}</p><p><a href="${base}${link}">See the details</a></p><p>ATHENA</p>`,
  });
}

// ============================================================================
// ACCELERATOR: THE TWELVE-WEEK CURRICULUM
// ============================================================================

/**
 * Blueprint 9.2, week by week. Each block runs two weeks and ends with the
 * deliverable a founder uploads to mark the block done.
 */
export const DEFAULT_CURRICULUM = [
  { weeks: [1, 2], title: 'Market Validation & Customer Research', deliverable: 'Customer interview notes (10 interviews minimum)' },
  { weeks: [3, 4], title: 'Product-Market Fit', deliverable: 'MVP specification document' },
  { weeks: [5, 6], title: 'Go-to-Market Strategy', deliverable: 'GTM plan with customer acquisition tactics' },
  { weeks: [7, 8], title: 'Fundraising & Cap Table', deliverable: 'Investor pitch deck, financial model' },
  { weeks: [9, 10], title: 'Hiring & Team Building', deliverable: 'Hiring plan, job descriptions' },
  { weeks: [11, 12], title: 'Launch & Scale', deliverable: 'Launch checklist, 6-month growth plan' },
] as const;

export const DEFAULT_SESSION_MINUTES = 120;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The twelve default sessions for a cohort: one a week from the start date,
 * at the start date's time of day, two hours long. Staff change the dates
 * and add the meeting links afterwards; the titles and deliverables are the
 * blueprint's.
 */
export function buildDefaultSessions(startDate: Date) {
  return DEFAULT_CURRICULUM.flatMap((block) =>
    block.weeks.map((weekNumber, index) => ({
      weekNumber,
      title: `${block.title} (${index + 1} of ${block.weeks.length})`,
      description:
        index === block.weeks.length - 1
          ? `Week ${weekNumber} of 12. Deliverable due at the end of this week: ${block.deliverable}.`
          : `Week ${weekNumber} of 12. Working towards: ${block.deliverable}.`,
      scheduledAt: new Date(startDate.getTime() + (weekNumber - 1) * WEEK_MS),
      durationMins: DEFAULT_SESSION_MINUTES,
      materials: { block: block.title, deliverable: block.deliverable },
    }))
  );
}

// ============================================================================
// ACCELERATOR COHORTS
// ============================================================================

const COHORT_STATUSES = ['UPCOMING', 'ENROLLING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const cohortFields = {
  name: z.string().trim().min(2).max(120),
  description: optionalText(2000),
  startDate: isoDate,
  endDate: isoDate,
  maxParticipants: z.coerce.number().int().min(1).max(500).optional(),
  priceAud: z.coerce.number().min(0).max(1_000_000).optional(),
  status: z.enum(COHORT_STATUSES).optional(),
  mentorIds: stringList(50).optional(),
};
const createCohortSchema = z.object({
  ...cohortFields,
  // Staff can start from the blueprint's twelve weeks or from nothing.
  useDefaultCurriculum: z.boolean().optional(),
});
const updateCohortSchema = z.object({
  ...cohortFields,
  name: cohortFields.name.optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});

function assertDateOrder(startDate: Date, endDate: Date) {
  if (endDate.getTime() < startDate.getTime()) {
    throw new ApiError(400, 'endDate: must be on or after the start date');
  }
}

const cohortInclude = { _count: { select: { enrollments: true, sessions: true } } } as const;

router.get('/accelerator/cohorts', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const cohorts = await prisma.acceleratorCohort.findMany({
      where: status ? { status: status as any } : {},
      include: cohortInclude,
      orderBy: { startDate: 'desc' },
      take: 200,
    });
    res.json({
      success: true,
      data: cohorts.map((c) => ({ ...c, enrollmentCount: c._count.enrollments, sessionCount: c._count.sessions })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/accelerator/cohorts', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(createCohortSchema, req.body);
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    assertDateOrder(startDate, endDate);

    const useDefault = data.useDefaultCurriculum !== false;
    const sessions = useDefault ? buildDefaultSessions(startDate) : [];

    const cohort = await prisma.acceleratorCohort.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        startDate,
        endDate,
        ...(data.maxParticipants !== undefined ? { maxParticipants: data.maxParticipants } : {}),
        ...(data.priceAud !== undefined ? { priceAud: data.priceAud } : {}),
        ...(data.status ? { status: data.status } : {}),
        mentorIds: data.mentorIds ?? [],
        // The public page reads block titles from here; keep it in step with the sessions.
        curriculum: useDefault ? (DEFAULT_CURRICULUM as unknown as any) : undefined,
        ...(sessions.length > 0 ? { sessions: { create: sessions } } : {}),
      },
      include: { sessions: { orderBy: { weekNumber: 'asc' } }, ...cohortInclude },
    });

    logger.info('Accelerator cohort created', { cohortId: cohort.id, sessions: sessions.length, by: req.user!.id });
    res.status(201).json({ success: true, data: cohort });
  } catch (error) {
    next(error);
  }
});

router.get('/accelerator/cohorts/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cohort = await prisma.acceleratorCohort.findUnique({
      where: { id: req.params.id },
      include: { sessions: { orderBy: { weekNumber: 'asc' } }, ...cohortInclude },
    });
    if (!cohort) throw new ApiError(404, 'Cohort not found');
    res.json({ success: true, data: cohort });
  } catch (error) {
    next(error);
  }
});

router.patch('/accelerator/cohorts/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(updateCohortSchema, req.body);
    const existing = await prisma.acceleratorCohort.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Cohort not found');

    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate;
    assertDateOrder(startDate, endDate);

    const cohort = await prisma.acceleratorCohort.update({
      where: { id: existing.id },
      data: {
        ...sentFields({
          name: data.name,
          description: data.description,
          maxParticipants: data.maxParticipants,
          priceAud: data.priceAud,
          status: data.status,
          mentorIds: data.mentorIds,
        }),
        ...(data.startDate ? { startDate } : {}),
        ...(data.endDate ? { endDate } : {}),
      },
      include: { sessions: { orderBy: { weekNumber: 'asc' } }, ...cohortInclude },
    });

    logger.info('Accelerator cohort updated', { cohortId: cohort.id, by: req.user!.id });
    res.json({ success: true, data: cohort });
  } catch (error) {
    next(error);
  }
});

router.delete('/accelerator/cohorts/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.acceleratorCohort.findUnique({ where: { id: req.params.id }, include: cohortInclude });
    if (!existing) throw new ApiError(404, 'Cohort not found');
    // A cohort someone has enrolled in is a record of her money and her work; cancel it instead.
    if (existing._count.enrollments > 0) {
      throw new ApiError(409, 'This cohort has enrolments. Set its status to cancelled instead of deleting it.');
    }

    await prisma.$transaction([
      prisma.acceleratorSession.deleteMany({ where: { cohortId: existing.id } }),
      prisma.acceleratorCohort.delete({ where: { id: existing.id } }),
    ]);

    logger.info('Accelerator cohort deleted', { cohortId: existing.id, by: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- sessions

const sessionFields = {
  weekNumber: z.coerce.number().int().min(1).max(52),
  title: z.string().trim().min(2).max(160),
  description: optionalText(2000),
  scheduledAt: isoDate,
  durationMins: z.coerce.number().int().min(15).max(480).optional(),
  meetingUrl: optionalUrl,
  recordingUrl: optionalUrl,
  materials: z
    .union([z.array(z.unknown()), z.record(z.unknown())])
    .nullable()
    .optional()
    .refine((m) => !m || JSON.stringify(m).length <= 8000, 'materials is limited to 8000 characters'),
};
const createSessionSchema = z.object(sessionFields);
const updateSessionSchema = z.object({
  ...sessionFields,
  weekNumber: sessionFields.weekNumber.optional(),
  title: sessionFields.title.optional(),
  scheduledAt: isoDate.optional(),
});

/**
 * Put the blueprint's twelve weeks on a cohort that has no sessions yet, for
 * cohorts created without them. It refuses when sessions exist so it can never
 * duplicate or overwrite what staff have already scheduled.
 */
router.post('/accelerator/cohorts/:id/sessions/default', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cohort = await prisma.acceleratorCohort.findUnique({ where: { id: req.params.id }, include: cohortInclude });
    if (!cohort) throw new ApiError(404, 'Cohort not found');
    if (cohort._count.sessions > 0) {
      throw new ApiError(409, 'This cohort already has sessions. Remove them first if you want the default twelve.');
    }

    const sessions = buildDefaultSessions(cohort.startDate);
    await prisma.$transaction([
      prisma.acceleratorSession.createMany({ data: sessions.map((s) => ({ ...s, cohortId: cohort.id })) }),
      prisma.acceleratorCohort.update({ where: { id: cohort.id }, data: { curriculum: DEFAULT_CURRICULUM as unknown as any } }),
    ]);

    const created = await prisma.acceleratorSession.findMany({ where: { cohortId: cohort.id }, orderBy: { weekNumber: 'asc' } });
    logger.info('Default curriculum added to cohort', { cohortId: cohort.id, by: req.user!.id });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.post('/accelerator/cohorts/:id/sessions', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(createSessionSchema, req.body);
    const cohort = await prisma.acceleratorCohort.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!cohort) throw new ApiError(404, 'Cohort not found');

    const session = await prisma.acceleratorSession.create({
      data: {
        cohortId: cohort.id,
        weekNumber: data.weekNumber,
        title: data.title,
        description: data.description ?? null,
        scheduledAt: new Date(data.scheduledAt),
        ...(data.durationMins !== undefined ? { durationMins: data.durationMins } : {}),
        meetingUrl: data.meetingUrl ?? null,
        recordingUrl: data.recordingUrl ?? null,
        ...(data.materials !== undefined ? { materials: (data.materials ?? undefined) as any } : {}),
      },
    });

    logger.info('Accelerator session created', { cohortId: cohort.id, sessionId: session.id, by: req.user!.id });
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

router.patch('/accelerator/cohorts/:id/sessions/:sessionId', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(updateSessionSchema, req.body);
    const existing = await prisma.acceleratorSession.findFirst({ where: { id: req.params.sessionId, cohortId: req.params.id } });
    if (!existing) throw new ApiError(404, 'Session not found');

    const session = await prisma.acceleratorSession.update({
      where: { id: existing.id },
      data: {
        ...sentFields({
          weekNumber: data.weekNumber,
          title: data.title,
          description: data.description,
          durationMins: data.durationMins,
          meetingUrl: data.meetingUrl,
          recordingUrl: data.recordingUrl,
        }),
        ...(data.scheduledAt ? { scheduledAt: new Date(data.scheduledAt) } : {}),
        ...(data.materials !== undefined ? { materials: (data.materials ?? undefined) as any } : {}),
      },
    });

    logger.info('Accelerator session updated', { sessionId: session.id, by: req.user!.id });
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

router.delete('/accelerator/cohorts/:id/sessions/:sessionId', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.acceleratorSession.findFirst({ where: { id: req.params.sessionId, cohortId: req.params.id } });
    if (!existing) throw new ApiError(404, 'Session not found');
    await prisma.acceleratorSession.delete({ where: { id: existing.id } });
    logger.info('Accelerator session deleted', { sessionId: existing.id, by: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// INVESTORS
// ============================================================================

const INVESTOR_TYPES = ['ANGEL', 'VC', 'CORPORATE_VC', 'FAMILY_OFFICE', 'ACCELERATOR', 'GOVERNMENT'] as const;

const investorFields = {
  name: z.string().trim().min(2).max(160),
  type: z.enum(INVESTOR_TYPES),
  description: optionalText(2000),
  minCheckSize: optionalMoney,
  maxCheckSize: optionalMoney,
  stages: stringList(20, 60).optional(),
  industries: stringList(40, 80).optional(),
  regions: stringList(20, 60).optional(),
  thesis: optionalText(2000),
  website: optionalUrl,
  linkedinUrl: optionalUrl,
  portfolioCompanies: z.array(z.string().trim().min(1).max(120)).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
};
const createInvestorSchema = z.object(investorFields);
const updateInvestorSchema = z.object({ ...investorFields, name: investorFields.name.optional(), type: investorFields.type.optional() });

/** A cheque range only means something when its floor is not above its ceiling. */
function assertCheckSizes(min: number | null | undefined, max: number | null | undefined) {
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    throw new ApiError(400, 'minCheckSize: must not be larger than maxCheckSize');
  }
}

const INTRO_DECISIONS = ['APPROVED', 'INTRODUCED', 'MEETING_SCHEDULED', 'DECLINED', 'EXPIRED'] as const;
const introDecisionSchema = z.object({
  status: z.enum(INTRO_DECISIONS),
  outcome: optionalText(1000),
});

// The literal /investors/introductions paths are registered before
// /investors/:id so Express does not hand them to the id handler.

router.get('/investors/introductions', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const introductions = await prisma.investorIntroduction.findMany({
      where: status ? { status: status as any } : {},
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        investor: { select: { id: true, name: true, type: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: introductions });
  } catch (error) {
    next(error);
  }
});

/**
 * Move an introduction along and tell the founder. introducedAt is stamped the
 * first time it becomes INTRODUCED; respondedAt the first time ATHENA or the
 * investor answers (any decision). The outcome column carries the note the
 * founder reads on her dashboard.
 */
router.patch('/investors/introductions/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(introDecisionSchema, req.body);
    const existing = await prisma.investorIntroduction.findUnique({
      where: { id: req.params.id },
      include: { investor: { select: { name: true } } },
    });
    if (!existing) throw new ApiError(404, 'Introduction not found');

    const now = new Date();
    const note = typeof data.outcome === 'string' ? data.outcome.trim() : '';
    const updated = await prisma.investorIntroduction.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        ...(data.outcome !== undefined ? { outcome: note || null } : {}),
        ...(data.status === 'INTRODUCED' && !existing.introducedAt ? { introducedAt: now } : {}),
        ...(!existing.respondedAt ? { respondedAt: now } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        investor: { select: { id: true, name: true, type: true } },
      },
    });

    const name = existing.investor.name;
    const line: Record<(typeof INTRO_DECISIONS)[number], string> = {
      APPROVED: `Your introduction to ${name} has been approved and we are lining it up now.`,
      INTRODUCED: `We have introduced you to ${name}. Keep an eye on your inbox.`,
      MEETING_SCHEDULED: `A meeting with ${name} is on the calendar.`,
      DECLINED: `${name} is not taking this introduction right now.`,
      EXPIRED: `Your request to meet ${name} has expired without a reply.`,
    };
    await tellMember(existing.userId, 'Update on your investor introduction', `${line[data.status]}${note ? ` ${note}` : ''}`, '/dashboard/investors');

    logger.info('Investor introduction decided', { introductionId: existing.id, status: data.status, by: req.user!.id });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.get('/investors', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const active = typeof req.query.active === 'string' ? req.query.active : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const investors = await prisma.investor.findMany({
      where: {
        ...(type ? { type: type as any } : {}),
        ...(active === 'true' ? { isActive: true } : active === 'false' ? { isActive: false } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { introductions: true } } },
      orderBy: { name: 'asc' },
      take: 500,
    });
    res.json({ success: true, data: investors.map((i) => ({ ...i, introductionCount: i._count.introductions })) });
  } catch (error) {
    next(error);
  }
});

router.post('/investors', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(createInvestorSchema, req.body);
    assertCheckSizes(data.minCheckSize, data.maxCheckSize);

    const investor = await prisma.investor.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description ?? null,
        minCheckSize: data.minCheckSize ?? null,
        maxCheckSize: data.maxCheckSize ?? null,
        stages: data.stages ?? [],
        industries: data.industries ?? [],
        regions: data.regions ?? [],
        thesis: data.thesis ?? null,
        website: data.website ?? null,
        linkedinUrl: data.linkedinUrl ?? null,
        ...(data.portfolioCompanies !== undefined ? { portfolioCompanies: (data.portfolioCompanies ?? undefined) as any } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.isVerified !== undefined ? { isVerified: data.isVerified } : {}),
      },
    });

    logger.info('Investor created', { investorId: investor.id, by: req.user!.id });
    res.status(201).json({ success: true, data: investor });
  } catch (error) {
    next(error);
  }
});

router.patch('/investors/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(updateInvestorSchema, req.body);
    const existing = await prisma.investor.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Investor not found');

    const min = data.minCheckSize !== undefined ? data.minCheckSize : existing.minCheckSize === null ? null : Number(existing.minCheckSize);
    const max = data.maxCheckSize !== undefined ? data.maxCheckSize : existing.maxCheckSize === null ? null : Number(existing.maxCheckSize);
    assertCheckSizes(min, max);

    const investor = await prisma.investor.update({
      where: { id: existing.id },
      data: {
        ...sentFields({
          name: data.name,
          type: data.type,
          description: data.description,
          minCheckSize: data.minCheckSize,
          maxCheckSize: data.maxCheckSize,
          stages: data.stages,
          industries: data.industries,
          regions: data.regions,
          thesis: data.thesis,
          website: data.website,
          linkedinUrl: data.linkedinUrl,
          isActive: data.isActive,
          isVerified: data.isVerified,
        }),
        ...(data.portfolioCompanies !== undefined ? { portfolioCompanies: (data.portfolioCompanies ?? undefined) as any } : {}),
      },
    });

    logger.info('Investor updated', { investorId: investor.id, by: req.user!.id });
    res.json({ success: true, data: investor });
  } catch (error) {
    next(error);
  }
});

router.delete('/investors/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.investor.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { introductions: true } } },
    });
    if (!existing) throw new ApiError(404, 'Investor not found');
    // Founders' introduction history hangs off this row; deactivate rather than erase it.
    if (existing._count.introductions > 0) {
      throw new ApiError(409, 'Founders have requested introductions to this investor. Mark them inactive instead of deleting them.');
    }
    await prisma.investor.delete({ where: { id: existing.id } });
    logger.info('Investor deleted', { investorId: existing.id, by: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// INSURANCE PRODUCTS
// ============================================================================

const INSURANCE_TYPES = ['INCOME_PROTECTION', 'LIFE', 'TPD', 'TRAUMA', 'HEALTH'] as const;

const productFields = {
  provider: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(160),
  type: z.enum(INSURANCE_TYPES),
  description: optionalText(2000),
  coverageAmount: optionalMoney,
  premiumMonthly: optionalMoney,
  premiumAnnual: optionalMoney,
  /** Days before a benefit starts. */
  waitingPeriod: optionalInt(730),
  /** Months a benefit is paid for. */
  benefitPeriod: optionalInt(600),
  features: stringList(30, 200).optional(),
  exclusions: stringList(30, 200).optional(),
  commissionPct: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable().optional()),
  isActive: z.boolean().optional(),
};
const createProductSchema = z.object(productFields);
const updateProductSchema = z.object({
  ...productFields,
  provider: productFields.provider.optional(),
  name: productFields.name.optional(),
  type: productFields.type.optional(),
});

router.get('/insurance/products', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const active = typeof req.query.active === 'string' ? req.query.active : undefined;
    const products = await prisma.insuranceProduct.findMany({
      where: {
        ...(type ? { type: type as any } : {}),
        ...(active === 'true' ? { isActive: true } : active === 'false' ? { isActive: false } : {}),
      },
      include: { _count: { select: { applications: true } } },
      orderBy: [{ provider: 'asc' }, { name: 'asc' }],
      take: 500,
    });
    res.json({ success: true, data: products.map((p) => ({ ...p, applicationCount: p._count.applications })) });
  } catch (error) {
    next(error);
  }
});

router.post('/insurance/products', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(createProductSchema, req.body);
    const product = await prisma.insuranceProduct.create({
      data: {
        provider: data.provider,
        name: data.name,
        type: data.type,
        description: data.description ?? null,
        coverageAmount: data.coverageAmount ?? null,
        premiumMonthly: data.premiumMonthly ?? null,
        premiumAnnual: data.premiumAnnual ?? null,
        waitingPeriod: data.waitingPeriod ?? null,
        benefitPeriod: data.benefitPeriod ?? null,
        features: data.features ?? [],
        exclusions: data.exclusions ?? [],
        commissionPct: data.commissionPct ?? null,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    logger.info('Insurance product created', { productId: product.id, by: req.user!.id });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

router.patch('/insurance/products/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseBody(updateProductSchema, req.body);
    const existing = await prisma.insuranceProduct.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Insurance product not found');

    const product = await prisma.insuranceProduct.update({
      where: { id: existing.id },
      data: sentFields({
        provider: data.provider,
        name: data.name,
        type: data.type,
        description: data.description,
        coverageAmount: data.coverageAmount,
        premiumMonthly: data.premiumMonthly,
        premiumAnnual: data.premiumAnnual,
        waitingPeriod: data.waitingPeriod,
        benefitPeriod: data.benefitPeriod,
        features: data.features,
        exclusions: data.exclusions,
        commissionPct: data.commissionPct,
        isActive: data.isActive,
      }),
    });
    logger.info('Insurance product updated', { productId: product.id, by: req.user!.id });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

router.delete('/insurance/products/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.insuranceProduct.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { applications: true } } },
    });
    if (!existing) throw new ApiError(404, 'Insurance product not found');
    // Members' applications reference this row; retire it rather than erase it.
    if (existing._count.applications > 0) {
      throw new ApiError(409, 'Members have applied for this product. Mark it inactive instead of deleting it.');
    }
    await prisma.insuranceProduct.delete({ where: { id: existing.id } });
    logger.info('Insurance product deleted', { productId: existing.id, by: req.user!.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
