"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIFT_CATALOG = void 0;
exports.createStreamKey = createStreamKey;
exports.validateStreamKey = validateStreamKey;
exports.revokeStreamKey = revokeStreamKey;
exports.startLiveStream = startLiveStream;
exports.endLiveStream = endLiveStream;
exports.updateViewerCount = updateViewerCount;
exports.getLiveStreams = getLiveStreams;
exports.getWalletBalance = getWalletBalance;
exports.purchaseCoins = purchaseCoins;
exports.sendGift = sendGift;
exports.getStreamGifts = getStreamGifts;
exports.requestPayout = requestPayout;
exports.processEarningsToAvailable = processEarningsToAvailable;
exports.getGiftLeaderboard = getGiftLeaderboard;
/**
 * Live Streaming Service
 * Handles stream key generation, RTMP management, and live gifting
 */
const prisma_1 = require("../utils/prisma");
const crypto_1 = require("crypto");
const logger_1 = require("../utils/logger");
const event_stream_1 = require("../utils/event-stream");
// ==========================================
// GIFT CATALOG
// ==========================================
exports.GIFT_CATALOG = [
    { id: 'heart', name: 'Heart', icon: '❤️', coinCost: 1, dollarValue: 0.01, animation: 'float' },
    { id: 'star', name: 'Star', icon: '⭐', coinCost: 5, dollarValue: 0.05, animation: 'sparkle' },
    { id: 'crown', name: 'Crown', icon: '👑', coinCost: 10, dollarValue: 0.10, animation: 'bounce' },
    { id: 'rocket', name: 'Rocket', icon: '🚀', coinCost: 50, dollarValue: 0.50, animation: 'fly' },
    { id: 'diamond', name: 'Diamond', icon: '💎', coinCost: 100, dollarValue: 1.00, animation: 'shine' },
    { id: 'trophy', name: 'Trophy', icon: '🏆', coinCost: 500, dollarValue: 5.00, animation: 'celebration' },
    { id: 'unicorn', name: 'Unicorn', icon: '🦄', coinCost: 1000, dollarValue: 10.00, animation: 'magic' },
    { id: 'galaxy', name: 'Galaxy', icon: '🌌', coinCost: 5000, dollarValue: 50.00, animation: 'cosmic' },
];
// ==========================================
// STREAM KEY MANAGEMENT
// ==========================================
function generateStreamKey() {
    const random = (0, crypto_1.randomBytes)(16).toString('hex');
    const timestamp = Date.now().toString(36);
    return `live_${timestamp}_${random}`;
}
function hashStreamKey(key) {
    return (0, crypto_1.createHash)('sha256').update(key).digest('hex');
}
async function createStreamKey(userId) {
    // Check if user is eligible (must be a verified creator)
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            isCreator: true,
            creatorStatus: true,
            trustScore: true,
        },
    });
    if (!user) {
        throw new Error('User not found');
    }
    if (!user.isCreator) {
        throw new Error('User is not a creator. Apply for creator status first.');
    }
    if ((user.trustScore || 0) < 30) {
        throw new Error('Trust score too low for live streaming');
    }
    // Revoke any existing active stream keys
    await prisma_1.prisma.streamKey.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, revokedAt: new Date() },
    });
    // Generate new stream key
    const rawKey = generateStreamKey();
    const hashedKey = hashStreamKey(rawKey);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    // Store hashed key in database
    await prisma_1.prisma.streamKey.create({
        data: {
            userId,
            keyHash: hashedKey,
            expiresAt,
            isActive: true,
        },
    });
    const serverUrl = process.env.RTMP_SERVER_URL || 'rtmp://live.athena.io/stream';
    const playbackUrl = process.env.HLS_PLAYBACK_URL || 'https://live.athena.io/hls';
    return {
        key: rawKey,
        serverUrl: `${serverUrl}/${rawKey}`,
        playbackUrl: `${playbackUrl}/${hashedKey.slice(0, 12)}/playlist.m3u8`,
        expiresAt,
    };
}
async function validateStreamKey(key) {
    const hashedKey = hashStreamKey(key);
    const streamKey = await prisma_1.prisma.streamKey.findFirst({
        where: {
            keyHash: hashedKey,
            isActive: true,
            expiresAt: { gt: new Date() },
        },
        select: { userId: true },
    });
    if (!streamKey) {
        return { valid: false };
    }
    return { valid: true, userId: streamKey.userId };
}
async function revokeStreamKey(userId) {
    await prisma_1.prisma.streamKey.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, revokedAt: new Date() },
    });
}
// ==========================================
// LIVE STREAM MANAGEMENT
// ==========================================
async function startLiveStream(userId, data) {
    // Check for existing active stream
    const existingStream = await prisma_1.prisma.liveStream.findFirst({
        where: { hostId: userId, status: 'LIVE' },
    });
    if (existingStream) {
        throw new Error('You already have an active live stream');
    }
    const stream = await prisma_1.prisma.liveStream.create({
        data: {
            hostId: userId,
            title: data.title,
            description: data.description,
            thumbnailUrl: data.thumbnailUrl,
            category: data.category || 'General',
            status: 'LIVE',
            startedAt: new Date(),
            viewerCount: 0,
            peakViewerCount: 0,
        },
    });
    logger_1.logger.info(`Live stream started: ${stream.id} by user ${userId}`);
    await (0, event_stream_1.publishEvent)('livestream.started', {
        streamId: stream.id,
        hostId: stream.hostId,
        title: stream.title,
        category: stream.category || 'General',
        startedAt: stream.startedAt?.toISOString() || new Date().toISOString(),
    });
    return stream;
}
async function endLiveStream(streamId, userId) {
    const stream = await prisma_1.prisma.liveStream.findUnique({
        where: { id: streamId },
    });
    if (!stream) {
        throw new Error('Stream not found');
    }
    if (stream.hostId !== userId) {
        throw new Error('Not authorized to end this stream');
    }
    const endedStream = await prisma_1.prisma.liveStream.update({
        where: { id: streamId },
        data: {
            status: 'ENDED',
            endedAt: new Date(),
        },
    });
    // Calculate stream duration and earnings
    const duration = stream.startedAt
        ? Math.floor((Date.now() - stream.startedAt.getTime()) / 1000)
        : 0;
    const earnings = await prisma_1.prisma.giftTransaction.aggregate({
        where: { streamId },
        _sum: { dollarValue: true },
    });
    logger_1.logger.info(`Live stream ended: ${streamId}, duration: ${duration}s, earnings: $${earnings._sum.dollarValue || 0}`);
    await (0, event_stream_1.publishEvent)('livestream.ended', {
        streamId: endedStream.id,
        hostId: endedStream.hostId,
        durationSeconds: duration,
        totalEarnings: earnings._sum.dollarValue || 0,
        endedAt: endedStream.endedAt?.toISOString() || new Date().toISOString(),
    });
    return {
        ...endedStream,
        duration,
        totalEarnings: earnings._sum.dollarValue || 0,
    };
}
async function updateViewerCount(streamId, count) {
    const stream = await prisma_1.prisma.liveStream.findUnique({
        where: { id: streamId },
        select: { peakViewerCount: true },
    });
    const peakViewerCount = Math.max(stream?.peakViewerCount || 0, count);
    await prisma_1.prisma.liveStream.update({
        where: { id: streamId },
        data: {
            viewerCount: count,
            peakViewerCount,
        },
    });
}
async function getLiveStreams(options) {
    const { category, limit = 20, cursor } = options;
    const where = { status: 'LIVE' };
    if (category) {
        where.category = category;
    }
    const streams = await prisma_1.prisma.liveStream.findMany({
        where,
        orderBy: [{ viewerCount: 'desc' }, { startedAt: 'desc' }],
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        take: limit + 1,
        include: {
            host: {
                select: { id: true, displayName: true, avatar: true },
            },
        },
    });
    const hasMore = streams.length > limit;
    const result = hasMore ? streams.slice(0, limit) : streams;
    return {
        streams: result,
        nextCursor: hasMore ? result[result.length - 1]?.id : null,
    };
}
// ==========================================
// WALLET & COINS
// ==========================================
async function getWalletBalance(userId) {
    const wallet = await prisma_1.prisma.wallet.findUnique({
        where: { userId },
    });
    if (!wallet) {
        // Create wallet if doesn't exist
        const newWallet = await prisma_1.prisma.wallet.create({
            data: {
                userId,
                coins: 0,
                pendingEarnings: 0,
                availableEarnings: 0,
                lifetimeEarnings: 0,
            },
        });
        return newWallet;
    }
    return wallet;
}
async function purchaseCoins(userId, amount, paymentIntentId) {
    // Validate coin package
    const COIN_PACKAGES = {
        100: 0.99,
        500: 4.99,
        1000: 9.99,
        5000: 49.99,
        10000: 99.99,
    };
    if (!COIN_PACKAGES[amount]) {
        throw new Error('Invalid coin package');
    }
    // Record purchase
    await prisma_1.prisma.coinPurchase.create({
        data: {
            userId,
            coinAmount: amount,
            dollarAmount: COIN_PACKAGES[amount],
            paymentIntentId,
            status: 'COMPLETED',
        },
    });
    // Add coins to wallet
    await prisma_1.prisma.wallet.upsert({
        where: { userId },
        update: {
            coins: { increment: amount },
        },
        create: {
            userId,
            coins: amount,
            pendingEarnings: 0,
            availableEarnings: 0,
            lifetimeEarnings: 0,
        },
    });
    logger_1.logger.info(`User ${userId} purchased ${amount} coins for $${COIN_PACKAGES[amount]}`);
    await (0, event_stream_1.publishEvent)('wallet.coins_purchased', {
        userId,
        coinAmount: amount,
        dollarAmount: COIN_PACKAGES[amount],
        paymentIntentId,
        purchasedAt: new Date().toISOString(),
    });
    return { coins: amount, price: COIN_PACKAGES[amount] };
}
// ==========================================
// GIFTING
// ==========================================
async function sendGift(senderId, receiverId, streamId, giftTypeId) {
    const gift = exports.GIFT_CATALOG.find(g => g.id === giftTypeId);
    if (!gift) {
        throw new Error('Invalid gift type');
    }
    // Check sender's wallet
    const senderWallet = await prisma_1.prisma.wallet.findUnique({
        where: { userId: senderId },
    });
    if (!senderWallet || senderWallet.coins < gift.coinCost) {
        throw new Error('Insufficient coins');
    }
    // Verify stream is active
    const stream = await prisma_1.prisma.liveStream.findUnique({
        where: { id: streamId },
        select: { status: true, hostId: true },
    });
    if (!stream || stream.status !== 'LIVE') {
        throw new Error('Stream is not live');
    }
    if (stream.hostId !== receiverId) {
        throw new Error('Receiver is not the stream host');
    }
    // Calculate creator earnings (70% to creator, 30% platform fee)
    const creatorEarnings = gift.dollarValue * 0.7;
    // Execute transaction
    const [transaction] = await prisma_1.prisma.$transaction([
        // Create gift transaction
        prisma_1.prisma.giftTransaction.create({
            data: {
                senderId,
                receiverId,
                streamId,
                giftType: giftTypeId,
                coinAmount: gift.coinCost,
                dollarValue: gift.dollarValue,
                creatorEarnings,
            },
        }),
        // Deduct coins from sender
        prisma_1.prisma.wallet.update({
            where: { userId: senderId },
            data: { coins: { decrement: gift.coinCost } },
        }),
        // Add earnings to receiver (pending until payout)
        prisma_1.prisma.wallet.upsert({
            where: { userId: receiverId },
            update: {
                pendingEarnings: { increment: creatorEarnings },
                lifetimeEarnings: { increment: creatorEarnings },
            },
            create: {
                userId: receiverId,
                coins: 0,
                pendingEarnings: creatorEarnings,
                availableEarnings: 0,
                lifetimeEarnings: creatorEarnings,
            },
        }),
    ]);
    logger_1.logger.info(`Gift sent: ${gift.name} from ${senderId} to ${receiverId} on stream ${streamId}`);
    await (0, event_stream_1.publishEvent)('livestream.gift_sent', {
        transactionId: transaction.id,
        streamId,
        senderId,
        receiverId,
        giftType: giftTypeId,
        coinAmount: gift.coinCost,
        dollarValue: gift.dollarValue,
        creatorEarnings,
        createdAt: transaction.createdAt.toISOString(),
    });
    return transaction;
}
async function getStreamGifts(streamId) {
    const gifts = await prisma_1.prisma.giftTransaction.findMany({
        where: { streamId },
        orderBy: { createdAt: 'desc' },
        include: {
            sender: {
                select: { id: true, displayName: true, avatar: true },
            },
        },
    });
    // Aggregate by gift type
    const summary = await prisma_1.prisma.giftTransaction.groupBy({
        by: ['giftType'],
        where: { streamId },
        _count: true,
        _sum: { dollarValue: true },
    });
    return {
        gifts,
        summary: summary.map(s => ({
            giftType: s.giftType,
            count: s._count,
            totalValue: s._sum.dollarValue || 0,
        })),
        totalValue: gifts.reduce((sum, g) => sum + g.dollarValue, 0),
    };
}
// ==========================================
// PAYOUT MANAGEMENT
// ==========================================
async function requestPayout(userId) {
    const wallet = await prisma_1.prisma.wallet.findUnique({
        where: { userId },
    });
    if (!wallet) {
        throw new Error('Wallet not found');
    }
    const minPayout = 50; // Minimum $50 for payout
    if (wallet.availableEarnings < minPayout) {
        throw new Error(`Minimum payout amount is $${minPayout}`);
    }
    // Create payout request
    const payout = await prisma_1.prisma.payout.create({
        data: {
            userId,
            amount: wallet.availableEarnings,
            status: 'PENDING',
        },
    });
    // Reset available earnings
    await prisma_1.prisma.wallet.update({
        where: { userId },
        data: { availableEarnings: 0 },
    });
    logger_1.logger.info(`Payout requested: $${payout.amount} by user ${userId}`);
    await (0, event_stream_1.publishEvent)('wallet.payout_requested', {
        userId,
        payoutId: payout.id,
        amount: payout.amount,
        status: payout.status,
        requestedAt: payout.createdAt.toISOString(),
    });
    return payout;
}
async function processEarningsToAvailable() {
    // Move pending earnings to available after 7 days (fraud prevention)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pendingTransactions = await prisma_1.prisma.giftTransaction.findMany({
        where: {
            createdAt: { lt: sevenDaysAgo },
            isProcessed: false,
        },
        select: {
            id: true,
            receiverId: true,
            creatorEarnings: true,
        },
    });
    // Group by receiver
    const earningsByUser = new Map();
    for (const tx of pendingTransactions) {
        const current = earningsByUser.get(tx.receiverId) || 0;
        earningsByUser.set(tx.receiverId, current + tx.creatorEarnings);
    }
    // Update wallets
    for (const [userId, earnings] of earningsByUser) {
        await prisma_1.prisma.wallet.update({
            where: { userId },
            data: {
                pendingEarnings: { decrement: earnings },
                availableEarnings: { increment: earnings },
            },
        });
    }
    // Mark transactions as processed
    await prisma_1.prisma.giftTransaction.updateMany({
        where: { id: { in: pendingTransactions.map(t => t.id) } },
        data: { isProcessed: true },
    });
    logger_1.logger.info(`Processed ${pendingTransactions.length} gift transactions to available earnings`);
    return { processed: pendingTransactions.length };
}
// ==========================================
// LEADERBOARDS
// ==========================================
async function getGiftLeaderboard(streamId, limit = 10) {
    const leaderboard = await prisma_1.prisma.giftTransaction.groupBy({
        by: ['senderId'],
        where: { streamId },
        _sum: { coinAmount: true, dollarValue: true },
        orderBy: { _sum: { coinAmount: 'desc' } },
        take: limit,
    });
    // Fetch user details
    const userIds = leaderboard.map(l => l.senderId);
    const users = await prisma_1.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, avatar: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    return leaderboard.map((entry, index) => ({
        rank: index + 1,
        user: userMap.get(entry.senderId),
        totalCoins: entry._sum.coinAmount || 0,
        totalValue: entry._sum.dollarValue || 0,
    }));
}
//# sourceMappingURL=livestream.service.js.map