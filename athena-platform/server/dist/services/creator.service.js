"use strict";
/**
 * Creator Economy Service
 * Handles creator monetization, tips/gifts, and creator fund tracking
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIFT_TYPES = exports.CREATOR_TIERS = void 0;
exports.getCreatorProfile = getCreatorProfile;
exports.enableCreatorMode = enableCreatorMode;
exports.getCreatorTier = getCreatorTier;
exports.sendGift = sendGift;
exports.purchaseGiftBalance = purchaseGiftBalance;
exports.confirmGiftPurchaseFromPaymentIntent = confirmGiftPurchaseFromPaymentIntent;
exports.confirmGiftPurchase = confirmGiftPurchase;
exports.calculateCreatorFundDistribution = calculateCreatorFundDistribution;
exports.getCreatorAnalytics = getCreatorAnalytics;
exports.requestPayout = requestPayout;
exports.generateStripeOnboardingLink = generateStripeOnboardingLink;
exports.generateStripeLoginLink = generateStripeLoginLink;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const stripe_1 = __importDefault(require("stripe"));
const errorHandler_1 = require("../middleware/errorHandler");
const socket_service_1 = require("./socket.service");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});
// ==========================================
// CREATOR TIERS
// ==========================================
exports.CREATOR_TIERS = [
    {
        name: 'Emerging',
        minFollowers: 0,
        revShare: 70,
        benefits: ['Basic analytics', 'Gift receiving'],
    },
    {
        name: 'Rising',
        minFollowers: 1000,
        revShare: 75,
        benefits: ['Advanced analytics', 'Priority support', 'Custom profile badge'],
    },
    {
        name: 'Established',
        minFollowers: 10000,
        revShare: 80,
        benefits: ['Creator fund eligibility', 'Featured placement', 'Early access features'],
    },
    {
        name: 'Partner',
        minFollowers: 50000,
        revShare: 85,
        benefits: ['Dedicated account manager', 'Brand partnerships', 'Custom monetization'],
    },
];
// ==========================================
// GIFT TYPES (Virtual Gifts)
// ==========================================
exports.GIFT_TYPES = {
    SPARK: { id: 'spark', name: 'Spark', value: 1, icon: '✨', description: 'Show some love!' },
    STAR: { id: 'star', name: 'Star', value: 5, icon: '⭐', description: 'You shine bright!' },
    ROCKET: { id: 'rocket', name: 'Rocket', value: 10, icon: '🚀', description: 'To the moon!' },
    CROWN: { id: 'crown', name: 'Crown', value: 25, icon: '👑', description: 'Absolute royalty!' },
    DIAMOND: { id: 'diamond', name: 'Diamond', value: 50, icon: '💎', description: 'Rare and precious!' },
    TROPHY: { id: 'trophy', name: 'Trophy', value: 100, icon: '🏆', description: 'Champion content!' },
};
// 1 gift point = 0.01 units of local currency
const GIFT_POINT_VALUE = 0.01;
const SUPPORTED_GIFT_CURRENCIES = new Set([
    'AUD',
    'USD',
    'SGD',
    'PHP',
    'IDR',
    'THB',
    'VND',
    'MYR',
    'AED',
    'SAR',
    'ZAR',
    'EGP',
]);
async function resolveUserCurrency(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { preferredCurrency: true, region: true },
    });
    const currency = (user?.preferredCurrency || 'AUD').toUpperCase();
    return SUPPORTED_GIFT_CURRENCIES.has(currency) ? currency : 'AUD';
}
// ==========================================
// CREATOR PROFILE MANAGEMENT
// ==========================================
async function getCreatorProfile(userId) {
    const creator = await prisma_1.prisma.creatorProfile.findUnique({
        where: { userId },
        include: {
            user: {
                select: {
                    id: true,
                    displayName: true,
                    avatar: true,
                    headline: true,
                    followers: { select: { id: true } },
                    posts: {
                        select: { viewCount: true, likeCount: true },
                        take: 100,
                    },
                },
            },
        },
    });
    if (!creator)
        return null;
    // Calculate engagement rate
    const posts = creator.user.posts;
    const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
    const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
    const engagementRate = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;
    return {
        ...creator,
        followerCount: creator.user.followers.length,
        engagementRate: Math.round(engagementRate * 100) / 100,
        tier: getCreatorTier(creator.user.followers.length),
    };
}
async function enableCreatorMode(userId, stripeAccountId) {
    // Check if already a creator
    const existing = await prisma_1.prisma.creatorProfile.findUnique({
        where: { userId },
    });
    if (existing) {
        throw new Error('Creator profile already exists');
    }
    // Create Stripe Connect account if not provided
    let accountId = stripeAccountId;
    if (!accountId) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true, lastName: true },
        });
        if (!user)
            throw new Error('User not found');
        const account = await stripe.accounts.create({
            type: 'express',
            email: user.email,
            capabilities: {
                transfers: { requested: true },
            },
            business_profile: {
                name: `${user.firstName} ${user.lastName}`,
                product_description: 'Content creator on ATHENA platform',
            },
        });
        accountId = account.id;
    }
    // Create creator profile
    const creatorProfile = await prisma_1.prisma.creatorProfile.create({
        data: {
            userId,
            stripeAccountId: accountId,
            isMonetized: true,
        },
    });
    // Update user role
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { role: 'CREATOR' },
    });
    logger_1.logger.info('Creator mode enabled', { userId, stripeAccountId: accountId });
    return creatorProfile;
}
function getCreatorTier(followerCount) {
    const sorted = [...exports.CREATOR_TIERS].sort((a, b) => b.minFollowers - a.minFollowers);
    return sorted.find((tier) => followerCount >= tier.minFollowers) || exports.CREATOR_TIERS[0];
}
// ==========================================
// GIFT TRANSACTIONS
// ==========================================
async function sendGift(senderId, receiverId, giftType, message) {
    const gift = exports.GIFT_TYPES[giftType];
    if (!gift) {
        throw new Error('Invalid gift type');
    }
    // Check if receiver is a creator
    const receiverProfile = await prisma_1.prisma.creatorProfile.findUnique({
        where: { userId: receiverId },
        include: { user: { include: { followers: true } } },
    });
    if (!receiverProfile || !receiverProfile.isMonetized) {
        throw new Error('Receiver is not a monetized creator');
    }
    // Get sender's gift balance
    const sender = await prisma_1.prisma.user.findUnique({
        where: { id: senderId },
        select: { giftBalance: true, displayName: true },
    });
    if (!sender || (sender.giftBalance || 0) < gift.value) {
        throw new Error('Insufficient gift balance');
    }
    // Calculate creator's share
    const tier = getCreatorTier(receiverProfile.user.followers.length);
    const creatorShare = Math.floor(gift.value * (tier.revShare / 100));
    const platformShare = gift.value - creatorShare;
    // Perform transaction
    const [transaction] = await prisma_1.prisma.$transaction([
        // Create gift transaction record
        prisma_1.prisma.giftTransaction.create({
            data: {
                senderId,
                receiverId,
                giftType: gift.id,
                giftValue: gift.value,
                creatorShare,
                platformShare,
                message,
            },
        }),
        // Deduct from sender
        prisma_1.prisma.user.update({
            where: { id: senderId },
            data: { giftBalance: { decrement: gift.value } },
        }),
        // Add to creator's earnings
        prisma_1.prisma.creatorProfile.update({
            where: { userId: receiverId },
            data: {
                totalEarnings: { increment: creatorShare },
                pendingPayout: { increment: creatorShare },
            },
        }),
    ]);
    logger_1.logger.info('Gift sent', {
        senderId,
        receiverId,
        giftType: gift.id,
        value: gift.value,
        creatorShare,
    });
    // Send real-time notification to creator
    await (0, socket_service_1.sendNotification)({
        userId: receiverId,
        type: 'GIFT_RECEIVED',
        title: `You received a ${gift.name}!`,
        message: `${(sender.displayName || 'Someone')} sent you a ${gift.icon} ${gift.name} gift!`,
        link: '/dashboard/creator/gifts',
    });
    return {
        transaction,
        gift,
        creatorShare,
        tier,
    };
}
async function purchaseGiftBalance(userId, amount) {
    const currency = await resolveUserCurrency(userId);
    const giftPoints = Math.floor(amount / GIFT_POINT_VALUE);
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
            userId,
            type: 'gift_balance_purchase',
            giftPoints: giftPoints.toString(),
            currency,
        },
    });
    return {
        clientSecret: paymentIntent.client_secret,
        amount,
        giftPoints,
        currency,
    };
}
async function confirmGiftPurchaseFromPaymentIntent(actorUserId, paymentIntent) {
    if (paymentIntent.status !== 'succeeded') {
        throw new errorHandler_1.ApiError(400, 'Payment not completed');
    }
    const paymentIntentId = paymentIntent.id;
    const { userId, giftPoints, type } = paymentIntent.metadata || {};
    if (!userId || userId !== actorUserId) {
        throw new errorHandler_1.ApiError(403, 'Forbidden');
    }
    if (type !== 'gift_balance_purchase') {
        throw new errorHandler_1.ApiError(400, 'Invalid payment intent');
    }
    const points = parseInt(String(giftPoints || '0'), 10);
    if (!Number.isFinite(points) || points <= 0) {
        throw new errorHandler_1.ApiError(400, 'Invalid gift points');
    }
    const amountCents = typeof paymentIntent.amount === 'number' ? paymentIntent.amount : 0;
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new errorHandler_1.ApiError(400, 'Invalid payment amount');
    }
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const existing = await tx.giftBalancePurchase.findUnique({
            where: { paymentIntentId },
        });
        if (existing) {
            return { giftPoints: existing.giftPoints, alreadyProcessed: true };
        }
        await tx.giftBalancePurchase.create({
            data: {
                userId: actorUserId,
                paymentIntentId,
                amountCents,
                giftPoints: points,
            },
        });
        await tx.user.update({
            where: { id: actorUserId },
            data: {
                giftBalance: { increment: points },
            },
        });
        return { giftPoints: points, alreadyProcessed: false };
    });
    logger_1.logger.info('Gift balance purchased', { userId: actorUserId, giftPoints: result.giftPoints, paymentIntentId });
    return result;
}
async function confirmGiftPurchase(actorUserId, paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return confirmGiftPurchaseFromPaymentIntent(actorUserId, paymentIntent);
}
// ==========================================
// CREATOR FUND
// ==========================================
async function calculateCreatorFundDistribution(fundAmount) {
    // Get all eligible creators (Established tier or above)
    const creators = await prisma_1.prisma.creatorProfile.findMany({
        where: {
            isMonetized: true,
            user: {
                followers: {
                // At least 10,000 followers for fund eligibility
                },
            },
        },
        include: {
            user: {
                include: {
                    followers: true,
                    posts: {
                        where: {
                            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                        },
                        select: { viewCount: true, likeCount: true },
                    },
                },
            },
        },
    });
    // Filter to only established+ creators
    const eligibleCreators = creators.filter((c) => c.user.followers.length >= 10000);
    // Calculate engagement scores
    const creatorScores = eligibleCreators.map((creator) => {
        const posts = creator.user.posts;
        const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
        const totalEngagement = posts.reduce((sum, p) => sum + p.likeCount, 0);
        const followers = creator.user.followers.length;
        // Score = sqrt(followers) * engagement_rate * activity_multiplier
        const engagementRate = totalViews > 0 ? totalEngagement / totalViews : 0;
        const activityMultiplier = Math.min(posts.length / 10, 1); // Max 10 posts
        const score = Math.sqrt(followers) * engagementRate * activityMultiplier;
        return {
            creatorId: creator.userId,
            followers,
            posts: posts.length,
            engagementRate,
            score,
        };
    });
    // Calculate total score
    const totalScore = creatorScores.reduce((sum, c) => sum + c.score, 0);
    // Distribute fund proportionally
    const distributions = creatorScores.map((creator) => ({
        ...creator,
        share: totalScore > 0 ? (creator.score / totalScore) * fundAmount : 0,
    }));
    return distributions;
}
// ==========================================
// CREATOR ANALYTICS
// ==========================================
async function getCreatorAnalytics(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [posts, gifts, followers, profile] = await Promise.all([
        // Posts in period
        prisma_1.prisma.post.findMany({
            where: {
                authorId: userId,
                createdAt: { gte: startDate },
            },
            select: {
                id: true,
                type: true,
                viewCount: true,
                likeCount: true,
                commentCount: true,
                shareCount: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        }),
        // Gifts received in period
        prisma_1.prisma.giftTransaction.findMany({
            where: {
                receiverId: userId,
                createdAt: { gte: startDate },
            },
            select: {
                giftValue: true,
                creatorShare: true,
                createdAt: true,
            },
        }),
        // New followers in period
        prisma_1.prisma.follow.findMany({
            where: {
                followingId: userId,
                createdAt: { gte: startDate },
            },
            select: { createdAt: true },
        }),
        // Creator profile
        prisma_1.prisma.creatorProfile.findUnique({
            where: { userId },
            select: {
                totalEarnings: true,
                pendingPayout: true,
            },
        }),
    ]);
    // Calculate metrics
    const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
    const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);
    const totalShares = posts.reduce((sum, p) => sum + p.shareCount, 0);
    const totalGiftValue = gifts.reduce((sum, g) => sum + g.giftValue, 0);
    const totalEarningsFromGifts = gifts.reduce((sum, g) => sum + g.creatorShare, 0);
    // Group by day for charts
    const dailyStats = new Map();
    // Initialize days
    for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const key = date.toISOString().split('T')[0];
        dailyStats.set(key, { views: 0, likes: 0, comments: 0, gifts: 0, followers: 0 });
    }
    // Aggregate post stats
    posts.forEach((post) => {
        const key = post.createdAt.toISOString().split('T')[0];
        const stats = dailyStats.get(key);
        if (stats) {
            stats.views += post.viewCount;
            stats.likes += post.likeCount;
            stats.comments += post.commentCount;
        }
    });
    // Aggregate gift stats
    gifts.forEach((gift) => {
        const key = gift.createdAt.toISOString().split('T')[0];
        const stats = dailyStats.get(key);
        if (stats)
            stats.gifts += gift.giftValue;
    });
    // Aggregate follower stats
    followers.forEach((follow) => {
        const key = follow.createdAt.toISOString().split('T')[0];
        const stats = dailyStats.get(key);
        if (stats)
            stats.followers += 1;
    });
    return {
        summary: {
            totalPosts: posts.length,
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalGiftValue,
            totalEarningsFromGifts,
            newFollowers: followers.length,
            engagementRate: totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0,
        },
        profile: profile || { totalEarnings: 0, pendingPayout: 0 },
        dailyStats: Array.from(dailyStats.entries()).map(([date, stats]) => ({
            date,
            ...stats,
        })),
        topPosts: [...posts]
            .sort((a, b) => (b.viewCount + b.likeCount * 5) - (a.viewCount + a.likeCount * 5))
            .slice(0, 5),
    };
}
// ==========================================
// PAYOUTS
// ==========================================
async function requestPayout(userId) {
    const profile = await prisma_1.prisma.creatorProfile.findUnique({
        where: { userId },
    });
    if (!profile) {
        throw new Error('Creator profile not found');
    }
    const minPayout = 50; // $50 minimum
    const pendingAmount = profile.pendingPayout * GIFT_POINT_VALUE;
    if (pendingAmount < minPayout) {
        throw new Error(`Minimum payout is $${minPayout}. Current pending: $${pendingAmount.toFixed(2)}`);
    }
    if (!profile.stripeAccountId) {
        throw new Error('Stripe account not connected');
    }
    const currency = await resolveUserCurrency(userId);
    // Create payout via Stripe
    const transfer = await stripe.transfers.create({
        amount: Math.floor(pendingAmount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        destination: profile.stripeAccountId,
        metadata: {
            userId,
            type: 'creator_payout',
            currency,
        },
    });
    // Record payout and reset pending
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.creatorPayout.create({
            data: {
                creatorProfileId: profile.id,
                amount: pendingAmount,
                stripeTransferId: transfer.id,
                status: 'PENDING',
            },
        }),
        prisma_1.prisma.creatorProfile.update({
            where: { userId },
            data: { pendingPayout: 0 },
        }),
    ]);
    logger_1.logger.info('Payout requested', { userId, amount: pendingAmount, transferId: transfer.id });
    return {
        amount: pendingAmount,
        transferId: transfer.id,
        status: 'PENDING',
        currency,
    };
}
async function generateStripeOnboardingLink(userId) {
    const profile = await prisma_1.prisma.creatorProfile.findUnique({
        where: { userId },
    });
    if (!profile || !profile.stripeAccountId) {
        throw new Error('Creator profile or Stripe account not found. Enable creator mode first.');
    }
    const accountLink = await stripe.accountLinks.create({
        account: profile.stripeAccountId,
        refresh_url: `${process.env.CLIENT_URL}/dashboard/creator/onboarding-refresh`,
        return_url: `${process.env.CLIENT_URL}/dashboard/creator`,
        type: 'account_onboarding',
    });
    return accountLink.url;
}
async function generateStripeLoginLink(userId) {
    const profile = await prisma_1.prisma.creatorProfile.findUnique({
        where: { userId },
    });
    if (!profile || !profile.stripeAccountId) {
        throw new Error('Creator profile or Stripe account not found.');
    }
    try {
        const loginLink = await stripe.accounts.createLoginLink(profile.stripeAccountId);
        return loginLink.url;
    }
    catch (error) {
        if (error.code === 'account_invalid') {
            throw new Error('Please complete onboarding before accessing the dashboard.');
        }
        throw error;
    }
}
//# sourceMappingURL=creator.service.js.map