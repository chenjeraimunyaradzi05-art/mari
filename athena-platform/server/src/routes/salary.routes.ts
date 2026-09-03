/**
 * Salary Equity Routes
 * Pay gap detection, salary benchmarking, negotiation coaching
 *
 * Matches the existing salary-equity.service.ts function signatures
 *
 * ## These routes serve SIMULATED data and are blocked outside development
 *
 * `salary-equity.service.ts` is backed by a hardcoded array its own comment
 * labels "Simulated salary database (would be real data in production)" — 15
 * invented rows carrying invented salaries and invented genders, every one
 * flagged `isVerified: true`. `getCompanyTransparencyScore` likewise returns
 * hardcoded "Simulated scoring".
 *
 * Serving that to a member would publish an invented gender pay gap on the one
 * subject where being wrong does real damage: someone could walk into a pay
 * negotiation quoting a number nobody ever earned. The routes stay mounted so
 * the work is not lost and the shapes stay addressable, but they refuse to
 * answer unless SALARY_SIMULATED_API=true is set, which no deployment sets.
 *
 * The real, database-backed pay endpoints live at
 * `/api/ai-algorithms/salary-equity/*`, which read the `SalaryDataPoint` table
 * and enforce a minimum-contributors threshold before reporting anything.
 * `/salary-insights` uses those. Point new work there, not here.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import salaryEquityService from '../services/salary-equity.service';
import { logger } from '../utils/logger';

const router = Router();

const SIMULATED_API_ENABLED = process.env.SALARY_SIMULATED_API === 'true';

// Applied to every route below, so a new handler added later cannot leak the
// simulated dataset by forgetting the guard.
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (SIMULATED_API_ENABLED) return next();

  logger.warn('Blocked a request to the simulated salary API', {
    hint: 'Use /api/ai-algorithms/salary-equity/* for real, database-backed pay data',
  });

  return res.status(501).json({
    success: false,
    message:
      'This endpoint is backed by a simulated dataset and is disabled. Use /api/ai-algorithms/salary-equity/* for real pay data.',
  });
});

/**
 * @route GET /api/salary/benchmark
 * @desc Get salary benchmark for a role
 * @access Private
 */
router.get('/benchmark', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, location, experience, industry } = req.query;

    if (!role || !location) {
      return res.status(400).json({ error: 'Role and location are required' });
    }

    // Call with correct signature: getSalaryBenchmark(role, location, filters?)
    const filters = {
      yearsExperience: experience ? parseInt(experience as string) : undefined,
      industry: industry as string | undefined,
    };

    const benchmark = await salaryEquityService.getSalaryBenchmark(
      role as string,
      location as string,
      filters
    );

    res.json(benchmark);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/salary/range
 * @desc Get salary range for a role (requires level)
 * @access Private
 */
router.get('/range', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, location, level } = req.query;

    if (!role || !location || !level) {
      return res.status(400).json({ error: 'Role, location, and level are required' });
    }

    // Call with correct signature: getSalaryRange(role, location, level)
    const range = salaryEquityService.getSalaryRange(
      role as string,
      location as string,
      level as string
    );

    if (!range) {
      return res.status(404).json({ error: 'No salary data found for criteria' });
    }

    res.json(range);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/salary/analyze-gap
 * @desc Analyze pay gap for current salary
 * @access Private
 */
router.post('/analyze-gap', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentSalary, role, location } = req.body;

    if (!role || !location) {
      return res.status(400).json({ 
        error: 'Role and location are required' 
      });
    }

    // Call with correct signature: analyzePayGap(role, location, currentSalary?)
    const analysis = await salaryEquityService.analyzePayGap(
      role,
      location,
      currentSalary
    );

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/salary/negotiation-script
 * @desc Generate personalized negotiation script
 * @access Private
 * 
 * Scenario must be one of: 'new_job', 'raise', 'promotion', 'counter_offer'
 */
router.post('/negotiation-script', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      currentSalary, 
      targetSalary, 
      role, 
      scenario, 
      achievements,
      yearsAtCompany
    } = req.body;

    if (!targetSalary || !role || !scenario) {
      return res.status(400).json({ 
        error: 'Target salary, role, and scenario are required' 
      });
    }

    // Validate scenario
    const validScenarios = ['new_job', 'raise', 'promotion', 'counter_offer'] as const;
    if (!validScenarios.includes(scenario)) {
      return res.status(400).json({
        error: `Scenario must be one of: ${validScenarios.join(', ')}`
      });
    }

    // Call with correct signature: generateNegotiationScript(situation, context)
    const context = {
      currentSalary,
      targetSalary,
      role,
      achievements,
      yearsAtCompany,
    };

    const script = salaryEquityService.generateNegotiationScript(
      scenario as 'new_job' | 'raise' | 'promotion' | 'counter_offer',
      context
    );

    res.json(script);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/salary/submit
 * @desc Submit anonymous salary data
 * @access Private
 */
router.post('/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { 
      role, 
      level,
      industry,
      location, 
      yearsExperience, 
      education,
      baseSalary,
      totalCompensation,
      gender,
    } = req.body;

    // Validate required fields per SalaryData interface
    if (!role || !level || !industry || !location || !baseSalary || !totalCompensation) {
      return res.status(400).json({ 
        error: 'Required: role, level, industry, location, baseSalary, totalCompensation' 
      });
    }

    // Call with correct signature: submitSalaryData(userId, data: Omit<SalaryData, 'isVerified'>)
    const data = {
      role,
      level,
      industry,
      location,
      yearsExperience: yearsExperience || 0,
      education: education || 'Not specified',
      baseSalary,
      totalCompensation,
      gender: gender as 'female' | 'male' | 'other' | undefined,
    };

    const success = await salaryEquityService.submitSalaryData(userId, data);

    if (success) {
      res.status(201).json({
        message: 'Salary data submitted successfully',
        submitted: true,
      });
    } else {
      res.status(500).json({ error: 'Failed to submit data' });
    }
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

    // Call with correct signature: getCompanyTransparencyScore(companyName)
    const score = salaryEquityService.getCompanyTransparencyScore(decodeURIComponent(companyName));

    res.json(score);
  } catch (error) {
    next(error);
  }
});

export default router;
