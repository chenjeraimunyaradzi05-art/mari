/**
 * Live Streaming & Gifting Routes
 * API endpoints for live streaming and virtual gifting
 */
import { Router, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as livestreamService from '../services/livestream.service';

const router = Router();

// ==========================================
// STREAM KEY MANAGEMENT
// ==========================================

/**
 * Generate a new stream key for the authenticated user
 * POST /api/livestream/key
 */
router.post('/key', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const streamKey = await livestreamService.createStreamKey(req.user!.id);
    
    res.json({
      success: true,
      data: {
        key: streamKey.key,
        serverUrl: streamKey.serverUrl,
        playbackUrl: streamKey.playbackUrl,
        expiresAt: streamKey.expiresAt,
        instructions: {
          obs: `In OBS, go to Settings > Stream, select "Custom" and enter:\n- Server: ${streamKey.serverUrl.split('/').slice(0, -1).join('/')}\n- Stream Key: ${streamKey.key}`,
          streamlabs: 'In Streamlabs, use the same settings as OBS above.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke current stream key
 * DELETE /api/livestream/key
 */
router.delete('/key', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await livestreamService.revokeStreamKey(req.user!.id);
    res.json({ success: true, message: 'Stream key revoked' });
  } catch (error) {
    next(error);
  }
});

/**
 * Validate stream key (called by RTMP server)
 * POST /api/livestream/key/validate
 */
router.post('/key/validate', [
  body('key').isString().notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { key } = req.body;
    const result = await livestreamService.validateStreamKey(key);
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// LIVE STREAM MANAGEMENT
// ==========================================

/**
 * Start a live stream
 * POST /api/livestream/start
 */
router.post('/start', authenticate, [
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('thumbnailUrl').optional().isURL(),
  body('category').optional().isString(),
], async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { title, description, thumbnailUrl, category } = req.body;
    const stream = await livestreamService.startLiveStream(req.user!.id, {
      title,
      description,
      thumbnailUrl,
      category,
    });

    res.status(201).json({ success: true, data: stream });
  } catch (error) {
    next(error);
  }
});

/**
 * End a live stream
 * POST /api/livestream/:streamId/end
 */
router.post('/:streamId/end', authenticate, [
  param('streamId').isString().notEmpty(),
], async (req: AuthRequest, res, next) => {
  try {
    const { streamId } = req.params;
    const result = await livestreamService.endLiveStream(streamId, req.user!.id);
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get live streams
 * GET /api/livestream
 */
router.get('/', [
  query('category').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('cursor').optional().isString(),
], async (req, res, next) => {
  try {
    const { category, limit, cursor } = req.query;
    const result = await livestreamService.getLiveStreams({
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: cursor as string | undefined,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// WALLET & COINS
// ==========================================

/**
 * Get wallet balance
 * GET /api/livestream/wallet
 */
router.get('/wallet', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const wallet = await livestreamService.getWalletBalance(req.user!.id);
    res.json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
});

/**
 * Purchase coins
 * POST /api/livestream/wallet/purchase
 */
router.post('/wallet/purchase', authenticate, [
  body('amount').isInt({ min: 100 }),
  body('paymentIntentId').isString().notEmpty(),
], async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { amount, paymentIntentId } = req.body;
    const result = await livestreamService.purchaseCoins(
      req.user!.id,
      amount,
      paymentIntentId
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get gift catalog
 * GET /api/livestream/gifts
 */
router.get('/gifts', (req, res) => {
  res.json({
    success: true,
    data: livestreamService.GIFT_CATALOG,
  });
});

// ==========================================
// GIFTING
// ==========================================

/**
 * Send a gift to a streamer
 * POST /api/livestream/:streamId/gift
 */
router.post('/:streamId/gift', authenticate, [
  param('streamId').isString().notEmpty(),
  body('giftType').isString().notEmpty(),
], async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation failed', errors.array());
    }

    const { streamId } = req.params;
    const { giftType, receiverId } = req.body;

    const transaction = await livestreamService.sendGift(
      req.user!.id,
      receiverId,
      streamId,
      giftType
    );

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
});

/**
 * Get gifts for a stream
 * GET /api/livestream/:streamId/gifts
 */
router.get('/:streamId/gifts', [
  param('streamId').isString().notEmpty(),
], async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const result = await livestreamService.getStreamGifts(streamId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get gift leaderboard for a stream
 * GET /api/livestream/:streamId/leaderboard
 */
router.get('/:streamId/leaderboard', [
  param('streamId').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    
    const leaderboard = await livestreamService.getGiftLeaderboard(streamId, limit);
    
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// PAYOUTS
// ==========================================

/**
 * Request payout of earnings
 * POST /api/livestream/wallet/payout
 */
router.post('/wallet/payout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const payout = await livestreamService.requestPayout(req.user!.id);
    res.json({ success: true, data: payout });
  } catch (error) {
    next(error);
  }
});

export default router;
