"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Partnerships & White-Label Routes
 * API endpoints for partner management, integrations, and white-label config
 */
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const partnerships_service_1 = require("../services/partnerships.service");
const router = (0, express_1.Router)();
/**
 * Get partner tiers configuration
 * GET /api/partnerships/tiers
 */
router.get('/tiers', async (req, res, next) => {
    try {
        res.json({ success: true, data: partnerships_service_1.PARTNER_TIERS });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Apply for partnership
 * POST /api/partnerships/apply
 */
router.post('/apply', auth_1.authenticate, [
    (0, express_validator_1.body)('name').isString().isLength({ min: 2, max: 200 }),
    (0, express_validator_1.body)('type').isIn(['employer', 'recruiter', 'educator', 'ngo', 'government']),
    (0, express_validator_1.body)('tier').isIn(['bronze', 'silver', 'gold', 'platinum', 'enterprise']),
    (0, express_validator_1.body)('contactInfo').isObject(),
    (0, express_validator_1.body)('contactInfo.primaryContact').isString(),
    (0, express_validator_1.body)('contactInfo.email').isEmail(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const application = await partnerships_service_1.partnershipsService.createPartner(req.body);
        res.status(201).json({ success: true, data: application });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get all partners
 * GET /api/partnerships
 */
router.get('/', auth_1.authenticate, [
    (0, express_validator_1.query)('type').optional().isIn(['employer', 'recruiter', 'educator', 'ngo', 'government']),
    (0, express_validator_1.query)('tier').optional().isIn(['bronze', 'silver', 'gold', 'platinum', 'enterprise']),
    (0, express_validator_1.query)('status').optional().isIn(['pending', 'active', 'suspended', 'terminated']),
], async (req, res, next) => {
    try {
        const partners = await partnerships_service_1.partnershipsService.getAllPartners({
            type: req.query.type,
            tier: req.query.tier,
            status: req.query.status,
        });
        res.json({ success: true, data: partners });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get partner details
 * GET /api/partnerships/:partnerId
 */
router.get('/:partnerId', auth_1.authenticate, [
    (0, express_validator_1.param)('partnerId').isString(),
], async (req, res, next) => {
    try {
        const partner = partnerships_service_1.partnershipsService.getPartner(req.params.partnerId);
        if (!partner) {
            throw new errorHandler_1.ApiError(404, 'Partner not found');
        }
        res.json({ success: true, data: partner });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Activate a partner
 * POST /api/partnerships/:partnerId/activate
 */
router.post('/:partnerId/activate', auth_1.authenticate, [
    (0, express_validator_1.param)('partnerId').isString(),
], async (req, res, next) => {
    try {
        const partner = await partnerships_service_1.partnershipsService.activatePartner(req.params.partnerId);
        res.json({ success: true, data: partner });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Setup white-label configuration
 * POST /api/partnerships/:partnerId/whitelabel
 */
router.post('/:partnerId/whitelabel', auth_1.authenticate, [
    (0, express_validator_1.param)('partnerId').isString(),
    (0, express_validator_1.body)('domain').isString(),
    (0, express_validator_1.body)('branding').isObject(),
    (0, express_validator_1.body)('branding.primaryColor').isString(),
    (0, express_validator_1.body)('branding.logo').isString(),
    (0, express_validator_1.body)('branding.appName').isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const config = await partnerships_service_1.partnershipsService.setupWhiteLabel(req.params.partnerId, req.body);
        res.json({ success: true, data: config });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get white-label config by domain
 * GET /api/partnerships/whitelabel/domain/:domain
 */
router.get('/whitelabel/domain/:domain', [
    (0, express_validator_1.param)('domain').isString(),
], async (req, res, next) => {
    try {
        const config = partnerships_service_1.partnershipsService.getWhiteLabelByDomain(req.params.domain);
        if (!config) {
            throw new errorHandler_1.ApiError(404, 'White-label config not found');
        }
        res.json({ success: true, data: config });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Add integration to partner
 * POST /api/partnerships/:partnerId/integrations
 */
router.post('/:partnerId/integrations', auth_1.authenticate, [
    (0, express_validator_1.param)('partnerId').isString(),
    (0, express_validator_1.body)('type').isIn(['ats', 'hris', 'lms', 'sso', 'analytics', 'webhook']),
    (0, express_validator_1.body)('name').isString(),
    (0, express_validator_1.body)('endpoint').isString(),
    (0, express_validator_1.body)('events').isArray(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const integration = await partnerships_service_1.partnershipsService.addIntegration(req.params.partnerId, req.body);
        res.status(201).json({ success: true, data: integration });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get revenue share calculation
 * GET /api/partnerships/:partnerId/revenue
 */
router.get('/:partnerId/revenue', auth_1.authenticate, [
    (0, express_validator_1.param)('partnerId').isString(),
    (0, express_validator_1.query)('grossRevenue').isNumeric(),
], async (req, res, next) => {
    try {
        const grossRevenue = parseFloat(req.query.grossRevenue);
        const revenue = partnerships_service_1.partnershipsService.calculateRevenueShare(req.params.partnerId, grossRevenue);
        res.json({ success: true, data: revenue });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Get partner analytics
 * GET /api/partnerships/:partnerId/analytics
 */
router.get('/:partnerId/analytics', auth_1.authenticate, [
    (0, express_validator_1.param)('partnerId').isString(),
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601(),
], async (req, res, next) => {
    try {
        const startDate = req.query.startDate
            ? new Date(req.query.startDate)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate
            ? new Date(req.query.endDate)
            : new Date();
        const analytics = await partnerships_service_1.partnershipsService.getPartnerAnalytics(req.params.partnerId, { start: startDate, end: endDate });
        res.json({ success: true, data: analytics });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Trigger webhook for partner
 * POST /api/partnerships/:partnerId/webhook
 */
router.post('/:partnerId/webhook', [
    (0, express_validator_1.param)('partnerId').isString(),
    (0, express_validator_1.body)('event').isString(),
    (0, express_validator_1.body)('payload').isObject(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const result = await partnerships_service_1.partnershipsService.triggerWebhook(req.params.partnerId, req.body.event, req.body.payload);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Upgrade partner tier
 * POST /api/partnerships/:partnerId/upgrade
 */
router.post('/:partnerId/upgrade', auth_1.authenticate, [
    (0, express_validator_1.param)('partnerId').isString(),
    (0, express_validator_1.body)('newTier').isIn(['bronze', 'silver', 'gold', 'platinum', 'enterprise']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed');
        }
        const partner = await partnerships_service_1.partnershipsService.upgradeTier(req.params.partnerId, req.body.newTier);
        res.json({ success: true, data: partner });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=partnerships.routes.js.map