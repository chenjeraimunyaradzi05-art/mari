"use strict";
/**
 * Stripe Connect Service
 * Multi-party payouts for Mentors and Creators
 * Phase 2: Backend Logic & Integrations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeConnectService = void 0;
exports.createConnectedAccount = createConnectedAccount;
exports.getOnboardingLink = getOnboardingLink;
exports.getAccountStatus = getAccountStatus;
exports.createEscrowPayment = createEscrowPayment;
exports.captureEscrowPayment = captureEscrowPayment;
exports.cancelEscrowPayment = cancelEscrowPayment;
exports.getEarningsDashboard = getEarningsDashboard;
exports.createPayout = createPayout;
const stripe_1 = __importDefault(require("stripe"));
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
    ? new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
    : null;
// Platform fee percentage (e.g., 15% of mentor/creator earnings)
const PLATFORM_FEE_PERCENT = 15;
/**
 * Create a Stripe Connect Express account for mentor/creator
 */
async function createConnectedAccount(input) {
    if (!stripe) {
        logger_1.logger.warn('Stripe not configured, returning mock account');
        return {
            accountId: `acct_mock_${input.userId}`,
            onboardingUrl: `${process.env.CLIENT_URL}/dashboard/payments/mock-onboarding`,
        };
    }
    try {
        // Create the Express connected account
        const account = await stripe.accounts.create({
            type: 'express',
            country: input.country,
            email: input.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            business_type: input.businessType || 'individual',
            metadata: {
                userId: input.userId,
                accountType: input.type,
            },
        });
        // Store the connected account ID in the database
        await prisma_1.prisma.user.update({
            where: { id: input.userId },
            data: {
                stripeConnectAccountId: account.id,
                stripeConnectStatus: 'PENDING',
            },
        });
        // Create the account onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.CLIENT_URL}/dashboard/payments/refresh`,
            return_url: `${process.env.CLIENT_URL}/dashboard/payments/success`,
            type: 'account_onboarding',
        });
        logger_1.logger.info('Created Stripe Connect account', { userId: input.userId, accountId: account.id });
        return {
            accountId: account.id,
            onboardingUrl: accountLink.url,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to create Stripe Connect account', { error, userId: input.userId });
        throw new errorHandler_1.ApiError(500, 'Failed to create payment account');
    }
}
/**
 * Get onboarding link for existing connected account
 */
async function getOnboardingLink(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { stripeConnectAccountId: true },
    });
    if (!user?.stripeConnectAccountId) {
        throw new errorHandler_1.ApiError(404, 'No connected account found');
    }
    if (!stripe) {
        return `${process.env.CLIENT_URL}/dashboard/payments/mock-onboarding`;
    }
    const accountLink = await stripe.accountLinks.create({
        account: user.stripeConnectAccountId,
        refresh_url: `${process.env.CLIENT_URL}/dashboard/payments/refresh`,
        return_url: `${process.env.CLIENT_URL}/dashboard/payments/success`,
        type: 'account_onboarding',
    });
    return accountLink.url;
}
/**
 * Check if connected account is fully onboarded
 */
async function getAccountStatus(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { stripeConnectAccountId: true, stripeConnectStatus: true },
    });
    if (!user?.stripeConnectAccountId) {
        return {
            isOnboarded: false,
            payoutsEnabled: false,
            chargesEnabled: false,
        };
    }
    if (!stripe) {
        // Mock response for development
        return {
            isOnboarded: true,
            payoutsEnabled: true,
            chargesEnabled: true,
        };
    }
    try {
        const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
        const isOnboarded = account.details_submitted || false;
        const payoutsEnabled = account.payouts_enabled || false;
        const chargesEnabled = account.charges_enabled || false;
        // Update local status
        const newStatus = isOnboarded
            ? payoutsEnabled
                ? 'ACTIVE'
                : 'RESTRICTED'
            : 'PENDING';
        if (user.stripeConnectStatus !== newStatus) {
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: { stripeConnectStatus: newStatus },
            });
        }
        return {
            isOnboarded,
            payoutsEnabled,
            chargesEnabled,
            requirements: account.requirements?.currently_due || [],
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to get account status', { error, userId });
        throw new errorHandler_1.ApiError(500, 'Failed to check account status');
    }
}
/**
 * Create an escrow-style payment (hold funds until service delivered)
 * Uses PaymentIntents with manual capture for mentor sessions
 */
async function createEscrowPayment(input) {
    const seller = await prisma_1.prisma.user.findUnique({
        where: { id: input.sellerId },
        select: { stripeConnectAccountId: true, stripeConnectStatus: true },
    });
    if (!seller?.stripeConnectAccountId) {
        throw new errorHandler_1.ApiError(400, 'Seller has not set up payment account');
    }
    if (seller.stripeConnectStatus !== 'ACTIVE') {
        throw new errorHandler_1.ApiError(400, 'Seller payment account is not fully verified');
    }
    const platformFee = Math.round(input.amount * (PLATFORM_FEE_PERCENT / 100));
    if (!stripe) {
        // Mock response for development
        const mockId = `pi_mock_${Date.now()}`;
        // Store mock escrow record
        await prisma_1.prisma.escrowPayment.create({
            data: {
                paymentIntentId: mockId,
                buyerId: input.buyerId,
                sellerId: input.sellerId,
                amount: input.amount,
                platformFee,
                currency: input.currency,
                status: 'PENDING',
                description: input.description,
                sessionType: input.sessionType || 'mentor_session',
                metadata: input.metadata || {},
            },
        });
        return {
            paymentIntentId: mockId,
            clientSecret: `${mockId}_secret_mock`,
            amount: input.amount,
            platformFee,
        };
    }
    try {
        // Create payment intent with manual capture (escrow)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: input.amount,
            currency: input.currency,
            capture_method: 'manual', // Don't capture immediately - hold in escrow
            application_fee_amount: platformFee,
            transfer_data: {
                destination: seller.stripeConnectAccountId,
            },
            metadata: {
                buyerId: input.buyerId,
                sellerId: input.sellerId,
                sessionType: input.sessionType || 'mentor_session',
                ...input.metadata,
            },
            description: input.description,
        });
        // Store escrow record in database
        await prisma_1.prisma.escrowPayment.create({
            data: {
                paymentIntentId: paymentIntent.id,
                buyerId: input.buyerId,
                sellerId: input.sellerId,
                amount: input.amount,
                platformFee,
                currency: input.currency,
                status: 'PENDING',
                description: input.description,
                sessionType: input.sessionType || 'mentor_session',
                metadata: input.metadata || {},
            },
        });
        logger_1.logger.info('Created escrow payment', {
            paymentIntentId: paymentIntent.id,
            buyerId: input.buyerId,
            sellerId: input.sellerId,
            amount: input.amount,
        });
        return {
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            amount: input.amount,
            platformFee,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to create escrow payment', { error, input });
        throw new errorHandler_1.ApiError(500, 'Failed to create payment');
    }
}
/**
 * Capture escrowed payment (release funds to seller after service delivered)
 */
async function captureEscrowPayment(paymentIntentId) {
    const escrow = await prisma_1.prisma.escrowPayment.findUnique({
        where: { paymentIntentId },
    });
    if (!escrow) {
        throw new errorHandler_1.ApiError(404, 'Escrow payment not found');
    }
    if (escrow.status !== 'PENDING' && escrow.status !== 'AUTHORIZED') {
        throw new errorHandler_1.ApiError(400, `Cannot capture payment in ${escrow.status} status`);
    }
    if (!stripe) {
        // Mock capture
        await prisma_1.prisma.escrowPayment.update({
            where: { paymentIntentId },
            data: { status: 'CAPTURED', capturedAt: new Date() },
        });
        return {
            status: 'captured',
            amountCaptured: escrow.amount,
        };
    }
    try {
        const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
        await prisma_1.prisma.escrowPayment.update({
            where: { paymentIntentId },
            data: { status: 'CAPTURED', capturedAt: new Date() },
        });
        logger_1.logger.info('Captured escrow payment', { paymentIntentId, amount: escrow.amount });
        return {
            status: paymentIntent.status,
            amountCaptured: paymentIntent.amount_received,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to capture escrow payment', { error, paymentIntentId });
        throw new errorHandler_1.ApiError(500, 'Failed to capture payment');
    }
}
/**
 * Cancel/refund escrowed payment (if service not delivered or disputed)
 */
async function cancelEscrowPayment(paymentIntentId, reason) {
    const escrow = await prisma_1.prisma.escrowPayment.findUnique({
        where: { paymentIntentId },
    });
    if (!escrow) {
        throw new errorHandler_1.ApiError(404, 'Escrow payment not found');
    }
    if (escrow.status === 'REFUNDED' || escrow.status === 'CANCELED') {
        throw new errorHandler_1.ApiError(400, 'Payment already canceled or refunded');
    }
    if (!stripe) {
        await prisma_1.prisma.escrowPayment.update({
            where: { paymentIntentId },
            data: { status: 'CANCELED', canceledAt: new Date(), cancelReason: reason },
        });
        return { status: 'canceled' };
    }
    try {
        // If captured, refund; if not captured, cancel
        if (escrow.status === 'CAPTURED') {
            await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reason: 'requested_by_customer',
            });
            await prisma_1.prisma.escrowPayment.update({
                where: { paymentIntentId },
                data: { status: 'REFUNDED', canceledAt: new Date(), cancelReason: reason },
            });
            return { status: 'refunded' };
        }
        else {
            await stripe.paymentIntents.cancel(paymentIntentId);
            await prisma_1.prisma.escrowPayment.update({
                where: { paymentIntentId },
                data: { status: 'CANCELED', canceledAt: new Date(), cancelReason: reason },
            });
            return { status: 'canceled' };
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to cancel escrow payment', { error, paymentIntentId });
        throw new errorHandler_1.ApiError(500, 'Failed to cancel payment');
    }
}
/**
 * Get seller's earnings dashboard data
 */
async function getEarningsDashboard(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { stripeConnectAccountId: true },
    });
    // Get escrow payments where user is seller
    const escrowPayments = await prisma_1.prisma.escrowPayment.findMany({
        where: { sellerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
    const totalEarnings = escrowPayments
        .filter((p) => p.status === 'CAPTURED')
        .reduce((sum, p) => sum + (p.amount - p.platformFee), 0);
    const pendingPayouts = escrowPayments
        .filter((p) => p.status === 'PENDING' || p.status === 'AUTHORIZED')
        .reduce((sum, p) => sum + (p.amount - p.platformFee), 0);
    let availableBalance = 0;
    if (stripe && user?.stripeConnectAccountId) {
        try {
            const balance = await stripe.balance.retrieve({
                stripeAccount: user.stripeConnectAccountId,
            });
            availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0);
        }
        catch (error) {
            logger_1.logger.warn('Failed to fetch Stripe balance', { error, userId });
        }
    }
    return {
        totalEarnings,
        pendingPayouts,
        availableBalance,
        recentTransactions: escrowPayments.map((p) => ({
            id: p.id,
            amount: p.amount - p.platformFee,
            status: p.status,
            description: p.description,
            createdAt: p.createdAt,
            capturedAt: p.capturedAt,
        })),
    };
}
/**
 * Initiate manual payout to connected account
 */
async function createPayout(input) {
    if (!stripe) {
        return { payoutId: `po_mock_${Date.now()}`, status: 'pending' };
    }
    try {
        const payout = await stripe.payouts.create({
            amount: input.amount,
            currency: input.currency,
            description: input.description,
        }, {
            stripeAccount: input.connectedAccountId,
        });
        return { payoutId: payout.id, status: payout.status };
    }
    catch (error) {
        logger_1.logger.error('Failed to create payout', { error, input });
        throw new errorHandler_1.ApiError(500, 'Failed to create payout');
    }
}
exports.stripeConnectService = {
    createConnectedAccount,
    getOnboardingLink,
    getAccountStatus,
    createEscrowPayment,
    captureEscrowPayment,
    cancelEscrowPayment,
    getEarningsDashboard,
    createPayout,
};
//# sourceMappingURL=stripe-connect.service.js.map