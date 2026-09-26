/**
 * Algorithm routes (/api/algorithms/*)
 *
 * Everything still served here is a real query. One route that was not is
 * withdrawn, and is listed at the end so nobody rebuilds it.
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
 *   GET /income-stream     Gifts she has actually received in the last thirty
 *                          days, her follower count and whether monetisation
 *                          is on, read by /dashboard/ai/creator. It used to
 *                          carry a fixed 55/20/15/10 revenue mix and two
 *                          scores with hand-picked weights; those are no
 *                          longer sent (see IncomeStreamResult). `actionPlan`
 *                          is general advice, the same for everyone, and the
 *                          page heads it as that.
 *
 * ## Withdrawn
 *
 *   GET /recommendation-engine-2  Every `score` was 90 (or 85, 80, 75) minus
 *                                 the row's position in a newest-first list,
 *                                 every `reason` a canned sentence, and it was
 *                                 open to signed-out callers — who were handed
 *                                 the first forty characters of the five
 *                                 most-viewed posts whether or not their
 *                                 authors had made them public. Nothing called
 *                                 it. It answers 410.
 *
 * The mirrored tables under /api/ai-algorithms/* (careerPrediction,
 * mentorMatchScore, opportunityMatch) have no writer; see that file's header.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import {
  getCareerCompass,
  getOpportunityScan,
  getSalaryEquity,
  getMentorMatch,
  getIncomeStream,
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
// Withdrawn; see the header. 410 rather than 404 so a stale caller is told
// the difference between "gone on purpose" and "the deploy is broken".
router.get('/recommendation-engine-2', (_req: AuthRequest, _res: Response, next: NextFunction) => {
  next(
    new ApiError(
      410,
      'This recommendation list has been withdrawn: its scores and reasons were not computed from anything.'
    )
  );
});

export default router;
