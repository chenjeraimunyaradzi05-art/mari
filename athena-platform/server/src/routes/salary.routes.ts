/**
 * Salary Equity Routes
 * Negotiation coaching and employer pay transparency
 *
 * ## The simulated dataset behind these routes is gone
 *
 * This module used to be backed by fifteen invented rows carrying invented
 * salaries and invented genders, all flagged verified, and a company
 * transparency score that returned the same four numbers for every employer.
 * It was blocked behind SALARY_SIMULATED_API for that reason.
 *
 * `getCompanyTransparencyScore` measures only what ATHENA can observe, which is
 * the share of that employer's roles here that publish a range, and returns
 * null where there is nothing to measure. The invented rows were deleted rather
 * than kept behind the flag, so there is no dataset left to leak.
 *
 * ## The benchmark, range, pay-gap and submit routes are gone too
 *
 * GET /benchmark, GET /range, POST /analyze-gap and POST /submit were twins of
 * `/api/ai-algorithms/salary-equity/*`, which is what `/salary-insights`
 * calls. Nothing called these four, and they had fallen behind the privacy
 * floors the live routes enforce. The live routes need ten women and ten
 * men before they state a gap, because below that one woman's figure can be
 * worked out from what is published; these needed three. Worse, the pay-gap
 * route took the median of women's reported pay from however many reports
 * there were — one included — before any floor applied, and returned
 * `potentialIncrease = womenMedian - currentSalary` beside `womenReporting`.
 * Asking about a narrow role and city with `currentSalary: 1` handed back one
 * woman's exact reported pay, minus a dollar, to any signed-in account. The
 * range route returned the lowest and highest salary in its sample, which are
 * two people's exact figures. A copy of a privacy rule that nobody uses is the
 * copy that ends up wrong, so they were removed rather than patched.
 *
 * What remains is the negotiation template and the transparency measure, both
 * of which the salary page calls.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { zodBody } from '../middleware/validate';
import { audMoney, audMoneyOrZero, numeric, text } from '../utils/schemas';
import salaryEquityService from '../services/salary-equity.service';

const router = Router();


/**
 * @route POST /api/salary/negotiation-script
 * @desc Generate personalized negotiation script
 * @access Private
 * 
 * Scenario must be one of: 'new_job', 'raise', 'promotion', 'counter_offer'
 */
// The role and the achievements are written into the script's sentences, and the
// salaries are formatted into them with toLocaleString(), so each is the kind of
// value that belongs there: "$abc" as a salary used to make the script say so.
const negotiationBody = z.object({
  currentSalary: audMoneyOrZero(10_000_000).optional(),
  targetSalary: audMoney(10_000_000),
  role: text(120),
  scenario: z.enum(['new_job', 'raise', 'promotion', 'counter_offer'], {
    errorMap: () => ({ message: 'Scenario must be one of: new_job, raise, promotion, counter_offer' }),
  }),
  achievements: z.array(text(300)).max(20).optional(),
  yearsAtCompany: numeric.pipe(z.number().min(0).max(80)).optional(),
});

router.post('/negotiation-script', authenticate, zodBody(negotiationBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentSalary, targetSalary, role, scenario, achievements, yearsAtCompany } = req.body as z.output<
      typeof negotiationBody
    >;

    // Call with correct signature: generateNegotiationScript(situation, context)
    const context = {
      currentSalary,
      targetSalary,
      role,
      achievements,
      yearsAtCompany,
    };

    const script = salaryEquityService.generateNegotiationScript(scenario, context);

    res.json(script);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/salary/company/:companyName/transparency
 * @desc Get company transparency score
 * @access Private
 */
router.get('/company/:companyName/transparency', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyName } = req.params;

    const score = await salaryEquityService.getCompanyTransparencyScore(
      decodeURIComponent(companyName)
    );

    if (!score) {
      return res.status(404).json({
        error: 'This employer has no roles on ATHENA yet, so there is nothing to measure.',
      });
    }

    res.json(score);
  } catch (error) {
    next(error);
  }
});

export default router;
