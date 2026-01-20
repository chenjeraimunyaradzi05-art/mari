/**
 * Analytics Routes
 * Platform-wide and user analytics endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import * as analyticsService from '../services/analytics.service';

const router = Router();

// ==========================================
// PLATFORM ANALYTICS (Admin Only)
// ==========================================

/**
 * GET /api/analytics/platform
 * Get platform-wide statistics
 */
router.get(
  '/platform',
  authenticate,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const stats = await analyticsService.getPlatformStats();
      res.json(stats);
    } catch (error) {
      console.error('Get platform stats error:', error);
      res.status(500).json({ message: 'Failed to get platform stats' });
    }
  }
);

/**
 * GET /api/analytics/engagement
 * Get engagement time series data
 */
router.get(
  '/engagement',
  authenticate,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await analyticsService.getEngagementTimeSeries(days);
      res.json(metrics);
    } catch (error) {
      console.error('Get engagement metrics error:', error);
      res.status(500).json({ message: 'Failed to get engagement metrics' });
    }
  }
);

/**
 * GET /api/analytics/top-content
 * Get top performing content
 */
router.get(
  '/top-content',
  authenticate,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const content = await analyticsService.getTopContent(period, limit);
      res.json(content);
    } catch (error) {
      console.error('Get top content error:', error);
      res.status(500).json({ message: 'Failed to get top content' });
    }
  }
);

/**
 * GET /api/analytics/growth
 * Get growth metrics compared to previous period
 */
router.get(
  '/growth',
  authenticate,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await analyticsService.getGrowthMetrics(days);
      res.json(metrics);
    } catch (error) {
      console.error('Get growth metrics error:', error);
      res.status(500).json({ message: 'Failed to get growth metrics' });
    }
  }
);

// ==========================================
// USER ANALYTICS (Own or Admin)
// ==========================================

/**
 * GET /api/analytics/me
 * Get current user's analytics
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await analyticsService.getUserAnalytics((req as AuthRequest).user!.id, days);
    res.json(analytics);
  } catch (error) {
    console.error('Get user analytics error:', error);
    res.status(500).json({ message: 'Failed to get analytics' });
  }
});

/**
 * GET /api/analytics/user/:userId
 * Get specific user's analytics (Admin only)
 */
router.get(
  '/user/:userId',
  authenticate,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const analytics = await analyticsService.getUserAnalytics(userId, days);
      res.json(analytics);
    } catch (error) {
      console.error('Get user analytics error:', error);
      res.status(500).json({ message: 'Failed to get user analytics' });
    }
  }
);

// ==========================================
// DASHBOARD DATA
// ==========================================

/**
 * GET /api/analytics/dashboard
 * Get admin dashboard summary
 */
router.get(
  '/dashboard',
  authenticate,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const [platformStats, growth, topContent] = await Promise.all([
        analyticsService.getPlatformStats(),
        analyticsService.getGrowthMetrics(7),
        analyticsService.getTopContent('week', 5),
      ]);

      res.json({
        stats: platformStats,
        growth,
        topContent,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({ message: 'Failed to get dashboard data' });
    }
  }
);

/**
 * GET /api/analytics/creator-dashboard
 * Get creator dashboard summary
 */
router.get(
  '/creator-dashboard',
  authenticate,
  requireRole('CREATOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const analytics = await analyticsService.getUserAnalytics((req as AuthRequest).user!.id, 30);
      res.json({
        analytics,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get creator dashboard error:', error);
      res.status(500).json({ message: 'Failed to get creator dashboard' });
    }
  }
);

export default router;
