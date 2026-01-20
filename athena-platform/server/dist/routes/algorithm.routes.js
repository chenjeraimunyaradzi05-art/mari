"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const algorithm_service_1 = require("../services/algorithm.service");
const router = (0, express_1.Router)();
// ===========================================
// CAREER COMPASS
// ===========================================
router.get('/career-compass', auth_1.authenticate, async (req, res, next) => {
    try {
        const targetRole = typeof req.query.targetRole === 'string' ? req.query.targetRole : undefined;
        const data = await (0, algorithm_service_1.getCareerCompass)(req.user.id, targetRole);
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// OPPORTUNITY SCAN
// ===========================================
router.get('/opportunity-scan', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const data = await (0, algorithm_service_1.getOpportunityScan)(req.user?.id);
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// SALARY EQUITY
// ===========================================
router.get('/salary-equity', auth_1.authenticate, async (req, res, next) => {
    try {
        const targetRole = typeof req.query.targetRole === 'string' ? req.query.targetRole : undefined;
        const data = await (0, algorithm_service_1.getSalaryEquity)(req.user.id, targetRole);
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// MENTOR MATCH
// ===========================================
router.get('/mentor-match', auth_1.authenticate, async (req, res, next) => {
    try {
        const data = await (0, algorithm_service_1.getMentorMatch)(req.user.id);
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// INCOME STREAM (Creator Revenue Optimization)
// ===========================================
router.get('/income-stream', auth_1.authenticate, async (req, res, next) => {
    try {
        const data = await (0, algorithm_service_1.getIncomeStream)(req.user.id);
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// RECOMMENDATION ENGINE 2.0
// ===========================================
router.get('/recommendation-engine-2', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const data = await (0, algorithm_service_1.getRecommendationEngineV2)(req.user?.id);
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=algorithm.routes.js.map