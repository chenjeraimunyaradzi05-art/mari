import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import {
  CONTENT_LIMITS,
  normalizeOptionalUserText,
  normalizeSafeUrl,
  normalizeStringList,
  normalizeUserText,
} from '../utils/contentSafety';

const router = Router();

function parseLimit(value: unknown, fallback = 20, max = 50): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

// ===========================================
// VIDEO FEED
// ===========================================
router.get('/feed', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    // The explore tabs pick a feed; `type` stays available for VideoType filtering.
    const feed = typeof req.query.feed === 'string' ? req.query.feed : undefined;

    const where: any = {
      status: 'PUBLISHED',
      isHidden: false,
    };

    if (type) {
      where.type = type;
    }

    if (feed === 'following') {
      // A signed-out viewer follows nobody, so the tab is honestly empty for them
      // rather than silently falling back to the chronological feed.
      const following = req.user
        ? await prisma.follow.findMany({
            where: { followerId: req.user.id },
            select: { followingId: true },
          })
        : [];

      where.authorId = { in: following.map((f) => f.followingId) };
    }

    const orderBy: any[] =
      feed === 'trending'
        ? [{ engagementScore: 'desc' }, { viewCount: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];

    const videos = await prisma.video.findMany({
      where,
      orderBy,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: limit + 1,
      include: {
        author: {
          select: { id: true, displayName: true, avatar: true, headline: true },
        },
      },
    });

    const hasMore = videos.length > limit;
    const result = hasMore ? videos.slice(0, limit) : videos;
    const nextCursor = hasMore ? result[result.length - 1]?.id : null;

    res.json({
      success: true,
      data: result,
      nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET VIDEO BY ID
// ===========================================
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true, avatar: true, headline: true } },
      },
    });

    const canViewUnpublished = req.user?.id === video?.authorId || req.user?.role === 'ADMIN';
    if (!video || video.isHidden || (video.status !== 'PUBLISHED' && !canViewUnpublished)) {
      throw new ApiError(404, 'Video not found');
    }

    res.json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE VIDEO
// ===========================================
router.post(
  '/',
  authenticate,
  [
    body('videoUrl').isString().notEmpty().isLength({ max: 2048 }),
    body('title').optional().isString().isLength({ max: CONTENT_LIMITS.videoTitle }),
    body('description').optional().isString().isLength({ max: CONTENT_LIMITS.videoDescription }),
    body('type').optional().isIn(['REEL', 'STORY', 'TUTORIAL', 'CAREER_STORY', 'MENTOR_TIP', 'LIVE_REPLAY']),
    body('thumbnailUrl').optional().isString().isLength({ max: 2048 }),
    body('duration').optional().isInt({ min: 1 }),
    body('aspectRatio').optional().isString(),
    body('hashtags').optional().isArray(),
    body('mentionedUserIds').optional().isArray(),
    body('location').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const created = await prisma.video.create({
        data: {
          authorId: req.user!.id,
          title: normalizeOptionalUserText(req.body.title, {
            field: 'title',
            maxLength: CONTENT_LIMITS.videoTitle,
            allowEmpty: true,
          }),
          description: normalizeOptionalUserText(req.body.description, {
            field: 'description',
            maxLength: CONTENT_LIMITS.videoDescription,
            allowEmpty: true,
          }),
          type: req.body.type,
          status: 'PUBLISHED',
          videoUrl: normalizeSafeUrl(req.body.videoUrl, {
            field: 'videoUrl',
            allowRelativeUploads: true,
          }),
          thumbnailUrl: req.body.thumbnailUrl
            ? normalizeSafeUrl(req.body.thumbnailUrl, { field: 'thumbnailUrl', allowRelativeUploads: true })
            : undefined,
          duration: req.body.duration,
          aspectRatio: req.body.aspectRatio,
          hashtags: normalizeStringList(req.body.hashtags, 'hashtags', 20, 64),
          mentionedUserIds: normalizeStringList(req.body.mentionedUserIds, 'mentionedUserIds', 50, 100),
          location: normalizeOptionalUserText(req.body.location, {
            field: 'location',
            maxLength: 120,
            allowEmpty: true,
          }),
          publishedAt: new Date(),
        },
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE VIDEO
// ===========================================
router.patch(
  '/:id',
  authenticate,
  [
    body('title').optional().isString().isLength({ max: CONTENT_LIMITS.videoTitle }),
    body('description').optional().isString().isLength({ max: CONTENT_LIMITS.videoDescription }),
    body('status').optional().isIn(['PROCESSING', 'PUBLISHED', 'HIDDEN', 'REMOVED']),
    body('type').optional().isIn(['REEL', 'STORY', 'TUTORIAL', 'CAREER_STORY', 'MENTOR_TIP', 'LIVE_REPLAY']),
    body('thumbnailUrl').optional().isString().isLength({ max: 2048 }),
    body('hashtags').optional().isArray(),
    body('mentionedUserIds').optional().isArray(),
    body('location').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const existing = await prisma.video.findUnique({ where: { id } });
      if (!existing) {
        throw new ApiError(404, 'Video not found');
      }

      if (existing.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'Not authorized');
      }

      const data: any = {};

      if (req.body.title !== undefined) {
        data.title = normalizeOptionalUserText(req.body.title, {
          field: 'title',
          maxLength: CONTENT_LIMITS.videoTitle,
          allowEmpty: true,
        }) ?? null;
      }
      if (req.body.description !== undefined) {
        data.description = normalizeOptionalUserText(req.body.description, {
          field: 'description',
          maxLength: CONTENT_LIMITS.videoDescription,
          allowEmpty: true,
        }) ?? null;
      }
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.type !== undefined) data.type = req.body.type;
      if (req.body.thumbnailUrl !== undefined) {
        data.thumbnailUrl = normalizeSafeUrl(req.body.thumbnailUrl, {
          field: 'thumbnailUrl',
          allowRelativeUploads: true,
        });
      }
      if (req.body.hashtags !== undefined) {
        data.hashtags = normalizeStringList(req.body.hashtags, 'hashtags', 20, 64);
      }
      if (req.body.mentionedUserIds !== undefined) {
        data.mentionedUserIds = normalizeStringList(req.body.mentionedUserIds, 'mentionedUserIds', 50, 100);
      }
      if (req.body.location !== undefined) {
        data.location = normalizeOptionalUserText(req.body.location, {
          field: 'location',
          maxLength: 120,
          allowEmpty: true,
        }) ?? null;
      }

      const updated = await prisma.video.update({
        where: { id },
        data,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// LIKE VIDEO
// ===========================================
router.post('/:id/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video || video.isHidden || video.status !== 'PUBLISHED') {
      throw new ApiError(404, 'Video not found');
    }

    const existing = await prisma.videoLike.findUnique({
      where: { videoId_userId: { videoId: id, userId: req.user!.id } },
    });

    if (existing) {
      throw new ApiError(400, 'Already liked this video');
    }

    await prisma.videoLike.create({
      data: { videoId: id, userId: req.user!.id },
    });

    await prisma.video.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    });

    res.json({ success: true, message: 'Video liked' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UNLIKE VIDEO
// ===========================================
router.delete('/:id/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await prisma.videoLike.deleteMany({
      where: { videoId: id, userId: req.user!.id },
    });

    if (deleted.count > 0) {
      await prisma.video.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      });
    }

    res.json({ success: true, message: 'Like removed' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// COMMENTS
// ===========================================
router.get('/:id/comments', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseLimit(req.query.limit, 20, 50);

    const comments = await prisma.videoComment.findMany({
      where: { videoId: id, parentId: null, isHidden: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        author: { select: { id: true, displayName: true, avatar: true } },
        replies: {
          include: { author: { select: { id: true, displayName: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/comments',
  authenticate,
  [
    body('content').isString().notEmpty().isLength({ max: CONTENT_LIMITS.comment }).withMessage('Comment max 2000 characters'),
    body('parentId').optional().isString().isLength({ max: 100 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const video = await prisma.video.findUnique({ where: { id } });
      if (!video || video.isHidden || video.status !== 'PUBLISHED') {
        throw new ApiError(404, 'Video not found');
      }

      const parentId = typeof req.body.parentId === 'string' && req.body.parentId.trim()
        ? req.body.parentId.trim()
        : undefined;

      if (parentId) {
        const parent = await prisma.videoComment.findUnique({
          where: { id: parentId },
          select: { videoId: true, isHidden: true },
        });

        if (!parent || parent.videoId !== id || parent.isHidden) {
          throw new ApiError(400, 'Invalid parent comment');
        }
      }

      const comment = await prisma.videoComment.create({
        data: {
          videoId: id,
          authorId: req.user!.id,
          content: normalizeUserText(req.body.content, {
            field: 'content',
            maxLength: CONTENT_LIMITS.comment,
          }),
          parentId,
        },
      });

      await prisma.video.update({
        where: { id },
        data: { commentCount: { increment: 1 } },
      });

      res.status(201).json({ success: true, data: comment });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// SAVE VIDEO
// ===========================================
router.post('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video || video.isHidden || video.status !== 'PUBLISHED') {
      throw new ApiError(404, 'Video not found');
    }

    const existing = await prisma.videoSave.findUnique({
      where: { videoId_userId: { videoId: id, userId: req.user!.id } },
    });

    if (existing) {
      throw new ApiError(400, 'Already saved this video');
    }

    await prisma.videoSave.create({
      data: { videoId: id, userId: req.user!.id },
    });

    await prisma.video.update({
      where: { id },
      data: { saveCount: { increment: 1 } },
    });

    res.json({ success: true, message: 'Video saved' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await prisma.videoSave.deleteMany({
      where: { videoId: id, userId: req.user!.id },
    });

    if (deleted.count > 0) {
      await prisma.video.update({
        where: { id },
        data: { saveCount: { decrement: 1 } },
      });
    }

    res.json({ success: true, message: 'Save removed' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RECORD VIEW
// ===========================================
router.post(
  '/:id/view',
  optionalAuth,
  [
    body('watchDuration').isInt({ min: 1 }),
    body('completionPct').isFloat({ min: 0, max: 100 }),
    body('source').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const video = await prisma.video.findUnique({ where: { id } });
      if (!video || video.isHidden || video.status !== 'PUBLISHED') {
        throw new ApiError(404, 'Video not found');
      }

      await prisma.videoView.create({
        data: {
          videoId: id,
          userId: req.user?.id,
          watchDuration: Number(req.body.watchDuration),
          completionPct: Number(req.body.completionPct),
          source: normalizeOptionalUserText(req.body.source, {
            field: 'source',
            maxLength: 80,
            allowEmpty: true,
          }),
        },
      });

      await prisma.video.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });

      res.json({ success: true, message: 'View recorded' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
