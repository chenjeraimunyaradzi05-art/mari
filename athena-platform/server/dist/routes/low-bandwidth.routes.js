"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Low Bandwidth Optimization Routes
 * API endpoints for bandwidth detection and content optimization
 */
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const low_bandwidth_service_1 = require("../services/low-bandwidth.service");
const router = (0, express_1.Router)();
/**
 * Detect connection profile
 * POST /api/bandwidth/detect
 */
router.post('/detect', [
    (0, express_validator_1.body)('downlink').optional().isNumeric(),
    (0, express_validator_1.body)('rtt').optional().isNumeric(),
    (0, express_validator_1.body)('effectiveType').optional().isString(),
    (0, express_validator_1.body)('saveData').optional().isBoolean(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const profile = low_bandwidth_service_1.lowBandwidthService.detectConnectionProfile(req.body);
        res.json({ success: true, data: profile });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get bandwidth profiles configuration
 * GET /api/bandwidth/profiles
 */
router.get('/profiles', async (req, res, next) => {
    try {
        res.json({ success: true, data: low_bandwidth_service_1.BANDWIDTH_PROFILES });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Set user bandwidth preference
 * POST /api/bandwidth/preference
 */
router.post('/preference', auth_1.authenticate, [
    (0, express_validator_1.body)('profileId').isIn(['ultra-low', 'low', 'medium', 'high']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const preference = low_bandwidth_service_1.lowBandwidthService.setUserProfile(req.user.id, req.body.profileId);
        res.json({ success: true, data: preference });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get user bandwidth preference
 * GET /api/bandwidth/preference
 */
router.get('/preference', auth_1.authenticate, async (req, res, next) => {
    try {
        const preference = low_bandwidth_service_1.lowBandwidthService.getUserProfile(req.user.id);
        res.json({ success: true, data: preference });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get optimized image URL
 * GET /api/bandwidth/optimize/image
 */
router.get('/optimize/image', auth_1.authenticate, [
    (0, express_validator_1.query)('url').isURL(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const profile = low_bandwidth_service_1.lowBandwidthService.getUserProfile(req.user.id);
        const optimization = low_bandwidth_service_1.lowBandwidthService.optimizeImageUrl(req.query.url, profile);
        res.json({ success: true, data: optimization });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get optimized video URL
 * GET /api/bandwidth/optimize/video
 */
router.get('/optimize/video', auth_1.authenticate, [
    (0, express_validator_1.query)('url').isURL(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const profile = low_bandwidth_service_1.lowBandwidthService.getUserProfile(req.user.id);
        const optimizedUrl = low_bandwidth_service_1.lowBandwidthService.optimizeVideoUrl(req.query.url, profile);
        res.json({ success: true, data: { optimizedUrl } });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get lite feed (optimized for low bandwidth)
 * GET /api/bandwidth/feed/lite
 */
router.get('/feed/lite', auth_1.authenticate, async (req, res, next) => {
    try {
        const profile = low_bandwidth_service_1.lowBandwidthService.getUserProfile(req.user.id);
        // Get a sample feed (in production, this would fetch from feed service)
        const sampleFeed = [
            { id: '1', authorId: 'a1', authorName: 'User 1', content: 'Sample post content', thumbnail: 'https://example.com/img.jpg', likeCount: 10, commentCount: 2, createdAt: new Date() },
        ];
        const liteFeed = low_bandwidth_service_1.lowBandwidthService.getLiteFeed(sampleFeed, profile);
        res.json({ success: true, data: liteFeed });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Cache content for offline access
 * POST /api/bandwidth/cache
 */
router.post('/cache', auth_1.authenticate, [
    (0, express_validator_1.body)('contentType').isIn(['feed', 'messages', 'profile', 'courses']),
    (0, express_validator_1.body)('data').exists(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const cached = await low_bandwidth_service_1.lowBandwidthService.cacheContent(req.user.id, req.body.contentType, req.body.data);
        res.json({ success: true, data: cached });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get cached content
 * GET /api/bandwidth/cache/:contentType
 */
router.get('/cache/:contentType', auth_1.authenticate, [
    (0, express_validator_1.param)('contentType').isIn(['feed', 'messages', 'profile', 'courses']),
], async (req, res, next) => {
    try {
        const cached = low_bandwidth_service_1.lowBandwidthService.getCachedContent(req.user.id, req.params.contentType);
        res.json({ success: true, data: cached });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=low-bandwidth.routes.js.map