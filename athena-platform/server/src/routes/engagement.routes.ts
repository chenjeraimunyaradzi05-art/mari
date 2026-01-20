/**
 * Engagement Routes
 * Gamification, achievements, XP, and leaderboards
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest, optionalAuth } from '../middleware/auth';
import * as engagementService from '../services/engagement.service';

const router = Router();

// ==========================================
// ACHIEVEMENTS
// ==========================================

/**
 * GET /api/engagement/achievements
 * Get all achievements with user's progress
 */
router.get('/achievements', authenticate, async (req: Request, res: Response) => {
  try {
    const achievements = await engagementService.getUserAchievements((req as AuthRequest).user!.id);
    res.json(achievements);
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ message: 'Failed to get achievements' });
  }
});

/**
 * GET /api/engagement/achievements/list
 * Get list of all available achievements
 */
router.get('/achievements/list', async (req: Request, res: Response) => {
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
    console.error('Get achievements list error:', error);
    res.status(500).json({ message: 'Failed to get achievements list' });
  }
});

// ==========================================
// XP AND LEVELS
// ==========================================

/**
 * GET /api/engagement/xp
 * Get current user's XP and level
 */
router.get('/xp', authenticate, async (req: Request, res: Response) => {
  try {
    const xpData = await engagementService.getUserXP((req as AuthRequest).user!.id);
    res.json(xpData);
  } catch (error) {
    console.error('Get XP error:', error);
    res.status(500).json({ message: 'Failed to get XP' });
  }
});

/**
 * GET /api/engagement/xp/history
 * Get XP transaction history
 */
router.get('/xp/history', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const history = await engagementService.getXPHistory((req as AuthRequest).user!.id, limit);
    res.json({ history });
  } catch (error) {
    console.error('Get XP history error:', error);
    res.status(500).json({ message: 'Failed to get XP history' });
  }
});

// ==========================================
// STREAKS
// ==========================================

/**
 * GET /api/engagement/streaks
 * Get user's current streaks
 */
router.get('/streaks', authenticate, async (req: Request, res: Response) => {
  try {
    const streaks = await engagementService.getStreaks((req as AuthRequest).user!.id);
    res.json({ streaks });
  } catch (error) {
    console.error('Get streaks error:', error);
    res.status(500).json({ message: 'Failed to get streaks' });
  }
});

/**
 * POST /api/engagement/streaks/check-in
 * Record a login check-in for streak tracking
 */
router.post('/streaks/check-in', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await engagementService.updateStreak((req as AuthRequest).user!.id, 'login');
    
    // Award XP for daily check-in (only if streak continues)
    if (result.currentStreak > 0) {
      const xpAmount = Math.min(10 + result.currentStreak * 2, 50);
      await engagementService.addXP((req as AuthRequest).user!.id, xpAmount, 'Daily check-in');
    }

    res.json(result);
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Failed to check in' });
  }
});

// ==========================================
// LEADERBOARDS
// ==========================================

/**
 * GET /api/engagement/leaderboard
 * Get leaderboard by type
 */
router.get('/leaderboard', optionalAuth, async (req: Request, res: Response) => {
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
    console.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Failed to get leaderboard' });
  }
});

/**
 * GET /api/engagement/leaderboard/xp
 * Get XP leaderboard
 */
router.get('/leaderboard/xp', optionalAuth, async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'alltime') || 'alltime';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const leaderboard = await engagementService.getLeaderboard('xp', period, limit);
    res.json({ leaderboard, type: 'xp', period });
  } catch (error) {
    console.error('Get XP leaderboard error:', error);
    res.status(500).json({ message: 'Failed to get leaderboard' });
  }
});

/**
 * GET /api/engagement/leaderboard/creators
 * Get top creators leaderboard
 */
router.get('/leaderboard/creators', optionalAuth, async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'alltime') || 'weekly';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const leaderboard = await engagementService.getLeaderboard('followers', period, limit);
    res.json({ leaderboard, type: 'creators', period });
  } catch (error) {
    console.error('Get creators leaderboard error:', error);
    res.status(500).json({ message: 'Failed to get leaderboard' });
  }
});

// ==========================================
// USER STATS SUMMARY
// ==========================================

/**
 * GET /api/engagement/summary
 * Get complete engagement summary for current user
 */
router.get('/summary', authenticate, async (req: Request, res: Response) => {
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
    console.error('Get engagement summary error:', error);
    res.status(500).json({ message: 'Failed to get engagement summary' });
  }
});

export default router;
