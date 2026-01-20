"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_1 = __importDefault(require("stripe"));
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const regions_1 = require("../config/regions");
const region_1 = require("../utils/region");
const router = (0, express_1.Router)();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});
const VALID_TIERS = [
    'PREMIUM_CAREER',
    'PREMIUM_PROFESSIONAL',
    'PREMIUM_ENTREPRENEUR',
    'PREMIUM_CREATOR',
];
// Price IDs for subscription tiers are resolved per currency in config/regions.ts
// ===========================================
// GET CURRENT SUBSCRIPTION
// ===========================================
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const subscription = await prisma_1.prisma.subscription.findUnique({
            where: { userId: req.user.id },
        });
        if (!subscription) {
            throw new errorHandler_1.ApiError(404, 'Subscription not found');
        }
        res.json({
            success: true,
            data: subscription,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CREATE CHECKOUT SESSION
// ===========================================
router.post('/checkout', auth_1.authenticate, async (req, res, next) => {
    try {
        const { tier } = req.body;
        if (!tier || !VALID_TIERS.includes(tier)) {
            throw new errorHandler_1.ApiError(400, 'Invalid subscription tier');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { subscription: true },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        // Get or create Stripe customer
        let customerId = user.subscription?.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                metadata: {
                    userId: user.id,
                },
            });
            customerId = customer.id;
            // Save customer ID
            await prisma_1.prisma.subscription.update({
                where: { userId: user.id },
                data: { stripeCustomerId: customerId },
            });
        }
        const currency = (0, region_1.getCurrencyForUser)(user);
        const priceId = (0, regions_1.getPriceIdForTier)(tier, currency);
        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
            metadata: {
                userId: user.id,
                tier,
                currency,
            },
        });
        res.json({
            success: true,
            data: {
                sessionId: session.id,
                url: session.url,
                currency,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CREATE CUSTOMER PORTAL SESSION
// ===========================================
router.post('/portal', auth_1.authenticate, async (req, res, next) => {
    try {
        const subscription = await prisma_1.prisma.subscription.findUnique({
            where: { userId: req.user.id },
        });
        if (!subscription?.stripeCustomerId) {
            throw new errorHandler_1.ApiError(400, 'No Stripe customer found');
        }
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: `${process.env.CLIENT_URL}/settings/billing`,
        });
        res.json({
            success: true,
            data: {
                url: session.url,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CANCEL SUBSCRIPTION
// ===========================================
router.post('/cancel', auth_1.authenticate, async (req, res, next) => {
    try {
        const subscription = await prisma_1.prisma.subscription.findUnique({
            where: { userId: req.user.id },
        });
        if (!subscription?.stripeSubscriptionId) {
            throw new errorHandler_1.ApiError(400, 'No active subscription found');
        }
        // Cancel at period end
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });
        await prisma_1.prisma.subscription.update({
            where: { userId: req.user.id },
            data: { cancelAtPeriodEnd: true },
        });
        res.json({
            success: true,
            message: 'Subscription will be canceled at end of billing period',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=subscription.routes.js.map