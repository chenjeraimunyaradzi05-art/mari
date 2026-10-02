/**
 * Ceilings on how fast one account can act on other people: post, comment,
 * follow, open threads, repost, react, report. Generous for anyone using the
 * platform as intended; a wall for a script or a harassment spree. Keyed by
 * the signed-in member, so a shared office network is never penalised.
 *
 * Built on the sliding-window limiter, which counts in Redis and, while Redis
 * is unreachable, in each API process instead (so a flood is still slowed, per
 * instance). These limiters stand down only when no REDIS_URL is set at all,
 * which production cannot be (the API will not boot without one): local
 * development and tests, where there is nothing to count against and a test
 * run must never wait on a connection attempt.
 */

import type { Request } from 'express';
import { createRateLimiter, slidingWindowRateLimit } from './rateLimiter';
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
  // Direct messages: generous for a real conversation, a wall for a spammer
  // pasting the same line into every thread they can open.
  message: { max: 60, windowMs: 5 * MINUTE },
  // Live chat moves faster than a thread — a busy room is people reacting in
  // the same second — so the window is a minute rather than five. Twenty a
  // minute is more than anyone types by hand and far below what it takes to
  // bury a host's chat under a flood while she is on camera in front of her
  // audience, which is the thing this ceiling exists to stop.
  liveChat: { max: 20, windowMs: MINUTE },
} as const;

export const postLimiter = limiter('post', SOCIAL_LIMITS.post.max, SOCIAL_LIMITS.post.windowMs);
export const commentLimiter = limiter('comment', SOCIAL_LIMITS.comment.max, SOCIAL_LIMITS.comment.windowMs);
export const followLimiter = limiter('follow', SOCIAL_LIMITS.follow.max, SOCIAL_LIMITS.follow.windowMs);
export const conversationLimiter = limiter('conversation', SOCIAL_LIMITS.conversation.max, SOCIAL_LIMITS.conversation.windowMs);
export const repostLimiter = limiter('repost', SOCIAL_LIMITS.repost.max, SOCIAL_LIMITS.repost.windowMs);
export const reactionLimiter = limiter('reaction', SOCIAL_LIMITS.reaction.max, SOCIAL_LIMITS.reaction.windowMs);
export const reportLimiter = limiter('report', SOCIAL_LIMITS.report.max, SOCIAL_LIMITS.report.windowMs);
export const messageLimiter = limiter('message', SOCIAL_LIMITS.message.max, SOCIAL_LIMITS.message.windowMs);
export const liveChatLimiter = limiter('live-chat', SOCIAL_LIMITS.liveChat.max, SOCIAL_LIMITS.liveChat.windowMs);

/**
 * Ceilings on how often one member may reach the same other member.
 *
 * Every limit above counts what an account does to everybody, and all of them
 * are comfortable for a harassment campaign aimed at one person: thirty
 * comments in five minutes is a lot across a feed and nothing when every one is
 * under the same woman's posts, and sixty follows in ten minutes lets one
 * account follow, unfollow and follow her again all afternoon, each time
 * ringing her phone. These are keyed by the pair, so an account that spreads
 * itself thin is untouched and one that fixes on a single person is stopped.
 *
 *   follow   starting to follow, or asking to, the same member
 *   comment  comments under the same member's posts
 *   mention  @-mentions of the same member
 *   notice   anything else that would ring the same member's bell (likes,
 *            reposts, replies), so a spree of small things is as bounded as a
 *            spree of large ones
 *
 * Generous for people who know each other: five follows in an hour is more
 * than anyone presses by accident, and twelve comments is a conversation.
 */
export const TARGET_LIMITS = {
  follow: { max: 5, windowMs: HOUR },
  comment: { max: 12, windowMs: HOUR },
  mention: { max: 5, windowMs: HOUR },
  notice: { max: 30, windowMs: HOUR },
} as const;

export type TargetedKind = keyof typeof TARGET_LIMITS;

/**
 * Counts one more thing `actorId` is doing to `targetId` and says whether it is
 * still within the ceiling for its kind. Shares the sliding window, and the
 * Redis-or-in-process fallback, with the per-member limiters; and like them it
 * stands down when there is no Redis to count against (local development and
 * tests), so a test run never waits on a connection attempt.
 */
export async function withinTargetLimit(kind: TargetedKind, actorId: string, targetId: string): Promise<boolean> {
  if (inactive()) return true;
  const { max, windowMs } = TARGET_LIMITS[kind];
  const { allowed } = await slidingWindowRateLimit(`social:target:${kind}:${actorId}:${targetId}`, windowMs, max);
  return allowed;
}

/**
 * Public, unauthenticated forms (a referee's reference form) are keyed by the
 * caller's address: the tokens are unguessable, but a ceiling keeps anyone
 * from hammering the endpoint all the same.
 */
export const publicFormLimiter = createRateLimiter({
  max: 60,
  windowMs: HOUR,
  skip: inactive,
  keyGenerator: (req: Request) => `public-form:${req.ip}`,
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: 'Too many requests. Please try again in a little while.' });
  },
});

/**
 * The same ceiling for a path that has no Express middleware chain: the
 * socket. In memory and per process, which is enough to stop one account
 * flooding a thread; the HTTP path keeps the Redis-backed limiter.
 */
export function createMemoryThrottle(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now = Date.now()): boolean {
      const since = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((at) => at > since);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      // Keep the map from growing with every account that ever sent one message.
      if (hits.size > 10_000) {
        for (const [k, stamps] of hits) {
          if (stamps.every((at) => at <= since)) hits.delete(k);
        }
      }
      return true;
    },
  };
}

export const socketMessageThrottle = createMemoryThrottle(SOCIAL_LIMITS.message.max, SOCIAL_LIMITS.message.windowMs);

/**
 * Live chat has the same problem, and had none of the answer. The REST route
 * POST /api/livestream/:id/messages calls itself "the REST path; the socket is
 * the live one", and it is right: the page sends `live:chat` over the socket,
 * so an HTTP limiter mounted on that route never sees the messages that
 * actually reach a host's room. Until this existed there was no ceiling on
 * live chat at any speed, by any door.
 */
export const liveChatThrottle = createMemoryThrottle(SOCIAL_LIMITS.liveChat.max, SOCIAL_LIMITS.liveChat.windowMs);
