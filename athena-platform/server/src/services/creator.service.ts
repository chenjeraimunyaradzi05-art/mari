/**
 * Creator Economy Service
 * Handles creator monetization, tips/gifts, and creator fund tracking
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import Stripe from 'stripe';
import { getStripe } from '../utils/stripe';
import { ApiError } from '../middleware/errorHandler';
import { sendNotification } from './socket.service';
import {
  createConnectedAccount,
  refreshConnectedAccount,
  resolveConnectedAccountId,
} from './stripe-connect.service';
import { recordFailure } from '../utils/ops-metrics';

// getStripe() is called at each use rather than once into a module constant.
// Capturing it at import time froze whatever client could be built the moment
// this module loaded: with STRIPE_SECRET_KEY not yet in the environment, every
// Connect account, gift-balance charge and creator payout for the life of the
// process went out with the sk_test_not_configured placeholder, and the cache
// getStripe() rebuilds when the real key arrives could never be reached here.
//
// There is no isStripeConfigured() gate because nothing in this module has a
// fallback to gate: an unconfigured deployment fails as it always has - 503
// from the production client on first use, a refused key elsewhere. `Stripe`
// is still imported for the PaymentIntent type below.

// ==========================================
// TYPES
// ==========================================

export interface CreatorStats {
  totalEarnings: number;
  monthlyEarnings: number;
  totalGifts: number;
  monthlyGifts: number;
  totalFollowers: number;
  totalViews: number;
  engagementRate: number;
}

export interface GiftTransaction {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  giftType: string;
  message?: string;
  createdAt: Date;
}

export interface CreatorTier {
  name: string;
  minFollowers: number;
  revShare: number; // Percentage of gift value creator receives
  benefits: string[];
}

// ==========================================
// CREATOR TIERS
// ==========================================

export const CREATOR_TIERS: CreatorTier[] = [
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

export const GIFT_TYPES = {
  SPARK: { id: 'spark', name: 'Spark', value: 1, icon: '✨', description: 'Show some love!' },
  STAR: { id: 'star', name: 'Star', value: 5, icon: '⭐', description: 'You shine bright!' },
  ROCKET: { id: 'rocket', name: 'Rocket', value: 10, icon: '🚀', description: 'To the moon!' },
  CROWN: { id: 'crown', name: 'Crown', value: 25, icon: '👑', description: 'Absolute royalty!' },
  DIAMOND: { id: 'diamond', name: 'Diamond', value: 50, icon: '💎', description: 'Rare and precious!' },
  TROPHY: { id: 'trophy', name: 'Trophy', value: 100, icon: '🏆', description: 'Champion content!' },
};

// 1 gift point = 0.01 units of local currency
const GIFT_POINT_VALUE = 0.01;

/** The smallest payout the platform will send, in the creator's currency. */
const MINIMUM_PAYOUT = 50;

/** The same minimum expressed in the points the balance is actually held in. */
const MINIMUM_PAYOUT_POINTS = Math.round(MINIMUM_PAYOUT / GIFT_POINT_VALUE);

/** Statuses a payout can still move out of. Anything else is settled history. */
const OPEN_PAYOUT_STATUSES = ['PENDING', 'PROCESSING'];

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

async function resolveUserCurrency(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredCurrency: true, region: true },
  });

  const currency = (user?.preferredCurrency || 'AUD').toUpperCase();
  return SUPPORTED_GIFT_CURRENCIES.has(currency) ? currency : 'AUD';
}

// ==========================================
// CREATOR PROFILE MANAGEMENT
// ==========================================

export async function getCreatorProfile(userId: string) {
  const creator = await prisma.creatorProfile.findUnique({
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

  if (!creator) return null;

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

export async function enableCreatorMode(userId: string, stripeAccountId?: string) {
  // Check if already a creator
  const existing = await prisma.creatorProfile.findUnique({
    where: { userId },
  });

  if (existing) {
    throw new ApiError(409, 'Creator profile already exists');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) throw new ApiError(404, 'User not found');

  // The connected account comes from the shared Connect service rather than a
  // second accounts.create of this module's own. Creator mode, mentor
  // monetisation and the payments page each used to mint their own Express
  // account for the same woman, and whichever one a screen happened to read
  // showed a balance the other two were holding.
  let accountId = stripeAccountId;
  if (!accountId) {
    const created = await createConnectedAccount({
      userId,
      email: user.email,
      // 'AU' as the payments page already does: Stripe wants an ISO country
      // code and `User.country` holds a display name ("Australia"), so it is
      // not the field to read. ATHENA's Connect accounts are Australian.
      country: 'AU',
      type: 'creator',
    });
    accountId = created.accountId;
  }

  // isMonetized is left to the account's real state. It used to be set true in
  // this same statement, on an Express account seconds old that Stripe had
  // verified nothing about, so the flag meaning "she can be paid" was true from
  // the first moment and never said otherwise. createConnectedAccount has just
  // written the honest value onto the user; the profile picks it up from there,
  // and the account.updated webhook keeps it current afterwards.
  const connectState = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectStatus: true },
  });

  const creatorProfile = await prisma.creatorProfile.create({
    data: {
      userId,
      stripeAccountId: accountId,
      isMonetized: connectState?.stripeConnectStatus === 'ACTIVE',
    },
  });

  // Update user role
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'CREATOR' },
  });

  logger.info('Creator mode enabled', { userId, stripeAccountId: accountId });

  return creatorProfile;
}

/**
 * Brings a creator's monetisation flag back in step with Stripe.
 *
 * Onboarding finishes on Stripe's site and returns her to the creator
 * dashboard, which is the first moment this side of the platform can find out
 * whether her account came back usable. The `account.updated` webhook is the
 * authoritative answer and arrives whenever Stripe decides; this is the cheap
 * one that runs while she is looking at the screen, and only while she is not
 * monetised yet, so a monetised creator never pays for the call.
 */
export async function refreshCreatorMonetization(userId: string): Promise<void> {
  const profile = await prisma.creatorProfile.findUnique({
    where: { userId },
    select: { isMonetized: true },
  });

  if (!profile || profile.isMonetized) return;

  const accountId = await resolveConnectedAccountId(userId);
  if (!accountId) return;

  await refreshConnectedAccount(userId, accountId);
}

export function getCreatorTier(followerCount: number): CreatorTier {
  const sorted = [...CREATOR_TIERS].sort((a, b) => b.minFollowers - a.minFollowers);
  return sorted.find((tier) => followerCount >= tier.minFollowers) || CREATOR_TIERS[0];
}

// ==========================================
// GIFT TRANSACTIONS
// ==========================================

export async function sendGift(
  senderId: string,
  receiverId: string,
  giftType: keyof typeof GIFT_TYPES,
  message?: string
) {
  const gift = GIFT_TYPES[giftType];
  if (!gift) {
    throw new Error('Invalid gift type');
  }

  // Check if receiver is a creator
  const receiverProfile = await prisma.creatorProfile.findUnique({
    where: { userId: receiverId },
    include: { user: { include: { followers: true } } },
  });

  if (!receiverProfile || !receiverProfile.isMonetized) {
    throw new Error('Receiver is not a monetized creator');
  }

  // An early exit so an obviously empty balance does not do the work below. It
  // is not the guard: two requests can both read enough points here and both
  // proceed. The guard is the conditional debit inside the transaction.
  const sender = await prisma.user.findUnique({
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

  // The interactive form, so a refused debit rolls back the gift record and the
  // creator's earnings rather than recording a gift nobody paid for. The array
  // form this replaced could not do that: the decrement was unconditional, so
  // two concurrent gifts both took the points, the balance went negative, and
  // the overspend arrived in the creator's pendingPayout — from where it leaves
  // as a real Stripe transfer. Gift points are bought with money, so that was a
  // cash-loss path, not a counter bug. Same shape as sendLiveGift in
  // livestream.service.ts, which had the identical defect.
  const transaction = await prisma.$transaction(async (tx) => {
    const debit = await tx.user.updateMany({
      where: { id: senderId, giftBalance: { gte: gift.value } },
      data: { giftBalance: { decrement: gift.value } },
    });

    if (debit.count === 0) {
      throw new Error('Insufficient gift balance');
    }

    const created = await tx.giftTransaction.create({
      data: {
        senderId,
        receiverId,
        giftType: gift.id,
        giftValue: gift.value,
        creatorShare,
        platformShare,
        message,
      },
    });

    await tx.creatorProfile.update({
      where: { userId: receiverId },
      data: {
        totalEarnings: { increment: creatorShare },
        pendingPayout: { increment: creatorShare },
      },
    });

    return created;
  });

  logger.info('Gift sent', {
    senderId,
    receiverId,
    giftType: gift.id,
    value: gift.value,
    creatorShare,
  });

  // Send real-time notification to creator
  await sendNotification({
    userId: receiverId,
    type: 'GIFT_RECEIVED',
    title: `You received a ${gift.name}!`,
    message: `${(sender!.displayName || 'Someone')} sent you a ${gift.icon} ${gift.name} gift!`,
    link: '/dashboard/creator/gifts',
  });

  return {
    transaction,
    gift,
    creatorShare,
    tier,
  };
}

export async function purchaseGiftBalance(userId: string, amount: number) {
  const currency = await resolveUserCurrency(userId);
  const giftPoints = Math.floor(amount / GIFT_POINT_VALUE);

  // Create Stripe payment intent
  const paymentIntent = await getStripe().paymentIntents.create({
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
    // The id travels with the secret so the browser can confirm the purchase
    // without picking the id back out of the secret string.
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount,
    giftPoints,
    currency,
  };
}

export async function confirmGiftPurchaseFromPaymentIntent(
  actorUserId: string,
  paymentIntent: Stripe.PaymentIntent
): Promise<{ giftPoints: number; alreadyProcessed: boolean }> {
  if (paymentIntent.status !== 'succeeded') {
    throw new ApiError(400, 'Payment not completed');
  }

  const paymentIntentId = paymentIntent.id;
  const { userId, giftPoints, type } = (paymentIntent.metadata as any) || {};

  if (!userId || userId !== actorUserId) {
    throw new ApiError(403, 'Forbidden');
  }

  if (type !== 'gift_balance_purchase') {
    throw new ApiError(400, 'Invalid payment intent');
  }

  const points = parseInt(String(giftPoints || '0'), 10);
  if (!Number.isFinite(points) || points <= 0) {
    throw new ApiError(400, 'Invalid gift points');
  }

  const amountCents = typeof (paymentIntent as any).amount === 'number' ? (paymentIntent as any).amount : 0;
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new ApiError(400, 'Invalid payment amount');
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).giftBalancePurchase.findUnique({
      where: { paymentIntentId },
    });

    if (existing) {
      return { giftPoints: existing.giftPoints, alreadyProcessed: true };
    }

    await (tx as any).giftBalancePurchase.create({
      data: {
        userId: actorUserId,
        paymentIntentId,
        amountCents,
        giftPoints: points,
      },
    });

    await (tx as any).user.update({
      where: { id: actorUserId },
      data: {
        giftBalance: { increment: points },
      },
    });

    return { giftPoints: points, alreadyProcessed: false };
  });

  logger.info('Gift balance purchased', { userId: actorUserId, giftPoints: result.giftPoints, paymentIntentId });
  return result;
}

export async function confirmGiftPurchase(actorUserId: string, paymentIntentId: string) {
  const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  return confirmGiftPurchaseFromPaymentIntent(actorUserId, paymentIntent as any);
}

// ==========================================
// CREATOR FUND
// ==========================================

export async function calculateCreatorFundDistribution(fundAmount: number) {
  // Get all eligible creators (Established tier or above)
  const creators = await prisma.creatorProfile.findMany({
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
  const eligibleCreators = creators.filter(
    (c) => c.user.followers.length >= 10000
  );

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

export async function getCreatorAnalytics(userId: string, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [posts, gifts, followers, profile] = await Promise.all([
    // Posts in period
    prisma.post.findMany({
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
    prisma.giftTransaction.findMany({
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
    prisma.follow.findMany({
      where: {
        followingId: userId,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    }),
    // Creator profile
    prisma.creatorProfile.findUnique({
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
  const dailyStats = new Map<string, {
    views: number;
    likes: number;
    comments: number;
    gifts: number;
    followers: number;
  }>();

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
    if (stats) stats.gifts += gift.giftValue;
  });

  // Aggregate follower stats
  followers.forEach((follow) => {
    const key = follow.createdAt.toISOString().split('T')[0];
    const stats = dailyStats.get(key);
    if (stats) stats.followers += 1;
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

/**
 * Pays a creator the balance her supporters' gifts have built up.
 *
 * The order of the three steps here is the whole safety of it, and it used to
 * run the other way round: read the balance, send the money at Stripe, then
 * write the row and set pendingPayout to the literal 0. Two requests arriving
 * together both read the same balance, both passed the minimum check and both
 * transferred, because nothing had been claimed in the database yet and the
 * Stripe call carried no key that could collapse them. A gift that landed
 * while the transfer was in flight was then destroyed by the 0, silently,
 * because the payout row records only what was paid.
 *
 * So: claim the points first with a conditional decrement, which is the
 * concurrency guard — the loser of the race matches no row, decrements nothing
 * and is told her balance is below the minimum, which by then it is. Only then
 * call Stripe, keyed on the payout row's own id so a retry, a crash or a
 * replay can never settle twice. If Stripe refuses, put the points back and
 * mark the row FAILED, because a refused transfer must not eat her balance.
 */
export async function requestPayout(userId: string) {
  const profile = await prisma.creatorProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new ApiError(404, 'Creator profile not found');
  }

  const points = profile.pendingPayout;
  const pendingAmount = points * GIFT_POINT_VALUE;

  if (points < MINIMUM_PAYOUT_POINTS) {
    throw new ApiError(
      400,
      `Minimum payout is $${MINIMUM_PAYOUT}. Current pending: $${pendingAmount.toFixed(2)}`
    );
  }

  const destination = await resolveConnectedAccountId(userId);
  if (!destination) {
    throw new ApiError(400, 'Stripe account not connected');
  }

  const currency = await resolveUserCurrency(userId);

  const payout = await prisma.$transaction(async (tx) => {
    const claimed = await tx.creatorProfile.updateMany({
      // `gte: points` and `decrement: points` rather than a set to zero: a gift
      // credited between the read above and this line raises the balance, and
      // decrementing takes only what this payout is actually sending, so the
      // new gift survives to the next payout instead of vanishing.
      where: { userId, pendingPayout: { gte: points } },
      data: { pendingPayout: { decrement: points } },
    });

    if (claimed.count !== 1) return null;

    return tx.creatorPayout.create({
      data: {
        creatorProfileId: profile.id,
        amount: pendingAmount,
        status: 'PENDING',
      },
    });
  });

  if (!payout) {
    // Nothing was decremented, so nothing is owed back. Either another request
    // claimed this balance a moment ago or a gift was reversed underneath it;
    // in both cases the honest answer is the balance she has now.
    throw new ApiError(
      409,
      'This balance is already being paid out. Check your payout history in a moment.'
    );
  }

  let transfer: Stripe.Transfer;
  try {
    transfer = await getStripe().transfers.create(
      {
        amount: Math.floor(pendingAmount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        destination,
        metadata: {
          userId,
          type: 'creator_payout',
          payoutId: payout.id,
          currency,
        },
      },
      // Derived from the row, not generated per call. The Stripe SDK attaches a
      // fresh random key to every POST, which dedupes one request's own network
      // retries and nothing at all across two invocations of this function.
      { idempotencyKey: `creator-payout-${payout.id}` }
    );
  } catch (error) {
    await creditBackFailedPayout(payout.id, userId, points);
    recordFailure('creator.payout.transfer', error);
    logger.error('Creator payout transfer was refused; the balance has been restored', {
      userId,
      payoutId: payout.id,
      amount: pendingAmount,
      error: (error as Error).message,
    });
    throw new ApiError(502, 'The payout could not be sent. Your balance is unchanged; please try again.');
  }

  await prisma.creatorPayout.update({
    where: { id: payout.id },
    data: { stripeTransferId: transfer.id },
  });

  logger.info('Payout requested', { userId, amount: pendingAmount, transferId: transfer.id });

  return {
    payoutId: payout.id,
    amount: pendingAmount,
    transferId: transfer.id,
    status: 'PENDING',
    currency,
  };
}

/**
 * Returns the points a refused or reversed payout was carrying.
 *
 * Guarded on the row still being open so that a Stripe failure and a later
 * `transfer.failed` webhook for the same payout credit her once between them,
 * not twice.
 */
async function creditBackFailedPayout(
  payoutId: string,
  userId: string,
  points: number
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const closed = await tx.creatorPayout.updateMany({
      where: { id: payoutId, status: { in: OPEN_PAYOUT_STATUSES } },
      data: { status: 'FAILED' },
    });

    if (closed.count !== 1) return false;

    await tx.creatorProfile.update({
      where: { userId },
      data: { pendingPayout: { increment: points } },
    });

    return true;
  });
}

/**
 * A payout Stripe has confirmed reached the creator's bank.
 *
 * Both columns are written together on purpose: the annual earnings statement
 * filters on `status: 'COMPLETED'` AND a `completedAt` inside the financial
 * year, so a row stamped COMPLETED with a null `completedAt` is still invisible
 * to her — which is how every payout on the platform read as $0 paid out.
 *
 * The caller is the Stripe webhook, which finds the row by
 * `CreatorPayout.stripeTransferId`. Returns false when no open payout carries
 * that transfer, so a replayed event can be counted as ignored.
 */
export async function settleCreatorPayout(stripeTransferId: string, completedAt: Date): Promise<boolean> {
  const settled = await prisma.creatorPayout.updateMany({
    where: { stripeTransferId, status: { in: OPEN_PAYOUT_STATUSES } },
    data: { status: 'COMPLETED', completedAt },
  });

  if (settled.count === 0) return false;

  logger.info('Creator payout settled', { stripeTransferId, completedAt });
  return true;
}

/**
 * A payout Stripe failed or reversed after it had been sent.
 *
 * The points were claimed out of her balance before the transfer went out, so
 * money that came back has to go back onto the balance or it is simply gone —
 * the platform would have no record of owing it and she would have no way to
 * ask for it again.
 *
 * The caller is the Stripe webhook, which finds the row by
 * `CreatorPayout.stripeTransferId`.
 */
export async function reverseCreatorPayout(stripeTransferId: string, reason: 'FAILED' | 'REVERSED' = 'FAILED'): Promise<boolean> {
  const payout = await prisma.creatorPayout.findFirst({
    where: { stripeTransferId },
    select: { id: true, amount: true, creatorProfile: { select: { userId: true } } },
  });

  if (!payout) {
    logger.warn('Stripe reported a transfer no creator payout row claims', { stripeTransferId });
    return false;
  }

  // Back into the unit the balance is actually kept in. The row stores dollars;
  // pendingPayout is whole gift points at a cent each.
  const points = Math.round(payout.amount / GIFT_POINT_VALUE);
  const credited = await creditBackFailedPayout(payout.id, payout.creatorProfile.userId, points);

  if (!credited) return false;

  logger.error('Creator payout came back from Stripe; the balance has been restored', {
    stripeTransferId,
    payoutId: payout.id,
    amount: payout.amount,
    reason,
  });
  recordFailure('creator.payout.transfer', new Error(`Transfer ${stripeTransferId} ${reason.toLowerCase()}`));

  await sendNotification({
    userId: payout.creatorProfile.userId,
    type: 'SYSTEM',
    title: 'Your payout did not go through',
    message: `The $${payout.amount.toFixed(2)} payout was returned by the bank and is back in your balance. Check your payout details before trying again.`,
    link: '/dashboard/creator',
  });

  return true;
}

export async function generateStripeOnboardingLink(userId: string) {
  const accountId = await resolveConnectedAccountId(userId);

  if (!accountId) {
    throw new ApiError(400, 'Creator profile or Stripe account not found. Enable creator mode first.');
  }

  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.CLIENT_URL}/dashboard/creator/onboarding-refresh`,
    return_url: `${process.env.CLIENT_URL}/dashboard/creator`,
    type: 'account_onboarding',
  });

  return accountLink.url;
}

export async function generateStripeLoginLink(userId: string) {
  const accountId = await resolveConnectedAccountId(userId);

  if (!accountId) {
    throw new ApiError(400, 'Creator profile or Stripe account not found.');
  }

  try {
    const loginLink = await getStripe().accounts.createLoginLink(accountId);
    return loginLink.url;
  } catch (error: any) {
    if (error.code === 'account_invalid') {
       throw new ApiError(400, 'Please complete onboarding before accessing the dashboard.');
    }
    throw error;
  }
}
