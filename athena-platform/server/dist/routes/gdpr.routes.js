"use strict";
/**
 * GDPR & Privacy Routes
 * Handles DSAR requests, consent management, and privacy controls
 * Phase 4: UK/EU Market Launch
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gdpr_service_1 = require("../services/gdpr.service");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// DSAR (Data Subject Access Request) Endpoints
// ============================================
/**
 * GET /api/gdpr/dsar
 * Get user's DSAR request history
 */
router.get('/dsar', async (req, res) => {
    try {
        const userId = req.user.id;
        const requests = await gdpr_service_1.gdprService.getDSARRequests(userId);
        res.json({ success: true, data: requests });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/gdpr/dsar/export
 * Request data export (Right of Access)
 */
router.post('/dsar/export', async (req, res) => {
    try {
        const userId = req.user.id;
        const dsar = await gdpr_service_1.gdprService.createDSARRequest({
            userId,
            type: client_1.DSARType.EXPORT,
            requestDetails: 'User-initiated data export request',
        });
        // Process immediately for small datasets (in production, queue for async processing)
        const exportData = await gdpr_service_1.gdprService.processExportRequest(dsar.id);
        res.json({
            success: true,
            message: 'Your data export has been initiated. You will receive an email when it is ready.',
            data: {
                requestId: dsar.id,
                status: 'COMPLETED',
                downloadUrl: `/api/gdpr/download/${dsar.id}`,
                expiresAt: dsar.exportExpiresAt,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/gdpr/dsar/delete
 * Request account deletion (Right to be Forgotten)
 */
router.post('/dsar/delete', async (req, res) => {
    try {
        const userId = req.user.id;
        const { confirmation, reason } = req.body;
        if (confirmation !== 'DELETE_MY_ACCOUNT') {
            return res.status(400).json({
                success: false,
                error: 'Please confirm deletion by providing confirmation: "DELETE_MY_ACCOUNT"',
            });
        }
        const dsar = await gdpr_service_1.gdprService.createDSARRequest({
            userId,
            type: client_1.DSARType.DELETION,
            requestDetails: reason || 'User-initiated account deletion',
        });
        res.json({
            success: true,
            message: 'Your deletion request has been received. Your account will be deleted within 30 days.',
            data: {
                requestId: dsar.id,
                status: 'PENDING',
                dueDate: dsar.dueDate,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/gdpr/dsar/rectify
 * Request data correction (Right to Rectification)
 */
router.post('/dsar/rectify', async (req, res) => {
    try {
        const userId = req.user.id;
        const { corrections } = req.body;
        if (!corrections || Object.keys(corrections).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide corrections object with fields to update',
            });
        }
        const dsar = await gdpr_service_1.gdprService.createDSARRequest({
            userId,
            type: client_1.DSARType.RECTIFICATION,
            requestDetails: JSON.stringify(corrections),
        });
        await gdpr_service_1.gdprService.processRectificationRequest(dsar.id, corrections);
        res.json({
            success: true,
            message: 'Your data has been corrected.',
            data: { requestId: dsar.id },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/gdpr/dsar/restrict
 * Request processing restriction (Right to Restriction)
 */
router.post('/dsar/restrict', async (req, res) => {
    try {
        const userId = req.user.id;
        const { processingTypes, reason } = req.body;
        const dsar = await gdpr_service_1.gdprService.createDSARRequest({
            userId,
            type: client_1.DSARType.RESTRICTION,
            requestDetails: JSON.stringify({ processingTypes, reason }),
        });
        res.json({
            success: true,
            message: 'Your restriction request has been received and will be processed.',
            data: { requestId: dsar.id },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/gdpr/download/:requestId
 * Download exported data
 */
router.get('/download/:requestId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;
        // Verify request belongs to user and is valid
        const dsar = await gdpr_service_1.gdprService.getDSARRequest(requestId);
        if (!dsar || dsar.userId !== userId) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        if (dsar.exportExpiresAt && new Date() > dsar.exportExpiresAt) {
            return res.status(410).json({ success: false, error: 'Download link has expired' });
        }
        // In production, this would stream from S3/storage
        const exportData = await gdpr_service_1.gdprService.processExportRequest(requestId);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="athena-data-export-${requestId}.json"`);
        res.json(exportData);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// Consent Management Endpoints
// ============================================
/**
 * GET /api/gdpr/consents
 * Get all user consents
 */
router.get('/consents', async (req, res) => {
    try {
        const userId = req.user.id;
        const consents = await gdpr_service_1.gdprService.getUserConsents(userId);
        // Return structured consent state
        const consentState = {};
        for (const consent of consents) {
            consentState[consent.consentType] = consent.status === 'GRANTED';
        }
        res.json({ success: true, data: consentState });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * PUT /api/gdpr/consents
 * Update user consents (bulk update)
 */
router.put('/consents', async (req, res) => {
    try {
        const userId = req.user.id;
        const { consents } = req.body;
        if (!Array.isArray(consents)) {
            return res.status(400).json({
                success: false,
                error: 'Consents must be an array of {type, granted} objects',
            });
        }
        const context = {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            region: req.headers['cf-ipcountry'] || 'UNKNOWN',
        };
        await gdpr_service_1.gdprService.bulkUpdateConsents(userId, consents, context);
        res.json({ success: true, message: 'Consents updated successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/gdpr/consents/:type
 * Update single consent
 */
router.post('/consents/:type', async (req, res) => {
    try {
        const userId = req.user.id;
        const consentType = req.params.type;
        const { granted } = req.body;
        if (typeof granted !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Please provide granted: true or false',
            });
        }
        const context = {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            region: req.headers['cf-ipcountry'] || 'UNKNOWN',
        };
        const consent = await gdpr_service_1.gdprService.recordConsent(userId, consentType, granted, context);
        res.json({ success: true, data: consent });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// Cookie Consent Endpoints (Public - no auth required for initial consent)
// ============================================
/**
 * GET /api/gdpr/cookies/:visitorId
 * Get cookie preferences for visitor
 */
router.get('/cookies/:visitorId', async (req, res) => {
    try {
        const { visitorId } = req.params;
        const consent = await gdpr_service_1.gdprService.getCookieConsent(visitorId);
        if (!consent) {
            return res.json({
                success: true,
                data: {
                    essential: true,
                    analytics: false,
                    marketing: false,
                    functional: false,
                    hasConsented: false,
                },
            });
        }
        res.json({
            success: true,
            data: {
                essential: consent.essential,
                analytics: consent.analytics,
                marketing: consent.marketing,
                functional: consent.functional,
                hasConsented: true,
                consentedAt: consent.consentedAt,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/gdpr/cookies
 * Record cookie consent
 */
router.post('/cookies', async (req, res) => {
    try {
        const { visitorId, analytics, marketing, functional } = req.body;
        if (!visitorId) {
            return res.status(400).json({
                success: false,
                error: 'visitorId is required',
            });
        }
        const context = {
            userId: req.user?.id,
            ipAddress: req.ip,
            region: req.headers['cf-ipcountry'] || 'UNKNOWN',
        };
        const consent = await gdpr_service_1.gdprService.recordCookieConsent(visitorId, {
            analytics: analytics ?? false,
            marketing: marketing ?? false,
            functional: functional ?? false,
        }, context);
        res.json({ success: true, data: consent });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// Privacy Information Endpoints
// ============================================
/**
 * GET /api/gdpr/data-categories
 * Get data categories we process (for transparency)
 */
router.get('/data-categories', async (_req, res) => {
    const categories = gdpr_service_1.gdprService.getDataClassification();
    res.json({ success: true, data: categories });
});
/**
 * GET /api/gdpr/retention-policies
 * Get data retention policies (for transparency)
 */
router.get('/retention-policies', async (_req, res) => {
    const policies = [
        { dataType: 'Account Data', retention: 'Until account deletion', basis: 'Contract' },
        { dataType: 'Messages', retention: '3 years', basis: 'Legitimate Interest' },
        { dataType: 'Audit Logs', retention: '7 years', basis: 'Legal Obligation' },
        { dataType: 'Payment Records', retention: '7 years', basis: 'Legal Obligation' },
        { dataType: 'Marketing Data', retention: '2 years from last interaction', basis: 'Consent' },
        { dataType: 'Analytics Data', retention: '26 months', basis: 'Legitimate Interest' },
    ];
    res.json({ success: true, data: policies });
});
exports.default = router;
//# sourceMappingURL=gdpr.routes.js.map