"use strict";
/**
 * Payments Routes
 * Multi-provider payment orchestration, creator payouts, regional pricing
 *
 * Uses the available functions from payments-orchestration.service.ts:
 * - getBestProvider
 * - getAvailablePaymentMethods
 * - processPayment
 * - processCreatorPayout
 * - convertCurrency
 * - getRegionalPricing
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const payments_orchestration_service_1 = __importDefault(require("../services/payments-orchestration.service"));
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Supported currencies for validation (must match Currency type in service)
const SUPPORTED_CURRENCIES = [
    'AUD', 'NZD', 'USD', 'GBP', 'EUR', 'SGD', 'PHP', 'INR', 'BRL', 'KES'
];
/**
 * @route GET /api/payments/methods
 * @desc Get available payment methods for user's region
 * @access Private
 */
router.get('/methods', auth_1.authenticate, async (req, res) => {
    try {
        const { region } = req.query;
        const regionCode = region || 'US';
        const methods = payments_orchestration_service_1.default.getAvailablePaymentMethods(regionCode);
        res.json({ methods });
    }
    catch (error) {
        logger_1.logger.error('Failed to get payment methods', { error });
        res.status(500).json({ error: 'Failed to get payment methods' });
    }
});
/**
 * @route GET /api/payments/best-provider
 * @desc Get the best payment provider for a region
 * @access Private
 */
router.get('/best-provider', auth_1.authenticate, async (req, res) => {
    try {
        const { region, paymentType } = req.query;
        const regionCode = region || 'US';
        const provider = payments_orchestration_service_1.default.getBestProvider(regionCode, paymentType);
        res.json({ provider });
    }
    catch (error) {
        logger_1.logger.error('Failed to get best provider', { error });
        res.status(500).json({ error: 'Failed to get best provider' });
    }
});
/**
 * @route GET /api/payments/pricing
 * @desc Get regional pricing for products
 * @access Public
 */
router.get('/pricing', async (req, res) => {
    try {
        const { region } = req.query;
        const regionCode = region || 'US';
        const pricing = payments_orchestration_service_1.default.getRegionalPricing(regionCode);
        res.json(pricing);
    }
    catch (error) {
        logger_1.logger.error('Failed to get pricing', { error });
        res.status(500).json({ error: 'Failed to get pricing' });
    }
});
/**
 * @route POST /api/payments/process
 * @desc Process a payment
 * @access Private
 */
router.post('/process', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, currency, description, paymentMethodId, returnUrl, metadata } = req.body;
        if (!amount || !currency || !description) {
            return res.status(400).json({
                error: 'Amount, currency, and description are required'
            });
        }
        // Validate currency
        if (!SUPPORTED_CURRENCIES.includes(currency)) {
            return res.status(400).json({
                error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
            });
        }
        const result = await payments_orchestration_service_1.default.processPayment({
            userId,
            amount,
            currency,
            description,
            paymentMethodId,
            returnUrl,
            metadata,
        });
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        logger_1.logger.error('Payment processing failed', { error });
        res.status(500).json({ error: 'Payment processing failed' });
    }
});
/**
 * @route POST /api/payments/payout
 * @desc Process a creator payout
 * @access Private (Creator only)
 */
router.post('/payout', auth_1.authenticate, (0, roles_1.requireRole)('CREATOR'), async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, currency, destinationType, destinationId, } = req.body;
        if (!amount || !currency || !destinationType || !destinationId) {
            return res.status(400).json({
                error: 'Amount, currency, destinationType, and destinationId are required'
            });
        }
        // Validate currency
        if (!SUPPORTED_CURRENCIES.includes(currency)) {
            return res.status(400).json({
                error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
            });
        }
        // Validate destination type
        const validDestTypes = ['bank', 'wallet', 'mobile_money'];
        if (!validDestTypes.includes(destinationType)) {
            return res.status(400).json({
                error: `Invalid destinationType. Must be: ${validDestTypes.join(', ')}`
            });
        }
        const result = await payments_orchestration_service_1.default.processCreatorPayout({
            userId,
            amount,
            currency,
            destinationType,
            destinationId,
        });
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        logger_1.logger.error('Payout processing failed', { error });
        res.status(500).json({ error: 'Payout processing failed' });
    }
});
/**
 * @route POST /api/payments/convert
 * @desc Convert currency
 * @access Private
 */
router.post('/convert', auth_1.authenticate, async (req, res) => {
    try {
        const { amount, from, to } = req.body;
        if (!amount || !from || !to) {
            return res.status(400).json({
                error: 'Amount, from currency, and to currency are required'
            });
        }
        // Validate currencies
        if (!SUPPORTED_CURRENCIES.includes(from) || !SUPPORTED_CURRENCIES.includes(to)) {
            return res.status(400).json({
                error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
            });
        }
        const result = payments_orchestration_service_1.default.convertCurrency(amount, from, to);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Currency conversion failed', { error });
        res.status(500).json({ error: 'Currency conversion failed' });
    }
});
/**
 * @route GET /api/payments/currencies
 * @desc Get list of supported currencies
 * @access Public
 */
router.get('/currencies', async (_req, res) => {
    res.json({ currencies: SUPPORTED_CURRENCIES });
});
exports.default = router;
//# sourceMappingURL=payments.routes.js.map