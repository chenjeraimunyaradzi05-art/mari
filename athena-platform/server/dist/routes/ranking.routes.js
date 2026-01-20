"use strict";
/**
 * ML Ranking Routes
 * Light/Heavy rankers, SafetyScore, MentorMatch, SalaryEquity
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const ml_ranking_service_1 = require("../services/ml-ranking.service");
const router = (0, express_1.Router)();
/**
 * POST /api/ranking/light
 * Light ranking for initial filtering
 */
router.post('/light', auth_1.authenticate, [(0, express_validator_1.body)('items').isArray({ min: 1 })], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const ranked = await ml_ranking_service_1.mlRankingService.lightRank(req.body.items, {
            userId: req.user.id,
            sessionId: req.body.sessionId,
            deviceType: req.body.deviceType,
            timestamp: new Date(),
        });
        res.json({
            success: true,
            data: ranked,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/ranking/heavy
 * Heavy ranking for personalized results
 */
router.post('/heavy', auth_1.authenticate, [(0, express_validator_1.body)('items').isArray({ min: 1 })], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const ranked = await ml_ranking_service_1.mlRankingService.heavyRank(req.body.items, {
            userId: req.user.id,
            sessionId: req.body.sessionId,
            deviceType: req.body.deviceType,
            location: req.body.location,
            timestamp: new Date(),
        });
        res.json({
            success: true,
            data: ranked,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ranking/safety-score/:userId
 * Get user safety score
 */
router.get('/safety-score/:userId', auth_1.authenticate, async (req, res, next) => {
    try {
        const safetyScore = await ml_ranking_service_1.mlRankingService.calculateSafetyScore(req.params.userId);
        res.json({
            success: true,
            data: safetyScore,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ranking/safety-score
 * Get own safety score
 */
router.get('/safety-score', auth_1.authenticate, async (req, res, next) => {
    try {
        const safetyScore = await ml_ranking_service_1.mlRankingService.calculateSafetyScore(req.user.id);
        res.json({
            success: true,
            data: safetyScore,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ranking/mentor-matches
 * Get mentor match recommendations
 */
router.get('/mentor-matches', auth_1.authenticate, async (req, res, next) => {
    try {
        const { skills, maxResults, budgetMax } = req.query;
        const matches = await ml_ranking_service_1.mlRankingService.findMentorMatches(req.user.id, {
            skills: skills ? skills.split(',') : undefined,
            maxResults: maxResults ? parseInt(maxResults) : undefined,
            budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
        });
        res.json({
            success: true,
            data: matches,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ranking/salary-equity
 * Get salary equity analysis
 */
router.get('/salary-equity', auth_1.authenticate, async (req, res, next) => {
    try {
        const { title, company, location, industry } = req.query;
        const salaryEquity = await ml_ranking_service_1.mlRankingService.calculateSalaryEquity(req.user.id, {
            title: title,
            company: company,
            location: location,
            industry: industry,
        });
        res.json({
            success: true,
            data: salaryEquity,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=ranking.routes.js.map