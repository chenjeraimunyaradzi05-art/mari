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
