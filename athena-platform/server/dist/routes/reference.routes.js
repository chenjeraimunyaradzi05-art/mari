"use strict";
/**
 * Reference Check Routes
 * API endpoints for reference requests and responses
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reference_check_service_1 = require("../services/reference-check.service");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// ==========================================
// CANDIDATE ROUTES
// ==========================================
/**
 * @route POST /api/references/request
 * @desc Create a reference request
 * @access Private
 */
router.post('/request', auth_1.authenticate, async (req, res, next) => {
    try {
        const { applicationId, refereeEmail, refereeName, refereeTitle, refereeCompany, relationship, type, customQuestions, } = req.body;
        if (!refereeEmail || !refereeName || !relationship || !type) {
            throw new errorHandler_1.ApiError(400, 'refereeEmail, refereeName, relationship, and type are required');
        }
        const request = await reference_check_service_1.referenceCheckService.createReferenceRequest({
            candidateId: req.user.id,
            applicationId,
            refereeEmail,
            refereeName,
            refereeTitle,
            refereeCompany,
            relationship,
            type,
            customQuestions,
        });
        res.json({
            success: true,
            data: request,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/references/batch
 * @desc Send batch reference requests
 * @access Private
 */
router.post('/batch', auth_1.authenticate, async (req, res, next) => {
    try {
        const { referees, applicationId } = req.body;
        if (!referees || !Array.isArray(referees) || referees.length === 0) {
            throw new errorHandler_1.ApiError(400, 'referees array is required');
        }
        const result = await reference_check_service_1.referenceCheckService.batchSendReferenceRequests(req.user.id, referees, applicationId);
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
 * @route POST /api/references/:referenceId/send
 * @desc Send reference request email
 * @access Private
 */
router.post('/:referenceId/send', auth_1.authenticate, async (req, res, next) => {
    try {
        const { referenceId } = req.params;
        const success = await reference_check_service_1.referenceCheckService.sendReferenceRequest(referenceId);
        res.json({
            success,
            message: success ? 'Reference request sent' : 'Failed to send reference request',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/references/summary
 * @desc Get reference summary for current user
 * @access Private
 */
router.get('/summary', auth_1.authenticate, async (req, res, next) => {
    try {
        const summary = await reference_check_service_1.referenceCheckService.getCandidateReferenceSummary(req.user.id);
        res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/references/application/:applicationId
 * @desc Get references for a job application
 * @access Private
 */
router.get('/application/:applicationId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { applicationId } = req.params;
        const references = await reference_check_service_1.referenceCheckService.getApplicationReferences(applicationId);
        res.json({
            success: true,
            data: references,
        });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// REFEREE ROUTES (Public with token)
// ==========================================
/**
 * @route GET /api/references/form/:token
 * @desc Get reference form by token (for referee)
 * @access Public
 */
router.get('/form/:token', async (req, res, next) => {
    try {
        const { token } = req.params;
        const data = await reference_check_service_1.referenceCheckService.getReferenceByToken(token);
        if (data.expired) {
            throw new errorHandler_1.ApiError(410, 'This reference request has expired');
        }
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/references/form/:token/submit
 * @desc Submit reference response
 * @access Public
 */
router.post('/form/:token/submit', async (req, res, next) => {
    try {
        const { token } = req.params;
        const { answers, overallRating, wouldRecommend, additionalComments } = req.body;
        if (!answers || !Array.isArray(answers)) {
            throw new errorHandler_1.ApiError(400, 'answers array is required');
        }
        if (typeof wouldRecommend !== 'boolean') {
            throw new errorHandler_1.ApiError(400, 'wouldRecommend is required');
        }
        const success = await reference_check_service_1.referenceCheckService.submitReferenceResponse(token, {
            answers,
            overallRating,
            wouldRecommend,
            additionalComments,
            submittedAt: new Date(),
        });
        res.json({
            success,
            message: 'Thank you for submitting your reference',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/references/form/:token/decline
 * @desc Decline reference request
 * @access Public
 */
router.post('/form/:token/decline', async (req, res, next) => {
    try {
        const { token } = req.params;
        const { reason } = req.body;
        const success = await reference_check_service_1.referenceCheckService.declineReferenceRequest(token, reason);
        res.json({
            success,
            message: 'Reference request declined',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=reference.routes.js.map