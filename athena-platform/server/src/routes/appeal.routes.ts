import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// ===========================================
// SUBMIT APPEAL
// ===========================================
router.post(
  '/',
  authenticate,
  [
    body('type').isIn(['CONTENT_MODERATION', 'ACCOUNT_SUSPENSION', 'VERIFICATION_DECISION', 'OTHER']),
    body('reason').isString().notEmpty(),
    body('metadata').optional(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { type, reason, metadata } = req.body;

      const appeal = await prisma.appeal.create({
        data: {
          userId: req.user!.id,
          type,
          reason,
          metadata: metadata ?? undefined,
          status: 'PENDING',
        },
      });

      await logAudit({
        action: 'USER_APPEAL_SUBMIT',
        actorUserId: req.user?.id ?? null,
        targetUserId: req.user?.id ?? null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { appealId: appeal.id, type },
      });

      res.status(201).json({
        success: true,
        data: appeal,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// LIST CURRENT USER APPEALS
// ===========================================
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const appeals = await prisma.appeal.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: appeals,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// ADMIN LIST APPEALS
// ===========================================
router.get(
  '/',
  authenticate,
  requireRole('ADMIN'),
  [query('status').optional().isIn(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'])],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { status } = req.query;
      const where = status ? { status } : {};

      const appeals = await prisma.appeal.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.json({
        success: true,
        data: appeals,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADMIN REVIEW APPEAL
// ===========================================
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  [body('status').isIn(['UNDER_REVIEW', 'APPROVED', 'REJECTED']), body('decisionNote').optional().isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const { status, decisionNote } = req.body;

      const appeal = await prisma.appeal.update({
        where: { id },
        data: {
          status,
          decisionNote: decisionNote ?? null,
          reviewedAt: new Date(),
          reviewedById: req.user!.id,
        },
      });

      await logAudit({
        action: 'ADMIN_APPEAL_DECISION',
        actorUserId: req.user?.id ?? null,
        targetUserId: appeal.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { appealId: appeal.id, status, decisionNote },
      });

      res.json({
        success: true,
        data: appeal,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
