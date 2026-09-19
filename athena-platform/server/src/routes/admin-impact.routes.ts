/**
 * Admin Impact Routes
 *
 * The catalogues the impact dashboards read from had no way in: community
 * support programs and their milestones, bridging programs, DV support
 * services, impact partners, First Nations community pages and resources.
 * Staff enter real ones here from the providers' public listings; nothing is
 * seeded, so every list starts empty and stays honest.
 *
 * Also the credentials queue: an overseas credential a member submitted is
 * given its outcome (status, Australian equivalent, bridging, assessing
 * body) and she is told in the app and by email.
 *
 * Guards are attached per route rather than with router.use so this router
 * can sit in front of admin.routes.ts without re-authenticating every
 * /api/admin request that it does not handle (the same arrangement as
 * admin-operations.routes.ts).
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { httpUrl } from '../utils/http-url';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';
import { AU_STATES } from '../services/strategy/au-rates';
import { ASSESSING_BODIES_AS_AT, listAssessingBodies, suggestPathway } from '../services/community-support/assessing-bodies';

const router = Router();
const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

// ------------------------------------------------------------------ helpers

function parse<T extends ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  try {
    return schema.parse(input ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
    }
    throw error;
  }
}

const COMMUNITY_TYPES = ['FIRST_NATIONS', 'REFUGEE_IMMIGRANT', 'DV_SURVIVOR', 'DISABILITY', 'LGBTQIA', 'SINGLE_PARENT', 'RURAL_REGIONAL', 'GENERAL'] as const;
const REGIONS = ['ANZ', 'US', 'SEA', 'MEA', 'UK', 'EU', 'ROW'] as const;
const DV_SERVICE_TYPES = ['CRISIS', 'LEGAL', 'FINANCIAL', 'HOUSING', 'COUNSELING', 'CHILDREN'] as const;
const PARTNER_TYPES = ['GOVERNMENT', 'NGO', 'CORPORATE', 'COMMUNITY'] as const;
const RESOURCE_TYPES = ['FUNDING', 'MENTORSHIP', 'JOB_BOARD', 'TRAINING', 'CULTURAL'] as const;
const CREDENTIAL_STATUSES = ['PENDING_REVIEW', 'RECOGNIZED', 'PARTIALLY_RECOGNIZED', 'BRIDGING_REQUIRED', 'NOT_RECOGNIZED'] as const;

const text = (min: number, max: number) => z.string().trim().min(min, `must be at least ${min} characters`).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = () => httpUrl(2048).nullable().optional();
const stringList = (max: number, each: number) => z.array(z.string().trim().min(1).max(each)).max(max);
const dateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'must be a date');
const optionalDate = () => dateString.nullable().optional();
const toDate = (value: string | null | undefined) => (value === undefined ? undefined : value ? new Date(value) : null);

/**
 * An Australian phone number as people write them: 000, 13 11 14,
 * 1800 737 732, (07) 3000 0000, +61 7 3000 0000. Digits with spaces,
 * brackets, dashes and a leading plus; at least three digits.
 */
const PHONE = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{1,19}$/, 'must be a phone number, digits with spaces or dashes')
  .refine((value) => (value.match(/\d/g) || []).length >= 3, 'must be a phone number');

const idParam = (req: AuthRequest) => String(req.params.id);

async function mustExist<T>(row: T | null, what: string): Promise<T> {
  if (!row) throw new ApiError(404, `${what} not found`);
  return row;
}

// ==========================================================================
// COMMUNITY SUPPORT PROGRAMS (+ milestones)
// ==========================================================================

const programSchema = z
  .object({
    name: text(2, 200),
    communityType: z.enum(COMMUNITY_TYPES),
    description: text(10, 5000),
    eligibilityDesc: optionalText(2000),
    objectives: stringList(20, 300).optional(),
    partnerOrgs: stringList(20, 200).optional(),
    fundingSource: optionalText(200),
    maxParticipants: z.number().int().positive().max(100000).nullable().optional(),
    startDate: optionalDate(),
    endDate: optionalDate(),
    isActive: z.boolean().optional(),
    region: z.enum(REGIONS).optional(),
  })
  .strict();

const programInclude = {
  milestones: { orderBy: { orderIndex: 'asc' as const } },
  _count: { select: { enrollments: true } },
};

/** GET /api/admin/impact/programs — every program, retired ones included. */
router.get('/impact/programs', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const programs = await prisma.communitySupportProgram.findMany({ include: programInclude, orderBy: [{ isActive: 'desc' }, { name: 'asc' }], take: 500 });
    res.json({ success: true, data: programs });
  } catch (error) {
    next(error);
  }
});

router.post('/impact/programs', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(programSchema, req.body);
    const program = await prisma.communitySupportProgram.create({
      data: {
        ...body,
        objectives: body.objectives ?? [],
        partnerOrgs: body.partnerOrgs ?? [],
        startDate: toDate(body.startDate) ?? null,
        endDate: toDate(body.endDate) ?? null,
      },
      include: programInclude,
    });
    logger.info('Community program created', { programId: program.id, by: req.user!.id });
    res.status(201).json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

router.patch('/impact/programs/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(programSchema.partial(), req.body);
    await mustExist(await prisma.communitySupportProgram.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Program');
    const program = await prisma.communitySupportProgram.update({
      where: { id: idParam(req) },
      data: { ...body, startDate: toDate(body.startDate), endDate: toDate(body.endDate) },
      include: programInclude,
    });
    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

/** DELETE retires rather than removes: enrolments and milestone progress hang off a program. */
router.delete('/impact/programs/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await mustExist(await prisma.communitySupportProgram.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Program');
    const program = await prisma.communitySupportProgram.update({ where: { id: idParam(req) }, data: { isActive: false }, include: programInclude });
    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

const milestoneSchema = z
  .object({
    title: text(1, 200),
    description: optionalText(2000),
    orderIndex: z.number().int().min(0).max(1000).optional(),
    requiredForCompletion: z.boolean().optional(),
  })
  .strict();

router.post('/impact/programs/:id/milestones', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(milestoneSchema, req.body);
    await mustExist(await prisma.communitySupportProgram.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Program');
    const orderIndex = body.orderIndex ?? (await prisma.programMilestone.count({ where: { programId: idParam(req) } }));
    const milestone = await prisma.programMilestone.create({ data: { ...body, orderIndex, programId: idParam(req) } });
    res.status(201).json({ success: true, data: milestone });
  } catch (error) {
    next(error);
  }
});

router.patch('/impact/milestones/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(milestoneSchema.partial(), req.body);
    await mustExist(await prisma.programMilestone.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Milestone');
    const milestone = await prisma.programMilestone.update({ where: { id: idParam(req) }, data: body });
    res.json({ success: true, data: milestone });
  } catch (error) {
    next(error);
  }
});

/** A milestone someone has already ticked stays; only an untouched one can go. */
router.delete('/impact/milestones/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const milestone = await mustExist(
      await prisma.programMilestone.findUnique({ where: { id: idParam(req) }, include: { _count: { select: { progress: true } } } }),
      'Milestone'
    );
    if (milestone._count.progress > 0) {
      throw new ApiError(409, 'Members have recorded progress against this milestone; edit it instead of removing it');
    }
    await prisma.programMilestone.delete({ where: { id: milestone.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==========================================================================
// BRIDGING PROGRAMS
// ==========================================================================

const bridgingSchema = z
  .object({
    name: text(2, 200),
    provider: text(2, 200),
    profession: text(2, 100),
    description: optionalText(5000),
    duration: optionalText(100),
    cost: z.number().min(0).max(1_000_000).nullable().optional(),
    fundingAvailable: z.boolean().optional(),
    url: optionalUrl(),
    requirements: stringList(20, 300).optional(),
    outcomes: stringList(20, 300).optional(),
    region: z.enum(REGIONS).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

router.get('/impact/bridging-programs', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const programs = await prisma.bridgingProgram.findMany({
      include: { _count: { select: { enrollments: true } } },
      orderBy: [{ isActive: 'desc' }, { profession: 'asc' }, { name: 'asc' }],
      take: 500,
    });
    res.json({ success: true, data: programs });
  } catch (error) {
    next(error);
  }
});

router.post('/impact/bridging-programs', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(bridgingSchema, req.body);
    const program = await prisma.bridgingProgram.create({
      data: { ...body, requirements: body.requirements ?? [], outcomes: body.outcomes ?? [] },
    });
    logger.info('Bridging program created', { programId: program.id, by: req.user!.id });
    res.status(201).json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

router.patch('/impact/bridging-programs/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(bridgingSchema.partial(), req.body);
    await mustExist(await prisma.bridgingProgram.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Bridging program');
    const program = await prisma.bridgingProgram.update({ where: { id: idParam(req) }, data: body });
    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

/** Retire: enrolments reference the program. */
router.delete('/impact/bridging-programs/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await mustExist(await prisma.bridgingProgram.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Bridging program');
    const program = await prisma.bridgingProgram.update({ where: { id: idParam(req) }, data: { isActive: false } });
    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

// ==========================================================================
// DV SUPPORT SERVICES
// ==========================================================================

const dvServiceSchema = z
  .object({
    name: text(2, 200),
    type: z.enum(DV_SERVICE_TYPES),
    phone: PHONE.nullable().optional(),
    website: optionalUrl(),
    description: optionalText(2000),
    available24x7: z.boolean().optional(),
    state: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => (AU_STATES as string[]).includes(value), 'must be a state or territory: NSW, VIC, QLD, WA, SA, TAS, ACT or NT')
      .nullable()
      .optional(),
    isNational: z.boolean().optional(),
  })
  .strict();

/** A service must say where it helps: a state, or national. */
function checkCoverage(state: string | null | undefined, isNational: boolean | undefined) {
  if (!state && !isNational) {
    throw new ApiError(400, 'Say which state the service covers, or mark it national');
  }
}

router.get('/impact/dv-services', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const services = await prisma.dVSupportService.findMany({ orderBy: [{ isNational: 'desc' }, { state: 'asc' }, { name: 'asc' }], take: 500 });
    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
});

router.post('/impact/dv-services', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(dvServiceSchema, req.body);
    checkCoverage(body.state, body.isNational);
    const service = await prisma.dVSupportService.create({ data: body });
    logger.info('DV support service created', { serviceId: service.id, by: req.user!.id });
    res.status(201).json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
});

router.patch('/impact/dv-services/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(dvServiceSchema.partial(), req.body);
    const existing = await mustExist(await prisma.dVSupportService.findUnique({ where: { id: idParam(req) } }), 'Service');
    checkCoverage(body.state === undefined ? existing.state : body.state, body.isNational === undefined ? existing.isNational : body.isNational);
    const service = await prisma.dVSupportService.update({ where: { id: existing.id }, data: body });
    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
});

router.delete('/impact/dv-services/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await mustExist(await prisma.dVSupportService.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Service');
    await prisma.dVSupportService.delete({ where: { id: idParam(req) } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==========================================================================
// IMPACT PARTNERS
// ==========================================================================

const partnerSchema = z
  .object({
    name: text(2, 200),
    type: z.enum(PARTNER_TYPES),
    focusAreas: z.array(z.enum(COMMUNITY_TYPES)).max(COMMUNITY_TYPES.length).optional(),
    website: optionalUrl(),
    contactEmail: z.string().trim().email().max(200).nullable().optional(),
    contactPhone: PHONE.nullable().optional(),
    description: optionalText(5000),
    logoUrl: optionalUrl(),
    partnerSince: optionalDate(),
    isActive: z.boolean().optional(),
    region: z.enum(REGIONS).optional(),
  })
  .strict();

router.get('/impact/partners', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const partners = await prisma.impactPartner.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }], take: 500 });
    res.json({ success: true, data: partners });
  } catch (error) {
    next(error);
  }
});

router.post('/impact/partners', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(partnerSchema, req.body);
    const partner = await prisma.impactPartner.create({
      data: { ...body, focusAreas: body.focusAreas ?? [], partnerSince: toDate(body.partnerSince) ?? null },
    });
    logger.info('Impact partner created', { partnerId: partner.id, by: req.user!.id });
    res.status(201).json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

router.patch('/impact/partners/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(partnerSchema.partial(), req.body);
    await mustExist(await prisma.impactPartner.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Partner');
    const partner = await prisma.impactPartner.update({ where: { id: idParam(req) }, data: { ...body, partnerSince: toDate(body.partnerSince) } });
    res.json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

/** Retire: a partner's history with the platform is kept. */
router.delete('/impact/partners/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await mustExist(await prisma.impactPartner.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Partner');
    const partner = await prisma.impactPartner.update({ where: { id: idParam(req) }, data: { isActive: false } });
    res.json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

// ==========================================================================
// FIRST NATIONS: COMMUNITY PAGES AND RESOURCES
// ==========================================================================

const communitySchema = z
  .object({
    name: text(2, 200),
    description: optionalText(5000),
    region: optionalText(100),
    nation: optionalText(200),
    isWomenOnly: z.boolean().optional(),
    coverImage: optionalUrl(),
    isVerified: z.boolean().optional(),
    moderatorIds: z.array(z.string().trim().uuid()).max(20).optional(),
    culturalProtocols: optionalText(5000),
  })
  .strict();

router.get('/impact/indigenous/communities', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const communities = await prisma.indigenousCommunityPage.findMany({
      include: { _count: { select: { members: true, resources: true } } },
      orderBy: { name: 'asc' },
      take: 500,
    });
    res.json({ success: true, data: communities });
  } catch (error) {
    next(error);
  }
});

router.post('/impact/indigenous/communities', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(communitySchema, req.body);
    const community = await prisma.indigenousCommunityPage.create({ data: { ...body, moderatorIds: body.moderatorIds ?? [] } });
    logger.info('First Nations community page created', { communityId: community.id, by: req.user!.id });
    res.status(201).json({ success: true, data: community });
  } catch (error) {
    next(error);
  }
});

router.patch('/impact/indigenous/communities/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(communitySchema.partial(), req.body);
    await mustExist(await prisma.indigenousCommunityPage.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Community page');
    const community = await prisma.indigenousCommunityPage.update({ where: { id: idParam(req) }, data: body });
    res.json({ success: true, data: community });
  } catch (error) {
    next(error);
  }
});

/** A page with members is theirs; only an empty one can be removed. */
router.delete('/impact/indigenous/communities/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const community = await mustExist(
      await prisma.indigenousCommunityPage.findUnique({ where: { id: idParam(req) }, include: { _count: { select: { members: true, resources: true } } } }),
      'Community page'
    );
    if (community._count.members > 0) {
      throw new ApiError(409, 'Members have joined this page; it cannot be removed');
    }
    if (community._count.resources > 0) {
      await prisma.indigenousResource.updateMany({ where: { communityId: community.id }, data: { communityId: null } });
    }
    await prisma.indigenousCommunityPage.delete({ where: { id: community.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const resourceSchema = z
  .object({
    communityId: z.string().trim().uuid().nullable().optional(),
    title: text(2, 200),
    description: optionalText(2000),
    type: z.enum(RESOURCE_TYPES),
    url: optionalUrl(),
    partnerOrg: optionalText(200),
    isNational: z.boolean().optional(),
  })
  .strict();

router.get('/impact/indigenous/resources', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resources = await prisma.indigenousResource.findMany({
      include: { community: { select: { id: true, name: true } } },
      orderBy: [{ type: 'asc' }, { title: 'asc' }],
      take: 500,
    });
    res.json({ success: true, data: resources });
  } catch (error) {
    next(error);
  }
});

router.post('/impact/indigenous/resources', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(resourceSchema, req.body);
    if (body.communityId) {
      await mustExist(await prisma.indigenousCommunityPage.findUnique({ where: { id: body.communityId }, select: { id: true } }), 'Community page');
    }
    const resource = await prisma.indigenousResource.create({ data: body });
    logger.info('First Nations resource created', { resourceId: resource.id, by: req.user!.id });
    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

router.patch('/impact/indigenous/resources/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(resourceSchema.partial(), req.body);
    await mustExist(await prisma.indigenousResource.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Resource');
    if (body.communityId) {
      await mustExist(await prisma.indigenousCommunityPage.findUnique({ where: { id: body.communityId }, select: { id: true } }), 'Community page');
    }
    const resource = await prisma.indigenousResource.update({ where: { id: idParam(req) }, data: body });
    res.json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

router.delete('/impact/indigenous/resources/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await mustExist(await prisma.indigenousResource.findUnique({ where: { id: idParam(req) }, select: { id: true } }), 'Resource');
    await prisma.indigenousResource.delete({ where: { id: idParam(req) } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==========================================================================
// CREDENTIALS QUEUE
// ==========================================================================
// The assessing body writes to the member, not to the platform. Whoever
// handles settlement support records the outcome here when it reaches them,
// and the member is told in the app and by email. Each credential carries
// the reference table's suggestion so staff see which body it was for.

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

/** GET /api/admin/credentials?status= — the queue, newest first, pending by default. */
router.get('/credentials', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' && (CREDENTIAL_STATUSES as readonly string[]).includes(req.query.status) ? (req.query.status as (typeof CREDENTIAL_STATUSES)[number]) : undefined;
    const all = req.query.status === 'all';
    const [credentials, counts] = await Promise.all([
      prisma.internationalCredential.findMany({
        where: all ? {} : { status: status ?? 'PENDING_REVIEW' },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      prisma.internationalCredential.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    res.json({
      success: true,
      data: credentials.map((c) => ({ ...c, suggestion: suggestPathway(c) })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      reference: { asAt: ASSESSING_BODIES_AS_AT, bodies: listAssessingBodies() },
    });
  } catch (error) {
    next(error);
  }
});

const decisionSchema = z
  .object({
    status: z.enum(CREDENTIAL_STATUSES),
    australianEquiv: optionalText(200),
    bridgingRequired: optionalText(500),
    assessmentBody: optionalText(200),
    assessmentDate: optionalDate(),
    notes: optionalText(2000),
  })
  .strict();

/** PATCH /api/admin/credentials/:id — record the outcome and tell her. */
router.patch('/credentials/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parse(decisionSchema, req.body);
    const credential = await mustExist(await prisma.internationalCredential.findUnique({ where: { id: idParam(req) } }), 'Credential');

    const empty = (value: string | null | undefined) => (value === undefined ? undefined : value === null || value === '' ? null : value);
    const updated = await prisma.internationalCredential.update({
      where: { id: credential.id },
      data: {
        status: body.status,
        ...(body.australianEquiv !== undefined ? { australianEquiv: empty(body.australianEquiv) } : {}),
        ...(body.bridgingRequired !== undefined ? { bridgingRequired: empty(body.bridgingRequired) } : {}),
        ...(body.assessmentBody !== undefined ? { assessmentBody: empty(body.assessmentBody) } : {}),
        ...(body.notes !== undefined ? { notes: empty(body.notes) } : {}),
        assessmentDate: body.assessmentDate ? new Date(body.assessmentDate) : body.status === 'PENDING_REVIEW' ? credential.assessmentDate : new Date(),
      },
    });

    const name = credential.credentialName;
    const equiv = empty(body.australianEquiv) ?? credential.australianEquiv;
    const bridging = empty(body.bridgingRequired) ?? credential.bridgingRequired;
    const line: Record<(typeof CREDENTIAL_STATUSES)[number], string> = {
      PENDING_REVIEW: `Your ${name} is being looked at.`,
      RECOGNIZED: `Your ${name} has been recorded as recognised in Australia${equiv ? `, equivalent to ${equiv}` : ''}.`,
      PARTIALLY_RECOGNIZED: `Your ${name} has been recorded as partly recognised in Australia${equiv ? `, comparable to ${equiv}` : ''}.`,
      BRIDGING_REQUIRED: `Your ${name} needs a bridging step before it is recognised${bridging ? `: ${bridging}` : ''}.`,
      NOT_RECOGNIZED: `Your ${name} was not recognised as it stands. There may be another way through; see the note.`,
    };
    const note = empty(body.notes);
    await tellMember(credential.userId, 'Update on your overseas credential', `${line[body.status]}${note ? ` ${note}` : ''}`, '/dashboard/impact/migrant');

    logger.info('Credential outcome recorded', { credentialId: credential.id, status: body.status, by: req.user!.id });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
