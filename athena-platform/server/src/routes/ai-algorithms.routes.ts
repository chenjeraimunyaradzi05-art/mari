/**
 * AI algorithm routes (/api/ai-algorithms/*)
 *
 * ## Four tables here were placeholder-only, and their routes are withdrawn
 *
 * `careerPrediction`, `mentorMatchScore` and `opportunityMatch` were built for
 * an ML service that was never connected, and nothing on the server writes
 * mentorMatchScore or opportunityMatch, so the routes that read them could
 * only ever answer with an empty list. careerPrediction had one writer — POST
 * /career-compass/generate — and it invented every figure it stored; it is
 * gone, that route answers 501, and GET /career-compass refuses to serve the
 * rows it left behind. The userTrustScore row behind GET /trust-score started
 * at 50 and moved only on a report or a block. The opportunity-scan, mentor-
 * match and trust-score routes now answer 410 with the address of the real
 * feature, rather than an empty answer a member reads as a verdict on her.
 *
 * /dashboard/ai/career-compass, /dashboard/ai/mentors and
 * /dashboard/ai/opportunities read /api/algorithms/career-compass,
 * /mentor-match and /opportunity-scan, which are real queries (see
 * algorithm.routes.ts). /dashboard/ai/trust reads /api/trust-score.
 *
 * What stays in use: the salary routes (/salary-equity/*), POST /report,
 * creator analytics and feed preferences below, which read and write real rows.
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
//
// The list read opportunityMatch, which nothing on the server writes, so it
// was always empty, and the two PATCH routes could never find a row to update.
// /dashboard/ai/opportunities reads /api/algorithms/opportunity-scan — the
// newest roles, courses and events, and it says it is not personalised. All
// three answer 410 rather than an empty list that reads as "nothing for you".
router.all(
  ['/opportunity-scan', '/opportunity-scan/:id/view', '/opportunity-scan/:id/feedback'],
  (_req: Request, _res: Response, next: NextFunction) => {
    next(
      new ApiError(
        410,
        'Opportunity scanning is at /api/algorithms/opportunity-scan. The matches this route read were never computed.'
      )
    );
  }
);

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

/**
 * How many roles one member may add pay for in a rolling year.
 *
 * Validation stopped a single absurd figure, and aiLimiter stopped a burst, but
 * neither stopped a patient account: ten a minute is about six hundred points
 * an hour, each one a plausible salary, every one of them moving the median a
 * woman takes into her next negotiation. A member reports her own pay, for the
 * role she holds and perhaps the one before it; five roles a year is more than
 * that and far less than a campaign.
 */
const SALARY_ROLES_PER_MEMBER_PER_YEAR = 5;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Submit salary data. It is saved against her account (see the salary page's
// own wording); what is anonymous is what other members are shown.
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

    // Every route here sits behind authenticate, and the per-member rules
    // below are keyed on this id: without one, "her earlier figure for this
    // role" would be a query for everybody's.
    const userId: string | undefined = (req as AuthRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    const normalizedTitle = String(jobTitle).toLowerCase().trim();
    const pointCurrency = currency || 'AUD';

    const fields = {
      jobTitle: String(jobTitle).trim(),
      normalizedTitle,
      company,
      companySize,
      industry,
      city,
      state,
      country: country || 'Australia',
      isRemote: isRemote || false,
      baseSalary,
      currency: pointCurrency,
      bonus,
      equity,
      totalComp: baseSalary + (bonus || 0) + (equity || 0),
      yearsExperience,
      yearsInRole,
      educationLevel,
      gender,
      ageRange,
    };

    // One figure per member per role. A second submission for the same role
    // is her correcting herself, not a second person earning that salary, so
    // it replaces the first rather than joining it — which is also what stops
    // one account from filling a role's pool with copies of the same number.
    const existing = await prisma.salaryDataPoint.findFirst({
      where: { userId, normalizedTitle, currency: pointCurrency },
      orderBy: { submittedAt: 'desc' },
      select: { id: true },
    });

    if (existing) {
      await prisma.salaryDataPoint.update({
        where: { id: existing.id },
        data: { ...fields, submittedAt: new Date() },
      });
      return res.json({
        data: { id: existing.id, replaced: true },
        message: 'Your figure for this role has replaced the one you gave before.',
      });
    }

    const rolesThisYear = await prisma.salaryDataPoint.count({
      where: { userId, submittedAt: { gte: new Date(Date.now() - YEAR_MS) } },
    });
    if (rolesThisYear >= SALARY_ROLES_PER_MEMBER_PER_YEAR) {
      throw new ApiError(
        429,
        `You have added pay for ${SALARY_ROLES_PER_MEMBER_PER_YEAR} roles in the last year, which is the most one member can. You can still correct the figure for a role you have already reported.`
      );
    }

    const dataPoint = await prisma.salaryDataPoint.create({
      data: { userId, ...fields },
    });

    res.json({ data: { id: dataPoint.id, replaced: false }, message: 'Salary data submitted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * How many contributors must sit below a published cut point, and how many
 * above it, before it is published.
 *
 * The floor used to be five points for the whole analysis, and with five points
 * p10, p25, p50, p75 and p90 are salaries[0] to salaries[4]: the "band" was
 * every contributor's exact pay, in order, published to anyone who typed the
 * title — on a page that told her "other members never see your row". Up to
 * about nine points each percentile was still one real person's figure. A cut
 * point with at least five people on either side of it is a position in a
 * crowd rather than the edge of one, so:
 *
 *   median     needs 10 contributors
 *   p25, p75   need 20
 *   p10, p90   need 50
 *
 * and a percentile below its floor is withheld (null) rather than shown thin.
 */
const CONTRIBUTORS_EACH_SIDE = 5;
const ANALYSIS_MIN_POINTS = CONTRIBUTORS_EACH_SIDE * 2;

/**
 * Every published figure is rounded to this, so that even a cut point that
 * happens to fall exactly on somebody's salary is not that salary to the
 * dollar. A thousand is well inside what anyone negotiates over.
 */
const PUBLISHED_ROUNDING = 1_000;

const roundForPublication = (value: number) => Math.round(value / PUBLISHED_ROUNDING) * PUBLISHED_ROUNDING;

/**
 * The p-th percentile of sorted values by linear interpolation, or null when
 * fewer than CONTRIBUTORS_EACH_SIDE values sit on either side of it.
 */
export function publishablePercentile(sorted: number[], p: number): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  const below = Math.floor(n * p);
  const above = n - Math.ceil(n * p);
  if (below < CONTRIBUTORS_EACH_SIDE || above < CONTRIBUTORS_EACH_SIDE) return null;

  const index = p * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const value = sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  return roundForPublication(value);
}

/**
 * One figure per contributor. The submit route now replaces a member's earlier
 * figure for a role, but rows written before it did are still in the table,
 * and one account's twenty copies of a number are one person, not twenty. Rows
 * with no member on them predate accounts being required and are kept as they
 * are, because there is nothing to tell them apart by.
 */
export function onePerContributor<T extends { userId: string | null; submittedAt: Date }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  const anonymous: T[] = [];
  for (const row of rows) {
    if (!row.userId) {
      anonymous.push(row);
      continue;
    }
    const seen = latest.get(row.userId);
    if (!seen || row.submittedAt > seen.submittedAt) latest.set(row.userId, row);
  }
  return [...latest.values(), ...anonymous];
}
/**
 * Per gender, before a gender gap is published for a role.
 *
 * It was three. A Queensland job title with three women who have reported their
 * pay is a room in which each of them can work out what the others earn — the
 * gap is a difference of two medians over a sample small enough to name, and
 * publishing it to anyone who types the title is a disclosure the three of them
 * never agreed to. It then became eight, which was still one short of what
 * the rule for any published median needs (five contributors either side of
 * it, below), so each gender's median is now held to exactly that rule.
 */
const GENDER_GAP_MIN_PER_GENDER = ANALYSIS_MIN_POINTS;

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
    const rows = await prisma.salaryDataPoint.findMany({
      where: {
        normalizedTitle: { contains: role.toLowerCase() },
        currency,
        ...(typeof location === 'string' && location.trim() && { city: { contains: location } }),
      },
      select: {
        userId: true,
        submittedAt: true,
        baseSalary: true,
        gender: true,
      },
    });
    const salaryData = onePerContributor(rows);

    // Calculate statistics
    const salaries = salaryData.map(d => Number(d.baseSalary)).sort((a, b) => a - b);
    const median = publishablePercentile(salaries, 0.5);

    if (median === null) {
      return res.json({
        data: null,
        currency,
        sampleSize: salaryData.length,
        message: `Not enough members have reported pay for this role yet. A median is published once ${ANALYSIS_MIN_POINTS} people have reported in ${currency}, so that no one person's salary can be read off it.`,
      });
    }

    const p10 = publishablePercentile(salaries, 0.1);
    const p25 = publishablePercentile(salaries, 0.25);
    const p75 = publishablePercentile(salaries, 0.75);
    const p90 = publishablePercentile(salaries, 0.9);

    // Gender gap analysis
    const womenSalaries = salaryData.filter(d => d.gender === 'WOMAN').map(d => Number(d.baseSalary)).sort((a, b) => a - b);
    const menSalaries = salaryData.filter(d => d.gender === 'MAN').map(d => Number(d.baseSalary)).sort((a, b) => a - b);

    let genderGapAmount: number | null = null;
    let genderGapPercent: number | null = null;
    if (
      womenSalaries.length >= GENDER_GAP_MIN_PER_GENDER &&
      menSalaries.length >= GENDER_GAP_MIN_PER_GENDER
    ) {
      // Ten a side is exactly what the five-each-side rule needs for a median,
      // so both of these are publishable figures and neither is one person's
      // pay. The null checks are the rule speaking, not a formality: if the
      // floor above is ever lowered, the gap is withheld rather than computed
      // from a median that could not be published on its own.
      const womenMedian = publishablePercentile(womenSalaries, 0.5);
      const menMedian = publishablePercentile(menSalaries, 0.5);
      if (womenMedian !== null && menMedian !== null) {
        genderGapAmount = menMedian - womenMedian;
        genderGapPercent = menMedian === 0 ? null : ((menMedian - womenMedian) / menMedian) * 100;
      }
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
      bandWithheld:
        p25 === null
          ? `A salary range is published once ${CONTRIBUTORS_EACH_SIDE * 4} members have reported pay for this role; until then only the median is shown.`
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
//
// These read mentorMatchScore, which nothing on the server has ever written, so
// they could only ever answer with nothing — an empty list a member reads as
// "no mentor suits you". /dashboard/ai/mentors reads /api/algorithms/mentor-
// match, which ranks the mentors who are actually available by shared skills,
// rating and years mentoring, with the reasons shown. These answer 410 and say
// so, rather than an empty list or a 404 that reads as a broken deploy.
router.get(['/mentor-match', '/mentor-match/:mentorId'], (_req: Request, _res: Response, next: NextFunction) => {
  next(
    new ApiError(
      410,
      'Mentor matching is at /api/algorithms/mentor-match. The scores this route read were never computed.'
    )
  );
});

// =============================================
// SAFETY SCORE - Trust & Verification
// =============================================
//
// GET /trust-score and GET /trust-score/:userId read the userTrustScore row,
// which started at 50 with no badges the first time anyone asked and moved
// only on a report or a block — and the second of them handed any signed-in
// member another member's score, badges and identity-verification flag by id.
// Nothing in the web or mobile app called either. /dashboard/ai/trust reads
// /api/trust-score, which returns the factors behind the score and only ever
// her own. Both answer 410 so a stale caller is told where the real one is;
// POST /report below is still the report path.
router.get(['/trust-score', '/trust-score/:userId'], (_req: Request, _res: Response, next: NextFunction) => {
  next(
    new ApiError(
      410,
      'This trust score has been withdrawn. Your own trust score, and what it is made of, is at /api/trust-score.'
    )
  );
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
//
// Two things on this table were stored and never read, and the rule for a
// store with no reader on a platform like this one is that it stops storing.
//
// outNetworkRatio and trendingRatio were written straight from the request
// body — any number, any type — and nothing on the server has ever read
// either; only inNetworkRatio drives the feed (feed.service). They are no
// longer accepted, so the settings a member can change are the settings that
// do something.
//
// searchHistory kept the raw text of her last fifty searches, with no length
// or type check, no reader anywhere on the server and no way to clear it: a
// behavioural log with no product purpose, on a platform whose members include
// women whose searches are exactly what someone else wants to see. Nothing in
// the web or mobile app ever called the route that wrote it. It is no longer
// written, no longer returned, and DELETE /feed-preferences/search empties
// what was already kept.

/** How much of the feed comes from people she follows; the rest is discovery. */
const clampInNetworkRatio = (value: unknown): number =>
  Math.min(0.9, Math.max(0.1, Number(value) || 0.3));

/** The list fields are ids and tags; anything else in them is refused, not stored. */
const MAX_PREFERENCE_LIST = 500;
const stringListOrUndefined = (value: unknown, field: string): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_PREFERENCE_LIST || value.some((v) => typeof v !== 'string' || v.length > 200)) {
    throw new ApiError(400, `${field} must be a list of at most ${MAX_PREFERENCE_LIST} short strings`);
  }
  return value;
};

/** What the settings page is shown: everything except the fields described above. */
function publicPreferences<T extends { searchHistory: string[]; outNetworkRatio: number; trendingRatio: number }>(
  prefs: T
): Omit<T, 'searchHistory' | 'outNetworkRatio' | 'trendingRatio'> {
  const { searchHistory: _history, outNetworkRatio: _out, trendingRatio: _trending, ...rest } = prefs;
  return rest;
}

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

    res.json({ data: { ...publicPreferences(prefs), blockedCreatorProfiles } });
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

    const { followedCategories, inNetworkRatio, preferredDuration, autoplayEnabled } = req.body;
    const followedHashtags = stringListOrUndefined(req.body.followedHashtags, 'followedHashtags');
    const blockedHashtags = stringListOrUndefined(req.body.blockedHashtags, 'blockedHashtags');
    const blockedCreators = stringListOrUndefined(req.body.blockedCreators, 'blockedCreators');

    const prefs = await prisma.userFeedPreferences.upsert({
      where: { userId },
      update: {
        ...(followedCategories && { followedCategories }),
        ...(followedHashtags && { followedHashtags }),
        ...(blockedHashtags && { blockedHashtags }),
        ...(blockedCreators && { blockedCreators }),
        ...(inNetworkRatio !== undefined && { inNetworkRatio: clampInNetworkRatio(inNetworkRatio) }),
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
        inNetworkRatio: inNetworkRatio !== undefined ? clampInNetworkRatio(inNetworkRatio) : 0.3,
        preferredDuration,
        autoplayEnabled: autoplayEnabled ?? true,
      },
    });

    res.json({ data: publicPreferences(prefs) });
  } catch (error) {
    next(error);
  }
});

// Search history is no longer kept. See the comment at the top of this section.
router.post('/feed-preferences/search', (_req: Request, _res: Response, next: NextFunction) => {
  next(
    new ApiError(
      410,
      'ATHENA no longer keeps a history of your searches. Nothing was recorded.'
    )
  );
});

// Empty whatever search history was kept before it stopped being kept.
router.delete('/feed-preferences/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await prisma.userFeedPreferences.updateMany({
      where: { userId },
      data: { searchHistory: [] },
    });

    res.json({ message: 'Your search history has been cleared.' });
  } catch (error) {
    next(error);
  }
});

export default router;
