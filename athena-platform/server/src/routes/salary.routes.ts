/**
 * Salary Equity Routes
 * Pay gap detection, salary benchmarking, negotiation coaching
 *
 * ## The simulated dataset behind these routes is gone
 *
 * This module used to be backed by fifteen invented rows carrying invented
 * salaries and invented genders, all flagged verified, and a company
 * transparency score that returned the same four numbers for every employer.
 * It was blocked behind SALARY_SIMULATED_API for that reason.
 *
 * `salary-equity.service.ts` now reads the `SalaryDataPoint` table members
 * contribute to, reports nothing below five contributors, and refuses to state
 * a gender gap without at least three reports from each of women and men.
 * `getCompanyTransparencyScore` measures only what ATHENA can observe, which is
 * the share of that employer's roles here that publish a range, and returns
 * null where there is nothing to measure. The invented rows were deleted rather
 * than kept behind the flag, so there is no dataset left to leak.
 *
 * Being wrong here does real damage: a member can walk into a pay negotiation
 * quoting whatever this returns. Every number it serves must come from the
 * table, and an empty answer is always better than a confident invented one.
 *
 * `/api/ai-algorithms/salary-equity/*` reads the same table and is what
 * `/salary-insights` currently calls. The two overlap and should be merged.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import salaryEquityService from '../services/salary-equity.service';

const router = Router();


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

    const range = await salaryEquityService.getSalaryRange(
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
