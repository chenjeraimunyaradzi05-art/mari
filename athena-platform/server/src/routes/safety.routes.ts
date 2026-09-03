import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { evaluateSafetyScore } from '../services/moderation.service';
import { handleUserBlock, handleUserReport } from '../services/safety-score.service';
import { recordSafetyReport, recordUserBlock } from '../services/trust.service';
import { prisma } from '../utils/prisma';
import { blockUser, listBlockedUsers, unblockUser } from '../utils/safety-store';

const router = Router();

type ReportTargetType = 'post' | 'video' | 'user' | 'message' | 'channel' | 'other';

// ContentReport speaks the moderation queue's vocabulary; the Safety Center
// speaks the reporter's. Translate on the way out so a reporter still sees
// whether their case is open or finished.
const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'SUBMITTED',
  REVIEWING: 'UNDER_REVIEW',
  RESOLVED: 'ACTION_TAKEN',
  DISMISSED: 'CLOSED',
};

/**
 * Every report has to name the account it is about, because that is what a
 * moderator acts on. Returns null when the target cannot be traced to a user.
 */
async function resolveReportedUserId(
  targetType: ReportTargetType,
  targetId?: string
): Promise<string | null> {
  if (!targetId) {
    return null;
  }

  switch (targetType) {
    case 'user': {
      const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
      return user?.id ?? null;
    }
    case 'post': {
      const post = await prisma.post.findUnique({ where: { id: targetId }, select: { authorId: true } });
      return post?.authorId ?? null;
    }
    case 'video': {
      const video = await prisma.video.findUnique({ where: { id: targetId }, select: { authorId: true } });
      return video?.authorId ?? null;
    }
    case 'message': {
      const message = await prisma.message.findUnique({ where: { id: targetId }, select: { senderId: true } });
      return message?.senderId ?? null;
    }
    case 'channel': {
      const channel = await prisma.channel.findUnique({ where: { id: targetId }, select: { ownerId: true } });
      return channel?.ownerId ?? null;
    }
    default:
      return null;
  }
}

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
    const reports = await prisma.contentReport.findMany({
      where: { reporterId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: reports.map((report) => ({
        id: report.id,
        userId: report.reporterId,
        targetType: report.contentType.toLowerCase(),
        targetId: report.contentId,
        reason: report.reason,
        details: report.description ?? undefined,
        status: REPORT_STATUS_LABELS[report.status] ?? report.status,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      })),
    });
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

      const { targetType, targetId, reason, details } = req.body as {
        targetType: ReportTargetType;
        targetId?: string;
        reason: string;
        details?: string;
      };

      const reportedUserId = await resolveReportedUserId(targetType, targetId);

      // A report the moderation queue cannot route is worse than no report, so
      // say so instead of accepting it into a void.
      if (!reportedUserId) {
        throw new ApiError(400, 'We could not find the content you reported');
      }

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

      const report = await prisma.contentReport.create({
        data: {
          reporterId: req.user!.id,
          contentType: targetType.toUpperCase(),
          contentId: targetId!,
          reportedUserId,
          reason,
          description: details,
          status: 'PENDING',
        },
      });

      await recordSafetyReport(req.user!.id, reportedUserId);
      await handleUserReport(reportedUserId, req.user!.id, reason, targetId, targetType);

      res.status(201).json({
        success: true,
        data: {
          id: report.id,
          userId: report.reporterId,
          targetType,
          targetId,
          reason,
          details,
          status: REPORT_STATUS_LABELS[report.status] ?? report.status,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
        },
      });
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
    const blocks = await listBlockedUsers(req.user!.id);

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

      const { blockedUserId } = req.body;

      if (blockedUserId === req.user!.id) {
        throw new ApiError(400, 'You cannot block yourself');
      }

      const target = await prisma.user.findUnique({
        where: { id: blockedUserId },
        select: { id: true },
      });

      if (!target) {
        throw new ApiError(404, 'User not found');
      }

      const { created } = await blockUser(req.user!.id, blockedUserId);

      if (created) {
        await recordUserBlock(blockedUserId);
        await handleUserBlock(blockedUserId, req.user!.id);
      }

      const [block] = (await listBlockedUsers(req.user!.id)).filter(
        (entry) => entry.blockedUserId === blockedUserId
      );

      res.status(created ? 201 : 200).json({ success: true, data: block });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/blocks/:blockedUserId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { blockedUserId } = req.params;
    await unblockUser(req.user!.id, blockedUserId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAFETY SETTINGS
// ===========================================
const MESSAGE_AUDIENCES = ['all', 'connections', 'none'] as const;
const PROFILE_VISIBILITIES = ['public', 'connections', 'private'] as const;

// Defaults mirror the UserSafetySettings model, so a user who has never saved
// reads the same values the database would give them on first write.
const SAFETY_PREFERENCE_DEFAULTS = {
  allowMessagesFrom: 'connections',
  filterOffensiveContent: true,
  hideReadReceipts: false,
  profileVisibility: 'public',
  hideOnlineStatus: false,
  hideLastSeen: false,
  enableSafetyAlerts: true,
};

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

    const preferences = await prisma.userSafetySettings.findUnique({
      where: { userId: req.user!.id },
      select: {
        allowMessagesFrom: true,
        filterOffensiveContent: true,
        hideReadReceipts: true,
        profileVisibility: true,
        hideOnlineStatus: true,
        hideLastSeen: true,
        enableSafetyAlerts: true,
      },
    });

    res.json({
      success: true,
      data: {
        allowMessages: user?.allowMessages ?? true,
        isSafeMode: profile?.isSafeMode ?? false,
        hideFromSearch: profile?.hideFromSearch ?? false,
        ...SAFETY_PREFERENCE_DEFAULTS,
        ...(preferences ?? {}),
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
    body('allowMessagesFrom').optional().isIn(MESSAGE_AUDIENCES),
    body('filterOffensiveContent').optional().isBoolean(),
    body('hideReadReceipts').optional().isBoolean(),
    body('profileVisibility').optional().isIn(PROFILE_VISIBILITIES),
    body('hideOnlineStatus').optional().isBoolean(),
    body('hideLastSeen').optional().isBoolean(),
    body('enableSafetyAlerts').optional().isBoolean(),
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

      // Only the keys the caller actually sent are written, so a page that owns
      // a subset of these preferences cannot clobber the ones it does not show.
      const preferenceUpdates = Object.fromEntries(
        Object.keys(SAFETY_PREFERENCE_DEFAULTS)
          .filter((key) => req.body[key] !== undefined)
          .map((key) => [key, req.body[key]])
      );

      if (Object.keys(preferenceUpdates).length > 0) {
        await prisma.userSafetySettings.upsert({
          where: { userId: req.user!.id },
          update: preferenceUpdates,
          create: {
            userId: req.user!.id,
            ...SAFETY_PREFERENCE_DEFAULTS,
            ...preferenceUpdates,
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
