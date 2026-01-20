"use strict";
/**
 * Feed Routes (OpportunityVerse)
 * API endpoints for personalized feed mixing
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const opportunity_verse_service_1 = require("../services/opportunity-verse.service");
const cold_start_service_1 = require("../services/cold-start.service");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/**
 * @route GET /api/feed
 * @desc Get personalized mixed feed
 * @access Private
 */
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { cursor, limit = '20', filters, } = req.query;
        const feed = await (0, opportunity_verse_service_1.getMixedFeed)(req.user.id, {
            cursor: cursor,
            limit: parseInt(limit, 10),
            filters: filters ? JSON.parse(filters) : undefined,
        });
        res.json({
            success: true,
            data: feed,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/feed/cold-start
 * @desc Get cold start recommendations for new users
 * @access Private
 */
router.get('/cold-start', auth_1.authenticate, async (req, res, next) => {
    try {
        const { limit = '20' } = req.query;
        const recommendations = await cold_start_service_1.coldStartAlgorithm.getColdStartRecommendations(req.user.id, parseInt(limit, 10));
        res.json({
            success: true,
            data: recommendations,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/feed/cold-start/score
 * @desc Get cold start score for user
 * @access Private
 */
router.get('/cold-start/score', auth_1.authenticate, async (req, res, next) => {
    try {
        const [score, isColdStart] = await Promise.all([
            cold_start_service_1.coldStartAlgorithm.getColdStartScore(req.user.id),
            cold_start_service_1.coldStartAlgorithm.isUserColdStart(req.user.id),
        ]);
        res.json({
            success: true,
            data: {
                score,
                isColdStart,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/feed/onboarding
 * @desc Get onboarding suggestions
 * @access Private
 */
router.get('/onboarding', auth_1.authenticate, async (req, res, next) => {
    try {
        const suggestions = await cold_start_service_1.coldStartAlgorithm.getOnboardingSuggestions(req.user.id);
        res.json({
            success: true,
            data: suggestions,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/feed/opportunities
 * @desc Get job/gig opportunities feed
 * @access Private
 */
router.get('/opportunities', auth_1.authenticate, async (req, res, next) => {
    try {
        const { cursor, limit = '20' } = req.query;
        // Get opportunities-focused feed
        const feed = await (0, opportunity_verse_service_1.getMixedFeed)(req.user.id, {
            cursor: cursor,
            limit: parseInt(limit, 10),
            filters: { contentTypes: ['OPPORTUNITY', 'JOB'] },
        });
        res.json({
            success: true,
            data: feed,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=feed.routes.js.map