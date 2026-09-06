/**
 * Product feedback from the help centre.
 *
 * Anyone can send it, signed in or not; a signed-in member's account is
 * attached so staff can reply, a visitor may leave an email. It is rate
 * limited by address, and the message is kept as typed.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();

export const FEEDBACK_CATEGORIES = ['BUG', 'IDEA', 'PRAISE', 'OTHER'] as const;

const limiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  handler: (_req: Request, res: Response) => res.status(429).json({ success: false, message: 'Too much feedback from this address for now; try again in an hour.' }),
});

const clean = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

/** POST /api/feedback */
router.post(
  '/',
  limiter,
  optionalAuth,
  [
    body('message').isString().trim().isLength({ min: 10, max: 4000 }).withMessage('Say a little more: at least ten characters, at most four thousand'),
    body('category').optional().isIn(FEEDBACK_CATEGORIES as unknown as string[]).withMessage('Unknown category'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('That email does not look right'),
    body('page').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

      const feedback = await prisma.feedback.create({
        data: {
          userId: req.user?.id ?? null,
          email: req.user?.email ?? (clean(req.body.email, 254)?.toLowerCase() ?? null),
          page: clean(req.body.page, 300),
          category: req.body.category ?? 'OTHER',
          message: req.body.message,
          userAgent: clean(req.get('user-agent'), 300),
        },
        select: { id: true },
      });

      logger.info('Feedback received', { feedbackId: feedback.id, category: req.body.category ?? 'OTHER', signedIn: Boolean(req.user) });
      res.status(201).json({ success: true, data: { id: feedback.id } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
