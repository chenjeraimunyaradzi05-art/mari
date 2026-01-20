"use strict";
/**
 * Creator Routes
 * API endpoints for creator economy features
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const creatorService = __importStar(require("../services/creator.service"));
const prisma_1 = require("../utils/prisma");
const router = (0, express_1.Router)();
// ==========================================
// CREATOR PROFILE
// ==========================================
/**
 * GET /api/creator/profile
 * Get current user's creator profile
 */
router.get('/profile', auth_1.authenticate, async (req, res, next) => {
    try {
        const profile = await creatorService.getCreatorProfile(req.user.id);
        res.json({
            success: true,
            data: profile,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/creator/profile/:userId
 * Get a creator's public profile
 */
router.get('/profile/:userId', async (req, res, next) => {
    try {
        const profile = await creatorService.getCreatorProfile(req.params.userId);
        if (!profile) {
            throw new errorHandler_1.ApiError(404, 'Creator profile not found');
        }
        res.json({
            success: true,
            data: {
                userId: profile.userId,
                displayName: profile.user.displayName,
                avatar: profile.user.avatar,
                headline: profile.user.headline,
                followerCount: profile.followerCount,
                tier: profile.tier,
                isMonetized: profile.isMonetized,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/creator/enable
 * Enable creator mode for current user
 */
router.post('/enable', auth_1.authenticate, async (req, res, next) => {
    try {
        const profile = await creatorService.enableCreatorMode(req.user.id);
        res.status(201).json({
            success: true,
            message: 'Creator mode enabled',
            data: profile,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/creator/onboard
 * Generate Stripe Express onboarding link
 */
router.post('/onboard', auth_1.authenticate, async (req, res, next) => {
    try {
        const url = await creatorService.generateStripeOnboardingLink(req.user.id);
        res.json({ success: true, url });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/creator/stripe-login
 * Generate Stripe Express dashboard login link
 */
router.post('/stripe-login', auth_1.authenticate, async (req, res, next) => {
    try {
        const url = await creatorService.generateStripeLoginLink(req.user.id);
        res.json({ success: true, url });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// GIFT SYSTEM
// ==========================================
/**
 * GET /api/creator/gifts
 * Get available gift types
 */
router.get('/gifts', (_req, res) => {
    res.json({
        success: true,
        data: Object.values(creatorService.GIFT_TYPES),
    });
});
/**
 * POST /api/creator/gifts/send
 * Send a gift to a creator
 */
router.post('/gifts/send', auth_1.authenticate, [
    (0, express_validator_1.body)('receiverId').isUUID().withMessage('Valid receiver ID required'),
    (0, express_validator_1.body)('giftType').isString().withMessage('Gift type required'),
    (0, express_validator_1.body)('message').optional().isString().isLength({ max: 200 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
        }
        const { receiverId, giftType, message } = req.body;
        if (receiverId === req.user.id) {
            throw new errorHandler_1.ApiError(400, 'Cannot send gifts to yourself');
        }
        const result = await creatorService.sendGift(req.user.id, receiverId, giftType, message);
        res.json({
            success: true,
            message: `${result.gift.name} sent successfully!`,
            data: {
                transaction: result.transaction,
                creatorShare: result.creatorShare,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/creator/gifts/received
 * Get gifts received by the creator
 */
router.get('/gifts/received', auth_1.authenticate, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const [gifts, total] = await Promise.all([
            prisma_1.prisma.giftTransaction.findMany({
                where: { receiverId: req.user.id },
                include: {
                    sender: {
                        select: { id: true, displayName: true, avatar: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.prisma.giftTransaction.count({
                where: { receiverId: req.user.id },
            }),
        ]);
        res.json({
            success: true,
            data: gifts.map((g) => ({
                ...g,
                giftInfo: creatorService.GIFT_TYPES[g.giftType.toUpperCase()],
            })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/creator/gifts/sent
 * Get gifts sent by the user
 */
router.get('/gifts/sent', auth_1.authenticate, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const [gifts, total] = await Promise.all([
            prisma_1.prisma.giftTransaction.findMany({
                where: { senderId: req.user.id },
                include: {
                    receiver: {
                        select: { id: true, displayName: true, avatar: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.prisma.giftTransaction.count({
                where: { senderId: req.user.id },
            }),
        ]);
        res.json({
            success: true,
            data: gifts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// GIFT BALANCE
// ==========================================
/**
 * GET /api/creator/balance
 * Get user's gift balance
 */
router.get('/balance', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { giftBalance: true },
        });
        res.json({
            success: true,
            data: {
                balance: user?.giftBalance || 0,
                valueAud: (user?.giftBalance || 0) * 0.01,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/creator/balance/purchase
 * Purchase gift balance
 */
router.post('/balance/purchase', auth_1.authenticate, [(0, express_validator_1.body)('amount').isFloat({ min: 5, max: 1000 }).withMessage('Amount must be between $5 and $1000')], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
        }
        const { amount } = req.body;
        const result = await creatorService.purchaseGiftBalance(req.user.id, amount);
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
 * POST /api/creator/balance/purchase/confirm
 * Confirm a completed Stripe payment intent and credit gift points (idempotent)
 */
router.post('/balance/purchase/confirm', auth_1.authenticate, [(0, express_validator_1.body)('paymentIntentId').isString().notEmpty().withMessage('paymentIntentId is required')], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
        }
        const { paymentIntentId } = req.body;
        const result = await creatorService.confirmGiftPurchase(req.user.id, paymentIntentId);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// ANALYTICS
// ==========================================
/**
 * GET /api/creator/analytics
 * Get creator analytics
 */
router.get('/analytics', auth_1.authenticate, [(0, express_validator_1.query)('days').optional().isInt({ min: 7, max: 90 })], async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const analytics = await creatorService.getCreatorAnalytics(req.user.id, days);
        res.json({
            success: true,
            data: analytics,
        });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// TIERS
// ==========================================
/**
 * GET /api/creator/tiers
 * Get creator tiers info
 */
router.get('/tiers', (_req, res) => {
    res.json({
        success: true,
        data: creatorService.CREATOR_TIERS,
    });
});
// ==========================================
// PAYOUTS
// ==========================================
/**
 * GET /api/creator/earnings
 * Get creator earnings summary
 */
router.get('/earnings', auth_1.authenticate, async (req, res, next) => {
    try {
        const profile = await prisma_1.prisma.creatorProfile.findUnique({
            where: { userId: req.user.id },
            include: {
                payouts: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });
        if (!profile) {
            throw new errorHandler_1.ApiError(404, 'Creator profile not found');
        }
        res.json({
            success: true,
            data: {
                totalEarnings: profile.totalEarnings * 0.01,
                pendingPayout: profile.pendingPayout * 0.01,
                recentPayouts: profile.payouts,
                canRequestPayout: profile.pendingPayout * 0.01 >= 50,
                minPayoutAmount: 50,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/creator/payouts/request
 * Request a payout
 */
router.post('/payouts/request', auth_1.authenticate, async (req, res, next) => {
    try {
        const result = await creatorService.requestPayout(req.user.id);
        res.json({
            success: true,
            message: 'Payout requested successfully',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/creator/payouts
 * Get payout history
 */
router.get('/payouts', auth_1.authenticate, async (req, res, next) => {
    try {
        const profile = await prisma_1.prisma.creatorProfile.findUnique({
            where: { userId: req.user.id },
            select: { id: true },
        });
        if (!profile) {
            throw new errorHandler_1.ApiError(404, 'Creator profile not found');
        }
        const payouts = await prisma_1.prisma.creatorPayout.findMany({
            where: { creatorProfileId: profile.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: payouts,
        });
    }
    catch (error) {
        next(error);
    }
});
// ==========================================
// LEADERBOARD
// ==========================================
/**
 * GET /api/creator/leaderboard
 * Get top creators
 */
router.get('/leaderboard', async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe || 'week';
        let startDate;
        switch (timeframe) {
            case 'day':
                startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case 'week':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }
        // Get creators with most engagement in timeframe
        const topCreators = await prisma_1.prisma.user.findMany({
            where: {
                role: 'CREATOR',
                creatorProfile: { isNot: null },
            },
            select: {
                id: true,
                displayName: true,
                avatar: true,
                headline: true,
                _count: {
                    select: {
                        followers: true,
                    },
                },
                posts: {
                    where: { createdAt: { gte: startDate } },
                    select: {
                        viewCount: true,
                        likeCount: true,
                    },
                },
            },
            take: 50,
        });
        // Calculate scores and rank
        const ranked = topCreators
            .map((creator) => {
            const totalViews = creator.posts.reduce((sum, p) => sum + p.viewCount, 0);
            const totalLikes = creator.posts.reduce((sum, p) => sum + p.likeCount, 0);
            const score = totalViews + totalLikes * 5 + creator._count.followers;
            return {
                id: creator.id,
                displayName: creator.displayName,
                avatar: creator.avatar,
                headline: creator.headline,
                followers: creator._count.followers,
                totalViews,
                totalLikes,
                score,
            };
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        res.json({
            success: true,
            data: {
                timeframe,
                creators: ranked.map((c, index) => ({ ...c, rank: index + 1 })),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=creator.routes.js.map