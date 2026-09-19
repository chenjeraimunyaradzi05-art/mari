/**
 * Algorithm routes (/api/algorithms/*)
 *
 * This file is two different things, and the next person needs to know which
 * half they are reading before wiring anything to it.
 *
 * ## Real queries, used by the web app
 *
 *   GET /career-compass    The skills that active roles carrying her title ask
 *                          for and she has not listed, the courses on ATHENA
 *                          that teach them, and those roles
 *                          (algorithm.service getCareerCompass: Job, JobSkill,
 *                          Course, UserSkill). /dashboard/ai/career-compass
 *                          reads it. It is a comparison against listings, not
 *                          a forecast; it has no probability, salary or risk.
 *   GET /mentor-match      Available mentors ranked by shared skills, rating
 *                          and years of experience, with the reasons spelled
 *                          out. /dashboard/ai/mentors reads it. `matchScore`
 *                          is an unbounded heuristic (overlap*3 + rating +
 *                          experience), not a percentage; the client shows the
 *                          reasons and never the number.
 *   GET /opportunity-scan  The newest active jobs and courses and the next
 *                          events. Not personalised, and
 *                          /dashboard/ai/opportunities says so.
 *   GET /salary-equity     The median of the ranges employers advertise on
 *                          active listings carrying her title, reported only
 *                          from three listings up (getSalaryEquity).
 *                          /salary-insights quotes it beside member-reported
 *                          pay as the employer's own figure. Its `tips` are
 *                          canned coaching lines, not data; the client does
 *                          not render them.
 *
 * ## Numbers nothing computed; do not build a screen against these
 *
 *   GET /income-stream            The revenue `channels` are fixed shares
 *                                 (55/20/15/10) and the `actionPlan` is the
 *                                 same four sentences for everyone. Only the
 *                                 gift earnings, follower count and post count
 *                                 come from the database.
 *   GET /recommendation-engine-2  Every `score` is 90 (or 85, 80, 75) minus
 *                                 the row's position in a newest-first list,
 *                                 and every `reason` is a canned sentence. It
 *                                 ranks nothing.
 *
 * Both stay mounted so nothing breaks, with no client helper. The mirrored
 * tables under /api/ai-algorithms/* (careerPrediction, mentorMatchScore,
 * opportunityMatch) have no writer; see that file's header.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import {
  getCareerCompass,
  getOpportunityScan,
  getSalaryEquity,
  getMentorMatch,
  getIncomeStream,
  getRecommendationEngineV2,
} from '../services/algorithm.service';

const router = Router();

// ===========================================
// CAREER COMPASS
// ===========================================
router.get('/career-compass', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const targetRole = typeof req.query.targetRole === 'string' ? req.query.targetRole : undefined;
    const data = await getCareerCompass(req.user!.id, targetRole);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// OPPORTUNITY SCAN
// ===========================================
router.get('/opportunity-scan', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getOpportunityScan(req.user?.id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SALARY EQUITY
// ===========================================
router.get('/salary-equity', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const targetRole = typeof req.query.targetRole === 'string' ? req.query.targetRole : undefined;
    const data = await getSalaryEquity(req.user!.id, targetRole);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// MENTOR MATCH
// ===========================================
router.get('/mentor-match', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getMentorMatch(req.user!.id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// INCOME STREAM (Creator Revenue Optimization)
// ===========================================
router.get('/income-stream', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getIncomeStream(req.user!.id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RECOMMENDATION ENGINE 2.0
// ===========================================
router.get('/recommendation-engine-2', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getRecommendationEngineV2(req.user?.id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
