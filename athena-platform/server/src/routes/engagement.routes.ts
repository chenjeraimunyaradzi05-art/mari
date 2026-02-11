/**
 * Engagement Routes
 * Gamification, achievements, XP, and leaderboards
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest, optionalAuth } from '../middleware/auth';
import * as engagementService from '../services/engagement.service';
import { logger } from '../utils/logger';

const router = Router();

// ==========================================
// ACHIEVEMENTS
// ==========================================

/**
 * GET /api/engagement/achievements
 * Get all achievements with user's progress
 */
router.get('/achievements', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const achievements = await engagementService.getUserAchievements((req as AuthRequest).user!.id);
    res.json(achievements);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/engagement/achievements/list
 * Get list of all available achievements
 */
router.get('/achievements/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const achievements = Object.values(engagementService.ACHIEVEMENTS);
    
    // Group by category
    const grouped = achievements.reduce((acc, ach) => {
      if (!acc[ach.category]) acc[ach.category] = [];
      acc[ach.category].push(ach);
      return acc;
    }, {} as Record<string, typeof achievements>);

    res.json({
      achievements,
      byCategory: grouped,
      total: achievements.length,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// XP AND LEVELS
// ==========================================

/**
 * GET /api/engagement/xp
 * Get current user's XP and level
 */
router.get('/xp', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const xpData = await engagementService.getUserXP((req as AuthRequest).user!.id);
    res.json(xpData);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/engagement/xp/history
 * Get XP transaction history
 */
router.get('/xp/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const history = await engagementService.getXPHistory((req as AuthRequest).user!.id, limit);
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// STREAKS
// ==========================================

/**
 * GET /api/engagement/streaks
 * Get user's current streaks
 */
router.get('/streaks', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const streaks = await engagementService.getStreaks((req as AuthRequest).user!.id);
    res.json({ streaks });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/engagement/streaks/check-in
 * Record a login check-in for streak tracking
 */
router.post('/streaks/check-in', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await engagementService.updateStreak((req as AuthRequest).user!.id, 'login');
    
    // Award XP for daily check-in (only if streak continues)
    if (result.currentStreak > 0) {
      const xpAmount = Math.min(10 + result.currentStreak * 2, 50);
      await engagementService.addXP((req as AuthRequest).user!.id, xpAmount, 'Daily check-in');
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// LEADERBOARDS
// ==========================================

/**
 * GET /api/engagement/leaderboard
 * Get leaderboard by type
 */
router.get('/leaderboard', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = (req.query.type as 'xp' | 'followers' | 'posts' | 'streak') || 'xp';
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'alltime') || 'weekly';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const leaderboard = await engagementService.getLeaderboard(type, period, limit);

    // Add user's rank if authenticated
    let userRank = null;
    if ((req as AuthRequest).user) {
      // Find user's position
      const fullLeaderboard = await engagementService.getLeaderboard(type, period, 1000);
      const userIndex = fullLeaderboard.findIndex(
        (entry: any) => entry.id === (req as AuthRequest).user!.id
      );
      if (userIndex !== -1) {
        userRank = userIndex + 1;
      }
    }

    res.json({
      leaderboard,
      type,
      period,
      userRank,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/engagement/leaderboard/xp
 * Get XP leaderboard
 */
router.get('/leaderboard/xp', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'alltime') || 'alltime';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const leaderboard = await engagementService.getLeaderboard('xp', period, limit);
    res.json({ leaderboard, type: 'xp', period });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/engagement/leaderboard/creators
 * Get top creators leaderboard
 */
router.get('/leaderboard/creators', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'alltime') || 'weekly';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const leaderboard = await engagementService.getLeaderboard('followers', period, limit);
    res.json({ leaderboard, type: 'creators', period });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// USER STATS SUMMARY
// ==========================================

/**
 * GET /api/engagement/summary
 * Get complete engagement summary for current user
 */
router.get('/summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [achievements, xp, streaks] = await Promise.all([
      engagementService.getUserAchievements((req as AuthRequest).user!.id),
      engagementService.getUserXP((req as AuthRequest).user!.id),
      engagementService.getStreaks((req as AuthRequest).user!.id),
    ]);

    res.json({
      achievements: achievements.stats,
      xp,
      streaks,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
