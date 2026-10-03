/**
 * Creator Economy Service
 * Handles creator monetization, tips/gifts, and creator fund tracking
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import Stripe from 'stripe';
import { getStripe } from '../utils/stripe';
import { idempotencyWindow } from '../utils/idempotency';
import { ApiError } from '../middleware/errorHandler';
import { sendNotification } from './socket.service';
import {
  createConnectedAccount,
  refreshConnectedAccount,
  resolveConnectedAccountId,
} from './stripe-connect.service';
import { recordFailure } from '../utils/ops-metrics';
import { bestEffort } from '../utils/best-effort';
import { isBlockedRelationship } from '../utils/safety-store';
import { CREATOR_TERMS_VERSION } from '../config/creator-terms';
import { assertPaymentsOpen } from './feature-flags.service';
import {
  CREATOR_REVENUE_SHARE_PERCENT,
  MINIMUM_PAYOUT_AUD,
  PRICE_CURRENCY,
  centsForGiftPoints,
  giftPointsForCents,
} from '../config/price-book';

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
  /** What the tier gives, in words. Only the share: nothing else on the server reads a creator's tier. */
  benefits: string[];
}

// ==========================================
// CREATOR TIERS
// ==========================================

/**
 * The one thing a tier changes is the share of each gift the creator keeps
 * (CREATOR_REVENUE_SHARE_PERCENT in the price book, which the gift credit and
 * the payout read). The benefits used to be a wish list: "Priority support",
 * "Custom profile badge", "Featured placement", "Creator fund eligibility",
 * "Dedicated account manager", "Brand partnerships". No code did any of it, and
 * GET /api/creator/tiers served the list to anyone who asked. Each tier now says
 * only what it does; a benefit is added here after the server does it, and
 * config/__tests__/plan-claims.test.ts holds the list to that.
 */
function shareBenefit(revShare: number): string[] {
  return [`Keeps ${revShare}% of the value of every gift received`];
}

export const CREATOR_TIERS: CreatorTier[] = [
  {
    name: 'Emerging',
    minFollowers: 0,
    revShare: CREATOR_REVENUE_SHARE_PERCENT.Emerging,
    benefits: shareBenefit(CREATOR_REVENUE_SHARE_PERCENT.Emerging),
  },
  {
    name: 'Rising',
    minFollowers: 1000,
    revShare: CREATOR_REVENUE_SHARE_PERCENT.Rising,
    benefits: shareBenefit(CREATOR_REVENUE_SHARE_PERCENT.Rising),
  },
  {
    name: 'Established',
    minFollowers: 10000,
    revShare: CREATOR_REVENUE_SHARE_PERCENT.Established,
    benefits: shareBenefit(CREATOR_REVENUE_SHARE_PERCENT.Established),
  },
  {
    name: 'Partner',
    minFollowers: 50000,
    revShare: CREATOR_REVENUE_SHARE_PERCENT.Partner,
    benefits: shareBenefit(CREATOR_REVENUE_SHARE_PERCENT.Partner),
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

// A gift point is worth one cent of Australian dollars: see the price book for
// why it is held in whole cents and why it is Australian dollars only.

/** The smallest payout the platform will send, in Australian dollars. */
const MINIMUM_PAYOUT = MINIMUM_PAYOUT_AUD;

/** The same minimum expressed in the points the balance is actually held in. */
const MINIMUM_PAYOUT_POINTS = giftPointsForCents(MINIMUM_PAYOUT * 100);

/** Statuses a payout can still move out of. Anything else is settled history. */
const OPEN_PAYOUT_STATUSES = ['PENDING', 'PROCESSING'];

/**
 * Gift points are bought and cashed out in Australian dollars, whatever
 * currency a member has chosen for her own display.
 *
 * Both sides used to follow `User.preferredCurrency`, which a member sets
 * herself to any of twelve currencies. A point was a hundredth of whichever one
 * the buyer picked and a creator was paid one for one in the one she picked, so
 * a buyer on VND or IDR could pay a few Australian dollars for points that a
 * creator on AUD withdrew as tens or hundreds of times that, out of ATHENA's own
 * Stripe balance. Nothing converted between the two. One currency removes the
 * whole class: what is charged, what is credited and what is paid out are all
 * Australian dollars.
 */
const GIFT_CURRENCY = PRICE_CURRENCY;

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

  // Why a withdrawal is paused is a note for ATHENA's team: it names a card
  // dispute by its Stripe id, and a creator is not told whose payment it was.
  // That withdrawals are paused is the creator's to know, and is still here.
  const { payoutHoldReason: _staffNote, ...profile } = creator;

  // Whether she has accepted the Creator Terms Addendum as it stands. A creator
  // who enabled creator mode before the addendum existed has accepted nothing and
  // is asked at her next withdrawal; the screen reads this to say so.
  const creatorTerms = {
    version: CREATOR_TERMS_VERSION,
    accepted: creator.creatorTermsVersion === CREATOR_TERMS_VERSION,
    acceptedAt: creator.creatorTermsAcceptedAt,
  };

  // Calculate engagement rate
  const posts = creator.user.posts;
  const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
  const engagementRate = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;

  return {
    ...profile,
    creatorTerms,
    followerCount: creator.user.followers.length,
    engagementRate: Math.round(engagementRate * 100) / 100,
    tier: getCreatorTier(creator.user.followers.length),
  };
}

/**
 * Turns creator mode on. `acceptedTermsVersion` is the version of the Creator
 * Terms Addendum she accepted in this same request, and is recorded on the
 * profile as it is created: no profile exists without it, so the only creators
 * with no acceptance on record are the ones who enabled creator mode before the
 * addendum did.
 */
export async function enableCreatorMode(userId: string, stripeAccountId?: string, acceptedTermsVersion?: string) {
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
      ...(acceptedTermsVersion
        ? { creatorTermsVersion: acceptedTermsVersion, creatorTermsAcceptedAt: new Date() }
        : {}),
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
 * Records that an existing creator has accepted the Creator Terms Addendum, as
 * shown to her. Only the current version can be accepted: a page left open on an
 * old one does not accept the new text by mistake.
 */
export async function acceptCreatorTerms(userId: string, version: string) {
  if (version !== CREATOR_TERMS_VERSION) {
    throw new ApiError(409, 'The Creator Terms Addendum has changed since you opened it. Please reload it and read the current version.');
  }

  const accepted = await prisma.creatorProfile.updateMany({
    where: { userId },
    data: { creatorTermsVersion: version, creatorTermsAcceptedAt: new Date() },
  });
  if (accepted.count === 0) {
    throw new ApiError(404, 'Turn on creator mode first. Accepting the addendum is part of that.');
  }

  logger.info('Creator Terms Addendum accepted', { userId, version });
  return { version, accepted: true, acceptedAt: new Date() };
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

  // Good standing is the creator's to keep, and a gift is money that she is later
  // paid. A suspended or banned creator is not signed in, so she cannot withdraw,
  // yet she went on accruing gifts and a pending payout that left as a real
  // transfer the day she was reinstated, from supporters who could not know. A
  // gift also does not cross a block: it names its sender to the creator, and a
  // member who blocked her, or whom she blocked, must not be able to reach her
  // with one. Both are read before any points move, so a refusal costs nothing.
  const standing = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { isSuspended: true, bannedAt: true },
  });
  if (!standing || standing.isSuspended || standing.bannedAt) {
    throw new ApiError(409, 'This creator is not able to receive gifts right now.');
  }
  if (await isBlockedRelationship(senderId, receiverId)) {
    throw new ApiError(403, 'You cannot send a gift to this creator.');
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
  // Nothing new is charged while payments are paused.
  await assertPaymentsOpen();

  // Rounded once, to whole cents, and everything below is worked out from that
  // integer. `amount * 100` sent a fractional number of cents to Stripe for an
  // amount like 5.555, and the points were floored from the dollar figure
  // rather than from what was charged.
  const amountCents = Math.round(Number(amount) * 100);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ApiError(400, 'Invalid amount');
  }

  const giftPoints = giftPointsForCents(amountCents);

  // Create Stripe payment intent
  const paymentIntent = await getStripe().paymentIntents.create(
    {
      amount: amountCents,
      currency: GIFT_CURRENCY.toLowerCase(),
      metadata: {
        userId,
        type: 'gift_balance_purchase',
        giftPoints: giftPoints.toString(),
        currency: GIFT_CURRENCY,
      },
    },
    // There is no row to key from until the payment succeeds, so the member,
    // the amount and the minute: two taps on Buy are one intent, and buying
    // the same amount again a minute later is a new one. Without this, every
    // tap minted a fresh intent against her card.
    { idempotencyKey: `gift-purchase-${userId}-${amountCents}-${idempotencyWindow()}` }
  );

  return {
    // The id travels with the secret so the browser can confirm the purchase
    // without picking the id back out of the secret string.
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount: amountCents / 100,
    giftPoints,
    currency: GIFT_CURRENCY,
  };
}

/**
 * Credits the points a gift-balance payment bought, once.
 *
 * The points come from the money received, never from what the intent's
 * metadata says. Metadata is only a note we wrote when the intent was created,
 * and the webhook and the confirm route both trust this function with whatever
 * intent they are handed: a credit read from metadata is a credit anyone who
 * can get a payment intent created with chosen metadata can write for
 * themselves. The metadata is kept as a consistency check, and an intent whose
 * claim does not match its payment, or which was not paid in Australian dollars,
 * credits nothing and is refused with a 409 so that it is looked at by a person.
 */
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

  // What Stripe actually took. `amount` is what was asked for; on a succeeded
  // intent the two agree, but only one of them is a receipt.
  // A real intent always carries amount_received; the fallback is for a payload
  // that lacks the field, and zero received is zero, not "use the amount asked".
  const amountCents = paymentIntent.amount_received ?? paymentIntent.amount;
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new ApiError(400, 'Invalid payment amount');
  }

  const paidIn = String(paymentIntent.currency ?? '').toLowerCase();
  if (paidIn !== GIFT_CURRENCY.toLowerCase()) {
    logger.error('A gift-balance payment was not in Australian dollars and has not been credited', {
      userId: actorUserId,
      paymentIntentId,
      currency: paidIn,
      amountCents,
    });
    throw new ApiError(
      409,
      'This payment was not made in Australian dollars, so it has not been turned into gift points. Please contact support and quote the payment reference.'
    );
  }

  const points = giftPointsForCents(amountCents);
  const claimed = parseInt(String(giftPoints || '0'), 10);
  if (points <= 0 || claimed !== points) {
    logger.error('A gift-balance payment claims points that do not match what was paid and has not been credited', {
      userId: actorUserId,
      paymentIntentId,
      amountCents,
      claimedPoints: claimed,
      pointsForAmount: points,
    });
    throw new ApiError(
      409,
      'The points on this payment do not match what was paid, so none have been added. Please contact support and quote the payment reference.'
    );
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

/**
 * What taking points back for a refunded or charged-back purchase did.
 *
 * `shortfallPoints` is the part that could not be given back because it had already
 * been spent on gifts: that money is not the member's any more, and it is in somebody
 * else's creator balance.
 */
export interface GiftReversal {
  userId: string;
  /** When the points were bought, which is where "spent since" starts. */
  purchasedAt: Date;
  tookBackPoints: number;
  shortfallPoints: number;
  /** True when there was nothing left to take back: this refund, or more, had already been applied. */
  alreadyApplied: boolean;
}

/**
 * Takes back the points a gift-balance purchase bought, in proportion to the
 * money that has gone back to the buyer.
 *
 * A refund, or a card dispute that was lost, returned the money and left the
 * points: the member kept the whole of what had been refunded, and could spend
 * it on gifts that became real creator earnings, paid out as real transfers.
 *
 * `returnedCents` is cumulative, as Stripe reports it, so the same refund
 * delivered twice, or two part refunds delivered out of order, take each point
 * back once: GiftBalancePurchase.reversedPoints records how many have gone, and
 * the claim on it is conditional on the figure that was read. A full return takes
 * every point; a part return takes the whole points that part of the money
 * bought, rounded down, so that nobody is charged a point for a fraction.
 *
 * The balance is debited only as far as it goes. The conditional debit is the
 * same guard sendGift uses, so a gift being sent at the same moment cannot
 * push the balance below zero from either side; what is no longer there is
 * reported as the shortfall instead of being taken as a negative balance.
 *
 * Null when the payment was not a gift-balance purchase.
 */
export async function reverseGiftPurchase(paymentIntentId: string, returnedCents: number): Promise<GiftReversal | null> {
  if (!Number.isFinite(returnedCents) || returnedCents <= 0) return null;

  let lastError: unknown;
  // The balance can move between reading it and debiting it (a gift sent at the
  // same moment). The attempt is rolled back and made again on the new figure.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const purchase = await tx.giftBalancePurchase.findUnique({ where: { paymentIntentId } });
        if (!purchase) return null;

        const owed =
          returnedCents >= purchase.amountCents
            ? purchase.giftPoints
            : Math.min(purchase.giftPoints, Math.floor((purchase.giftPoints * returnedCents) / purchase.amountCents));
        const toTake = owed - purchase.reversedPoints;
        const applied: GiftReversal = {
          userId: purchase.userId,
          purchasedAt: purchase.createdAt,
          tookBackPoints: 0,
          shortfallPoints: 0,
          alreadyApplied: true,
        };
        if (toTake <= 0) return applied;

        const claimed = await tx.giftBalancePurchase.updateMany({
          where: { id: purchase.id, reversedPoints: purchase.reversedPoints },
          data: { reversedPoints: owed },
        });
        // Somebody else took them between our read and this write.
        if (claimed.count !== 1) return applied;

        const holder = await tx.user.findUnique({ where: { id: purchase.userId }, select: { giftBalance: true } });
        const takeNow = Math.min(Math.max(holder?.giftBalance ?? 0, 0), toTake);
        if (takeNow > 0) {
          const debited = await tx.user.updateMany({
            where: { id: purchase.userId, giftBalance: { gte: takeNow } },
            data: { giftBalance: { decrement: takeNow } },
          });
          if (debited.count !== 1) throw new Error('The gift balance moved while points were being taken back');
        }

        return { ...applied, tookBackPoints: takeNow, shortfallPoints: toTake - takeNow, alreadyApplied: false };
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Freezes withdrawals for the creators with these profile ids, and tells each one
 * that was not already frozen. Returns how many were newly frozen.
 *
 * Only requestPayout reads the hold. The balance is not touched, and gifts sent
 * to the creator keep adding to it.
 */
export async function holdCreatorPayouts(profileIds: string[], reason: string): Promise<number> {
  if (profileIds.length === 0) return 0;

  const unheld = await prisma.creatorProfile.findMany({
    where: { id: { in: profileIds }, payoutHold: false },
    select: { id: true, userId: true },
  });
  if (unheld.length === 0) return 0;

  await prisma.creatorProfile.updateMany({
    where: { id: { in: unheld.map((p) => p.id) }, payoutHold: false },
    data: { payoutHold: true, payoutHoldReason: reason, payoutHeldAt: new Date() },
  });

  for (const profile of unheld) {
    await sendNotification({
      userId: profile.userId,
      type: 'SYSTEM',
      title: 'Withdrawals are paused for now',
      message:
        'ATHENA is looking into a card payment connected to some of the gifts you were sent, so withdrawals are paused until that is settled. Your balance is safe and keeps growing, and we will write to you when it is open again.',
      link: '/dashboard/creator',
    }).catch(() => undefined);
  }

  return unheld.length;
}

/**
 * Lifts the freeze from these profiles, and tells each creator who had one.
 * Returns how many were lifted. The caller decides which ids are free to go:
 * a profile held for two disputes is not released by the end of one.
 */
export async function releaseCreatorPayouts(profileIds: string[]): Promise<number> {
  if (profileIds.length === 0) return 0;

  const held = await prisma.creatorProfile.findMany({
    where: { id: { in: profileIds }, payoutHold: true },
    select: { id: true, userId: true },
  });
  if (held.length === 0) return 0;

  await prisma.creatorProfile.updateMany({
    where: { id: { in: held.map((p) => p.id) }, payoutHold: true },
    data: { payoutHold: false, payoutHoldReason: null, payoutHeldAt: null },
  });

  for (const profile of held) {
    await sendNotification({
      userId: profile.userId,
      type: 'SYSTEM',
      title: 'Withdrawals are open again',
      message: 'The check on a payment connected to your gifts is finished, and you can withdraw your balance again.',
      link: '/dashboard/creator',
    }).catch(() => undefined);
  }

  return held.length;
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

/**
 * Fills the CreatorAnalytics row from the tables that hold her real numbers.
 *
 * Nothing on this server had ever written followerCount, totalViews, totalLikes
 * or avgEngagementRate. The one route that reads the row created it at the
 * column defaults and returned it, so every creator who opened IncomeStream was
 * shown zero followers, zero views and zero likes — not as an absence, but as a
 * measurement of her — and the income model then multiplied those zeros
 * together and called the product her forecast.
 *
 * The numbers were always there to be counted. Follow rows are written on every
 * follow, Post.impressionCount by the feed's impression batch, Video.viewCount
 * on every play, and the like, comment and share counters by their own routes.
 * This reads them and stores the totals, so the row becomes a cache of
 * something true rather than a set of defaults nobody fills.
 *
 * What the numbers mean, precisely, because the page prints them as headlines:
 *  - Views combines reel plays with the number of times a feed post of hers was
 *    on somebody's screen. They are not the same event, and the page labels
 *    them as the two things they are.
 *  - avgViews is per piece of content — reels and posts together — not per reel.
 *  - avgEngagementRate is the formula the column documents, likes plus comments
 *    plus shares over views, and it is null rather than 0 when nothing has been
 *    seen yet, so the page can leave it out instead of printing "0.0%" at a
 *    woman who has simply not been measured.
 *  - creatorTier is the ladder in CREATOR_TIERS, the same one that decides her
 *    share of every gift in sendGift. It is computed here rather than left at
 *    its default so that the tier on her screen is the tier her money is
 *    actually paid at.
 *
 * The two projection columns are cleared on every refresh. They hold what the
 * old formula wrote — an invented dollar figure per follower — and the platform
 * no longer stands behind those numbers, so they should not survive in a table
 * that a GDPR export will hand back to her as fact.
 *
 * `maxAgeMs` is why the row still exists at all: the recount is five aggregates
 * and a write, and the creator page asks two endpoints for it in the same
 * breath. A row counted within the window is handed back as it stands, so
 * opening the page costs one recount rather than two, and a refresh of the page
 * a minute later costs none.
 */
export async function refreshCreatorAnalytics(userId: string, maxAgeMs = 5 * 60 * 1000) {
  const existing = await prisma.creatorAnalytics.findUnique({ where: { userId } });
  if (existing && Date.now() - existing.updatedAt.getTime() < maxAgeMs) {
    return existing;
  }

  const [followerCount, followingCount, reels, posts] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.video.aggregate({
      where: { authorId: userId, isHidden: false, status: 'PUBLISHED' },
      _count: { _all: true },
      _sum: { viewCount: true, likeCount: true, commentCount: true, shareCount: true },
    }),
    prisma.post.aggregate({
      where: { authorId: userId, isHidden: false },
      _count: { _all: true },
      _sum: { impressionCount: true, likeCount: true, commentCount: true, shareCount: true },
    }),
  ]);

  // An aggregate over no rows sums to null, which is the same shape as a sum of
  // zero and must not become NaN halfway down the arithmetic below.
  const count = (value: number | null | undefined) => value ?? 0;

  const totalVideos = reels._count._all;
  const contentCount = totalVideos + posts._count._all;
  const totalViews = count(reels._sum.viewCount) + count(posts._sum.impressionCount);
  const totalLikes = count(reels._sum.likeCount) + count(posts._sum.likeCount);
  const interactions =
    totalLikes +
    count(reels._sum.commentCount) +
    count(posts._sum.commentCount) +
    count(reels._sum.shareCount) +
    count(posts._sum.shareCount);

  const measured = {
    followerCount,
    followingCount,
    totalVideos,
    totalViews,
    totalLikes,
    avgViews: contentCount > 0 ? totalViews / contentCount : null,
    avgEngagementRate: totalViews > 0 ? interactions / totalViews : null,
    creatorTier: getCreatorTier(followerCount).name,
  };

  return prisma.creatorAnalytics.upsert({
    where: { userId },
    create: { userId, ...measured },
    update: { ...measured, projectedIncome: Prisma.DbNull, topRevenueStreams: Prisma.DbNull },
  });
}

/**
 * The share of every gift this creator keeps, and the follower count the next
 * rung starts at. Both come from CREATOR_TIERS, which is not a marketing ladder
 * — it is the table sendGift divides her gifts by.
 */
export function creatorTierStanding(followerCount: number) {
  const tier = getCreatorTier(followerCount);
  const next = [...CREATOR_TIERS]
    .sort((a, b) => a.minFollowers - b.minFollowers)
    .find((candidate) => candidate.minFollowers > followerCount);

  return {
    tier: tier.name,
    giftRevenueShare: tier.revShare,
    nextTier: next ? { tier: next.name, minFollowers: next.minFollowers, giftRevenueShare: next.revShare } : null,
  };
}

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
  // Asked before anything is claimed, so a paused platform never takes the points
  // out of a balance for a transfer that is not going out.
  await assertPaymentsOpen();

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new ApiError(404, 'Creator profile not found');
  }

  // A freeze while a card payment connected to the gifts sent is looked at
  // (see payment-disputes.service). It stops a withdrawal and nothing else: the
  // balance is untouched and keeps growing, and it can be withdrawn again the
  // moment the hold is lifted. Said before anything is claimed, so the points
  // are never taken out of the balance for a transfer that was never going out.
  if (profile.payoutHold) {
    throw new ApiError(
      409,
      'Withdrawals are paused on your account while ATHENA looks into a card payment connected to some of the gifts you were sent. Your balance is safe and keeps growing, and we will write to you as soon as this is settled.'
    );
  }

  const points = profile.pendingPayout;
  // Whole cents first, and the dollar figure is derived from them, so the amount
  // recorded on the payout row and the amount sent to Stripe are one number.
  const amountCents = centsForGiftPoints(points);
  const pendingAmount = amountCents / 100;

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

  // Only an account Stripe has verified and switched on for payouts is paid. The
  // terms promise payouts to a verified account, and until now this asked only
  // that an account id existed: one that had not finished Stripe's checks was
  // sent a transfer, refused, and had the balance claimed and put back on every
  // press of the button. The same happens to an account Stripe has since paused
  // (the account.updated webhook writes RESTRICTED, and tells her).
  //
  // The status is kept by Stripe's events, so one that is not ACTIVE may only be
  // behind: an account verified a minute ago, or adopted before the status was
  // written. Stripe is asked once before she is turned away, so a woman who has
  // finished setting up is not refused on a stale row. If it cannot be asked the
  // row stands.
  const readConnectStatus = async () =>
    (await prisma.user.findUnique({ where: { id: userId }, select: { stripeConnectStatus: true } }))?.stripeConnectStatus ?? null;

  let connectStatus = await readConnectStatus();
  if (connectStatus !== 'ACTIVE') {
    await bestEffort('creator.payout.refresh-account', () => refreshConnectedAccount(userId, destination), null);
    connectStatus = await readConnectStatus();
  }

  if (connectStatus === 'RESTRICTED' || connectStatus === 'DISABLED') {
    throw new ApiError(
      409,
      'Stripe has paused payouts to your account, so this withdrawal has not been started. Open your earnings page to see what Stripe needs. Your balance is unchanged.'
    );
  }
  if (connectStatus !== 'ACTIVE') {
    throw new ApiError(
      409,
      'Your payout account is not ready yet. Finish setting it up from your earnings page, and then you can withdraw. Your balance is unchanged.'
    );
  }

  // Australian dollars, always: the points were bought in them, so they are paid
  // out in them, whatever currency she has chosen to see her own figures in.
  const currency = GIFT_CURRENCY;

  const payout = await prisma.$transaction(async (tx) => {
    const claimed = await tx.creatorProfile.updateMany({
      // `gte: points` and `decrement: points` rather than a set to zero: a gift
      // credited between the read above and this line raises the balance, and
      // decrementing takes only what this payout is actually sending, so the
      // new gift survives to the next payout instead of vanishing.
      //
      // `payoutHold: false` is in the claim as well as in the read above: a card
      // dispute can open between the two, and a pause that is only checked
      // before the claim would let this one withdrawal through after it.
      where: { userId, pendingPayout: { gte: points }, payoutHold: false },
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
    // claimed this balance a moment ago, a gift was reversed underneath it, or a
    // pause was put on her withdrawals after the check above; in each case the
    // honest answer is the one that is true now.
    const paused = await prisma.creatorProfile.findUnique({ where: { userId }, select: { payoutHold: true } });
    if (paused?.payoutHold) {
      throw new ApiError(
        409,
        'Withdrawals have just been paused on your account while ATHENA looks into a card payment connected to some of the gifts you were sent. Your balance is unchanged and keeps growing.'
      );
    }
    throw new ApiError(
      409,
      'This balance is already being paid out. Check your payout history in a moment.'
    );
  }

  let transfer: Stripe.Transfer;
  try {
    transfer = await getStripe().transfers.create(
      {
        amount: amountCents,
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
  const points = giftPointsForCents(Math.round(payout.amount * 100));
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
