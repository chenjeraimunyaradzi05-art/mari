"use strict";
/**
 * AutoMod Routes
 * Automated moderation configuration and management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const automod_service_1 = require("../services/automod.service");
const router = (0, express_1.Router)();
/**
 * Middleware to check moderator/admin role
 */
function requireModerator(req, res, next) {
    if (!req.user || !['ADMIN', 'MODERATOR'].includes(req.user.role || '')) {
        return next(new errorHandler_1.ApiError(403, 'Moderator access required'));
    }
    next();
}
/**
 * POST /api/automod/check
 * Check content against AutoMod rules
 */
router.post('/check', auth_1.authenticate, [
    (0, express_validator_1.body)('content').isString().notEmpty(),
    (0, express_validator_1.body)('type').isIn(['post', 'comment', 'message', 'profile']),
    (0, express_validator_1.body)('communityId').optional().isString(),
    (0, express_validator_1.body)('channelId').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const result = await automod_service_1.automodService.processContent(req.body.content, req.user.id, {
            type: req.body.type,
            communityId: req.body.communityId,
            channelId: req.body.channelId,
        });
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
 * GET /api/automod/rules
 * Get AutoMod rules
 */
router.get('/rules', auth_1.authenticate, requireModerator, async (req, res, next) => {
    try {
        const { communityId, channelId } = req.query;
        const rules = await automod_service_1.automodService.getApplicableRules(communityId, channelId);
        res.json({
            success: true,
            data: rules,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/automod/rules
 * Create AutoMod rule
 */
router.post('/rules', auth_1.authenticate, requireModerator, [
    (0, express_validator_1.body)('name').isString().notEmpty().trim(),
    (0, express_validator_1.body)('type').isIn(['keyword', 'regex', 'ml', 'rate_limit', 'reputation', 'composite']),
    (0, express_validator_1.body)('enabled').isBoolean(),
    (0, express_validator_1.body)('priority').isInt({ min: 1, max: 1000 }),
    (0, express_validator_1.body)('action').isObject(),
    (0, express_validator_1.body)('action.type').isIn(['block', 'flag', 'quarantine', 'warn', 'mute', 'shadowban', 'escalate']),
    (0, express_validator_1.body)('conditions').isArray({ min: 1 }),
    (0, express_validator_1.body)('scope').isIn(['global', 'community', 'channel']),
    (0, express_validator_1.body)('scopeId').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const rule = await automod_service_1.automodService.createRule(req.user.id, {
            name: req.body.name,
            type: req.body.type,
            enabled: req.body.enabled,
            priority: req.body.priority,
            action: req.body.action,
            conditions: req.body.conditions,
            scope: req.body.scope,
            scopeId: req.body.scopeId,
        });
        res.status(201).json({
            success: true,
            data: rule,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/automod/community/:communityId/initialize
 * Initialize default rules for community
 */
router.post('/community/:communityId/initialize', auth_1.authenticate, requireModerator, async (req, res, next) => {
    try {
        await automod_service_1.automodService.initializeCommunityRules(req.params.communityId, req.user.id);
        res.json({
            success: true,
            message: 'Default rules initialized',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/automod/queue
 * Get moderation queue
 */
router.get('/queue', auth_1.authenticate, requireModerator, async (req, res, next) => {
    try {
        const { communityId, status, limit, offset } = req.query;
        const queue = await automod_service_1.automodService.getModerationQueue(req.user.id, {
            communityId: communityId,
            status: status,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        res.json({
            success: true,
            data: queue,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/automod/queue/:itemId/process
 * Process moderation queue item
 */
router.post('/queue/:itemId/process', auth_1.authenticate, requireModerator, [
    (0, express_validator_1.body)('decision').isIn(['approve', 'reject', 'escalate']),
    (0, express_validator_1.body)('notes').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        await automod_service_1.automodService.processQueueItem(req.user.id, req.params.itemId, req.body.decision, req.body.notes);
        res.json({
            success: true,
            message: 'Queue item processed',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/automod/stats
 * Get moderation statistics
 */
router.get('/stats', auth_1.authenticate, requireModerator, async (req, res, next) => {
    try {
        const { communityId, startDate, endDate } = req.query;
        const stats = await automod_service_1.automodService.getStats({
            communityId: communityId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/automod/user/:userId/reputation
 * Get user reputation score
 */
router.get('/user/:userId/reputation', auth_1.authenticate, requireModerator, async (req, res, next) => {
    try {
        const reputation = await automod_service_1.automodService.calculateUserReputation(req.params.userId);
        res.json({
            success: true,
            data: { userId: req.params.userId, reputation },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=automod.routes.js.map