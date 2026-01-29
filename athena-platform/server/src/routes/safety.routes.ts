import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { evaluateSafetyScore } from '../services/moderation.service';
import { handleUserBlock, handleUserReport } from '../services/safety-score.service';
import { recordSafetyReport, recordUserBlock } from '../services/trust.service';
import { prisma } from '../utils/prisma';
import { readSafetyStore, writeSafetyStore } from '../utils/safety-store';
import { randomUUID } from 'crypto';

const router = Router();

// ===========================================
// SAFETY SCORE (Full Launch)
// ===========================================
router.post('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      throw new ApiError(400, 'Content is required');
    }

    const data = await evaluateSafetyScore(content);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAFETY REPORTS
// ===========================================
router.get('/reports', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const store = await readSafetyStore();
    const reports = store.reports.filter((report) => report.userId === req.user!.id);
    res.json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/reports',
  authenticate,
  [
    body('targetType').notEmpty().isIn(['post', 'video', 'user', 'message', 'channel', 'other']),
    body('reason').notEmpty().isString(),
    body('targetId').optional().isString(),
    body('details').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { targetType, targetId, reason, details } = req.body;
      const now = new Date().toISOString();

      const report: {
        id: `${string}-${string}-${string}-${string}-${string}`;
        userId: string;
        targetType: 'post' | 'video' | 'user' | 'message' | 'channel' | 'other';
        targetId: string | undefined;
        reason: string;
        details: string | undefined;
        status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'CLOSED';
        createdAt: string;
        updatedAt: string;
      } = {
        id: randomUUID(),
        userId: req.user!.id,
        targetType,
        targetId,
        reason,
        details,
        status: 'SUBMITTED' as const,
        createdAt: now,
        updatedAt: now,
      };

      const store = await readSafetyStore();
      store.reports.unshift(report);
      await writeSafetyStore(store);

      if (targetType === 'post' && targetId) {
        await prisma.post.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
        });
      }

      if (targetType === 'video' && targetId) {
        await prisma.video.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
        });
      }

      const reportedUserId =
        targetType === 'user' && targetId
          ? targetId
          : targetType === 'post' && targetId
            ? (await prisma.post.findUnique({ where: { id: targetId }, select: { authorId: true } }))?.authorId
            : targetType === 'video' && targetId
              ? ((await prisma.video.findUnique({ where: { id: targetId }, select: { authorId: true } })) as any)?.authorId
              : null;

      if (reportedUserId) {
        await recordSafetyReport(req.user!.id, reportedUserId);
        await handleUserReport(reportedUserId, req.user!.id, reason, targetId, targetType);
        await prisma.contentReport.create({
          data: {
            reporterId: req.user!.id,
            contentType: targetType.toUpperCase(),
            contentId: targetId || 'unknown',
            reportedUserId,
            reason,
            description: details,
            status: 'PENDING',
          },
        });
      }

      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// BLOCKED USERS
// ===========================================
router.get('/blocks', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const store = await readSafetyStore();
    const blocks = store.blocks.filter((block) => block.userId === req.user!.id);

    const users = await prisma.user.findMany({
      where: { id: { in: blocks.map((block) => block.blockedUserId) } },
      select: { id: true, displayName: true, avatar: true, headline: true },
    });

    const enriched = blocks.map((block) => ({
      ...block,
      user: users.find((user) => user.id === block.blockedUserId) || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/blocks',
  authenticate,
  [body('blockedUserId').notEmpty().isString(), body('reason').optional().isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { blockedUserId, reason } = req.body;
      const store = await readSafetyStore();

      const exists = store.blocks.find(
        (block) => block.userId === req.user!.id && block.blockedUserId === blockedUserId
      );

      if (exists) {
        return res.json({ success: true, data: exists });
      }

      const block = {
        id: randomUUID(),
        userId: req.user!.id,
        blockedUserId,
        reason,
        createdAt: new Date().toISOString(),
      };

      store.blocks.unshift(block);
      await writeSafetyStore(store);

      await recordUserBlock(blockedUserId);
      await handleUserBlock(blockedUserId, req.user!.id);

      res.status(201).json({ success: true, data: block });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/blocks/:blockedUserId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { blockedUserId } = req.params;
    const store = await readSafetyStore();
    store.blocks = store.blocks.filter(
      (block) => !(block.userId === req.user!.id && block.blockedUserId === blockedUserId)
    );
    await writeSafetyStore(store);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAFETY SETTINGS
// ===========================================
router.get('/settings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { allowMessages: true },
    });

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { isSafeMode: true, hideFromSearch: true },
    });

    res.json({
      success: true,
      data: {
        allowMessages: user?.allowMessages ?? true,
        isSafeMode: profile?.isSafeMode ?? false,
        hideFromSearch: profile?.hideFromSearch ?? false,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/settings',
  authenticate,
  [
    body('allowMessages').optional().isBoolean(),
    body('isSafeMode').optional().isBoolean(),
    body('hideFromSearch').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { allowMessages, isSafeMode, hideFromSearch } = req.body;

      if (typeof allowMessages === 'boolean') {
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { allowMessages },
        });
      }

      if (typeof isSafeMode === 'boolean' || typeof hideFromSearch === 'boolean') {
        await prisma.profile.upsert({
          where: { userId: req.user!.id },
          update: {
            ...(typeof isSafeMode === 'boolean' ? { isSafeMode } : {}),
            ...(typeof hideFromSearch === 'boolean' ? { hideFromSearch } : {}),
          },
          create: {
            userId: req.user!.id,
            isSafeMode: typeof isSafeMode === 'boolean' ? isSafeMode : false,
            hideFromSearch: typeof hideFromSearch === 'boolean' ? hideFromSearch : false,
          },
        });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
