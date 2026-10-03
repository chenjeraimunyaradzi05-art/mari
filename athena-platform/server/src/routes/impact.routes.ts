import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { CommunityType, ImpactMetricType, Prisma, Region } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { httpUrl } from '../utils/http-url';
import { buildPaginationMeta, clampLimit } from '../utils/pagination';
import { BUILT_IN_DV_SERVICES } from '../services/dv-safe.service';
import {
  compileImpactReport,
  parseReportPeriod,
  presentPublicReport,
  presentStaffReport,
  publishRefusal,
  reportRowData,
  storedFigures,
  type CompileScope,
} from '../services/impact-reports.service';
import { recordStaffAction } from '../services/staff-record.service';
import { logger } from '../utils/logger';
import { planColumnValue, presentSafetyPlan } from '../utils/safety-plan-seal';

const router = Router();

/**
 * The signed-in member. Used only behind `authenticate`, which has already
 * answered 401 before a handler runs, so this never refuses in practice: it
 * narrows `req.user` for the compiler in place of a `!`.
 */
function member(req: AuthRequest) {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  return req.user;
}

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
  const limit = clampLimit(query.limit, PAGE_SIZE, MAX_PAGE_SIZE);
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

// GET /api/impact/reports - Published impact reports (public)
//
// Each report is shown as impact-reports.service presents it to the public:
// a count under the publication floor is withheld and named in `suppressed`,
// and the basis says what the figures were counted from.
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const communityType = enumFilter(req.query.communityType, COMMUNITY_TYPES, 'community type');
    const region = enumFilter(req.query.region, REGIONS, 'region');
    const period = text(req.query.period, 20);

    const where: Prisma.ImpactReportWhereInput = {
      ...(communityType ? { communityType } : {}),
      ...(region ? { region } : {}),
      ...(period ? { reportPeriod: period.toUpperCase() } : {}),
    };

    const reports = await prisma.impactReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ success: true, data: reports.map(presentPublicReport) });
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

    res.json({ success: true, data: presentPublicReport(report) });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// STAFF: PUBLISHING IMPACT REPORTS
// ===========================================
// Nothing could write an ImpactReport, so the reports page was permanently
// empty. Staff publish one here for a period, a region and optionally one
// community, and the figures are counted from the platform's records rather
// than typed in (impact-reports.service says how). Staff choose the period and
// write the narrative; a correction recounts and says why; a withdrawal takes
// the report down. Each is in the audit log under whoever did it.

const REPORT_PERIOD_HELP = 'period: use a quarter like Q3-2026, a financial year like FY2026, a year like 2026, or a month like 2026-09';

const COMMUNITY_LABELS: Record<CommunityType, string> = {
  FIRST_NATIONS: 'First Nations women',
  REFUGEE_IMMIGRANT: 'refugee and migrant women',
  DV_SURVIVOR: 'survivors of domestic violence',
  DISABILITY: 'women with disability',
  LGBTQIA: 'LGBTQIA+ women',
  SINGLE_PARENT: 'single mothers',
  RURAL_REGIONAL: 'rural and regional women',
  GENERAL: 'the general community',
};

const scopeLabel = (scope: Pick<CompileScope, 'communityType' | 'region'> & { label: string }) =>
  `${scope.label} (${scope.communityType ? COMMUNITY_LABELS[scope.communityType] : 'all communities'}, ${scope.region})`;

/** The scope a report is compiled for, from a query string or a body. */
function reportScope(input: { period?: unknown; communityType?: unknown; region?: unknown }): CompileScope {
  const period = parseReportPeriod(input.period);
  if (!period) throw new ApiError(400, REPORT_PERIOD_HELP);
  return {
    period,
    communityType: enumFilter(input.communityType, COMMUNITY_TYPES, 'community type') ?? null,
    region: enumFilter(input.region, REGIONS, 'region') ?? Region.ANZ,
  };
}

/**
 * The report already filed for this scope, if any. The database's unique
 * index cannot answer this for "all communities": Postgres treats two NULL
 * community types as different, so it would let a second all-communities
 * report for the same period in beside the first.
 */
const reportFiledFor = (scope: CompileScope) =>
  prisma.impactReport.findFirst({
    where: { reportPeriod: scope.period.label, communityType: scope.communityType, region: scope.region },
    select: { id: true },
  });

const staffNarrative = z.string().trim().max(2000).nullable().optional();
const staffReason = (what: string) =>
  z.string({ required_error: `says why ${what}` }).trim().min(10, `says in a sentence why ${what}`).max(1000);

// GET /api/impact/admin/reports - Every published report, with exact counts
router.get('/admin/reports', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await prisma.impactReport.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ success: true, data: reports.map(presentStaffReport) });
  } catch (error) {
    next(error);
  }
});

// GET /api/impact/admin/reports/preview - Count a period without publishing it
router.get('/admin/reports/preview', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scope = reportScope(req.query);
    const [compiled, existing] = await Promise.all([compileImpactReport(scope), reportFiledFor(scope)]);
    const refusal = existing
      ? `A report for ${scopeLabel({ ...scope, label: scope.period.label })} is already published. Correct it rather than publishing a second.`
      : publishRefusal(compiled, scope.period);
    res.json({
      success: true,
      data: { ...compiled, publishable: refusal === null, refusal, existingReportId: existing?.id ?? null },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/impact/admin/reports - Count a period and publish it
router.post('/admin/reports', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scope = reportScope(req.body ?? {});
    const { narrativeSummary } = parse(z.object({ narrativeSummary: staffNarrative }).passthrough(), req.body);
    const label = scopeLabel({ ...scope, label: scope.period.label });

    if (await reportFiledFor(scope)) {
      throw new ApiError(409, `A report for ${label} is already published. Correct it rather than publishing a second.`);
    }
    const compiled = await compileImpactReport(scope);
    const refusal = publishRefusal(compiled, scope.period);
    if (refusal) throw new ApiError(400, refusal);

    let report;
    try {
      report = await prisma.impactReport.create({
        data: {
          reportPeriod: scope.period.label,
          communityType: scope.communityType,
          region: scope.region,
          ...reportRowData(compiled, narrativeSummary || null),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, `A report for ${label} is already published. Correct it rather than publishing a second.`);
      }
      throw error;
    }

    await recordStaffAction(req, 'IMPACT_REPORT_PUBLISHED', {
      resourceType: 'ImpactReport',
      resourceId: report.id,
      reportPeriod: report.reportPeriod,
      communityType: report.communityType,
      region: report.region,
      figures: compiled.figures,
      outcomesRecorded: compiled.basis.outcomesRecorded,
      programmeMembers: compiled.basis.programmeMembers,
    });

    res.status(201).json({ success: true, data: presentStaffReport(report), message: `Published the report for ${label}.` });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/impact/admin/reports/:id - Correct a published report
//
// A correction either recounts the period from the records as they now stand
// (an outcome recorded late, say) or rewrites the narrative, or both, and it
// always says why. The figures are never set by hand here either.
router.patch('/admin/reports/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(
      z.object({ reason: staffReason('the report is being corrected'), narrativeSummary: staffNarrative, recount: z.boolean().optional() }),
      req.body
    );
    if (!input.recount && input.narrativeSummary === undefined) {
      throw new ApiError(400, 'Nothing to correct: recount the figures, change the narrative, or both.');
    }

    const report = await prisma.impactReport.findUnique({ where: { id: req.params.id } });
    if (!report) throw new ApiError(404, 'Report not found');

    const data: Prisma.ImpactReportUpdateInput = {};
    if (input.narrativeSummary !== undefined) data.narrativeSummary = input.narrativeSummary || null;
    if (input.recount) {
      const period = parseReportPeriod(report.reportPeriod);
      if (!period) {
        throw new ApiError(400, `This report's period, "${report.reportPeriod}", is not one the records can be recounted for.`);
      }
      const compiled = await compileImpactReport({ period, region: report.region, communityType: report.communityType });
      const refusal = publishRefusal(compiled, period);
      if (refusal) throw new ApiError(400, `Recounted, this report cannot stand: ${refusal} Withdraw it instead.`);
      Object.assign(data, reportRowData(compiled, input.narrativeSummary === undefined ? report.narrativeSummary : input.narrativeSummary || null));
    }

    const updated = await prisma.impactReport.update({ where: { id: report.id }, data });

    await recordStaffAction(req, 'IMPACT_REPORT_CORRECTED', {
      resourceType: 'ImpactReport',
      resourceId: report.id,
      reportPeriod: report.reportPeriod,
      reason: input.reason,
      before: { figures: storedFigures(report), narrativeChanged: input.narrativeSummary !== undefined },
      after: { figures: storedFigures(updated) },
      recounted: Boolean(input.recount),
    });

    res.json({ success: true, data: presentStaffReport(updated), message: 'Corrected.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/impact/admin/reports/:id/withdraw - Take a published report down
//
// The row goes, because ImpactReport has no column to mark one withdrawn; the
// audit row keeps every figure it showed and why it came down, so the record
// of what ATHENA once said survives it.
router.post('/admin/reports/:id/withdraw', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = parse(z.object({ reason: staffReason('the report is being withdrawn') }), req.body);
    const report = await prisma.impactReport.findUnique({ where: { id: req.params.id } });
    if (!report) throw new ApiError(404, 'Report not found');

    await prisma.impactReport.delete({ where: { id: report.id } });

    await recordStaffAction(req, 'IMPACT_REPORT_WITHDRAWN', {
      resourceType: 'ImpactReport',
      resourceId: report.id,
      reportPeriod: report.reportPeriod,
      communityType: report.communityType,
      region: report.region,
      reason,
      figures: storedFigures(report),
      narrativeSummary: report.narrativeSummary,
      publishedAt: report.createdAt.toISOString(),
    });

    res.json({ success: true, message: `Withdrew the report for ${report.reportPeriod}.` });
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
// SAFETY PLAN (private to her; sealed at rest under DV_ENCRYPTION_KEY)
// ===========================================

// GET /api/impact/safety-plan - Get user's safety plan
//
// Every part is opened here and nowhere else, so a sealed string never leaves
// the server. encryptedAtRest and unreadableParts say how her own row is kept,
// which is what the page words its promise from.
router.get('/safety-plan', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = member(req).id;

    const safetyPlan = await prisma.safetyPlan.findUnique({
      where: { userId },
    });

    res.json({ success: true, data: safetyPlan ? presentSafetyPlan(safetyPlan) : null });
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

// POST /api/impact/safety-plan - Create/update safety plan
router.post('/safety-plan', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = member(req).id;
    const plan = parse(safetyPlanSchema, req.body);

    // A part she sent is sealed before it is written; one she left out is
    // left as it is, and one she emptied is cleared. See planColumnValue.
    const fields = {
      emergencyContacts: planColumnValue(plan.emergencyContacts),
      safeLocations: planColumnValue(plan.safeLocations),
      warningTriggers: planColumnValue(plan.warningTriggers),
      exitStrategies: planColumnValue(plan.exitStrategies),
      importantDocs: planColumnValue(plan.importantDocs),
      financialPlan: planColumnValue(plan.financialPlan),
      legalContacts: planColumnValue(plan.legalContacts),
    };

    const safetyPlan = await prisma.safetyPlan.upsert({
      where: { userId },
      create: { userId, ...fields, lastReviewedAt: new Date() },
      update: { ...fields, lastReviewedAt: new Date() },
    });

    res.json({ success: true, data: presentSafetyPlan(safetyPlan) });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/impact/safety-plan - Delete the whole plan
//
// Emptying every box and saving leaves a row behind that says she once made a
// plan. This removes the row. Only the fact is logged, never a word of it, and
// no audit row is written: none of AuditAction's values fits, and a record
// kept for years saying she had a plan is the thing she is asking to be rid of.
router.delete('/safety-plan', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = member(req).id;

    const { count } = await prisma.safetyPlan.deleteMany({ where: { userId } });
    logger.info('Safety plan deleted', { userId, hadPlan: count > 0 });

    res.json({ success: true, data: { deleted: count > 0 } });
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

    // Only employers staff have checked and not since retired. verifiedAt is
    // the check: a retired employer keeps its row, and the record of having
    // been listed, with verifiedAt cleared.
    const where: Prisma.DisabilityFriendlyEmployerWhereInput = {
      verifiedAt: { not: null },
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

// ===========================================
// STAFF: THE DISABILITY-FRIENDLY EMPLOYER LIST
// ===========================================
// The list had a reader and no writer, so it was permanently empty. Staff now
// list an employer they have checked, with what they checked; edit it, which
// is a fresh check; and retire it when it no longer holds. Being on the list
// is ATHENA vouching for a workplace to women with disability, so every one
// of those is in the audit log with its reason. No badge is awarded here: a
// badge names someone else's accreditation, and nothing on the platform
// checks one.

const employerFields = {
  accessibilityRating: z.coerce.number().int('is a whole number from 1 to 5').min(1, 'is from 1 to 5').max(5, 'is from 1 to 5'),
  accommodationsOffered: z.array(z.string().trim().min(1).max(200)).max(30),
  hasWheelchairAccess: z.boolean(),
  hasFlexibleWork: z.boolean(),
  hasRemoteOptions: z.boolean(),
  hasMentalHealthSupport: z.boolean(),
};
const checkedBasis = z
  .string({ required_error: 'says what you checked' })
  .trim()
  .min(10, 'says what you checked: who you spoke to, and what you saw')
  .max(1000);

const employerCreateSchema = z.object({
  organizationId: z.string().trim().min(1).max(64),
  accessibilityRating: employerFields.accessibilityRating,
  accommodationsOffered: employerFields.accommodationsOffered.default([]),
  hasWheelchairAccess: employerFields.hasWheelchairAccess.default(false),
  hasFlexibleWork: employerFields.hasFlexibleWork.default(false),
  hasRemoteOptions: employerFields.hasRemoteOptions.default(false),
  hasMentalHealthSupport: employerFields.hasMentalHealthSupport.default(false),
  basis: checkedBasis,
});

const employerUpdateSchema = z.object({
  accessibilityRating: employerFields.accessibilityRating.optional(),
  accommodationsOffered: employerFields.accommodationsOffered.optional(),
  hasWheelchairAccess: employerFields.hasWheelchairAccess.optional(),
  hasFlexibleWork: employerFields.hasFlexibleWork.optional(),
  hasRemoteOptions: employerFields.hasRemoteOptions.optional(),
  hasMentalHealthSupport: employerFields.hasMentalHealthSupport.optional(),
  basis: checkedBasis,
});

const EMPLOYER_ORG_SELECT = { select: { id: true, name: true, logo: true, industry: true } } as const;

type EmployerRow = {
  accessibilityRating: number | null;
  accommodationsOffered: string[];
  hasWheelchairAccess: boolean;
  hasFlexibleWork: boolean;
  hasRemoteOptions: boolean;
  hasMentalHealthSupport: boolean;
  verifiedAt: Date | null;
};

/** What the audit row keeps of a listing: the assessment, never the organisation's own copy. */
const employerAssessment = (row: EmployerRow) => ({
  accessibilityRating: row.accessibilityRating,
  accommodationsOffered: row.accommodationsOffered,
  hasWheelchairAccess: row.hasWheelchairAccess,
  hasFlexibleWork: row.hasFlexibleWork,
  hasRemoteOptions: row.hasRemoteOptions,
  hasMentalHealthSupport: row.hasMentalHealthSupport,
  listed: row.verifiedAt !== null,
});

// GET /api/impact/admin/disability-employers - Every listing, retired ones included
router.get('/admin/disability-employers', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const employers = await prisma.disabilityFriendlyEmployer.findMany({
      include: { organization: EMPLOYER_ORG_SELECT },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    res.json({ success: true, data: employers });
  } catch (error) {
    next(error);
  }
});

// GET /api/impact/admin/organizations?q= - Find the organisation to list
router.get('/admin/organizations', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = text(req.query.q, 100);
    if (!q || q.length < 2) throw new ApiError(400, 'q: type at least two letters of the organisation name');
    const organizations = await prisma.organization.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, industry: true, city: true, state: true, disabilityFriendlyListings: { select: { id: true, verifiedAt: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    res.json({ success: true, data: organizations });
  } catch (error) {
    next(error);
  }
});

// POST /api/impact/admin/disability-employers - List an employer staff have checked
router.post('/admin/disability-employers', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { basis, organizationId, ...assessment } = parse(employerCreateSchema, req.body);

    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
    if (!organization) throw new ApiError(404, 'No such organisation');

    const existing = await prisma.disabilityFriendlyEmployer.findUnique({ where: { organizationId }, select: { id: true, verifiedAt: true } });
    if (existing) {
      throw new ApiError(
        409,
        existing.verifiedAt
          ? `${organization.name} is already on the list. Edit its listing instead.`
          : `${organization.name} was listed before and retired. Edit that listing to put it back, so its history stays in one place.`
      );
    }

    const employer = await prisma.disabilityFriendlyEmployer.create({
      data: { organizationId, ...assessment, badgeType: null, verifiedAt: new Date() },
      include: { organization: EMPLOYER_ORG_SELECT },
    });

    await recordStaffAction(req, 'DISABILITY_EMPLOYER_LISTED', {
      resourceType: 'DisabilityFriendlyEmployer',
      resourceId: employer.id,
      organizationId,
      organizationName: organization.name,
      after: employerAssessment(employer),
      basis,
    });

    res.status(201).json({ success: true, data: employer, message: `${organization.name} is on the list.` });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/impact/admin/disability-employers/:id - Re-check a listing, and put a retired one back
router.patch('/admin/disability-employers/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { basis, ...changes } = parse(employerUpdateSchema, req.body);
    const before = await prisma.disabilityFriendlyEmployer.findUnique({ where: { id: req.params.id }, include: { organization: EMPLOYER_ORG_SELECT } });
    if (!before) throw new ApiError(404, 'Listing not found');

    // An edit is somebody looking at the employer again and vouching for what
    // the listing now says, so it is dated as a fresh check, and it lists a
    // retired employer again.
    const employer = await prisma.disabilityFriendlyEmployer.update({
      where: { id: before.id },
      data: { ...changes, verifiedAt: new Date() },
      include: { organization: EMPLOYER_ORG_SELECT },
    });

    await recordStaffAction(req, 'DISABILITY_EMPLOYER_UPDATED', {
      resourceType: 'DisabilityFriendlyEmployer',
      resourceId: employer.id,
      organizationId: employer.organizationId,
      organizationName: employer.organization.name,
      before: employerAssessment(before),
      after: employerAssessment(employer),
      relisted: before.verifiedAt === null,
      basis,
    });

    res.json({
      success: true,
      data: employer,
      message: before.verifiedAt === null ? `${employer.organization.name} is back on the list.` : 'Updated, and dated as checked today.',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/impact/admin/disability-employers/:id/retire - Take an employer off the list
router.post('/admin/disability-employers/:id/retire', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = parse(z.object({ reason: staffReason('the employer is coming off the list') }), req.body);
    const before = await prisma.disabilityFriendlyEmployer.findUnique({ where: { id: req.params.id }, include: { organization: EMPLOYER_ORG_SELECT } });
    if (!before) throw new ApiError(404, 'Listing not found');
    if (!before.verifiedAt) throw new ApiError(409, `${before.organization.name} is already off the list.`);

    const employer = await prisma.disabilityFriendlyEmployer.update({
      where: { id: before.id },
      data: { verifiedAt: null },
      include: { organization: EMPLOYER_ORG_SELECT },
    });

    await recordStaffAction(req, 'DISABILITY_EMPLOYER_RETIRED', {
      resourceType: 'DisabilityFriendlyEmployer',
      resourceId: employer.id,
      organizationId: employer.organizationId,
      organizationName: employer.organization.name,
      before: employerAssessment(before),
      reason,
    });

    res.json({ success: true, data: employer, message: `${employer.organization.name} is off the list.` });
  } catch (error) {
    next(error);
  }
});

export default router;
