/**
 * Feed Routes (OpportunityVerse)
 * API endpoints for personalized feed mixing
 * Phase 2: Backend Logic & Integrations
 */

import { Router, Response, NextFunction } from 'express';
import { opportunityVerseMixer, getMixedFeed } from '../services/opportunity-verse.service';
import { coldStartAlgorithm } from '../services/cold-start.service';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/feed
 * @desc Get personalized mixed feed
 * @access Private
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
    } = req.query;
    
    const feed = await getMixedFeed(
      req.user!.id,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );
    
    res.json({
      success: true,
      data: feed,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/feed/cold-start
 * @desc Get cold start recommendations for new users
 * @access Private
 */
router.get('/cold-start', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = '20' } = req.query;
    
    const recommendations = await coldStartAlgorithm.getColdStartRecommendations(
      req.user!.id,
      parseInt(limit as string, 10)
    );
    
    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/feed/cold-start/score
 * @desc Get cold start score for user
 * @access Private
 */
router.get('/cold-start/score', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [score, isColdStart] = await Promise.all([
      coldStartAlgorithm.getColdStartScore(req.user!.id),
      coldStartAlgorithm.isUserColdStart(req.user!.id),
    ]);
    
    res.json({
      success: true,
      data: {
        score,
        isColdStart,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/feed/onboarding
 * @desc Get onboarding suggestions
 * @access Private
 */
router.get('/onboarding', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const suggestions = await coldStartAlgorithm.getOnboardingSuggestions(req.user!.id);
    
    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/feed/opportunities
 * @desc Get job/gig opportunities feed
 * @access Private
 */
router.get('/opportunities', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    
    // Get opportunities-focused feed
    const feed = await getMixedFeed(
      req.user!.id,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );
    
    res.json({
      success: true,
      data: feed,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
