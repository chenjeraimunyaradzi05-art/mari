/**
 * AI algorithm routes (/api/ai-algorithms/*)
 *
 * ## Three of these tables are placeholder-only
 *
 * `careerPrediction`, `mentorMatchScore` and `opportunityMatch` were built for
 * an ML service that was never connected. Nothing on the server writes any of
 * the three, so GET /mentor-match and GET /opportunity-scan here are always
 * empty. careerPrediction had one writer — POST /career-compass/generate — and
 * it invented every figure it stored; it is gone, that route answers 501, and
 * GET /career-compass refuses to serve the rows it left behind. See the comment
 * above the route for what those rows contained and why a 503 in front of them
 * was not enough.
 *
 * The web app no longer reads any of the three. /dashboard/ai/career-compass,
 * /dashboard/ai/mentors and /dashboard/ai/opportunities read
 * /api/algorithms/career-compass, /mentor-match and /opportunity-scan, which
 * are real queries (see algorithm.routes.ts). /dashboard/ai/trust reads
 * /api/trust-score, which returns the factors behind the score. The
 * userTrustScore row that GET /trust-score here returns starts at 50 and only
 * moves on a report or a block (trust.service applyTrustDelta), so it and
 * user.trustScore are two stores that still need reconciling server-side.
 *
 * Do not build a screen against the placeholder tables. The salary routes
 * (/salary-equity/*), POST /report, creator analytics and feed preferences
 * below read and write real rows and stay in use.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { creatorTierStanding, refreshCreatorAnalytics } from '../services/creator.service';

const router = Router();

/**
 * The modelVersion the deleted placeholder generator stamped on every row it
 * wrote. Rows carrying it are the invented forecasts described below, and GET
 * /career-compass refuses to serve them wherever they still exist.
 */
const PLACEHOLDER_PREDICTION_VERSION = 'v1.0.0';

// Require authentication for all AI algorithm routes
router.use(authenticate);

// =============================================
// CAREER COMPASS - Career Trajectory Prediction
// =============================================
// Placeholder-only: careerPrediction is written by nothing but the gated
// generate route below. The web app reads /api/algorithms/career-compass.

// Get user's career predictions
//
// Anything this returns is served to a member as a forecast of her own career,
// so it must have been forecast by something. The only writer this table ever
// had was the generate route below, which invented every figure it stored — so
// the rows it left behind are excluded by modelVersion rather than trusted
// because they happen to exist. The exclusion is by version and not a blanket
// refusal so that a real generator, stamping its own version, needs no change
// here to be served.
router.get('/career-compass', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const prediction = await prisma.careerPrediction.findFirst({
      where: {
        userId,
        expiresAt: { gte: new Date() },
        NOT: { modelVersion: PLACEHOLDER_PREDICTION_VERSION },
      },
      orderBy: { generatedAt: 'desc' },
    });

    res.json({ data: prediction });
  } catch (error) {
    next(error);
  }
});

// Generate new career prediction
//
// What this route used to do was write, for every member who called it, the
// same invented forecast: "Senior Software Engineer" at 75% probability paying
// "$150,000 - $180,000", three priority skills each with a salary lift in whole
// thousands, and riskFactors carrying an attritionRisk of 25, burnoutIndicators
// of 15 and a wageGapExposure of 8 — an assessment of how likely a named woman
// was to burn out and leave, computed by nothing, stored against her record,
// confidenceScore 0.78. The salary figures were US dollars on a Queensland
// platform.
//
// The 503 that stood in front of it covered production only, and the matching
// GET had no gate at all, so a row written in staging or during a window with
// AI_ALGORITHMS_ALLOW_PLACEHOLDER on was served back as a real forecast for the
// next thirty days. There is no version of this that becomes true by being
// better guarded, so the writer is gone rather than gated: what is missing is a
// model, and an environment variable is not one.
//
// The route stays mounted and answers 501 so that a caller still holding the
// old client helper is told plainly what happened rather than getting a 404 it
// will read as a deploy problem. /dashboard/ai/career-compass reads
// /api/algorithms/career-compass, which compares her skills against real
// listings and has never been part of this.
router.post('/career-compass/generate', async (_req: Request, _res: Response, next: NextFunction) => {
  next(
    new ApiError(
      501,
      'ATHENA does not generate career predictions. The forecast this route used to store — predicted roles, salary bands, attrition and burnout risk — was invented, not computed, and has been withdrawn. Career Compass at /api/algorithms/career-compass compares your skills against the roles employers are actually advertising.'
    )
  );
});

// =============================================
// OPPORTUNITY SCAN - Real-Time Opportunity Surfacing
// =============================================
// Placeholder-only: no code writes opportunityMatch, so this list is always
// empty. The web app reads /api/algorithms/opportunity-scan.

// Get matched opportunities
router.get('/opportunity-scan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type, viewed } = req.query;

    const opportunities = await prisma.opportunityMatch.findMany({
      where: {
        userId,
        ...(type && { opportunityType: type as string }),
        ...(viewed === 'false' && { isViewed: false }),
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: { matchScore: 'desc' },
      take: 20,
    });

    res.json({ data: opportunities });
  } catch (error) {
    next(error);
  }
});

// Mark opportunity as viewed
router.patch('/opportunity-scan/:id/view', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const opportunity = await prisma.opportunityMatch.update({
      where: { id, userId },
      data: {
        isViewed: true,
        viewedAt: new Date(),
      },
    });

    res.json({ data: opportunity });
  } catch (error) {
    next(error);
  }
});

// Record interest/feedback on opportunity
router.patch('/opportunity-scan/:id/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { isInterested, feedback } = req.body;

    const opportunity = await prisma.opportunityMatch.update({
      where: { id, userId },
      data: {
        isInterested,
        feedback,
        interactionAt: new Date(),
      },
    });

    res.json({ data: opportunity });
  } catch (error) {
    next(error);
  }
});

// =============================================
// SALARY EQUITY - Pay Gap Detection
// =============================================
//
// Everything below this line is crowd-sourced: one member's submission moves
// the median every other woman searching that role is shown, and the published
// gender pay gap she may take into a negotiation. The submit handler used to
// check only that jobTitle and baseSalary were truthy, and carried no rate
// limit, so a single caller could post any number of points at baseSalary
// 5000000 and shift the figure for everyone. `totalComp` was computed as
// `baseSalary + (bonus || 0) + (equity || 0)`, which string-concatenates when a
// non-browser caller sends "120000" — writing "1200000" into the column.
//
// The constants are named rather than inlined because they are the boundary
// between a market figure and a poisoned one, and the next person changing one
// should have to see what it is for.

/** AUD per year. Below the floor this is not an annual salary; above the ceiling it is not credible for a role advertised here. */
const SALARY_MIN = 1_000;
const SALARY_MAX = 5_000_000;
/** Bonus and equity are annual too, and no honest one is many times the base. */
const SUPPLEMENT_MAX = 20_000_000;

const GENDERS = ['WOMAN', 'MAN', 'NON_BINARY', 'PREFER_NOT'];
const EDUCATION_LEVELS = ['HIGH_SCHOOL', 'BACHELOR', 'MASTER', 'PHD', 'OTHER'];
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];
/** One median cannot span currencies; see the analyze route, which reports one at a time. */
const CURRENCIES = ['AUD', 'NZD', 'USD', 'GBP', 'EUR', 'CAD', 'SGD'];

/** Prisma takes Decimal; these arrive as JSON numbers and must be numbers by the time they are added. */
const toAmount = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

// Submit anonymous salary data
router.post(
  '/salary-equity/submit',
  // The route that moves everyone else's number had no limiter at all. A
  // member submits her own pay a handful of times a year; a script submits it
  // in a loop.
  aiLimiter,
  [
    body('jobTitle').isString().trim().notEmpty().isLength({ max: 200 })
      .withMessage('A job title is required'),
    body('baseSalary').isFloat({ min: SALARY_MIN, max: SALARY_MAX })
      .withMessage(`Base salary must be an annual figure between ${SALARY_MIN} and ${SALARY_MAX}`),
    body('bonus').optional({ nullable: true }).isFloat({ min: 0, max: SUPPLEMENT_MAX })
      .withMessage('Bonus must be a number of zero or more'),
    body('equity').optional({ nullable: true }).isFloat({ min: 0, max: SUPPLEMENT_MAX })
      .withMessage('Equity must be a number of zero or more'),
    body('currency').optional({ nullable: true }).isIn(CURRENCIES)
      .withMessage(`Currency must be one of ${CURRENCIES.join(', ')}`),
    body('yearsExperience').optional({ nullable: true }).isInt({ min: 0, max: 70 })
      .withMessage('Years of experience must be between 0 and 70'),
    body('yearsInRole').optional({ nullable: true }).isInt({ min: 0, max: 70 })
      .withMessage('Years in role must be between 0 and 70'),
    body('gender').optional({ nullable: true }).isIn(GENDERS)
      .withMessage(`Gender must be one of ${GENDERS.join(', ')}`),
    body('educationLevel').optional({ nullable: true }).isIn(EDUCATION_LEVELS)
      .withMessage(`Education level must be one of ${EDUCATION_LEVELS.join(', ')}`),
    body('companySize').optional({ nullable: true }).isIn(COMPANY_SIZES)
      .withMessage(`Company size must be one of ${COMPANY_SIZES.join(', ')}`),
    body('ageRange').optional({ nullable: true }).isIn(AGE_RANGES)
      .withMessage(`Age range must be one of ${AGE_RANGES.join(', ')}`),
    body('company').optional({ nullable: true }).isString().isLength({ max: 200 }),
    body('industry').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('city').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('state').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('country').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('isRemote').optional({ nullable: true }).isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, errors.array()[0].msg);
    }

    const userId = (req as any).user?.id; // Optional for anonymous

    const {
      jobTitle,
      company,
      companySize,
      industry,
      city,
      state,
      country,
      isRemote,
      currency,
      yearsExperience,
      yearsInRole,
      educationLevel,
      gender,
      ageRange,
    } = req.body;

    // Validated above, so these are numbers; coerced here because
    // express-validator checks the value without rewriting the body, and a
    // string that passes isFloat would still concatenate in the sum below.
    const baseSalary = toAmount(req.body.baseSalary) as number;
    const bonus = toAmount(req.body.bonus);
    const equity = toAmount(req.body.equity);

    const dataPoint = await prisma.salaryDataPoint.create({
      data: {
        userId,
        jobTitle: String(jobTitle).trim(),
        normalizedTitle: String(jobTitle).toLowerCase().trim(),
        company,
        companySize,
        industry,
        city,
        state,
        country: country || 'Australia',
        isRemote: isRemote || false,
        baseSalary,
        currency: currency || 'AUD',
        bonus,
        equity,
        totalComp: baseSalary + (bonus || 0) + (equity || 0),
        yearsExperience,
        yearsInRole,
        educationLevel,
        gender,
        ageRange,
      },
    });

    res.json({ data: { id: dataPoint.id }, message: 'Salary data submitted successfully' });
  } catch (error) {
    next(error);
  }
});

/** Below this, a "market median" is a handful of people's pay wearing the word market. */
const ANALYSIS_MIN_POINTS = 5;
/**
 * Per gender, before a gender gap is published for a role.
 *
 * It was three. A Queensland job title with three women who have reported their
 * pay is a room in which each of them can work out what the others earn — the
 * gap is a difference of two medians over a sample small enough to name, and
 * publishing it to anyone who types the title is a disclosure the three of them
 * never agreed to. Eight is still small; it is the point at which one person's
 * figure stops being recoverable from the published one.
 */
const GENDER_GAP_MIN_PER_GENDER = 8;

// Get salary analysis for a role
router.get('/salary-equity/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { role, location, company } = req.query;

    if (!role || typeof role !== 'string' || !role.trim()) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // One median cannot span currencies. Every figure here was pooled
    // regardless of what it was paid in, so a single salary reported in USD or
    // GBP pulled the AUD median for that role up by an exchange rate nobody
    // applied. The analysis reports one currency at a time and says which.
    const currency =
      typeof req.query.currency === 'string' && CURRENCIES.includes(req.query.currency.toUpperCase())
        ? req.query.currency.toUpperCase()
        : 'AUD';

    // Get salary data points for analysis
    const salaryData = await prisma.salaryDataPoint.findMany({
      where: {
        normalizedTitle: { contains: role.toLowerCase() },
        currency,
        ...(location && { city: { contains: location as string } }),
      },
      select: {
        baseSalary: true,
        totalComp: true,
        gender: true,
        yearsExperience: true,
        educationLevel: true,
        companySize: true,
      },
    });

    if (salaryData.length < ANALYSIS_MIN_POINTS) {
      return res.json({
        data: null,
        currency,
        sampleSize: salaryData.length,
        message: `Insufficient data for analysis. Need at least ${ANALYSIS_MIN_POINTS} salary data points reported in ${currency}.`,
      });
    }

    // Calculate statistics
    const salaries = salaryData.map(d => Number(d.baseSalary)).sort((a, b) => a - b);
    const median = salaries[Math.floor(salaries.length / 2)];
    const p10 = salaries[Math.floor(salaries.length * 0.1)];
    const p25 = salaries[Math.floor(salaries.length * 0.25)];
    const p75 = salaries[Math.floor(salaries.length * 0.75)];
    const p90 = salaries[Math.floor(salaries.length * 0.9)];

    // Gender gap analysis
    const womenSalaries = salaryData.filter(d => d.gender === 'WOMAN').map(d => Number(d.baseSalary));
    const menSalaries = salaryData.filter(d => d.gender === 'MAN').map(d => Number(d.baseSalary));

    let genderGapAmount = null;
    let genderGapPercent = null;
    if (
      womenSalaries.length >= GENDER_GAP_MIN_PER_GENDER &&
      menSalaries.length >= GENDER_GAP_MIN_PER_GENDER
    ) {
      const womenMedian = womenSalaries.sort((a, b) => a - b)[Math.floor(womenSalaries.length / 2)];
      const menMedian = menSalaries.sort((a, b) => a - b)[Math.floor(menSalaries.length / 2)];
      genderGapAmount = menMedian - womenMedian;
      genderGapPercent = menMedian === 0 ? null : ((menMedian - womenMedian) / menMedian) * 100;
    }

    // Save or update analysis
    const analysis = await prisma.salaryAnalysis.create({
      data: {
        userId,
        targetRole: role,
        targetLocation: location as string,
        targetCompany: company as string,
        marketMedian: median,
        genderGapAmount,
        genderGapPercent,
        sampleSize: salaryData.length,
        salaryBands: { p10, p25, p50: median, p75, p90 },
        negotiationTips: [
          { tip: 'Research comparable roles at similar companies', priority: 1 },
          { tip: 'Highlight your unique skills and accomplishments', priority: 2 },
          { tip: 'Practice your negotiation with a mentor', priority: 3 },
        ],
      },
    });

    res.json({
      data: analysis,
      // Which currency the bands are in, and why a gap may be absent from a
      // role that plainly has one: too few reports on one side to publish it
      // without identifying the people who made them.
      currency,
      genderGapWithheld:
        genderGapAmount === null &&
        (womenSalaries.length > 0 || menSalaries.length > 0)
          ? `A gender pay gap is published only once at least ${GENDER_GAP_MIN_PER_GENDER} women and ${GENDER_GAP_MIN_PER_GENDER} men have reported pay for this role.`
          : null,
    });
  } catch (error) {
    next(error);
  }
});

// Get user's salary analyses history
router.get('/salary-equity/my-analyses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analyses = await prisma.salaryAnalysis.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      take: 10,
    });

    res.json({ data: analyses });
  } catch (error) {
    next(error);
  }
});

// =============================================
// MENTOR MATCH - AI-Powered Mentor Pairing
// =============================================
// Placeholder-only: no code writes mentorMatchScore, so this list is always
// empty. The web app reads /api/algorithms/mentor-match.

// Get mentor recommendations
router.get('/mentor-match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const matches = await prisma.mentorMatchScore.findMany({
      where: {
        menteeId: userId,
        isActive: true,
      },
      orderBy: { overallScore: 'desc' },
      take: 10,
      include: {
        mentor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            headline: true,
            avatar: true,
          },
        },
      },
    });

    res.json({ data: matches });
  } catch (error) {
    next(error);
  }
});

// Get match details with a specific mentor
router.get('/mentor-match/:mentorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { mentorId } = req.params;

    const match = await prisma.mentorMatchScore.findUnique({
      where: {
        menteeId_mentorId: {
          menteeId: userId,
          mentorId,
        },
      },
      include: {
        mentor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            headline: true,
            avatar: true,
            bio: true,
          },
        },
      },
    });

    res.json({ data: match });
  } catch (error) {
    next(error);
  }
});

// =============================================
// SAFETY SCORE - Trust & Verification
// =============================================
// The row here starts at 50 with no badges and only moves on a report or a
// block. The web app reads /api/trust-score for the factor breakdown; POST
// /report below is still the report path.

// Get user's trust score
router.get('/trust-score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let trustScore = await prisma.userTrustScore.findUnique({
      where: { userId },
    });

    // Create default trust score if doesn't exist
    if (!trustScore) {
      trustScore = await prisma.userTrustScore.create({
        data: {
          userId,
          trustScore: 50,
          badges: [],
        },
      });
    }

    res.json({ data: trustScore });
  } catch (error) {
    next(error);
  }
});

// Get trust score for another user (limited info)
router.get('/trust-score/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const trustScore = await prisma.userTrustScore.findUnique({
      where: { userId },
      select: {
        trustScore: true,
        badges: true,
        identityVerified: true,
      },
    });

    res.json({ data: trustScore });
  } catch (error) {
    next(error);
  }
});

// Report content
router.post('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { contentType, contentId, reportedUserId, reason, description } = req.body;

    if (!contentType || !contentId || !reportedUserId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const report = await prisma.contentReport.create({
      data: {
        reporterId: userId,
        contentType,
        contentId,
        reportedUserId,
        reason,
        description,
      },
    });

    res.json({ data: { id: report.id }, message: 'Report submitted successfully' });
  } catch (error) {
    next(error);
  }
});

// =============================================
// INCOME STREAM - Creator Analytics
// =============================================

// Get creator analytics
//
// The row is a cache, and until now nothing filled it: this route created it at
// the column defaults and handed back zeros, which a creator reads as a
// measurement of herself rather than as the absence of one. It is now recounted
// from the follow, post and video tables on read — see refreshCreatorAnalytics
// — so what she is shown is what the platform has actually recorded.
router.get('/creator-analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analytics = await refreshCreatorAnalytics(userId);

    res.json({ data: analytics });
  } catch (error) {
    next(error);
  }
});

// What this route used to be called was "income projections", and what it did
// was this:
//
//   conservative: Math.floor(followers * 0.001 * engagement * 100)
//   realistic:    Math.floor(followers * 0.003 * engagement * 100)
//   optimistic:   Math.floor(followers * 0.008 * engagement * 100)
//
// and then three revenue streams at 30%, 50% and 20% of the middle figure,
// named Ad Revenue, Sponsorships and Digital Products. Every coefficient in
// that block was invented. ATHENA has no advertising product, no sponsorship
// marketplace and no digital storefront, so those three streams are not things
// a member here can earn from at all, and nothing anywhere establishes what a
// follower is worth per month on this platform. It was a forecast of her income
// with no basis, written to the database and presented to her as her own.
//
// There is no way to make that true, so it is gone. What remains is what can be
// stood behind: the reach the platform has actually measured, and the share of
// every gift she keeps, which is not a projection but the rate sendGift divides
// her gifts by today. Money she has actually received is on the same page,
// counted from live rows, at GET /api/algorithms/income-stream.
router.get('/creator-analytics/projections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analytics = await refreshCreatorAnalytics(userId);
    const standing = creatorTierStanding(analytics.followerCount);

    res.json({
      data: {
        followerCount: analytics.followerCount,
        avgEngagementRate: analytics.avgEngagementRate,
        creatorTier: analytics.creatorTier,
        // Null, always, and not because it has not been computed yet: this
        // platform does not forecast a creator's income. The field stays in the
        // response so that a client still reading it gets the honest answer
        // rather than a stale one.
        projectedIncome: null,
        topRevenueStreams: null,
        giftRevenueShare: standing.giftRevenueShare,
        nextTier: standing.nextTier,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// FEED PREFERENCES - OpportunityVerse Algorithm
// =============================================

// Get feed preferences
router.get('/feed-preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let prefs = await prisma.userFeedPreferences.findUnique({
      where: { userId },
    });

    // Create default preferences if doesn't exist
    if (!prefs) {
      prefs = await prisma.userFeedPreferences.create({
        data: {
          userId,
          followedCategories: [],
          followedHashtags: [],
          blockedHashtags: [],
          blockedCreators: [],
          searchHistory: [],
        },
      });
    }

    // The feed settings page shows who is muted by name, not by id.
    const blockedCreatorProfiles = prefs.blockedCreators.length
      ? (
          await prisma.user.findMany({
            where: { id: { in: prefs.blockedCreators } },
            select: { id: true, displayName: true, firstName: true, lastName: true, avatar: true, headline: true },
          })
        ).map((u) => ({
          id: u.id,
          name: u.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Member',
          avatar: u.avatar,
          headline: u.headline,
        }))
      : [];

    res.json({ data: { ...prefs, blockedCreatorProfiles } });
  } catch (error) {
    next(error);
  }
});

// Update feed preferences
router.patch('/feed-preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      followedCategories,
      followedHashtags,
      blockedHashtags,
      blockedCreators,
      inNetworkRatio,
      outNetworkRatio,
      trendingRatio,
      preferredDuration,
      autoplayEnabled,
    } = req.body;

    const prefs = await prisma.userFeedPreferences.upsert({
      where: { userId },
      update: {
        ...(followedCategories && { followedCategories }),
        ...(followedHashtags && { followedHashtags }),
        ...(blockedHashtags && { blockedHashtags }),
        ...(blockedCreators && { blockedCreators }),
        // How much of the feed comes from people you follow; the rest is discovery.
        ...(inNetworkRatio !== undefined && { inNetworkRatio: Math.min(0.9, Math.max(0.1, Number(inNetworkRatio) || 0.3)) }),
        ...(outNetworkRatio !== undefined && { outNetworkRatio }),
        ...(trendingRatio !== undefined && { trendingRatio }),
        ...(preferredDuration && { preferredDuration }),
        ...(autoplayEnabled !== undefined && { autoplayEnabled }),
      },
      create: {
        userId,
        followedCategories: followedCategories || [],
        followedHashtags: followedHashtags || [],
        blockedHashtags: blockedHashtags || [],
        blockedCreators: blockedCreators || [],
        searchHistory: [],
        inNetworkRatio: inNetworkRatio || 0.3,
        outNetworkRatio: outNetworkRatio || 0.5,
        trendingRatio: trendingRatio || 0.2,
        preferredDuration,
        autoplayEnabled: autoplayEnabled ?? true,
      },
    });

    res.json({ data: prefs });
  } catch (error) {
    next(error);
  }
});

// Add to search history
router.post('/feed-preferences/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const prefs = await prisma.userFeedPreferences.findUnique({
      where: { userId },
    });

    const currentHistory = prefs?.searchHistory || [];
    // Keep last 50 searches, remove duplicates
    const newHistory = [query, ...currentHistory.filter(q => q !== query)].slice(0, 50);

    await prisma.userFeedPreferences.upsert({
      where: { userId },
      update: { searchHistory: newHistory },
      create: {
        userId,
        followedCategories: [],
        followedHashtags: [],
        blockedHashtags: [],
        blockedCreators: [],
        searchHistory: newHistory,
      },
    });

    res.json({ message: 'Search recorded' });
  } catch (error) {
    next(error);
  }
});

export default router;
