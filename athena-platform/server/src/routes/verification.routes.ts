import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import Stripe from 'stripe';

const router = Router();

// Identity checks run through Stripe Identity when a key is configured: the
// member photographs her document and a selfie on Stripe's hosted page, and
// the webhook approves the badge when the check passes. Without a key the
// badge is applied for and reviewed by hand, as before.
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) : null;

// ===========================================
// GET CURRENT USER BADGES
// ===========================================
router.get('/badges', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const badges = await prisma.verificationBadge.findMany({
      where: { userId: req.user!.id },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({
      success: true,
      data: badges,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PENDING REQUESTS (ADMIN)
// ===========================================
router.get('/badges/pending', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' && ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status) ? req.query.status : 'PENDING';
    const badges = await prisma.verificationBadge.findMany({
      where: { status: status as any },
      include: { user: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, avatar: true } } },
      orderBy: { submittedAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 200,
    });
    res.json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// IDENTITY CHECK THROUGH STRIPE IDENTITY
// ===========================================
router.post('/identity/session', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!stripe) {
      throw new ApiError(503, 'Automated identity checks are not set up on this server yet. You can still apply for the badge and a person will review it.');
    }
    const userId = req.user!.id;
    const approved = await prisma.verificationBadge.findFirst({ where: { userId, type: 'IDENTITY', status: 'APPROVED' }, select: { id: true } });
    if (approved) {
      throw new ApiError(409, 'Your identity is already verified');
    }

    const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId },
      options: { document: { require_matching_selfie: true } },
      return_url: `${base}/dashboard/settings/verification?identity=done`,
    });

    // One pending identity badge per member; a retry points it at the new session.
    const metadata = { provider: 'stripe_identity', sessionId: session.id, startedAt: new Date().toISOString() };
    const pending = await prisma.verificationBadge.findFirst({ where: { userId, type: 'IDENTITY', status: 'PENDING' }, select: { id: true } });
    if (pending) {
      await prisma.verificationBadge.update({ where: { id: pending.id }, data: { metadata, reason: null } });
    } else {
      await prisma.verificationBadge.create({ data: { userId, type: 'IDENTITY', status: 'PENDING', metadata } });
    }
    await logAudit({
      action: 'USER_VERIFICATION_SUBMIT',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { type: 'IDENTITY', provider: 'stripe_identity', sessionId: session.id },
    });

    res.json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SUBMIT VERIFICATION REQUEST
// ===========================================
router.post(
  '/badges',
  authenticate,
  [body('type').isIn(['IDENTITY', 'EMPLOYER', 'EDUCATOR', 'MENTOR', 'CREATOR']), body('metadata').optional()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { type, metadata } = req.body;

      const badge = await prisma.verificationBadge.create({
        data: {
          userId: req.user!.id,
          type,
          status: 'PENDING',
          metadata: metadata ?? undefined,
        },
      });

      await logAudit({
        action: 'USER_VERIFICATION_SUBMIT',
        actorUserId: req.user?.id ?? null,
        targetUserId: req.user?.id ?? null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { badgeId: badge.id, type },
      });

      res.status(201).json({
        success: true,
        data: badge,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REVIEW VERIFICATION REQUEST (ADMIN)
// ===========================================
router.patch(
  '/badges/:id',
  authenticate,
  requireRole('ADMIN'),
  [body('status').isIn(['APPROVED', 'REJECTED']), body('reason').optional().isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const { status, reason } = req.body;

      const badge = await prisma.verificationBadge.update({
        where: { id },
        data: {
          status,
          reason: reason ?? null,
          reviewedAt: new Date(),
          reviewedById: req.user!.id,
        },
      });

      if (status === 'APPROVED' && badge.type === 'IDENTITY') {
        await prisma.user.update({
          where: { id: badge.userId },
          data: { isVerified: true },
        });
      }

      await logAudit({
        action: status === 'APPROVED' ? 'ADMIN_VERIFICATION_APPROVE' : 'ADMIN_VERIFICATION_REJECT',
        actorUserId: req.user?.id ?? null,
        targetUserId: badge.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { badgeId: badge.id, type: badge.type, reason },
      });

      res.json({
        success: true,
        data: badge,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
