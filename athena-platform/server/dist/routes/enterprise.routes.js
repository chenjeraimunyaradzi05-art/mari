"use strict";
/**
 * Enterprise Organization Routes
 * Enterprise org flows, team management, ATS integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const enterprise_org_service_1 = require("../services/enterprise-org.service");
const prisma_1 = require("../utils/prisma");
const router = (0, express_1.Router)();
/**
 * Middleware to check org membership and role
 */
async function requireOrgRole(req, orgId, allowedRoles) {
    const membership = await prisma_1.prisma.organizationMember.findFirst({
        where: {
            organizationId: orgId,
            userId: req.user.id,
        },
    });
    if (!membership) {
        throw new errorHandler_1.ApiError(403, 'Not a member of this organization');
    }
    if (!allowedRoles.includes(membership.role)) {
        throw new errorHandler_1.ApiError(403, 'Insufficient permissions');
    }
}
/**
 * POST /api/enterprise/org
 * Create enterprise organization
 */
router.post('/org', auth_1.authenticate, [
    (0, express_validator_1.body)('name').isString().notEmpty().trim(),
    (0, express_validator_1.body)('industry').isString().notEmpty(),
    (0, express_validator_1.body)('size').isString().notEmpty(),
    (0, express_validator_1.body)('type').optional().isIn(['enterprise', 'sme', 'startup', 'nonprofit', 'government']),
    (0, express_validator_1.body)('website').optional().isURL(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const org = await enterprise_org_service_1.enterpriseOrgService.createEnterpriseOrg(req.user.id, req.body);
        res.status(201).json({
            success: true,
            data: org,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/enterprise/org/:orgId
 * Get enterprise organization details
 */
router.get('/org/:orgId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'VIEWER']);
        const org = await enterprise_org_service_1.enterpriseOrgService.getEnterpriseOrg(orgId);
        if (!org) {
            throw new errorHandler_1.ApiError(404, 'Organization not found');
        }
        res.json({
            success: true,
            data: org,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/enterprise/org/:orgId/upgrade
 * Upgrade organization plan
 */
router.post('/org/:orgId/upgrade', auth_1.authenticate, [(0, express_validator_1.body)('plan').isIn(['basic', 'professional', 'enterprise'])], async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN']);
        const { plan } = req.body;
        const result = await enterprise_org_service_1.enterpriseOrgService.upgradePlan(orgId, plan);
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
 * POST /api/enterprise/org/:orgId/team/invite
 * Invite team member
 */
router.post('/org/:orgId/team/invite', auth_1.authenticate, [
    (0, express_validator_1.body)('email').isEmail(),
    (0, express_validator_1.body)('role').isIn(['admin', 'recruiter', 'hiring_manager', 'viewer']),
    (0, express_validator_1.body)('permissions').optional().isArray(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN']);
        const result = await enterprise_org_service_1.enterpriseOrgService.inviteTeamMember(orgId, req.user.id, req.body);
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
 * PATCH /api/enterprise/org/:orgId/team/:memberId
 * Update team member role
 */
router.patch('/org/:orgId/team/:memberId', auth_1.authenticate, [
    (0, express_validator_1.body)('role').isIn(['admin', 'recruiter', 'hiring_manager', 'viewer']),
    (0, express_validator_1.body)('permissions').optional().isArray(),
], async (req, res, next) => {
    try {
        const { orgId, memberId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN']);
        const { role, permissions } = req.body;
        await enterprise_org_service_1.enterpriseOrgService.updateTeamMemberRole(orgId, memberId, role, permissions);
        res.json({
            success: true,
            message: 'Team member updated',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/enterprise/org/:orgId/team/:memberId
 * Remove team member
 */
router.delete('/org/:orgId/team/:memberId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { orgId, memberId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN']);
        await enterprise_org_service_1.enterpriseOrgService.removeTeamMember(orgId, memberId);
        res.json({
            success: true,
            message: 'Team member removed',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /api/enterprise/org/:orgId/branding
 * Update organization branding
 */
router.patch('/org/:orgId/branding', auth_1.authenticate, [
    (0, express_validator_1.body)('logo').optional().isURL(),
    (0, express_validator_1.body)('coverImage').optional().isURL(),
    (0, express_validator_1.body)('bannerVideo').optional().isURL(),
    (0, express_validator_1.body)('primaryColor').optional().isString(),
    (0, express_validator_1.body)('secondaryColor').optional().isString(),
    (0, express_validator_1.body)('tagline').optional().isString(),
    (0, express_validator_1.body)('cultureStatement').optional().isString(),
    (0, express_validator_1.body)('values').optional().isArray(),
    (0, express_validator_1.body)('perks').optional().isArray(),
], async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN']);
        await enterprise_org_service_1.enterpriseOrgService.updateBranding(orgId, req.body);
        res.json({
            success: true,
            message: 'Branding updated',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/enterprise/ats-providers
 * Get available ATS providers
 */
router.get('/ats-providers', auth_1.authenticate, async (_req, res, next) => {
    try {
        res.json({
            success: true,
            data: enterprise_org_service_1.ATS_PROVIDERS,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/enterprise/org/:orgId/integrations/ats
 * Connect ATS integration
 */
router.post('/org/:orgId/integrations/ats', auth_1.authenticate, [
    (0, express_validator_1.body)('provider').isString().notEmpty(),
    (0, express_validator_1.body)('apiKey').optional().isString(),
    (0, express_validator_1.body)('apiSecret').optional().isString(),
    (0, express_validator_1.body)('subdomain').optional().isString(),
], async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN']);
        const { provider, ...credentials } = req.body;
        const integration = await enterprise_org_service_1.enterpriseOrgService.connectATS(orgId, provider, credentials);
        res.json({
            success: true,
            data: integration,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/enterprise/org/:orgId/integrations/:integrationId/sync-jobs
 * Sync jobs from ATS
 */
router.post('/org/:orgId/integrations/:integrationId/sync-jobs', auth_1.authenticate, async (req, res, next) => {
    try {
        const { orgId, integrationId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN', 'RECRUITER']);
        const result = await enterprise_org_service_1.enterpriseOrgService.syncJobsFromATS(orgId, integrationId);
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
 * POST /api/enterprise/org/:orgId/integrations/:integrationId/push-candidate
 * Push candidate to ATS
 */
router.post('/org/:orgId/integrations/:integrationId/push-candidate', auth_1.authenticate, [(0, express_validator_1.body)('applicationId').isString().notEmpty()], async (req, res, next) => {
    try {
        const { orgId, integrationId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN', 'RECRUITER']);
        const { applicationId } = req.body;
        const result = await enterprise_org_service_1.enterpriseOrgService.pushCandidateToATS(orgId, integrationId, applicationId);
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
 * GET /api/enterprise/org/:orgId/analytics
 * Get organization analytics
 */
router.get('/org/:orgId/analytics', auth_1.authenticate, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN', 'HIRING_MANAGER']);
        const analytics = await enterprise_org_service_1.enterpriseOrgService.getOrgAnalytics(orgId);
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
 * GET /api/enterprise/org/:orgId/analytics/diversity
 * Get diversity analytics
 */
router.get('/org/:orgId/analytics/diversity', auth_1.authenticate, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN', 'HIRING_MANAGER']);
        const diversity = await enterprise_org_service_1.enterpriseOrgService.getDiversityAnalytics(orgId);
        res.json({
            success: true,
            data: diversity,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/enterprise/org/:orgId/branding-report
 * Get employer branding report
 */
router.get('/org/:orgId/branding-report', auth_1.authenticate, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN']);
        const report = await enterprise_org_service_1.enterpriseOrgService.generateBrandingReport(orgId);
        res.json({
            success: true,
            data: report,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/enterprise/org/:orgId/candidates
 * Search candidates (enterprise feature)
 */
router.get('/org/:orgId/candidates', auth_1.authenticate, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN', 'RECRUITER']);
        const { skills, experienceMin, experienceMax, location, availability } = req.query;
        const candidates = await enterprise_org_service_1.enterpriseOrgService.searchCandidates(orgId, {
            skills: typeof skills === 'string' ? skills.split(',') : undefined,
            experience: experienceMin || experienceMax
                ? {
                    min: Number(experienceMin) || 0,
                    max: Number(experienceMax) || 50,
                }
                : undefined,
            location: typeof location === 'string' ? location : undefined,
            availability: typeof availability === 'string' ? availability : undefined,
        });
        res.json({
            success: true,
            data: candidates,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/enterprise/org/:orgId/jobs
 * Create enterprise job posting
 */
router.post('/org/:orgId/jobs', auth_1.authenticate, [
    (0, express_validator_1.body)('title').isString().notEmpty().trim(),
    (0, express_validator_1.body)('description').isString().notEmpty(),
    (0, express_validator_1.body)('type').optional().isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL', 'INTERNSHIP']),
    (0, express_validator_1.body)('city').optional().isString(),
    (0, express_validator_1.body)('state').optional().isString(),
    (0, express_validator_1.body)('isRemote').optional().isBoolean(),
    (0, express_validator_1.body)('salaryMin').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('salaryMax').optional().isInt({ min: 0 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN', 'RECRUITER']);
        const job = await enterprise_org_service_1.enterpriseOrgService.createEnterpriseJob(orgId, req.user.id, req.body);
        res.status(201).json({
            success: true,
            data: job,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/enterprise/org/:orgId/sso
 * Get SSO configuration
 */
router.get('/org/:orgId/sso', auth_1.authenticate, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER', 'ADMIN']);
        const config = await enterprise_org_service_1.enterpriseOrgService.getSSOConfig(orgId);
        res.json({
            success: true,
            data: config,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/enterprise/org/:orgId/sso
 * Configure SSO
 */
router.post('/org/:orgId/sso', auth_1.authenticate, [
    (0, express_validator_1.body)('provider').isIn(['okta', 'azure', 'google', 'custom']),
    (0, express_validator_1.body)('entityId').isString().notEmpty(),
    (0, express_validator_1.body)('ssoUrl').isURL(),
    (0, express_validator_1.body)('certificate').isString().notEmpty(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { orgId } = req.params;
        await requireOrgRole(req, orgId, ['OWNER']);
        await enterprise_org_service_1.enterpriseOrgService.configureSS(orgId, req.body);
        res.json({
            success: true,
            message: 'SSO configured',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=enterprise.routes.js.map