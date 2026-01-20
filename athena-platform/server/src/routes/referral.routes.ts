import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, optionalAuth } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// ============================================================================
// REFERRAL CODE GENERATION
// ============================================================================

/**
 * Generate a unique referral code for the user
 */
function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ============================================================================
// GET MY REFERRAL INFO
// ============================================================================

/**
 * GET /referrals/me
 * Get current user's referral code and stats
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Get or create referral code
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        referralCredits: true,
        referralsMade: {
          select: {
            id: true,
            status: true,
            rewardGranted: true,
            createdAt: true,
            completedAt: true,
            referred: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate referral code if not exists
    if (!user.referralCode) {
      let code = generateReferralCode();
      let attempts = 0;
      
      // Ensure uniqueness
      while (attempts < 10) {
        const existing = await prisma.user.findUnique({
          where: { referralCode: code },
        });
        if (!existing) break;
        code = generateReferralCode();
        attempts++;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });

      user = { ...user, referralCode: code };
    }

    const referralLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/register?ref=${user.referralCode}`;

    const stats = {
      totalReferrals: user.referralsMade.length,
      pendingReferrals: user.referralsMade.filter(r => r.status === 'PENDING').length,
      completedReferrals: user.referralsMade.filter(r => r.status === 'COMPLETED').length,
      creditsEarned: user.referralCredits,
    };

    res.json({
      referralCode: user.referralCode,
      referralLink,
      stats,
      referrals: user.referralsMade,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// VALIDATE REFERRAL CODE
// ============================================================================

/**
 * GET /referrals/validate/:code
 * Validate a referral code (public endpoint)
 */
router.get('/validate/:code', async (req, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;

    const referrer = await prisma.user.findUnique({
      where: { referralCode: code.toUpperCase() },
      select: {
        id: true,
        firstName: true,
        avatar: true,
      },
    });

    if (!referrer) {
      return res.status(404).json({ valid: false, error: 'Invalid referral code' });
    }

    res.json({
      valid: true,
      referrer: {
        firstName: referrer.firstName,
        avatar: referrer.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// TRACK REFERRAL (called during registration)
// ============================================================================

/**
 * POST /referrals/track
 * Track a new referral when a user signs up with a code
 * Called internally after user registration
 */
router.post('/track', async (req, res: Response, next: NextFunction) => {
  try {
    const { referralCode, newUserId, source } = req.body;

    if (!referralCode || !newUserId) {
      return res.status(400).json({ error: 'referralCode and newUserId are required' });
    }

    // Find referrer
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
    });

    if (!referrer) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    // Cannot refer yourself
    if (referrer.id === newUserId) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    // Check if user already has a referral
    const existingReferral = await prisma.referral.findUnique({
      where: { referredId: newUserId },
    });

    if (existingReferral) {
      return res.status(400).json({ error: 'User already has a referrer' });
    }

    // Create referral
    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: newUserId,
        status: 'PENDING',
        signupSource: source || 'link',
      },
    });

    res.status(201).json(referral);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// COMPLETE REFERRAL (when referred user takes qualifying action)
// ============================================================================

/**
 * POST /referrals/:id/complete
 * Mark a referral as completed and grant rewards
 * Called when referred user completes qualifying action (e.g., first post, subscription)
 */
router.post('/:id/complete', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const referral = await prisma.referral.findUnique({
      where: { id },
      include: {
        referrer: true,
        referred: true,
      },
    });

    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Referral already completed' });
    }

    // Update referral and grant credits to both users
    const REFERRAL_CREDITS = 100; // Credits for each party

    await prisma.$transaction([
      // Update referral status
      prisma.referral.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          rewardGranted: true,
        },
      }),
      // Grant credits to referrer
      prisma.user.update({
        where: { id: referral.referrerId },
        data: {
          referralCredits: { increment: REFERRAL_CREDITS },
        },
      }),
      // Grant credits to referred user
      prisma.user.update({
        where: { id: referral.referredId },
        data: {
          referralCredits: { increment: REFERRAL_CREDITS },
        },
      }),
      // Notify referrer
      prisma.notification.create({
        data: {
          userId: referral.referrerId,
          type: 'SYSTEM',
          title: 'Referral Completed!',
          message: `${referral.referred.firstName} completed signup! You both earned ${REFERRAL_CREDITS} credits.`,
        },
      }),
    ]);

    res.json({ success: true, creditsGranted: REFERRAL_CREDITS });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// GET REFERRAL LEADERBOARD
// ============================================================================

/**
 * GET /referrals/leaderboard
 * Get top referrers
 */
router.get('/leaderboard', async (_req, res: Response, next: NextFunction) => {
  try {
    const topReferrers = await prisma.user.findMany({
      where: {
        referralsMade: {
          some: {
            status: 'COMPLETED',
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        referralCredits: true,
        _count: {
          select: {
            referralsMade: {
              where: { status: 'COMPLETED' },
            },
          },
        },
      },
      orderBy: {
        referralCredits: 'desc',
      },
      take: 10,
    });

    // Transform the data
    const leaderboard = topReferrers.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
      referrals: user._count.referralsMade,
      credits: user.referralCredits,
    }));

    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// GENERATE SHARING LINKS
// ============================================================================

/**
 * GET /referrals/share-links
 * Get pre-formatted sharing links for different platforms
 */
router.get('/share-links', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, firstName: true },
    });

    if (!user?.referralCode) {
      return res.status(400).json({ error: 'No referral code. Call GET /referrals/me first.' });
    }

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const referralLink = `${baseUrl}/register?ref=${user.referralCode}`;
    const message = `Join me on ATHENA - the life operating system for women! Use my link to get started: ${referralLink}`;

    const shareLinks = {
      referralLink,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
      email: `mailto:?subject=${encodeURIComponent('Join me on ATHENA!')}&body=${encodeURIComponent(message)}`,
      copyText: message,
    };

    res.json(shareLinks);
  } catch (error) {
    next(error);
  }
});

export default router;
