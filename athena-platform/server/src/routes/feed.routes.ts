/**
 * Feed Routes (OpportunityVerse)
 *
 * The cold-start endpoints, and the two retired mixed-feed routes that now
 * answer 410 (see retiredMixedFeed). The member feed itself is served by
 * post.routes at GET /api/posts/feed.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { coldStartAlgorithm } from '../services/cold-start.service';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/feed
 * @route GET /api/feed/opportunities
 * @access none — both answer 410 Gone
 *
 * ## Retired: the mixed feed served numbers nobody had worked out
 *
 * Both routes served `getMixedFeed` from opportunity-verse.service.ts, and
 * what that mixes in as "opportunities" is not matched to anyone:
 * `getRelevantOpportunities` takes the most recently created active jobs and
 * courses and stamps every job `matchScore: 70` ("Would be calculated by
 * CareerCompass") and every course 60, and the mixer then presents them with
 * reasons like "Job opportunity". A member reading that would be told a job
 * was a 70% fit for her when nothing had looked at her at all. The warning
 * that used to sit on /opportunities said not to build a screen on it, but
 * the bare /api/feed served the same mix with no warning on it.
 *
 * It also ignored blocks. The mixer calls generateFeed and getTrendingPosts
 * without the viewer's block list, so a woman who had blocked someone could
 * be served his posts here, where every feed the clients actually read
 * leaves them out.
 *
 * Neither client ever called either route. The feed the web and the app
 * read is GET /api/posts/feed; opportunities that are actually scored against
 * a member live at /api/ai-algorithms/*. Answering 410 with those pointers,
 * rather than serving the mix, is what stops a new screen being built on it.
 */
function retiredMixedFeed(_req: Request, res: Response) {
  res.status(410).json({
    success: false,
    deprecated: true,
    message:
      'This mixed feed has been retired. Read the feed at GET /api/posts/feed; opportunities scored against a member are at /api/ai-algorithms.',
  });
}

router.get('/', retiredMixedFeed);

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
 *
 * ## Superseded by GET /api/concierge/onboarding
 *
 * Same idea, older shape. `getOnboardingSuggestions` in cold-start.service.ts
 * returns steps with no `completed` flag, so a screen built on it could never
 * tick anything off, and its action paths (/onboarding/persona,
 * /settings/profile, /settings/skills, /discover/people, /compose) are not
 * pages in the web client. The concierge route (concierge.service.ts
 * getOnboardingSteps) checks the same profile fields, reports completion and
 * points at /dashboard/settings/profile; the dashboard home reads it through
 * conciergeApi.onboarding().
 *
 * Do not build a screen against this route. It stays mounted rather than
 * deleted, as the repo does with superseded routes (see salary.routes.ts).
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
 * Retired with GET /api/feed; see retiredMixedFeed at the top of this file.
 * Opportunities that are actually scored against a member live at
 * `/api/ai-algorithms/*`, behind /dashboard/ai/opportunity-radar and
 * /dashboard/ai/opportunity-scan.
 */
router.get('/opportunities', retiredMixedFeed);

export default router;
