/**
 * Ceilings on how fast one account can act on other people: post, comment,
 * follow, open threads, repost, react, report. Generous for anyone using the
 * platform as intended; a wall for a script or a harassment spree. Keyed by
 * the signed-in member, so a shared office network is never penalised.
 *
 * Built on the sliding-window limiter, which allows everything when Redis is
 * not configured (local development and tests).
 */

import type { Request } from 'express';
import { createRateLimiter } from './rateLimiter';
import type { AuthRequest } from './auth';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function byMember(scope: string) {
  return (req: Request) => `social:${scope}:${(req as AuthRequest).user?.id || req.ip}`;
}

// Without a configured Redis there is nothing to count against, and a test
// run must never wait on a connection attempt.
const inactive = () => process.env.NODE_ENV === 'test' || !process.env.REDIS_URL;

function limiter(scope: string, max: number, windowMs: number) {
  return createRateLimiter({
    max,
    windowMs,
    skip: inactive,
    keyGenerator: byMember(scope),
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message: 'You are doing that a lot. Take a short break and try again in a few minutes.',
      });
    },
  });
}

export const SOCIAL_LIMITS = {
  post: { max: 15, windowMs: 10 * MINUTE },
  comment: { max: 30, windowMs: 5 * MINUTE },
  follow: { max: 60, windowMs: 10 * MINUTE },
  conversation: { max: 25, windowMs: HOUR },
  repost: { max: 30, windowMs: 10 * MINUTE },
  reaction: { max: 200, windowMs: 5 * MINUTE },
  report: { max: 15, windowMs: HOUR },
} as const;

export const postLimiter = limiter('post', SOCIAL_LIMITS.post.max, SOCIAL_LIMITS.post.windowMs);
export const commentLimiter = limiter('comment', SOCIAL_LIMITS.comment.max, SOCIAL_LIMITS.comment.windowMs);
export const followLimiter = limiter('follow', SOCIAL_LIMITS.follow.max, SOCIAL_LIMITS.follow.windowMs);
export const conversationLimiter = limiter('conversation', SOCIAL_LIMITS.conversation.max, SOCIAL_LIMITS.conversation.windowMs);
export const repostLimiter = limiter('repost', SOCIAL_LIMITS.repost.max, SOCIAL_LIMITS.repost.windowMs);
export const reactionLimiter = limiter('reaction', SOCIAL_LIMITS.reaction.max, SOCIAL_LIMITS.reaction.windowMs);
export const reportLimiter = limiter('report', SOCIAL_LIMITS.report.max, SOCIAL_LIMITS.report.windowMs);
