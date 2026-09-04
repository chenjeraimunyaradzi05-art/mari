/**
 * Sounds: trending audio, one sound's page, and making new ones.
 *
 *   GET  /api/sounds/trending?period=week&limit=20
 *   GET  /api/sounds/:id
 *   GET  /api/sounds/:id/videos
 *   POST /api/sounds                      upload-backed sound
 *   POST /api/sounds/from-video/:videoId  a reel's original sound
 */

import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { normalizeOptionalUserText, normalizeSafeUrl, normalizeUserText } from '../utils/contentSafety';
import {
  createSound,
  getSound,
  getTrendingSounds,
  soundFromVideo,
  type TrendingPeriod,
} from '../services/sound.service';

const router = Router();

const PERIODS: TrendingPeriod[] = ['day', 'week', 'month', 'all'];

function parsePeriod(value: unknown): TrendingPeriod {
  return typeof value === 'string' && (PERIODS as string[]).includes(value) ? (value as TrendingPeriod) : 'week';
}

function parseLimit(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

router.get('/trending', async (req, res, next) => {
  try {
    const result = await getTrendingSounds({
      period: parsePeriod(req.query.period),
      limit: parseLimit(req.query.limit, 20, 50),
    });
    res.json({ success: true, data: result.sounds, period: result.period });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await getTrendingSounds({
      period: parsePeriod(req.query.period),
      limit: parseLimit(req.query.limit, 20, 50),
    });
    res.json({ success: true, data: result.sounds, period: result.period });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  authenticate,
  [
    body('title').isString().notEmpty().isLength({ max: 120 }),
    body('artist').optional().isString().isLength({ max: 120 }),
    body('audioUrl').isString().notEmpty().isLength({ max: 2048 }),
    body('duration').isInt({ min: 1, max: 60 * 60 }),
    body('licenseType').optional().isString().isLength({ max: 60 }),
    body('coverUrl').optional().isString().isLength({ max: 2048 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const sound = await createSound({
        createdById: req.user!.id,
        title: normalizeUserText(req.body.title, { field: 'title', maxLength: 120 }),
        artist: normalizeOptionalUserText(req.body.artist, { field: 'artist', maxLength: 120, allowEmpty: true }) || null,
        audioUrl: normalizeSafeUrl(req.body.audioUrl, { field: 'audioUrl', allowRelativeUploads: true }),
        duration: Number(req.body.duration),
        licenseType: typeof req.body.licenseType === 'string' ? req.body.licenseType : undefined,
        coverUrl: req.body.coverUrl
          ? normalizeSafeUrl(req.body.coverUrl, { field: 'coverUrl', allowRelativeUploads: true })
          : undefined,
      });

      res.status(201).json({ success: true, data: sound });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/from-video/:videoId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const sound = await soundFromVideo(req.params.videoId, req.user!.id);
    res.status(201).json({ success: true, data: sound });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getSound(req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/videos', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const rows = await prisma.video.findMany({
      where: { audioTrackId: req.params.id, status: 'PUBLISHED', isHidden: false },
      include: { author: { select: { id: true, displayName: true, avatar: true, headline: true } } },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const videos = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      success: true,
      data: videos,
      nextCursor: hasMore ? videos[videos.length - 1].id : null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
