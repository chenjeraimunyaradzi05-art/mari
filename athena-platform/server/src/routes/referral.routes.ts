import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { hiddenMemberWhere, viewerContextFor } from '../services/search.service';
import crypto from 'crypto';

const router = Router();

/** The chosen display name, or a first name and an initial — never a full legal name. */
function leaderboardName(user: { displayName: string | null; firstName: string | null; lastName: string | null }): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  const first = user.firstName?.trim();
  const initial = user.lastName?.trim().charAt(0);
  if (first && initial) return `${first} ${initial}.`;
  return first || 'An ATHENA member';
}

/**
 * What a referrer is shown of a referred member who has since hidden herself
 * from search, or blocked the referrer, or been blocked by them.
 *
 * The referral history used to show every referred member's current first
 * name, last name and photo, whatever had happened since the invitation. On a
 * platform whose members include women leaving violent relationships, the
 * person who sent the link is not always a friend: he can be the partner she
 * signed up under, and the history kept showing him the name she now uses and
 * the photo she now posts after she had blocked him or hidden herself from
 * search. The referral is still his record — it counts, and its status still
 * moves — but who it was is no longer his to see. No id either: an id is a
 * way to open her profile.
 *
 * The strings keep the shape the referrals page reads (it takes the first
 * character of each name for the initials), so the page renders "A member you
 * referred" without needing to know why.
 */
const WITHHELD_REFERRED_MEMBER = {
  id: null,
  firstName: 'A member you referred',
  lastName: '',
  avatar: null,
} as const;

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

    // The referred members this referrer may still see: the same hide-from-
    // search and block rules as search and the leaderboard, both stores of
    // each and blocks in both directions. Nothing here is best-effort — if the
    // block list cannot be read the request fails, because a history that
    // quietly stopped filtering would put a blocked woman's name and photo
    // back in front of the person she blocked.
    const referredIds = user.referralsMade.map(r => r.referred.id);
    const visibleIds = new Set<string>();
    if (referredIds.length > 0) {
      const viewer = await viewerContextFor(userId);
      const visible = await prisma.user.findMany({
        where: { AND: [{ id: { in: referredIds } }, hiddenMemberWhere(viewer)] },
        select: { id: true },
      });
      for (const row of visible) visibleIds.add(row.id);
    }

    const referrals = user.referralsMade.map(referral =>
      visibleIds.has(referral.referred.id)
        ? referral
        : { ...referral, referred: WITHHELD_REFERRED_MEMBER }
    );

    res.json({
      referralCode: user.referralCode,
      referralLink,
      stats,
      referrals,
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
// TRACK REFERRAL (called after registration)
// ============================================================================

/**
 * POST /referrals/track
 * Track a new referral when a user signs up with a code
 * Requires authentication - uses the authenticated user's ID
 */
router.post('/track', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { referralCode, source } = req.body;
    const newUserId = req.user!.id; // Use authenticated user's ID, not from body

    if (!referralCode) {
      return res.status(400).json({ error: 'referralCode is required' });
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
 * Mark a referral as completed and grant rewards to both parties
 *
 * Completion pays out real credit, so it is not something either side of a
 * referral can trigger on their own referral. It is recorded by staff once the
 * referred user's qualifying action has been verified.
 */
router.post('/:id/complete', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const referral = await prisma.referral.findUnique({
      where: { id },
      include: {
        referred: { select: { firstName: true } },
      },
    });

    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Referral already completed' });
    }

    // The referrer's reward. The referred member is not paid here: she was
    // credited when she registered with the code (auth.routes.ts), and this
    // route used to credit her a second time on top of that, so every referral
    // an admin completed by hand paid her twice for the same signup.
    const REFERRAL_CREDITS = 100;

    const granted = await prisma.$transaction(async (tx) => {
      // Moving the row out of PENDING is the claim on the reward. A replay, or
      // a second request racing this one, updates no rows and mints nothing.
      const claimed = await tx.referral.updateMany({
        where: { id, status: { not: 'COMPLETED' } },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          rewardGranted: true,
        },
      });

      if (claimed.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { id: referral.referrerId },
        data: {
          referralCredits: { increment: REFERRAL_CREDITS },
        },
      });
      await tx.notification.create({
        data: {
          userId: referral.referrerId,
          type: 'SYSTEM',
          title: 'Referral Completed!',
          message: `${referral.referred.firstName} completed signup. You earned ${REFERRAL_CREDITS} credits.`,
          link: '/dashboard/referrals',
        },
      });

      return true;
    });

    if (!granted) {
      return res.status(400).json({ error: 'Referral already completed' });
    }

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
 *
 * This was open to anyone, signed in or not, and published each top
 * referrer's full first and last name and photo, with no regard for "hide me
 * from search". A woman who had hidden herself in the Safety Centre, and who
 * had shared her link with friends, could be found by name on a public page
 * by the person she was hiding from. It now needs a signed-in member, leaves
 * out anyone who asked to be hidden or who is blocked in either direction with
 * the viewer, and names people the way the rest of the platform does: by the
 * display name they chose, or a first name and an initial.
 *
 * Ranked by completed referrals, the number both leaderboards show beside each
 * name. It used to be ranked by referralCredits, which is not the same count:
 * a member who joined with somebody else's code starts with 100 credits of her
 * own, so of two women each shown with "1 referral" the one who had been
 * referred herself sat above the other, and the order contradicted the figure
 * printed next to it. Credits are also a balance nothing on the platform
 * accepts, so a table of top referrers was ranking women by a currency rather
 * than by the thing it names. Ties go to whoever reached her count first.
 */
router.get('/leaderboard', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const viewer = await viewerContextFor(req.user!.id);

    const ranked = await prisma.referral.groupBy({
      by: ['referrerId'],
      where: {
        status: 'COMPLETED',
        referrer: hiddenMemberWhere(viewer),
      },
      _count: { referrerId: true },
      _max: { completedAt: true },
      orderBy: [{ _count: { referrerId: 'desc' } }, { _max: { completedAt: 'asc' } }],
      take: 10,
    });

    const referrerIds = ranked.map((row) => row.referrerId);
    const people =
      referrerIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: referrerIds } },
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatar: true,
              referralCredits: true,
            },
          })
        : [];
    const byId = new Map(people.map((person) => [person.id, person]));

    // A referrer whose account went between the two reads is left out rather
    // than shown as a blank row; the ranks that remain stay consecutive.
    const leaderboard = ranked
      .flatMap((row) => {
        const person = byId.get(row.referrerId);
        return person ? [{ person, referrals: row._count.referrerId }] : [];
      })
      .map(({ person, referrals }, index) => ({
        rank: index + 1,
        id: person.id,
        name: leaderboardName(person),
        avatar: person.avatar,
        referrals,
        credits: person.referralCredits,
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
