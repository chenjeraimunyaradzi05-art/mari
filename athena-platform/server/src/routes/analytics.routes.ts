/**
 * Analytics Routes
 * Platform-wide and user analytics endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import * as analyticsService from '../services/analytics.service';
import { logger } from '../utils/logger';

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await analyticsService.getPlatformStats();
      res.json(stats);
    } catch (error) {
      next(error);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await analyticsService.getEngagementTimeSeries(days);
      res.json(metrics);
    } catch (error) {
      next(error);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const content = await analyticsService.getTopContent(period, limit);
      res.json(content);
    } catch (error) {
      next(error);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await analyticsService.getGrowthMetrics(days);
      res.json(metrics);
    } catch (error) {
      next(error);
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
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await analyticsService.getUserAnalytics((req as AuthRequest).user!.id, days);
    res.json(analytics);
  } catch (error) {
    next(error);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const analytics = await analyticsService.getUserAnalytics(userId, days);
      res.json(analytics);
    } catch (error) {
      next(error);
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
  async (req: Request, res: Response, next: NextFunction) => {
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
      next(error);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await analyticsService.getUserAnalytics((req as AuthRequest).user!.id, 30);
      res.json({
        analytics,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
