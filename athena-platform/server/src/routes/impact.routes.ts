import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { CommunityType, ImpactMetricType, Prisma, Region } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { httpUrl } from '../utils/http-url';
import { buildPaginationMeta } from '../utils/pagination';
import { BUILT_IN_DV_SERVICES } from '../services/dv-safe.service';

const router = Router();

// ===========================================
// INPUT
// ===========================================

/** A zod refusal as a 400 that names the field, never a 500 from Prisma. */
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

/**
 * A query value as a plain string, or nothing. Express parses `?type[not]=x`
 * into an object, and these filters used to go straight into a Prisma `where`,
 * so a caller could hand the query an operator instead of a value.
 */
const text = (value: unknown, max = 100): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

/** A query value that must be one of an enum's members; anything else is a 400, not a 500. */
function enumFilter<T extends string>(value: unknown, allowed: readonly T[], label: string): T | undefined {
  const raw = text(value, 60);
  if (raw === undefined) return undefined;
  const upper = raw.toUpperCase() as T;
  if (!allowed.includes(upper)) {
    throw new ApiError(400, `Unknown ${label}`);
  }
  return upper;
}

const COMMUNITY_TYPES = Object.values(CommunityType) as CommunityType[];
const REGIONS = Object.values(Region) as Region[];

/**
 * Pages for the lists here that had none. /partners, /metrics and
 * /disability-friendly-employers each read their whole table on every load,
 * the employer list with an organisation joined onto every row. Fifty to a
 * page, a hundred at most, the same as the community-support catalogues; the
 * rows are still under `data` and `pagination` is added beside them.
 */
const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function listPage(query: Request['query']) {
  const requestedLimit = Number.parseInt(text(query.limit) ?? '', 10);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, MAX_PAGE_SIZE) : PAGE_SIZE;
  const requestedPage = Number.parseInt(text(query.page) ?? '', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  return { page, limit, skip: (page - 1) * limit };
}

// ===========================================
// IMPACT METRICS & REPORTS
// ===========================================

// GET /api/impact/metrics - Get user's impact metrics
router.get('/metrics', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { page, limit, skip } = listPage(req.query);

    const [metrics, total] = await Promise.all([
      prisma.impactMetric.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.impactMetric.count({ where: { userId } }),
    ]);

    res.json({ success: true, data: metrics, pagination: buildPaginationMeta(total, page, limit) });
  } catch (error) {
    next(error);
  }
});

/**
 * What a member may record about her own progress.
 *
 * The only check used to be that metricType was present. It is an enum in the
 * schema, so an unknown type reached Prisma and came back a 500 rather than a
 * refusal; `value` went through parseFloat, so "lots" was stored as nothing and
 * "1e308" as a number no summary could add up; and evidenceUrl was stored as
 * typed, so a javascript: link sat waiting to be rendered.
 */
const optionalNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().finite().min(0).max(1_000_000_000).optional()
);

const metricSchema = z.object({
  metricType: z.nativeEnum(ImpactMetricType),
  value: optionalNumber,
  description: z.string().trim().max(2000).optional(),
  evidenceUrl: httpUrl(500).optional(),
  communityType: z.nativeEnum(CommunityType).optional(),
  programId: z.string().trim().min(1).max(64).optional(),
});

// POST /api/impact/metrics - Record an impact metric
router.post('/metrics', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const input = parse(metricSchema, req.body);

    // A metric that names a programme has to name one that exists, or the
    // record says she achieved something through a programme nobody runs.
    if (input.programId) {
      const program = await prisma.communitySupportProgram.findUnique({ where: { id: input.programId }, select: { id: true } });
      if (!program) {
        throw new ApiError(400, 'programId: no such program');
      }
    }

    const metric = await prisma.impactMetric.create({
      data: {
        userId,
        metricType: input.metricType,
        value: input.value ?? null,
        description: input.description || null,
        evidenceUrl: input.evidenceUrl || null,
        communityType: input.communityType ?? null,
        programId: input.programId ?? null,
      },
    });

    res.status(201).json({ success: true, data: metric });
  } catch (error) {
    next(error);
  }
});

// GET /api/impact/reports - Get impact reports (public)
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const communityType = enumFilter(req.query.communityType, COMMUNITY_TYPES, 'community type');
    const region = enumFilter(req.query.region, REGIONS, 'region');
    const period = text(req.query.period, 20);

    const where: Prisma.ImpactReportWhereInput = {
      ...(communityType ? { communityType } : {}),
      ...(region ? { region } : {}),
      ...(period ? { reportPeriod: period } : {}),
    };

    const reports = await prisma.impactReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
});

// GET /api/impact/reports/:id - Get specific impact report
router.get('/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const report = await prisma.impactReport.findUnique({
      where: { id },
    });

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

// GET /api/impact/summary - Get user's impact summary
router.get('/summary', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Totalled by the database rather than by reading every metric she has
    // ever recorded into memory on each view of the hub.
    const [byType, enrollments, completedPrograms] = await Promise.all([
      prisma.impactMetric.groupBy({
        by: ['metricType'],
        where: { userId },
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.programEnrollment.count({ where: { userId } }),
      prisma.programEnrollment.count({ where: { userId, status: 'COMPLETED' } }),
    ]);

    const summary = Object.fromEntries(
      byType.map((row) => [
        row.metricType,
        { count: row._count._all, totalValue: row._sum.value ? Number(row._sum.value.toString()) : 0 },
      ])
    ) as Record<string, { count: number; totalValue: number }>;
    const totalMetrics = byType.reduce((sum, row) => sum + row._count._all, 0);

    res.json({
      success: true,
      data: {
        metricsSummary: summary,
        totalMetrics,
        programsEnrolled: enrollments,
        programsCompleted: completedPrograms,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// IMPACT PARTNERS
// ===========================================

// GET /api/impact/partners - List impact partners
router.get('/partners', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = enumFilter(req.query.region, REGIONS, 'region');
    const focusArea = enumFilter(req.query.focusArea, COMMUNITY_TYPES, 'focus area');
    const type = text(req.query.type, 40);
    const { page, limit, skip } = listPage(req.query);

    const where: Prisma.ImpactPartnerWhereInput = {
      isActive: true,
      ...(region ? { region } : {}),
      ...(type ? { type } : {}),
      ...(focusArea ? { focusAreas: { has: focusArea } } : {}),
    };

    const [partners, total] = await Promise.all([
      prisma.impactPartner.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.impactPartner.count({ where }),
    ]);

    res.json({ success: true, data: partners, pagination: buildPaginationMeta(total, page, limit) });
  } catch (error) {
    next(error);
  }
});

// GET /api/impact/partners/:id - Get specific partner
router.get('/partners/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const partner = await prisma.impactPartner.findUnique({
      where: { id },
    });

    if (!partner) {
      return res.status(404).json({ success: false, error: 'Partner not found' });
    }

    res.json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DV SUPPORT SERVICES
// ===========================================

/**
 * GET /api/impact/dv-services — the DV support directory.
 *
 * The catalogue is what staff have entered and checked, and it ships empty,
 * which is correct: nobody should publish a local refuge's number that nobody
 * has verified. But the page that renders this is the DV survivor support
 * page, and an empty answer there read as "no help available" to a woman in
 * danger. So the reply always carries `fallback` — the nationally published
 * numbers held in dv-safe.service — whatever the catalogue holds and whatever
 * filter was asked for, and says in `usingFallback` whether the catalogue had
 * anything to show. A local service staff have entered supersedes the
 * fallback in the page's ordering; it never removes it.
 *
 * The `take` is a ceiling, not a page. This is a directory of verified local
 * services, so it is tens of rows rather than thousands, and a woman reading
 * it should get the whole of it rather than a first page she has to ask for
 * more of. If it ever grows past this, it needs paging and a search, not a
 * bigger number.
 */
const DV_SERVICE_LIMIT = 200;

router.get('/dv-services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = text(req.query.state, 10);
    const type = text(req.query.type, 40);
    const { national } = req.query;

    // A retired service keeps its row, so the record of having listed it
    // survives, but it does not appear on the page a woman in danger is
    // reading. Deleting was previously the only way to take one down.
    const where: Prisma.DVSupportServiceWhereInput = {
      isActive: true,
      ...(state ? { state } : {}),
      ...(type ? { type } : {}),
      ...(national === 'true' ? { isNational: true } : {}),
    };

    const services = await prisma.dVSupportService.findMany({
      where,
      orderBy: [{ isNational: 'desc' }, { name: 'asc' }],
      take: DV_SERVICE_LIMIT,
    });

    // A staff-entered service on the same number is the same service, better
    // checked, so the built-in copy of it drops out rather than appearing
    // twice under two labels.
    const catalogueNumbers = new Set(
      services.map((service) => (service.phone ?? '').replace(/\D/g, '')).filter(Boolean)
    );
    const fallback = BUILT_IN_DV_SERVICES.filter(
      (service) => !catalogueNumbers.has((service.phone ?? '').replace(/\D/g, ''))
    );

    res.json({
      success: true,
      data: services.map((service) => ({ ...service, source: 'catalogue' as const })),
      fallback,
      usingFallback: services.length === 0,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAFETY PLAN (private to her; stored as written, not encrypted at rest)
// ===========================================

// GET /api/impact/safety-plan - Get user's safety plan
router.get('/safety-plan', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const safetyPlan = await prisma.safetyPlan.findUnique({
      where: { userId },
    });

    res.json({ success: true, data: safetyPlan });
  } catch (error) {
    next(error);
  }
});

/**
 * Each part of the plan is a list of lines she wrote — people, places, what
 * to take — which is what the plan page sends. Anything else used to be
 * stored as given, up to the ten-megabyte body limit, in the one record on
 * the platform she most needs to open quickly and read at a glance.
 */
const planLines = z.array(z.string().max(1000)).max(100).nullable().optional();
const safetyPlanSchema = z.object({
  emergencyContacts: planLines,
  safeLocations: planLines,
  warningTriggers: planLines,
  exitStrategies: planLines,
  importantDocs: planLines,
  financialPlan: planLines,
  legalContacts: planLines,
});

/** A list for a Json column: null clears it, absent leaves it alone. */
const planValue = (lines: string[] | null | undefined) =>
  lines === undefined ? undefined : lines === null ? Prisma.JsonNull : lines;

// POST /api/impact/safety-plan - Create/update safety plan
router.post('/safety-plan', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const plan = parse(safetyPlanSchema, req.body);

    const fields = {
      emergencyContacts: planValue(plan.emergencyContacts),
      safeLocations: planValue(plan.safeLocations),
      warningTriggers: planValue(plan.warningTriggers),
      exitStrategies: planValue(plan.exitStrategies),
      importantDocs: planValue(plan.importantDocs),
      financialPlan: planValue(plan.financialPlan),
      legalContacts: planValue(plan.legalContacts),
    };

    const safetyPlan = await prisma.safetyPlan.upsert({
      where: { userId },
      create: { userId, ...fields, lastReviewedAt: new Date() },
      update: { ...fields, lastReviewedAt: new Date() },
    });

    res.json({ success: true, data: safetyPlan });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// ACCESSIBILITY PROFILE
// ===========================================

// GET /api/impact/accessibility - Get user's accessibility profile
router.get('/accessibility', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const profile = await prisma.accessibilityProfile.findUnique({
      where: { userId },
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

/**
 * The profile took whatever req.body held: a string where a yes/no belonged
 * went to Prisma and came back a 500, preferredFontSize took any text though
 * the schema names four sizes, and the free-text fields had no length at all.
 */
export const PREFERRED_FONT_SIZES = ['small', 'medium', 'large', 'extra-large'] as const;

const accessibilitySchema = z.object({
  hasVisionImpairment: z.boolean().optional(),
  hasHearingImpairment: z.boolean().optional(),
  hasMobilityImpairment: z.boolean().optional(),
  hasCognitiveDisability: z.boolean().optional(),
  usesScreenReader: z.boolean().optional(),
  usesVoiceControl: z.boolean().optional(),
  preferredFontSize: z.enum(PREFERRED_FONT_SIZES).nullable().optional(),
  highContrastMode: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  captionsRequired: z.boolean().optional(),
  otherNeeds: z.string().trim().max(2000).nullable().optional(),
  workAccommodations: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
});

// POST /api/impact/accessibility - Create/update accessibility profile
router.post('/accessibility', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const input = parse(accessibilitySchema, req.body);

    const profile = await prisma.accessibilityProfile.upsert({
      where: { userId },
      create: {
        userId,
        hasVisionImpairment: input.hasVisionImpairment ?? false,
        hasHearingImpairment: input.hasHearingImpairment ?? false,
        hasMobilityImpairment: input.hasMobilityImpairment ?? false,
        hasCognitiveDisability: input.hasCognitiveDisability ?? false,
        usesScreenReader: input.usesScreenReader ?? false,
        usesVoiceControl: input.usesVoiceControl ?? false,
        preferredFontSize: input.preferredFontSize ?? null,
        highContrastMode: input.highContrastMode ?? false,
        reducedMotion: input.reducedMotion ?? false,
        captionsRequired: input.captionsRequired ?? false,
        otherNeeds: input.otherNeeds || null,
        workAccommodations: input.workAccommodations ?? [],
      },
      update: {
        hasVisionImpairment: input.hasVisionImpairment,
        hasHearingImpairment: input.hasHearingImpairment,
        hasMobilityImpairment: input.hasMobilityImpairment,
        hasCognitiveDisability: input.hasCognitiveDisability,
        usesScreenReader: input.usesScreenReader,
        usesVoiceControl: input.usesVoiceControl,
        preferredFontSize: input.preferredFontSize,
        highContrastMode: input.highContrastMode,
        reducedMotion: input.reducedMotion,
        captionsRequired: input.captionsRequired,
        otherNeeds: input.otherNeeds === undefined ? undefined : input.otherNeeds || null,
        workAccommodations: input.workAccommodations,
      },
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// GET /api/impact/disability-friendly-employers - List disability-friendly employers
router.get('/disability-friendly-employers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hasRemote, hasFlexible } = req.query;
    // parseInt on anything used to reach Prisma, so ?minRating=abc was a NaN
    // filter and a 500. A rating is one to five.
    const requestedRating = Number.parseInt(text(req.query.minRating) ?? '', 10);
    const minRating = Number.isFinite(requestedRating) ? Math.min(Math.max(requestedRating, 1), 5) : undefined;
    const { page, limit, skip } = listPage(req.query);

    const where: Prisma.DisabilityFriendlyEmployerWhereInput = {
      ...(hasRemote === 'true' ? { hasRemoteOptions: true } : {}),
      ...(hasFlexible === 'true' ? { hasFlexibleWork: true } : {}),
      ...(minRating !== undefined ? { accessibilityRating: { gte: minRating } } : {}),
    };

    const [employers, total] = await Promise.all([
      prisma.disabilityFriendlyEmployer.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true, logo: true, industry: true },
          },
        },
        orderBy: [{ accessibilityRating: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.disabilityFriendlyEmployer.count({ where }),
    ]);

    res.json({ success: true, data: employers, pagination: buildPaginationMeta(total, page, limit) });
  } catch (error) {
    next(error);
  }
});

export default router;
