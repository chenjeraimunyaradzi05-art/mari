import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for video uploads
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format. Use MP4, MOV, or WebM.'));
    }
  },
});

function parseLimit(value: unknown, fallback = 20, max = 50): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

// ===========================================
// VIDEO UPLOAD
// ===========================================
router.post('/upload', authenticate, videoUpload.single('video'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new ApiError(400, 'No video file provided');
    }

    // Parse metadata from form data
    const title = req.body.title || 'Untitled Video';
    const description = req.body.description || '';
    const category = req.body.category || 'Other';
    const visibility = req.body.visibility || 'public';
    const hashtags = req.body.hashtags ? JSON.parse(req.body.hashtags) : [];
    const trimStart = parseFloat(req.body.trimStart) || 0;
    const trimEnd = parseFloat(req.body.trimEnd) || 0;

    // Generate unique filename
    const fileExtension = path.extname(file.originalname) || '.mp4';
    const key = `videos/${req.user!.id}/${uuidv4()}${fileExtension}`;

    // Save video file locally (or S3 in production)
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, key);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.buffer);

    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    const videoUrl = `${apiUrl}/uploads/${key}`;

    // Create video record in database
    const video = await prisma.video.create({
      data: {
        authorId: req.user!.id,
        title,
        description,
        videoUrl,
        type: 'REEL',
        status: 'PUBLISHED',
        hashtags,
        publishedAt: new Date(),
        duration: Math.round(trimEnd - trimStart),
      },
    });

    logger.info('Video uploaded successfully', { videoId: video.id, userId: req.user!.id });

    res.status(201).json({
      success: true,
      data: video,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// VIDEO FEED
// ===========================================
router.get('/feed', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;

    const where: any = {
      status: 'PUBLISHED',
      isHidden: false,
    };

    if (type) {
      where.type = type;
    }

    const videos = await prisma.video.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

    if (!video || video.isHidden) {
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
    body('title').optional().isString().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 5000 }),
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
          title: req.body.title,
          description: req.body.description,
          type: req.body.type,
          status: 'PUBLISHED',
          videoUrl: req.body.videoUrl,
          thumbnailUrl: req.body.thumbnailUrl,
          duration: req.body.duration,
          aspectRatio: req.body.aspectRatio,
          hashtags: req.body.hashtags || [],
          mentionedUserIds: req.body.mentionedUserIds || [],
          location: req.body.location,
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
    body('title').optional().isString().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 5000 }),
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

      const updated = await prisma.video.update({
        where: { id },
        data: {
          title: req.body.title,
          description: req.body.description,
          status: req.body.status,
          type: req.body.type,
          thumbnailUrl: req.body.thumbnailUrl,
          hashtags: req.body.hashtags,
          mentionedUserIds: req.body.mentionedUserIds,
          location: req.body.location,
        },
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
    if (!video) {
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
  [body('content').isString().notEmpty().isLength({ max: 2000 }).withMessage('Comment max 2000 characters'), body('parentId').optional().isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) {
        throw new ApiError(404, 'Video not found');
      }

      const comment = await prisma.videoComment.create({
        data: {
          videoId: id,
          authorId: req.user!.id,
          content: req.body.content,
          parentId: req.body.parentId,
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
    if (!video) {
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
      if (!video) {
        throw new ApiError(404, 'Video not found');
      }

      await prisma.videoView.create({
        data: {
          videoId: id,
          userId: req.user?.id,
          watchDuration: req.body.watchDuration,
          completionPct: req.body.completionPct,
          source: req.body.source,
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
