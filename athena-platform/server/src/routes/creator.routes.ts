/**
 * Creator Routes
 * API endpoints for creator economy features
 */

import { Router, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { z } from 'zod';
import { zodQuery } from '../middleware/validate';
import { paginationQuery } from '../utils/schemas';
import { clampLimit } from '../utils/pagination';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import * as creatorService from '../services/creator.service';
import { mayOpenMemberPage, notPrivateProfileWhere } from '../services/audience.service';
import { hiddenMemberWhere, viewerContextFor } from '../services/search.service';
import { prisma } from '../utils/prisma';
import { bestEffort } from '../utils/best-effort';
import { giftCeiling, payoutCeiling, startingAPayment } from '../middleware/moneyLimits';
import { requireWomanVerifiedFor } from '../middleware/woman-gate-surfaces';
import { requireAdultAccount, requireCreatorTerms } from '../middleware/account-gates';
import { CREATOR_TERMS_VERSION } from '../config/creator-terms';
import { GIFT_POINT_VALUE_AUD, MINIMUM_PAYOUT_AUD } from '../config/price-book';

const router = Router();

/**
 * The signed-in member. Used only behind `authenticate`, which has already
 * answered 401 before a handler runs, so this never refuses in practice: it
 * narrows `req.user` for the compiler in place of a `!`. The optionalAuth
 * routes read `req.user` directly, because there she may be absent.
 */
function member(req: AuthRequest) {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  return req.user;
}

// ==========================================
// CREATOR PROFILE
// ==========================================

/**
 * GET /api/creator/profile
 * Get current user's creator profile
 */
router.get('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Stripe onboarding finishes on Stripe's site and returns her here, so this
    // is the first moment the platform can find out whether her account came
    // back usable. It costs one Stripe lookup and only while she is not
    // monetised yet; once she is, this does nothing. The account.updated
    // webhook is what hears about a verification that finishes later. Best
    // effort, because a Stripe outage must not take her whole dashboard down.
    await bestEffort('creator.refresh-monetization', () =>
      creatorService.refreshCreatorMonetization(req.user!.id)
    );

    const profile = await creatorService.getCreatorProfile(req.user!.id);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/creator/profile/:userId
 * Get a creator's public profile
 *
 * It names her, with her picture and headline, so it is opened only by a viewer
 * who may be shown her: not across a block, and not a member in Safe Mode to
 * anyone who is neither her nor her verified connection. It answers as a page
 * that does not exist.
 */
router.get('/profile/:userId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const profile = await creatorService.getCreatorProfile(req.params.userId);
    
    if (!profile || !(await mayOpenMemberPage(req.user, profile.userId))) {
      throw new ApiError(404, 'Creator profile not found');
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
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/creator/enable
 * Enable creator mode for current user
 *
 * Terms 5.1 makes being an adult and accepting the Creator Terms Addendum
 * conditions of being paid, and this is where a creator starts being paid, so both
 * are checked here on the server and not only by the screen: the date of birth the
 * account holds must be an adult's, and the request must say she accepted the
 * version of the addendum that is current. The acceptance is recorded on the
 * profile in the same write that creates it. Checked before anything is created at
 * Stripe, so a refusal leaves no half-made account behind.
 */
router.post(
  '/enable',
  authenticate,
  requireAdultAccount,
  [
    body('acceptCreatorTerms')
      .custom((value) => value === true)
      .withMessage('Read and accept the Creator Terms Addendum to turn on creator mode'),
    body('termsVersion')
      .equals(CREATOR_TERMS_VERSION)
      .withMessage('The Creator Terms Addendum has changed since you opened it. Please reload it and read the current version.'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const profile = await creatorService.enableCreatorMode(member(req).id, undefined, CREATOR_TERMS_VERSION);

      res.status(201).json({
        success: true,
        message: 'Creator mode enabled',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/creator/terms/accept
 * A creator who enabled creator mode before the addendum existed, or before it
 * was last rewritten, accepts the current version. Her next withdrawal is refused
 * until she has (see requireCreatorTerms), and her earnings are untouched meanwhile.
 */
router.post(
  '/terms/accept',
  authenticate,
  requireAdultAccount,
  [body('version').isString().notEmpty().isLength({ max: 40 }).withMessage('Say which version of the addendum you read')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const result = await creatorService.acceptCreatorTerms(member(req).id, req.body.version);
      res.json({ success: true, message: 'Thank you. You have accepted the Creator Terms Addendum.', data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/creator/onboard
 * Generate Stripe Express onboarding link
 */
router.post('/onboard', authenticate, requireAdultAccount, requireCreatorTerms, async (req: AuthRequest, res, next) => {
  try {
    const url = await creatorService.generateStripeOnboardingLink(req.user!.id);
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/creator/stripe-login
 * Generate Stripe Express dashboard login link
 */
router.post('/stripe-login', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const url = await creatorService.generateStripeLoginLink(req.user!.id);
    res.json({ success: true, url });
  } catch (error) {
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
router.post(
  '/gifts/send',
  authenticate,
  // A gift is money from an account to a creator's earnings, so it is asked of an
  // adult account like every other way money moves here.
  requireAdultAccount,
  giftCeiling,
  [
    body('receiverId').isUUID().withMessage('Valid receiver ID required'),
    body('giftType').isString().notEmpty().isLength({ max: 50 }).withMessage('Gift type required'),
    body('message').optional().isString().isLength({ max: 200 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      const { receiverId, giftType, message } = req.body;

      if (receiverId === req.user!.id) {
        throw new ApiError(400, 'Cannot send gifts to yourself');
      }

      const result = await creatorService.sendGift(
        req.user!.id,
        receiverId,
        giftType,
        message
      );

      res.json({
        success: true,
        message: `${result.gift.name} sent successfully!`,
        data: {
          transaction: result.transaction,
          creatorShare: result.creatorShare,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/creator/gifts/received
 * Get gifts received by the creator
 */
router.get(
  '/gifts/received',
  authenticate,
  // These two declared express-validator chains (limit at most 100) that
  // nothing ever read, then took `parseInt(req.query.limit) || 20`: a limit of
  // a million went to the database. The query is clamped before the handler.
  zodQuery(paginationQuery()),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };

      const [gifts, total] = await Promise.all([
        prisma.giftTransaction.findMany({
          where: { receiverId: req.user!.id },
          include: {
            sender: {
              select: { id: true, displayName: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.giftTransaction.count({
          where: { receiverId: req.user!.id },
        }),
      ]);

      res.json({
        success: true,
        data: gifts.map((g) => ({
          ...g,
          giftInfo: creatorService.GIFT_TYPES[g.giftType.toUpperCase() as keyof typeof creatorService.GIFT_TYPES],
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/creator/gifts/sent
 * Get gifts sent by the user
 */
router.get(
  '/gifts/sent',
  authenticate,
  // These two declared express-validator chains (limit at most 100) that
  // nothing ever read, then took `parseInt(req.query.limit) || 20`: a limit of
  // a million went to the database. The query is clamped before the handler.
  zodQuery(paginationQuery()),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };

      const [gifts, total] = await Promise.all([
        prisma.giftTransaction.findMany({
          where: { senderId: req.user!.id },
          include: {
            receiver: {
              select: { id: true, displayName: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.giftTransaction.count({
          where: { senderId: req.user!.id },
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
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// GIFT BALANCE
// ==========================================

/**
 * GET /api/creator/balance
 * Get user's gift balance
 */
router.get('/balance', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { giftBalance: true },
    });

    res.json({
      success: true,
      data: {
        balance: user?.giftBalance || 0,
        valueAud: (user?.giftBalance || 0) * GIFT_POINT_VALUE_AUD,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/creator/balance/purchase
 * Purchase gift balance
 */
router.post(
  '/balance/purchase',
  authenticate,
  startingAPayment,
  [body('amount').isFloat({ min: 5, max: 1000 }).withMessage('Amount must be between $5 and $1000')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      const { amount } = req.body;
      const result = await creatorService.purchaseGiftBalance(req.user!.id, amount);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/creator/balance/purchase/confirm
 * Confirm a completed Stripe payment intent and credit gift points (idempotent)
 */
router.post(
  '/balance/purchase/confirm',
  authenticate,
  [body('paymentIntentId').isString().notEmpty().isLength({ max: 256 }).withMessage('paymentIntentId is required')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      }

      const { paymentIntentId } = req.body;
      const result = await creatorService.confirmGiftPurchase(req.user!.id, paymentIntentId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// ANALYTICS
// ==========================================

/**
 * GET /api/creator/analytics
 * Get creator analytics
 */
router.get(
  '/analytics',
  authenticate,
  // The validator here (7 to 90 days) was declared and never read either, so
  // `?days=100000` asked the analytics query for two hundred and seventy years.
  zodQuery(z.object({ days: z.unknown().transform((value) => clampLimit(value, 30, 90)) })),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const days = Math.max(7, (req.query as unknown as { days: number }).days);
      const analytics = await creatorService.getCreatorAnalytics(req.user!.id, days);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
);

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
router.get('/earnings', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        payouts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!profile) {
      throw new ApiError(404, 'Creator profile not found');
    }

    res.json({
      success: true,
      data: {
        totalEarnings: profile.totalEarnings * GIFT_POINT_VALUE_AUD,
        pendingPayout: profile.pendingPayout * GIFT_POINT_VALUE_AUD,
        recentPayouts: profile.payouts,
        // Not while ATHENA is looking into a card payment connected to the gifts:
        // requestPayout refuses, so the screen is told not to offer it.
        payoutHold: profile.payoutHold,
        canRequestPayout: !profile.payoutHold && profile.pendingPayout * GIFT_POINT_VALUE_AUD >= MINIMUM_PAYOUT_AUD,
        minPayoutAmount: MINIMUM_PAYOUT_AUD,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/creator/payouts/request
 * Request a payout
 */
// A completed women-only check is asked for here once the founder switches the
// surface on (config/woman-gate-policy.ts): it is members' money being paid out.
// The addendum and an adult account are asked here for every creator, and they are
// asked of the ones who were already creators before either existed: it is her
// next withdrawal that sends her to accept, not a silent assumption that she did.
router.post('/payouts/request', authenticate, requireAdultAccount, requireCreatorTerms, requireWomanVerifiedFor('creator_payouts'), payoutCeiling, async (req: AuthRequest, res, next) => {
  try {
    const result = await creatorService.requestPayout(req.user!.id);

    res.json({
      success: true,
      message: 'Payout requested successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/creator/payouts
 * Get payout history
 */
router.get('/payouts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });

    if (!profile) {
      throw new ApiError(404, 'Creator profile not found');
    }

    const payouts = await prisma.creatorPayout.findMany({
      where: { creatorProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: payouts,
    });
  } catch (error) {
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
router.get('/leaderboard', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const timeframe = (req.query.timeframe as string) || 'week';
    
    let startDate: Date;
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

    // Get creators with most engagement in timeframe. This board is public and
    // signed-out visitors read it, and it lists a creator's id, name, picture and
    // headline, so it names only the members a stranger searching by name could
    // find: not one who asked to be hidden from search, not one in Safe Mode, not
    // one whose profile is private, and, for a signed-in viewer, not either side
    // of a block with her (the engagement leaderboard takes those off as well).
    // Read the way search reads them, in both block stores, and not best-effort:
    // a list that could not be read must not become a board naming the man she
    // blocked.
    const viewer = await viewerContextFor(req.user?.id);
    const topCreators = await prisma.user.findMany({
      where: {
        AND: [{ role: 'CREATOR', creatorProfile: { isNot: null } }, hiddenMemberWhere(viewer), notPrivateProfileWhere],
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
  } catch (error) {
    next(error);
  }
});

export default router;
