import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

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
