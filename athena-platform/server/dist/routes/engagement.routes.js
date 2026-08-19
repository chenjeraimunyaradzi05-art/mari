"use strict";
/**
 * Engagement Routes
 * Gamification, achievements, XP, and leaderboards
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
const engagementService = __importStar(require("../services/engagement.service"));
const router = (0, express_1.Router)();
// ==========================================
// ACHIEVEMENTS
// ==========================================
/**
 * GET /api/engagement/achievements
 * Get all achievements with user's progress
 */
router.get('/achievements', auth_1.authenticate, async (req, res, next) => {
    try {
        const achievements = await engagementService.getUserAchievements(req.user.id);
        res.json(achievements);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/engagement/achievements/list
 * Get list of all available achievements
 */
router.get('/achievements/list', async (req, res, next) => {
    try {
        const achievements = Object.values(engagementService.ACHIEVEMENTS);
        // Group by category
        const grouped = achievements.reduce((acc, ach) => {
            if (!acc[ach.category])
                acc[ach.category] = [];
            acc[ach.category].push(ach);
            return acc;
        }, {});
        res.json({
            achievements,
            byCategory: grouped,
            total: achievements.length,
        });
    }
    catch (error) {
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
router.get('/xp', auth_1.authenticate, async (req, res, next) => {
    try {
        const xpData = await engagementService.getUserXP(req.user.id);
        res.json(xpData);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/engagement/xp/history
 * Get XP transaction history
 */
router.get('/xp/history', auth_1.authenticate, async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const history = await engagementService.getXPHistory(req.user.id, limit);
        res.json({ history });
    }
    catch (error) {
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
router.get('/streaks', auth_1.authenticate, async (req, res, next) => {
    try {
        const streaks = await engagementService.getStreaks(req.user.id);
        res.json({ streaks });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/engagement/streaks/check-in
 * Record a login check-in for streak tracking
 */
router.post('/streaks/check-in', auth_1.authenticate, async (req, res, next) => {
    try {
        const result = await engagementService.updateStreak(req.user.id, 'login');
        // Award XP for daily check-in (only if streak continues)
        if (result.currentStreak > 0) {
            const xpAmount = Math.min(10 + result.currentStreak * 2, 50);
            await engagementService.addXP(req.user.id, xpAmount, 'Daily check-in');
        }
        res.json(result);
    }
    catch (error) {
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
router.get('/leaderboard', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const type = req.query.type || 'xp';
        const period = req.query.period || 'weekly';
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const leaderboard = await engagementService.getLeaderboard(type, period, limit);
        // Add user's rank if authenticated
        let userRank = null;
        if (req.user) {
            // Find user's position
            const fullLeaderboard = await engagementService.getLeaderboard(type, period, 1000);
            const userIndex = fullLeaderboard.findIndex((entry) => entry.id === req.user.id);
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/engagement/leaderboard/xp
 * Get XP leaderboard
 */
router.get('/leaderboard/xp', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const period = req.query.period || 'alltime';
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const leaderboard = await engagementService.getLeaderboard('xp', period, limit);
        res.json({ leaderboard, type: 'xp', period });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/engagement/leaderboard/creators
 * Get top creators leaderboard
 */
router.get('/leaderboard/creators', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const period = req.query.period || 'weekly';
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const leaderboard = await engagementService.getLeaderboard('followers', period, limit);
        res.json({ leaderboard, type: 'creators', period });
    }
    catch (error) {
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
router.get('/summary', auth_1.authenticate, async (req, res, next) => {
    try {
        const [achievements, xp, streaks] = await Promise.all([
            engagementService.getUserAchievements(req.user.id),
            engagementService.getUserXP(req.user.id),
            engagementService.getStreaks(req.user.id),
        ]);
        res.json({
            achievements: achievements.stats,
            xp,
            streaks,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=engagement.routes.js.map