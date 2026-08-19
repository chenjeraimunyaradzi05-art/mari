"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const feature_flags_service_1 = require("../services/feature-flags.service");
const router = (0, express_1.Router)();
/**
 * GET /feature-flags/active
 * Returns active flags for the current user (or anonymous)
 */
router.get('/active', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const result = await (0, feature_flags_service_1.getActiveFeatureFlagsForUser)(userId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Admin-only routes
router.use(auth_1.authenticate);
router.use((0, auth_1.requireRole)('ADMIN'));
/**
 * GET /feature-flags
 * List all feature flags
 */
router.get('/', async (_req, res, next) => {
    try {
        const flags = await (0, feature_flags_service_1.listFeatureFlags)();
        res.json({ flags });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /feature-flags/:key
 * Get a specific feature flag
 */
router.get('/:key', async (req, res, next) => {
    try {
        const flag = await (0, feature_flags_service_1.getFeatureFlagByKey)(req.params.key);
        if (!flag) {
            return res.status(404).json({ error: 'Feature flag not found' });
        }
        res.json(flag);
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /feature-flags
 * Create or update a feature flag
 */
router.post('/', async (req, res, next) => {
    try {
        const flag = await (0, feature_flags_service_1.upsertFeatureFlag)({
            key: req.body.key,
            name: req.body.name,
            description: req.body.description,
            enabled: req.body.enabled,
            rolloutPercentage: req.body.rolloutPercentage,
            allowList: req.body.allowList,
            denyList: req.body.denyList,
            tags: req.body.tags,
            metadata: req.body.metadata,
            createdById: req.user?.id,
        });
        res.status(201).json(flag);
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /feature-flags/:key
 * Update a feature flag
 */
router.patch('/:key', async (req, res, next) => {
    try {
        const flag = await (0, feature_flags_service_1.updateFeatureFlag)(req.params.key, {
            name: req.body.name,
            description: req.body.description,
            enabled: req.body.enabled,
            rolloutPercentage: req.body.rolloutPercentage,
            allowList: req.body.allowList,
            denyList: req.body.denyList,
            tags: req.body.tags,
            metadata: req.body.metadata,
        });
        res.json(flag);
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /feature-flags/:key
 * Delete a feature flag
 */
router.delete('/:key', async (req, res, next) => {
    try {
        const result = await (0, feature_flags_service_1.deleteFeatureFlag)(req.params.key);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=feature-flags.routes.js.map