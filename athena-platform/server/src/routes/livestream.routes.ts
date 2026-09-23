/**
 * Live streaming.
 *
 *   GET    /api/livestream                 streams that are live now (?status=ENDED for replays list)
 *   GET    /api/livestream/gifts           gift catalogue
 *   GET    /api/livestream/wallet          my gift-point balance
 *   GET    /api/livestream/mine            my streams, newest first
 *   POST   /api/livestream                 prepare a stream (key, ingest and playback URLs)
 *   GET    /api/livestream/:id             one stream (host sees key and ingest)
 *   PATCH  /api/livestream/:id             host edits details or playback URL
 *   POST   /api/livestream/:id/start       host goes live
 *   POST   /api/livestream/:id/end         host ends it
 *   GET    /api/livestream/:id/messages    recent chat
 *   POST   /api/livestream/:id/messages    say something (REST path; the socket is the live one)
 *   DELETE /api/livestream/:id/messages/:messageId  host takes a message out of the room
 *   DELETE /api/livestream/:id/viewers/:userId      host removes someone from her stream
 *   POST   /api/livestream/:id/gift        send a gift
 *   GET    /api/livestream/:id/leaderboard top gifters
 *   POST   /api/livestream/key/validate    RTMP publish hook: may this key push?
 *   POST   /api/livestream/webhooks/rtmp   RTMP publish / publish_done events
 */

import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { liveChatLimiter } from '../middleware/socialLimits';
import { normalizeOptionalUserText, normalizeSafeUrl, normalizeUserText } from '../utils/contentSafety';
import * as live from '../services/livestream.service';

const router = Router();

function validationError(req: Request) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);
}

function optionalCategory(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const category = String(value).trim().toLowerCase();
  if (!(live.LIVE_CATEGORIES as readonly string[]).includes(category)) {
    throw new ApiError(400, `Category must be one of ${live.LIVE_CATEGORIES.join(', ')}`);
  }
  return category;
}

function optionalUrl(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return normalizeSafeUrl(String(value), { field, allowRelativeUploads: true });
}

function optionalDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${field} must be a valid date`);
  return date;
}

/**
 * Compares a presented secret without leaking its length or its prefix through
 * timing. Digests are compared rather than the strings themselves, because
 * timingSafeEqual requires equal-length buffers and the length of what someone
 * sent is itself something not worth telling them.
 */
function secretMatches(presented: unknown, expected: string): boolean {
  if (typeof presented !== 'string' || presented.length === 0) return false;
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(presented).digest(),
    crypto.createHash('sha256').update(expected).digest()
  );
}

/**
 * The two RTMP hooks below carry no `authenticate`, because the caller is a
 * media server rather than a person. This is the whole of their authentication.
 *
 * It used to return early when LIVESTREAM_WEBHOOK_SECRET was unset, on the
 * reasoning that a self-hosted ingest server on a private network could then
 * be used without one. That was a fail-open on an unauthenticated endpoint
 * that can end a live broadcast, reachable by anyone who can reach the API at
 * all — and it failed open silently, because nothing validates the variable at
 * boot and the production template ships it commented out. A private-network
 * RTMP server can be handed a secret exactly as easily as it is handed a URL,
 * so the exemption bought nothing it could not have had anyway. Unconfigured
 * now means the hooks are closed, which is what "not configured" should mean.
 */
function requireHookSecret(req: Request) {
  const expected = process.env.LIVESTREAM_WEBHOOK_SECRET?.trim();
  if (!expected) throw new ApiError(503, 'Livestream webhooks are not configured');
  const presented = req.headers['x-livestream-secret'] ?? req.body?.secret;
  if (!secretMatches(presented, expected)) throw new ApiError(401, 'Invalid webhook secret');
}

// ------------------------------------------------------------------
// Static paths first, so /gifts, /wallet, /mine and the hooks are never
// mistaken for a stream id.
// ------------------------------------------------------------------

router.get('/gifts', (_req, res) => {
  res.json({ success: true, data: live.giftCatalog() });
});

router.get('/wallet', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, data: await live.walletBalance(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.get('/mine', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, data: await live.myStreams(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/key/validate',
  [body('key').isString().notEmpty().isLength({ max: 256 })],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      validationError(req);
      requireHookSecret(req);
      const result = await live.validateStreamKey(req.body.key);
      if (!result.valid) {
        // Most RTMP servers treat a non-2xx as "reject the publish".
        return res.status(403).json({ success: false, data: result });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/webhooks/rtmp',
  [
    body('key').isString().notEmpty().isLength({ max: 256 }),
    body('event').isIn(['publish', 'publish_done']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      validationError(req);
      requireHookSecret(req);
      const result = await live.rtmpEvent(req.body.key, req.body.event);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ------------------------------------------------------------------
// Streams
// ------------------------------------------------------------------

router.get('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const status = req.query.status === 'ENDED' ? 'ENDED' : 'LIVE';
    const category = typeof req.query.category === 'string' ? optionalCategory(req.query.category) ?? undefined : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const streams = await live.listStreams({ status, category, limit, viewerId: req.user?.id });
    res.json({ success: true, data: streams, ingestConfigured: Boolean(live.ingestConfig().ingestUrl) });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  authenticate,
  [
    body('title').isString().trim().isLength({ min: 1, max: 200 }),
    body('description').optional({ values: 'null' }).isString().isLength({ max: 2000 }),
    body('category').optional({ values: 'null' }).isString().isLength({ max: 40 }),
    body('thumbnailUrl').optional({ values: 'null' }).isString().isLength({ max: 2048 }),
    body('playbackUrl').optional({ values: 'null' }).isString().isLength({ max: 2048 }),
    body('scheduledFor').optional({ values: 'null' }).isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      validationError(req);
      const stream = await live.createStream(req.user!.id, {
        title: normalizeUserText(req.body.title, { field: 'title', maxLength: 200 }),
        description: normalizeOptionalUserText(req.body.description, {
          field: 'description',
          maxLength: 2000,
          allowEmpty: true,
        }),
        category: optionalCategory(req.body.category),
        thumbnailUrl: optionalUrl(req.body.thumbnailUrl, 'thumbnailUrl'),
        playbackUrl: optionalUrl(req.body.playbackUrl, 'playbackUrl'),
        scheduledFor: optionalDate(req.body.scheduledFor, 'scheduledFor'),
      });
      res.status(201).json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, data: await live.getStream(req.params.id, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:id',
  authenticate,
  [
    body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('description').optional({ values: 'null' }).isString().isLength({ max: 2000 }),
    body('category').optional({ values: 'null' }).isString().isLength({ max: 40 }),
    body('thumbnailUrl').optional({ values: 'null' }).isString().isLength({ max: 2048 }),
    body('playbackUrl').optional({ values: 'null' }).isString().isLength({ max: 2048 }),
    body('scheduledFor').optional({ values: 'null' }).isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      validationError(req);
      const stream = await live.updateStream(req.params.id, req.user!.id, {
        ...(req.body.title !== undefined
          ? { title: normalizeUserText(req.body.title, { field: 'title', maxLength: 200 }) }
          : {}),
        ...(req.body.description !== undefined
          ? {
              description: normalizeOptionalUserText(req.body.description, {
                field: 'description',
                maxLength: 2000,
                allowEmpty: true,
              }),
            }
          : {}),
        category: optionalCategory(req.body.category),
        thumbnailUrl: optionalUrl(req.body.thumbnailUrl, 'thumbnailUrl'),
        playbackUrl: optionalUrl(req.body.playbackUrl, 'playbackUrl'),
        scheduledFor: optionalDate(req.body.scheduledFor, 'scheduledFor'),
      });
      res.json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:id/start', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, data: await live.startStream(req.params.id, req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/end', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, data: await live.endStream(req.params.id, req.user!.id) });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------
// Chat and gifts
// ------------------------------------------------------------------

// optionalAuth so the backlog can be filtered for whoever is reading it: a
// signed-in viewer does not get the lines of someone she blocked, or of
// someone who blocked her.
router.get('/:id/messages', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || 100 : 100;
    res.json({ success: true, data: await live.recentMessages(req.params.id, limit, req.user?.id) });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/messages',
  authenticate,
  liveChatLimiter,
  [body('content').isString().trim().isLength({ min: 1, max: live.LIVE_CHAT_MAX_LENGTH })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      validationError(req);
      const message = await live.postChatMessage(
        req.params.id,
        req.user!.id,
        normalizeUserText(req.body.content, { field: 'content', maxLength: live.LIVE_CHAT_MAX_LENGTH })
      );
      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }
);

// ------------------------------------------------------------------
// Host controls
// ------------------------------------------------------------------
// Ownership is asserted in the service, which loads the stream and refuses
// anyone who is not its host, exactly as the group moderation routes assert a
// role before touching a member.

router.delete('/:id/messages/:messageId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({
      success: true,
      data: await live.deleteChatMessage(req.params.id, req.params.messageId, req.user!.id),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/viewers/:userId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, data: await live.removeViewer(req.params.id, req.user!.id, req.params.userId) });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/gift',
  authenticate,
  [
    body('giftType').isString().notEmpty().isLength({ max: 50 }),
    body('message').optional({ values: 'null' }).isString().isLength({ max: 200 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      validationError(req);
      const result = await live.sendStreamGift(
        req.params.id,
        req.user!.id,
        req.body.giftType,
        normalizeOptionalUserText(req.body.message, { field: 'message', maxLength: 200, allowEmpty: true }) || undefined
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id/leaderboard', async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || 10 : 10;
    res.json({ success: true, data: await live.giftLeaderboard(req.params.id, limit) });
  } catch (error) {
    next(error);
  }
});

export default router;
