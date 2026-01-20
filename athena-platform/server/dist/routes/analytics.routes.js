"use strict";
/**
 * Analytics Routes
 * Platform-wide and user analytics endpoints
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const analyticsService = __importStar(require("../services/analytics.service"));
const router = (0, express_1.Router)();
// ==========================================
// PLATFORM ANALYTICS (Admin Only)
// ==========================================
/**
 * GET /api/analytics/platform
 * Get platform-wide statistics
 */
router.get('/platform', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const stats = await analyticsService.getPlatformStats();
        res.json(stats);
    }
    catch (error) {
        console.error('Get platform stats error:', error);
        res.status(500).json({ message: 'Failed to get platform stats' });
    }
});
/**
 * GET /api/analytics/engagement
 * Get engagement time series data
 */
router.get('/engagement', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const metrics = await analyticsService.getEngagementTimeSeries(days);
        res.json(metrics);
    }
    catch (error) {
        console.error('Get engagement metrics error:', error);
        res.status(500).json({ message: 'Failed to get engagement metrics' });
    }
});
/**
 * GET /api/analytics/top-content
 * Get top performing content
 */
router.get('/top-content', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const period = req.query.period || 'week';
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const content = await analyticsService.getTopContent(period, limit);
        res.json(content);
    }
    catch (error) {
        console.error('Get top content error:', error);
        res.status(500).json({ message: 'Failed to get top content' });
    }
});
/**
 * GET /api/analytics/growth
 * Get growth metrics compared to previous period
 */
router.get('/growth', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const metrics = await analyticsService.getGrowthMetrics(days);
        res.json(metrics);
    }
    catch (error) {
        console.error('Get growth metrics error:', error);
        res.status(500).json({ message: 'Failed to get growth metrics' });
    }
});
// ==========================================
// USER ANALYTICS (Own or Admin)
// ==========================================
/**
 * GET /api/analytics/me
 * Get current user's analytics
 */
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const analytics = await analyticsService.getUserAnalytics(req.user.id, days);
        res.json(analytics);
    }
    catch (error) {
        console.error('Get user analytics error:', error);
        res.status(500).json({ message: 'Failed to get analytics' });
    }
});
/**
 * GET /api/analytics/user/:userId
 * Get specific user's analytics (Admin only)
 */
router.get('/user/:userId', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const { userId } = req.params;
        const days = parseInt(req.query.days) || 30;
        const analytics = await analyticsService.getUserAnalytics(userId, days);
        res.json(analytics);
    }
    catch (error) {
        console.error('Get user analytics error:', error);
        res.status(500).json({ message: 'Failed to get user analytics' });
    }
});
// ==========================================
// DASHBOARD DATA
// ==========================================
/**
 * GET /api/analytics/dashboard
 * Get admin dashboard summary
 */
router.get('/dashboard', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
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
    }
    catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ message: 'Failed to get dashboard data' });
    }
});
/**
 * GET /api/analytics/creator-dashboard
 * Get creator dashboard summary
 */
router.get('/creator-dashboard', auth_1.authenticate, (0, auth_1.requireRole)('CREATOR', 'ADMIN'), async (req, res) => {
    try {
        const analytics = await analyticsService.getUserAnalytics(req.user.id, 30);
        res.json({
            analytics,
            lastUpdated: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Get creator dashboard error:', error);
        res.status(500).json({ message: 'Failed to get creator dashboard' });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map