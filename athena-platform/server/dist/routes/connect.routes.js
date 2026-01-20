"use strict";
/**
 * Stripe Connect Routes
 * API endpoints for multi-party payments and payouts
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_connect_service_1 = require("../services/stripe-connect.service");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
/**
 * @route POST /api/connect/account
 * @desc Create a connected account for a mentor/creator
 * @access Private (Mentor/Creator)
 */
router.post('/account', auth_1.authenticate, async (req, res, next) => {
    try {
        const { type = 'express', businessType, metadata } = req.body;
        const account = await stripe_connect_service_1.stripeConnectService.createConnectedAccount(req.user.id, type, {
            email: req.user.email,
            businessType,
            metadata,
        });
        res.json({
            success: true,
            data: account,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/connect/account/onboarding
 * @desc Generate onboarding link for connected account
 * @access Private
 */
router.post('/account/onboarding', auth_1.authenticate, async (req, res, next) => {
    try {
        const { returnUrl, refreshUrl } = req.body;
        const onboardingLink = await stripe_connect_service_1.stripeConnectService.createOnboardingLink(req.user.id, returnUrl || `${process.env.CLIENT_URL}/settings/payments`, refreshUrl || `${process.env.CLIENT_URL}/settings/payments?refresh=true`);
        res.json({
            success: true,
            data: { url: onboardingLink },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/connect/account
 * @desc Get connected account details
 * @access Private
 */
router.get('/account', auth_1.authenticate, async (req, res, next) => {
    try {
        const account = await stripe_connect_service_1.stripeConnectService.getConnectedAccount(req.user.id);
        res.json({
            success: true,
            data: account,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/connect/escrow
 * @desc Create an escrow payment (mentor session, course, etc.)
 * @access Private
 */
router.post('/escrow', auth_1.authenticate, async (req, res, next) => {
    try {
        const { recipientId, amount, currency, metadata, description } = req.body;
        if (!recipientId || !amount) {
            throw new errorHandler_1.ApiError(400, 'recipientId and amount are required');
        }
        const escrowPayment = await stripe_connect_service_1.stripeConnectService.createEscrowPayment({
            payerId: req.user.id,
            recipientId,
            amount,
            currency: currency || 'usd',
            metadata,
            description,
        });
        res.json({
            success: true,
            data: escrowPayment,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/connect/escrow/:paymentId/capture
 * @desc Capture an escrow payment (release funds to recipient)
 * @access Private
 */
router.post('/escrow/:paymentId/capture', auth_1.authenticate, async (req, res, next) => {
    try {
        const { paymentId } = req.params;
        const result = await stripe_connect_service_1.stripeConnectService.captureEscrowPayment(paymentId);
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
 * @route POST /api/connect/escrow/:paymentId/cancel
 * @desc Cancel an escrow payment (refund to payer)
 * @access Private
 */
router.post('/escrow/:paymentId/cancel', auth_1.authenticate, async (req, res, next) => {
    try {
        const { paymentId } = req.params;
        const { reason } = req.body;
        const result = await stripe_connect_service_1.stripeConnectService.cancelEscrowPayment(paymentId, reason);
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
 * @route GET /api/connect/earnings
 * @desc Get earnings dashboard for connected account
 * @access Private (Mentor/Creator)
 */
router.get('/earnings', auth_1.authenticate, async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const earnings = await stripe_connect_service_1.stripeConnectService.getEarningsDashboard(req.user.id, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json({
            success: true,
            data: earnings,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/connect/payout
 * @desc Request a payout to bank account
 * @access Private (Mentor/Creator)
 */
router.post('/payout', auth_1.authenticate, async (req, res, next) => {
    try {
        const { amount, currency } = req.body;
        if (!amount) {
            throw new errorHandler_1.ApiError(400, 'amount is required');
        }
        const payout = await stripe_connect_service_1.stripeConnectService.createPayout(req.user.id, amount, currency || 'usd');
        res.json({
            success: true,
            data: payout,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=connect.routes.js.map