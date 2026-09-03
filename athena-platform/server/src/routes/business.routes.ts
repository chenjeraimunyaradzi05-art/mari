import { Router, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createAcceleratorEnrollmentPayment } from '../services/payments-orchestration.service';

const router = Router();

function asRecord(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

// ===========================================
// ACCELERATOR COHORT PROGRESS
// ===========================================

interface CompletedWeek {
  weekNumber: number;
  completedAt: string;
  note?: string;
  url?: string;
}

type ProgressEnrollment = {
  id: string;
  status: string;
  paymentStatus: string;
  completedWeeks: number;
  deliverables: unknown;
  completedAt: Date | null;
  cohort: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    sessions: {
      id: string;
      weekNumber: number;
      title: string;
      scheduledAt: Date;
      durationMins: number;
      meetingUrl: string | null;
      recordingUrl: string | null;
    }[];
  };
};

/**
 * Read the weeks a participant has marked complete.
 *
 * `deliverables` is a free-form Json column, so tolerate both the shape this
 * route writes ({ weeks: [...] }) and a bare array, and drop anything that is
 * not a usable week rather than letting it distort the count.
 */
function completedWeekRecords(deliverables: unknown): CompletedWeek[] {
  const raw = Array.isArray(deliverables) ? deliverables : asRecord(deliverables).weeks;
  if (!Array.isArray(raw)) return [];

  const byWeek = new Map<number, CompletedWeek>();

  for (const entry of raw) {
    const record = asRecord(entry);
    const weekNumber = Number(record.weekNumber);
    if (!Number.isInteger(weekNumber) || weekNumber < 1) continue;

    byWeek.set(weekNumber, {
      weekNumber,
      completedAt: typeof record.completedAt === 'string' ? record.completedAt : '',
      ...(typeof record.note === 'string' ? { note: record.note } : {}),
      ...(typeof record.url === 'string' ? { url: record.url } : {}),
    });
  }

  return Array.from(byWeek.values()).sort((a, b) => a.weekNumber - b.weekNumber);
}

/**
 * Build the week-by-week view of a cohort for one participant. A week the
 * participant has not marked is only "in progress" once its session date has
 * passed; nothing here infers attendance the platform cannot observe.
 */
function buildCohortProgress(enrollment: ProgressEnrollment) {
  const completed = completedWeekRecords(enrollment.deliverables);
  const completedByWeek = new Map(completed.map((week) => [week.weekNumber, week]));
  const now = Date.now();

  const weeks = enrollment.cohort.sessions.map((session) => {
    const done = completedByWeek.get(session.weekNumber);
    const started = session.scheduledAt.getTime() <= now;

    return {
      weekNumber: session.weekNumber,
      sessionId: session.id,
      title: session.title,
      scheduledAt: session.scheduledAt,
      durationMins: session.durationMins,
      meetingUrl: session.meetingUrl,
      recordingUrl: session.recordingUrl,
      status: done ? 'COMPLETED' : started ? 'IN_PROGRESS' : 'UPCOMING',
      completedAt: done?.completedAt || null,
      note: done?.note || null,
      deliverableUrl: done?.url || null,
    };
  });

  const totalWeeks = weeks.length;
  const completedWeeks = weeks.filter((week) => week.status === 'COMPLETED').length;
  const currentWeek =
    weeks.find((week) => week.status === 'IN_PROGRESS') ||
    weeks.find((week) => week.status === 'UPCOMING') ||
    null;

  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    paymentStatus: enrollment.paymentStatus,
    cohort: {
      id: enrollment.cohort.id,
      name: enrollment.cohort.name,
      startDate: enrollment.cohort.startDate,
      endDate: enrollment.cohort.endDate,
    },
    totalWeeks,
    completedWeeks,
    percentComplete: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0,
    currentWeekNumber: currentWeek ? currentWeek.weekNumber : null,
    completedAt: enrollment.completedAt,
    weeks,
  };
}

// ===========================================
// GRANT MATCH SCORING
// ===========================================

/**
 * A grant says who it is for in four ways that actually exist in the data:
 * industries, stages and regions (free-text arrays) plus a funding band and a
 * deadline. The applicant side of each comparison comes from the application
 * itself, backed by the location on their account.
 *
 * Nothing else is scored. Inventing criteria the grant never stated would
 * produce a number that looks authoritative and is not, and a wrong match
 * score costs a founder a wasted application.
 */
const GRANT_MATCH_WEIGHTS = {
  industry: 30,
  stage: 20,
  region: 25,
  funding: 15,
  timing: 10,
} as const;

// Grants and profiles spell Australian regions both ways, and a grant open
// nationally is open to every applicant in the country.
const AU_STATE_ALIASES: Record<string, string> = {
  qld: 'queensland',
  nsw: 'new south wales',
  vic: 'victoria',
  sa: 'south australia',
  wa: 'western australia',
  tas: 'tasmania',
  nt: 'northern territory',
  act: 'australian capital territory',
};

const NATIONWIDE_REGIONS = new Set([
  'national',
  'nationwide',
  'australia',
  'all',
  'any',
  'anz',
  'all states',
]);

function normaliseTag(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

function normaliseTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const tags = values.map(normaliseTag).filter((tag): tag is string => tag !== null);
  return Array.from(new Set(tags));
}

/** Expand a region tag to everything it is also known as, both directions. */
function expandRegion(tag: string): string[] {
  const expanded = [tag];
  if (AU_STATE_ALIASES[tag]) expanded.push(AU_STATE_ALIASES[tag]);
  for (const [abbreviation, full] of Object.entries(AU_STATE_ALIASES)) {
    if (full === tag) expanded.push(abbreviation);
  }
  return expanded;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface GrantMatchComponent {
  criterion: string;
  weight: number;
  earned: number;
  detail: string;
}

export interface GrantMatchResult {
  score: number | null;
  components: GrantMatchComponent[];
  /** Criteria the grant or the applicant left blank, so they were not scored. */
  notScored: string[];
}

type ScorableGrant = {
  industries: string[];
  stages: string[];
  regions: string[];
  minFunding: unknown;
  maxFunding: unknown;
  deadline: Date | null;
  isRolling: boolean;
};

type GrantApplicant = {
  industries: string[];
  stages: string[];
  regions: string[];
  requestedAmount: number | null;
};

/**
 * Read the applicant side of the comparison: what they said on the application,
 * falling back to the location on their account for region.
 */
function applicantMatchProfile(
  applicationData: unknown,
  user: { state: string | null; country: string | null } | null
): GrantApplicant {
  const data = asRecord(applicationData);

  return {
    industries: normaliseTags(data.industries ?? data.industry),
    stages: normaliseTags(data.stages ?? data.stage),
    regions: normaliseTags(
      [data.regions, data.region, data.state, user?.state, user?.country].flat()
    ),
    requestedAmount: toFiniteNumber(
      data.requestedAmount ?? data.amountRequested ?? data.fundingRequested
    ),
  };
}

/**
 * Score a grant against an applicant, out of 100.
 *
 * Only criteria both sides declared are scored, and the total is normalised
 * over those weights: a grant that names no industries must not push every
 * applicant's score down for a question it never asked. If neither side
 * declared anything comparable the score is null - honestly unknown rather
 * than a fabricated zero.
 */
function scoreGrantMatch(grant: ScorableGrant, applicant: GrantApplicant): GrantMatchResult {
  const components: GrantMatchComponent[] = [];
  const notScored: string[] = [];

  const overlap = (grantTags: string[], applicantTags: string[]) =>
    grantTags.filter((tag) => applicantTags.includes(tag));

  const grantIndustries = normaliseTags(grant.industries);
  if (grantIndustries.length > 0 && applicant.industries.length > 0) {
    const shared = overlap(grantIndustries, applicant.industries);
    components.push({
      criterion: 'industry',
      weight: GRANT_MATCH_WEIGHTS.industry,
      earned: shared.length > 0 ? GRANT_MATCH_WEIGHTS.industry : 0,
      detail:
        shared.length > 0
          ? `Grant targets ${shared.join(', ')}`
          : `Grant targets ${grantIndustries.join(', ')}, which does not include your industry`,
    });
  } else {
    notScored.push('industry');
  }

  const grantStages = normaliseTags(grant.stages);
  if (grantStages.length > 0 && applicant.stages.length > 0) {
    const shared = overlap(grantStages, applicant.stages);
    components.push({
      criterion: 'stage',
      weight: GRANT_MATCH_WEIGHTS.stage,
      earned: shared.length > 0 ? GRANT_MATCH_WEIGHTS.stage : 0,
      detail:
        shared.length > 0
          ? `Grant is open to ${shared.join(', ')} businesses`
          : `Grant is for ${grantStages.join(', ')} businesses`,
    });
  } else {
    notScored.push('stage');
  }

  const grantRegions = normaliseTags(grant.regions);
  if (grantRegions.length > 0 && applicant.regions.length > 0) {
    const applicantRegions = new Set(applicant.regions.flatMap(expandRegion));
    const nationwide = grantRegions.filter((region) => NATIONWIDE_REGIONS.has(region));
    const shared = grantRegions
      .flatMap(expandRegion)
      .filter((region) => applicantRegions.has(region));

    const matched = shared.length > 0 || nationwide.length > 0;
    components.push({
      criterion: 'region',
      weight: GRANT_MATCH_WEIGHTS.region,
      earned: matched ? GRANT_MATCH_WEIGHTS.region : 0,
      detail: matched
        ? nationwide.length > 0 && shared.length === 0
          ? 'Grant is open nationally'
          : `Grant covers ${shared[0]}`
        : `Grant is limited to ${grantRegions.join(', ')}`,
    });
  } else {
    notScored.push('region');
  }

  const minFunding = toFiniteNumber(grant.minFunding);
  const maxFunding = toFiniteNumber(grant.maxFunding);
  if (applicant.requestedAmount !== null && (minFunding !== null || maxFunding !== null)) {
    const requested = applicant.requestedAmount;
    const aboveFloor = minFunding === null || requested >= minFunding;
    const belowCeiling = maxFunding === null || requested <= maxFunding;

    // Just outside the band still earns half: grant amounts are negotiable in a
    // way that an industry or a region is not.
    const nearBand =
      (minFunding !== null && requested >= minFunding * 0.75) ||
      (maxFunding !== null && requested <= maxFunding * 1.25);

    const earned =
      aboveFloor && belowCeiling
        ? GRANT_MATCH_WEIGHTS.funding
        : nearBand
          ? Math.round(GRANT_MATCH_WEIGHTS.funding / 2)
          : 0;

    components.push({
      criterion: 'funding',
      weight: GRANT_MATCH_WEIGHTS.funding,
      earned,
      detail:
        aboveFloor && belowCeiling
          ? 'Your requested amount sits inside the grant band'
          : `Grant funds ${minFunding ?? 'any'} to ${maxFunding ?? 'any'}`,
    });
  } else {
    notScored.push('funding');
  }

  if (grant.isRolling || grant.deadline) {
    const open = grant.isRolling || (grant.deadline as Date).getTime() > Date.now();
    components.push({
      criterion: 'timing',
      weight: GRANT_MATCH_WEIGHTS.timing,
      earned: open ? GRANT_MATCH_WEIGHTS.timing : 0,
      detail: grant.isRolling
        ? 'Applications are accepted year round'
        : open
          ? `Applications close ${(grant.deadline as Date).toISOString().slice(0, 10)}`
          : 'The application deadline has passed',
    });
  } else {
    notScored.push('timing');
  }

  const applicableWeight = components.reduce((total, part) => total + part.weight, 0);
  if (applicableWeight === 0) {
    return { score: null, components, notScored };
  }

  const earnedWeight = components.reduce((total, part) => total + part.earned, 0);

  return {
    score: Math.round((earnedWeight / applicableWeight) * 100),
    components,
    notScored,
  };
}

/** Score an application against its grant, reading the applicant's location. */
async function matchScoreForApplication(
  grant: ScorableGrant,
  userId: string,
  applicationData: unknown
): Promise<GrantMatchResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { state: true, country: true },
  });

  return scoreGrantMatch(grant, applicantMatchProfile(applicationData, user));
}


// ===========================================
// ACCELERATOR COHORTS
// ===========================================

// GET /api/business/accelerators - List all accelerator cohorts
router.get('/accelerators', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, upcoming } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (upcoming === 'true') {
      where.startDate = { gte: new Date() };
    }

    const cohorts = await prisma.acceleratorCohort.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        _count: {
          select: { enrollments: true, sessions: true },
        },
      },
    });

    res.json({
      success: true,
      data: cohorts.map((c) => ({
        ...c,
        enrollmentCount: c._count.enrollments,
        sessionCount: c._count.sessions,
        spotsRemaining: c.maxParticipants - c._count.enrollments,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/accelerators/:id - Get cohort details
router.get('/accelerators/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const cohort = await prisma.acceleratorCohort.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { weekNumber: 'asc' },
        },
        enrollments: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!cohort) {
      throw new ApiError(404, 'Accelerator cohort not found');
    }

    res.json({
      success: true,
      data: {
        ...cohort,
        spotsRemaining: cohort.maxParticipants - cohort._count.enrollments,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/accelerators/:id/enroll - Enroll in cohort
router.post(
  '/accelerators/:id/enroll',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const cohort = await prisma.acceleratorCohort.findUnique({
        where: { id },
        include: { _count: { select: { enrollments: true } } },
      });

      if (!cohort) {
        throw new ApiError(404, 'Accelerator cohort not found');
      }

      if (cohort.status !== 'ENROLLING' && cohort.status !== 'UPCOMING') {
        throw new ApiError(400, 'This cohort is no longer accepting enrollments');
      }

      if (cohort._count.enrollments >= cohort.maxParticipants) {
        throw new ApiError(400, 'This cohort is full');
      }

      // Check existing enrollment
      const existing = await prisma.acceleratorEnrollment.findUnique({
        where: { cohortId_userId: { cohortId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You are already enrolled in this cohort');
      }

      const enrollment = await prisma.acceleratorEnrollment.create({
        data: {
          cohortId: id,
          userId,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
        include: {
          cohort: true,
        },
      });

      logger.info(`User ${userId} enrolled in accelerator cohort ${id}`);

      res.status(201).json({
        success: true,
        data: enrollment,
        message: 'Enrollment created. Please complete payment to confirm your spot.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/accelerators/my/enrollments - Get user's enrollments
router.get(
  '/accelerators/my/enrollments',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const enrollments = await prisma.acceleratorEnrollment.findMany({
        where: { userId },
        include: {
          cohort: {
            include: {
              sessions: {
                orderBy: { weekNumber: 'asc' },
              },
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
      });

      res.json({
        success: true,
        data: enrollments,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/business/accelerators/enrollments/:id/payment - Pay for a spot
router.post(
  '/accelerators/enrollments/:id/payment',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const enrollment = await prisma.acceleratorEnrollment.findUnique({
        where: { id },
        include: { cohort: true },
      });

      if (!enrollment) {
        throw new ApiError(404, 'Enrollment not found');
      }

      if (enrollment.userId !== userId) {
        throw new ApiError(403, 'Not authorized to pay for this enrollment');
      }

      if (enrollment.paymentStatus === 'PAID') {
        throw new ApiError(409, 'This enrollment is already paid');
      }

      if (enrollment.paymentStatus === 'REFUNDED' || enrollment.status === 'DROPPED') {
        throw new ApiError(400, 'This enrollment is no longer active');
      }

      if (enrollment.cohort.status === 'CANCELLED' || enrollment.cohort.status === 'COMPLETED') {
        throw new ApiError(400, 'This cohort is no longer taking payments');
      }

      // Enrolling reserves a place, but only a paid place is real. Re-check
      // capacity against paid enrollments so a cohort cannot be oversold to
      // people who were still sitting in the queue.
      const paidCount = await prisma.acceleratorEnrollment.count({
        where: { cohortId: enrollment.cohortId, paymentStatus: 'PAID' },
      });

      if (paidCount >= enrollment.cohort.maxParticipants) {
        throw new ApiError(400, 'This cohort is full');
      }

      const payment = await createAcceleratorEnrollmentPayment({
        enrollmentId: enrollment.id,
        userId,
        cohortId: enrollment.cohortId,
        cohortName: enrollment.cohort.name,
        priceAud: enrollment.cohort.priceAud,
      });

      if (!payment.free && !payment.clientSecret) {
        logger.error(`Accelerator payment could not be started for enrollment ${enrollment.id}`);
        throw new ApiError(500, payment.error || 'Could not start payment. Please try again.');
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/accelerators/enrollments/:id/progress - Week-by-week progress
router.get(
  '/accelerators/enrollments/:id/progress',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const enrollment = await prisma.acceleratorEnrollment.findUnique({
        where: { id },
        include: {
          cohort: {
            include: { sessions: { orderBy: { weekNumber: 'asc' } } },
          },
        },
      });

      if (!enrollment) {
        throw new ApiError(404, 'Enrollment not found');
      }

      if (enrollment.userId !== userId) {
        throw new ApiError(403, 'Not authorized to view this enrollment');
      }

      res.json({
        success: true,
        data: buildCohortProgress(enrollment),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/business/accelerators/enrollments/:id/progress - Mark a week done
router.post(
  '/accelerators/enrollments/:id/progress',
  authenticate,
  [
    body('weekNumber').isInt({ min: 1 }),
    body('note').optional().isString().isLength({ max: 2000 }),
    body('deliverableUrl').optional().isURL(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const weekNumber = Number(req.body.weekNumber);
      const { note, deliverableUrl } = req.body;

      const enrollment = await prisma.acceleratorEnrollment.findUnique({
        where: { id },
        include: {
          cohort: {
            include: { sessions: { orderBy: { weekNumber: 'asc' } } },
          },
        },
      });

      if (!enrollment) {
        throw new ApiError(404, 'Enrollment not found');
      }

      if (enrollment.userId !== userId) {
        throw new ApiError(403, 'Not authorized to update this enrollment');
      }

      if (enrollment.paymentStatus !== 'PAID') {
        throw new ApiError(400, 'Complete payment before recording cohort progress');
      }

      const session = enrollment.cohort.sessions.find((s) => s.weekNumber === weekNumber);
      if (!session) {
        throw new ApiError(404, 'That week is not part of this cohort');
      }

      const weeks = completedWeekRecords(enrollment.deliverables).filter(
        (week) => week.weekNumber !== weekNumber
      );

      weeks.push({
        weekNumber,
        completedAt: new Date().toISOString(),
        ...(typeof note === 'string' && note.trim().length > 0 ? { note: note.trim() } : {}),
        ...(typeof deliverableUrl === 'string' && deliverableUrl.length > 0
          ? { url: deliverableUrl }
          : {}),
      });

      weeks.sort((a, b) => a.weekNumber - b.weekNumber);

      // completedWeeks is derived from the marked weeks rather than incremented,
      // so marking week 5 first does not claim weeks 1 to 4 as well.
      const totalWeeks = enrollment.cohort.sessions.length;
      const cohortHasEnded = enrollment.cohort.endDate.getTime() <= Date.now();
      const finished = totalWeeks > 0 && weeks.length >= totalWeeks && cohortHasEnded;

      const updated = await prisma.acceleratorEnrollment.update({
        where: { id },
        data: {
          deliverables: { weeks } as unknown as Prisma.InputJsonValue,
          completedWeeks: weeks.length,
          // Finishing every week is the participant's own record of the work.
          // It only becomes COMPLETED once the cohort itself has ended, so an
          // early tick-through cannot manufacture a graduation.
          ...(finished && enrollment.status === 'ACTIVE'
            ? { status: 'COMPLETED' as const, completedAt: new Date() }
            : {}),
        },
        include: {
          cohort: {
            include: { sessions: { orderBy: { weekNumber: 'asc' } } },
          },
        },
      });

      logger.info(`User ${userId} marked week ${weekNumber} complete on enrollment ${id}`);

      res.json({
        success: true,
        data: buildCohortProgress(updated),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GRANTS
// ===========================================

// GET /api/business/grants - List grants
router.get('/grants', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { providerType, industry, region, active } = req.query;

    const where: any = {};
    if (providerType) {
      where.providerType = providerType;
    }
    if (industry) {
      where.industries = { has: industry as string };
    }
    if (region) {
      where.regions = { has: region as string };
    }
    if (active !== 'false') {
      where.isActive = true;
    }

    const grants = await prisma.grant.findMany({
      where,
      orderBy: [
        { deadline: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      success: true,
      data: grants,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/grants/:id - Get grant details
router.get('/grants/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const grant = await prisma.grant.findUnique({
      where: { id },
    });

    if (!grant) {
      throw new ApiError(404, 'Grant not found');
    }

    res.json({
      success: true,
      data: grant,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/grants/:id/apply - Apply for grant
router.post(
  '/grants/:id/apply',
  authenticate,
  [body('applicationData').optional().isObject()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { applicationData } = req.body;

      const grant = await prisma.grant.findUnique({ where: { id } });
      if (!grant) {
        throw new ApiError(404, 'Grant not found');
      }

      if (!grant.isActive) {
        throw new ApiError(400, 'This grant is no longer accepting applications');
      }

      // Check existing application
      const existing = await prisma.grantApplication.findUnique({
        where: { grantId_userId: { grantId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You have already applied for this grant');
      }

      const match = await matchScoreForApplication(grant, userId, applicationData);

      const application = await prisma.grantApplication.create({
        data: {
          grantId: id,
          userId,
          status: 'DRAFT',
          applicationData,
          matchScore: match.score,
        },
        include: {
          grant: true,
        },
      });

      logger.info(`User ${userId} started grant application for ${id}`);

      res.status(201).json({
        success: true,
        data: {
          ...application,
          // The score is only useful if the applicant can see what drove it.
          matchBreakdown: match.components,
          matchNotScored: match.notScored,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/grants/my/applications - Get user's grant applications
router.get(
  '/grants/my/applications',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const applications = await prisma.grantApplication.findMany({
        where: { userId },
        include: {
          grant: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/business/grants/applications/:id - Update grant application
router.patch(
  '/grants/applications/:id',
  authenticate,
  [
    body('applicationData').optional().isObject(),
    body('status').optional().isIn(['DRAFT', 'SUBMITTED', 'WITHDRAWN']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { applicationData, status } = req.body;

      const application = await prisma.grantApplication.findUnique({
        where: { id },
      });

      if (!application) {
        throw new ApiError(404, 'Application not found');
      }

      if (application.userId !== userId) {
        throw new ApiError(403, 'Not authorized to update this application');
      }

      if (application.status !== 'DRAFT' && status !== 'WITHDRAWN') {
        throw new ApiError(400, 'Cannot modify a submitted application');
      }

      // The score describes the answers on this application, so it is
      // recomputed whenever those answers change instead of going stale.
      let match: GrantMatchResult | null = null;
      if (applicationData) {
        const grant = await prisma.grant.findUnique({ where: { id: application.grantId } });
        if (grant) {
          match = await matchScoreForApplication(grant, userId, applicationData);
        }
      }

      const updated = await prisma.grantApplication.update({
        where: { id },
        data: {
          ...(applicationData && { applicationData }),
          ...(status && { status }),
          ...(status === 'SUBMITTED' && { submittedAt: new Date() }),
          ...(match ? { matchScore: match.score } : {}),
        },
        include: {
          grant: true,
        },
      });

      res.json({
        success: true,
        data: match
          ? { ...updated, matchBreakdown: match.components, matchNotScored: match.notScored }
          : updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// INVESTORS
// ===========================================

// GET /api/business/investors - List investors
router.get('/investors', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, industry, stage, region, minCheck, maxCheck } = req.query;

    const where: any = { isActive: true };
    if (type) {
      where.type = type;
    }
    if (industry) {
      where.industries = { has: industry as string };
    }
    if (stage) {
      where.stages = { has: stage as string };
    }
    if (region) {
      where.regions = { has: region as string };
    }

    const investors = await prisma.investor.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: investors,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/investors/:id - Get investor details
router.get('/investors/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const investor = await prisma.investor.findUnique({
      where: { id },
    });

    if (!investor) {
      throw new ApiError(404, 'Investor not found');
    }

    res.json({
      success: true,
      data: investor,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/investors/:id/request-intro - Request introduction
router.post(
  '/investors/:id/request-intro',
  authenticate,
  [body('message').optional().isString().isLength({ max: 1000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { message } = req.body;

      const investor = await prisma.investor.findUnique({ where: { id } });
      if (!investor) {
        throw new ApiError(404, 'Investor not found');
      }

      if (!investor.isActive) {
        throw new ApiError(400, 'This investor is not currently accepting introductions');
      }

      // Check existing introduction
      const existing = await prisma.investorIntroduction.findUnique({
        where: { investorId_userId: { investorId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You have already requested an introduction to this investor');
      }

      const introduction = await prisma.investorIntroduction.create({
        data: {
          investorId: id,
          userId,
          message,
          status: 'REQUESTED',
        },
        include: {
          investor: true,
        },
      });

      logger.info(`User ${userId} requested intro to investor ${id}`);

      res.status(201).json({
        success: true,
        data: introduction,
        message: 'Introduction request submitted. We will review and connect you soon.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/investors/my/introductions - Get user's investor introductions
router.get(
  '/investors/my/introductions',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const introductions = await prisma.investorIntroduction.findMany({
        where: { userId },
        include: {
          investor: true,
        },
        orderBy: { requestedAt: 'desc' },
      });

      res.json({
        success: true,
        data: introductions,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// VENDORS
// ===========================================

// GET /api/business/vendors - List vendors
router.get('/vendors', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category, partner, verified, minRating } = req.query;

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (partner === 'true') {
      where.isPartner = true;
    }
    if (verified === 'true') {
      where.isVerified = true;
    }
    if (minRating) {
      where.avgRating = { gte: parseFloat(minRating as string) };
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: [
        { isPartner: 'desc' },
        { avgRating: 'desc' },
      ],
    });

    res.json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/business/vendors/:id - Get vendor details
router.get('/vendors/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        reviews: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!vendor) {
      throw new ApiError(404, 'Vendor not found');
    }

    res.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/vendors/:id/reviews - Add vendor review
router.post(
  '/vendors/:id/reviews',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('title').optional().isString().isLength({ max: 100 }),
    body('content').optional().isString().isLength({ max: 2000 }),
    body('projectType').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { rating, title, content, projectType } = req.body;

      const vendor = await prisma.vendor.findUnique({ where: { id } });
      if (!vendor) {
        throw new ApiError(404, 'Vendor not found');
      }

      // Check existing review
      const existing = await prisma.vendorReview.findUnique({
        where: { vendorId_userId: { vendorId: id, userId } },
      });

      if (existing) {
        throw new ApiError(409, 'You have already reviewed this vendor');
      }

      // Create review and update vendor stats in transaction
      const [review] = await prisma.$transaction([
        prisma.vendorReview.create({
          data: {
            vendorId: id,
            userId,
            rating,
            title,
            content,
            projectType,
          },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        }),
        prisma.vendor.update({
          where: { id },
          data: {
            reviewCount: { increment: 1 },
            avgRating: {
              set: await prisma.vendorReview
                .aggregate({
                  where: { vendorId: id },
                  _avg: { rating: true },
                })
                .then((r) => r._avg.rating || 0),
            },
          },
        }),
      ]);

      logger.info(`User ${userId} reviewed vendor ${id}`);

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// RFPs (Request for Proposals)
// ===========================================

// GET /api/business/rfps - List RFPs
router.get('/rfps', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category, status } = req.query;

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (status) {
      where.status = status;
    } else {
      where.status = 'OPEN';
    }

    const rfps = await prisma.rfp.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        _count: {
          select: { responses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: rfps.map((r) => ({
        ...r,
        responseCount: r._count.responses,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/business/rfps - Create RFP
router.post(
  '/rfps',
  authenticate,
  [
    body('title').notEmpty().trim().isLength({ max: 200 }),
    body('description').notEmpty().trim(),
    body('category').isIn([
      'ACCOUNTING_TAX',
      'LEGAL',
      'DESIGN_MARKETING',
      'TECH_DEVELOPMENT',
      'HR_COMPLIANCE',
      'BUSINESS_COACHING',
      'PHOTOGRAPHY_VIDEO',
      'COPYWRITING',
      'VIRTUAL_ASSISTANT',
      'OTHER',
    ]),
    body('budget').optional().isString(),
    body('deadline').optional().isISO8601(),
    body('requirements').optional().isObject(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;
      const { title, description, category, budget, deadline, requirements } = req.body;

      const rfp = await prisma.rfp.create({
        data: {
          userId,
          title,
          description,
          category,
          budget,
          deadline: deadline ? new Date(deadline) : undefined,
          requirements,
          status: 'OPEN',
        },
      });

      logger.info(`User ${userId} created RFP ${rfp.id}`);

      res.status(201).json({
        success: true,
        data: rfp,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/rfps/my - Get user's RFPs
router.get(
  '/rfps/my',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const rfps = await prisma.rfp.findMany({
        where: { userId },
        include: {
          responses: {
            include: {
              vendor: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: rfps,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/business/rfps/:id - Get RFP details
router.get('/rfps/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const rfp = await prisma.rfp.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        responses: {
          include: {
            vendor: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!rfp) {
      throw new ApiError(404, 'RFP not found');
    }

    res.json({
      success: true,
      data: rfp,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/business/rfps/:id - Update RFP status
router.patch(
  '/rfps/:id',
  authenticate,
  [body('status').isIn(['OPEN', 'CLOSED', 'AWARDED', 'CANCELLED'])],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const userId = req.user!.id;
      const { status } = req.body;

      const rfp = await prisma.rfp.findUnique({ where: { id } });

      if (!rfp) {
        throw new ApiError(404, 'RFP not found');
      }

      if (rfp.userId !== userId) {
        throw new ApiError(403, 'Not authorized to update this RFP');
      }

      const updated = await prisma.rfp.update({
        where: { id },
        data: { status },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
