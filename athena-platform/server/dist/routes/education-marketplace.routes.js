"use strict";
/**
 * Education Marketplace Routes
 * Course recommendations, learning paths, certifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const education_marketplace_service_1 = require("../services/education-marketplace.service");
const router = (0, express_1.Router)();
/**
 * GET /api/education/recommendations
 * Get personalized course recommendations
 */
router.get('/recommendations', auth_1.authenticate, async (req, res, next) => {
    try {
        const { targetRole, budget, timeCommitment, preferCertified } = req.query;
        const recommendations = await education_marketplace_service_1.educationMarketplaceService.getCourseRecommendations(req.user.id, {
            targetRole: targetRole,
            budget: budget ? parseFloat(budget) : undefined,
            timeCommitment: timeCommitment,
            preferCertified: preferCertified === 'true',
        });
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
 * GET /api/education/skill-gaps
 * Analyze skill gaps for career goal
 */
router.get('/skill-gaps', auth_1.authenticate, async (req, res, next) => {
    try {
        const { targetRole } = req.query;
        const analysis = await education_marketplace_service_1.educationMarketplaceService.analyzeSkillGaps(req.user.id, targetRole);
        res.json({
            success: true,
            data: analysis,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/education/learning-path
 * Create personalized learning path
 */
router.post('/learning-path', auth_1.authenticate, [
    (0, express_validator_1.body)('targetRole').isString().notEmpty(),
    (0, express_validator_1.body)('timeline').optional().isIn(['accelerated', 'standard', 'relaxed']),
    (0, express_validator_1.body)('budget').optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)('hoursPerWeek').optional().isInt({ min: 1, max: 60 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const learningPath = await education_marketplace_service_1.educationMarketplaceService.createLearningPath(req.user.id, req.body.targetRole, {
            timeline: req.body.timeline,
            budget: req.body.budget,
            hoursPerWeek: req.body.hoursPerWeek,
        });
        res.status(201).json({
            success: true,
            data: learningPath,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /api/education/courses/:courseId/progress
 * Update course progress
 */
router.patch('/courses/:courseId/progress', auth_1.authenticate, [
    (0, express_validator_1.body)('progress').isInt({ min: 0, max: 100 }),
    (0, express_validator_1.body)('lessonCompleted').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const result = await education_marketplace_service_1.educationMarketplaceService.updateCourseProgress(req.user.id, req.params.courseId, req.body.progress, req.body.lessonCompleted);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/education/providers
 * Get list of course providers
 */
router.get('/providers', auth_1.authenticate, async (_req, res, next) => {
    try {
        res.json({
            success: true,
            data: education_marketplace_service_1.COURSE_PROVIDERS,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/education/mentors
 * Get mentor recommendations
 */
router.get('/mentors', auth_1.authenticate, async (req, res, next) => {
    try {
        const { skillArea } = req.query;
        if (!skillArea) {
            throw new errorHandler_1.ApiError(400, 'skillArea is required');
        }
        const mentors = await education_marketplace_service_1.educationMarketplaceService.getMentorRecommendations(req.user.id, skillArea);
        res.json({
            success: true,
            data: mentors,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/education/study-groups
 * Create a study group
 */
router.post('/study-groups', auth_1.authenticate, [
    (0, express_validator_1.body)('courseId').isString().notEmpty(),
    (0, express_validator_1.body)('name').isString().notEmpty().trim(),
    (0, express_validator_1.body)('maxParticipants').isInt({ min: 2, max: 50 }),
    (0, express_validator_1.body)('scheduledTime').isISO8601(),
    (0, express_validator_1.body)('duration').isInt({ min: 15, max: 480 }), // 15 min to 8 hours
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const studyGroup = await education_marketplace_service_1.educationMarketplaceService.createStudyGroup(req.user.id, {
            courseId: req.body.courseId,
            name: req.body.name,
            maxParticipants: req.body.maxParticipants,
            scheduledTime: new Date(req.body.scheduledTime),
            duration: req.body.duration,
        });
        res.status(201).json({
            success: true,
            data: studyGroup,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/education/courses/:courseId/analytics
 * Get course analytics (for instructors)
 */
router.get('/courses/:courseId/analytics', auth_1.authenticate, async (req, res, next) => {
    try {
        const analytics = await education_marketplace_service_1.educationMarketplaceService.getCourseAnalytics(req.user.id, req.params.courseId);
        res.json({
            success: true,
            data: analytics,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/education/certificates/:certificateId/download
 * Download certificate
 */
router.get('/certificates/:certificateId/download', auth_1.authenticate, async (req, res, next) => {
    try {
        // In production, generate PDF and return file
        res.json({
            success: true,
            message: 'Certificate download',
            downloadUrl: `/api/education/certificates/${req.params.certificateId}/pdf`,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=education-marketplace.routes.js.map