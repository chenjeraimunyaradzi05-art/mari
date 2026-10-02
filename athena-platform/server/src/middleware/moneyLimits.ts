/**
 * Ceilings on how fast one member can start moving money.
 *
 * Until this existed the only limit on a route that creates a Stripe intent, a
 * hold, a gift or a withdrawal was the overall budget per address, which is
 * sized for browsing and is nothing against a script trying a list of stolen
 * cards one small purchase at a time ("card testing"), or emptying a balance
 * with a request a second. A woman paying for a mentor session, topping up her
 * gift balance or asking for her earnings does each of these a handful of times
 * a day at most, so the ceilings here sit well above that and are a wall only
 * for a script.
 *
 * Three kinds of limit:
 *
 *   - how many payments one member may START in an hour (an intent, a hold, a
 *     checkout), shared across every route that starts one, because a script
 *     does not care which door it uses;
 *   - how many gifts, and how many withdrawals, per member per window;
 *   - a pause after repeated declines: five declined cards in an hour and no new
 *     payment is started for the rest of it. Stripe tells us about every decline
 *     (payment_intent.payment_failed) and the webhook counts it here.
 *
 * Built on the sliding-window limiter, which keeps the window in this process
 * when Redis is not there. Unlike social limits these are not skipped in
 * development or tests: a money ceiling that quietly allows everything when its
 * store is missing is not a ceiling. Keyed on the signed-in member, never the
 * address, so a shared office or campus network is not penalised for one
 * person's loop.
 *
 * What these do not do: Stripe Radar rules, 3D Secure and per-card or per-email
 * limits are Stripe Dashboard configuration, because the card number never
 * reaches this server. See the launch checklist.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createRateLimiter } from './rateLimiter';
import type { AuthRequest } from './auth';
import { getRedisClient } from '../utils/cache';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from './errorHandler';
import { assertPaymentsOpen } from '../services/feature-flags.service';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const MONEY_LIMITS = {
  /** Payments started per member per hour, across every route that starts one. */
  intent: { max: 12, windowMs: HOUR },
  /** Gifts sent per member. Live chat moves fast; sixty in ten minutes is a busy room. */
  gift: { max: 60, windowMs: 10 * MINUTE },
  /** Withdrawal requests per member per day. A real one is once a week or so. */
  payout: { max: 3, windowMs: DAY },
  /** Holds on cards recorded per buyer per hour, counted from the database. */
  holdsPerBuyer: { max: 15, windowMs: HOUR },
  /** This many declined payments in the window pauses new payments for the rest of it. */
  declines: { max: 5, windowMs: HOUR },
} as const;

function memberKey(scope: string) {
  return (req: Request) => `money:${scope}:${(req as AuthRequest).user?.id ?? req.ip}`;
}

function ceiling(scope: string, max: number, windowMs: number, message: string): RequestHandler {
  return createRateLimiter({
    max,
    windowMs,
    keyGenerator: memberKey(scope),
    handler: (_req, res) => {
      res.status(429).json({ success: false, message });
    },
  });
}

/** Starting a payment: an intent, a hold, a checkout. */
export const paymentStartCeiling = ceiling(
  'intent',
  MONEY_LIMITS.intent.max,
  MONEY_LIMITS.intent.windowMs,
  'You have started a lot of payments in the last hour. Nothing is wrong with your account; please wait a little while and try again.'
);

/** Sending gifts. */
export const giftCeiling = ceiling(
  'gift',
  MONEY_LIMITS.gift.max,
  MONEY_LIMITS.gift.windowMs,
  'You are sending gifts very quickly. Take a short break and try again in a few minutes.'
);

/** Asking for earnings to be paid out. */
export const payoutCeiling = ceiling(
  'payout',
  MONEY_LIMITS.payout.max,
  MONEY_LIMITS.payout.windowMs,
  'You have asked for the most withdrawals we allow in a day. Your earnings are safe; please try again tomorrow, or get in touch if something is not right.'
);

// ---------------------------------------------------------------------------
// Declined payments
// ---------------------------------------------------------------------------

// The in-process copy, used when Redis is not configured or does not answer, so
// the count is never simply lost. Not shared across instances, which is the same
// trade-off the sliding-window limiter makes.
const memoryDeclines = new Map<string, number[]>();
const MEMORY_DECLINES_SWEEP_AT = 20_000;

const declineKey = (userId: string) => `money:declines:${userId}`;

function recentInMemory(userId: string, now: number): number[] {
  const since = now - MONEY_LIMITS.declines.windowMs;
  return (memoryDeclines.get(userId) ?? []).filter((at) => at > since);
}

/**
 * Counts one declined payment against the member who was paying. Never throws:
 * it runs inside the webhook, where a counter must not be the reason Stripe is
 * told an event failed.
 */
export async function noteDeclinedPayment(userId: string, now = Date.now()): Promise<void> {
  try {
    const redis = process.env.REDIS_URL ? getRedisClient() : null;
    if (redis) {
      try {
        const key = declineKey(userId);
        await redis
          .pipeline()
          .zremrangebyscore(key, 0, now - MONEY_LIMITS.declines.windowMs)
          .zadd(key, now.toString(), `${now}:${Math.random()}`)
          .expire(key, Math.ceil(MONEY_LIMITS.declines.windowMs / 1000))
          .exec();
        return;
      } catch (error) {
        logger.warn('Declined payments are being counted in this process: Redis did not answer', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const stamps = recentInMemory(userId, now);
    stamps.push(now);
    memoryDeclines.set(userId, stamps);
    if (memoryDeclines.size > MEMORY_DECLINES_SWEEP_AT) {
      const since = now - MONEY_LIMITS.declines.windowMs;
      for (const [id, list] of memoryDeclines) {
        if (list.every((at) => at <= since)) memoryDeclines.delete(id);
      }
    }
  } catch (error) {
    logger.warn('Could not count a declined payment', { error: error instanceof Error ? error.message : String(error) });
  }
}

/** How many of her payments Stripe has declined in the last hour. */
export async function recentDeclines(userId: string, now = Date.now()): Promise<number> {
  let count = recentInMemory(userId, now).length;
  const redis = process.env.REDIS_URL ? getRedisClient() : null;
  if (redis) {
    try {
      const key = declineKey(userId);
      await redis.zremrangebyscore(key, 0, now - MONEY_LIMITS.declines.windowMs);
      count = Math.max(count, await redis.zcard(key));
    } catch (error) {
      // Counted from what this process saw, rather than refusing everybody
      // because the store is down.
      logger.warn('Declined payments were read from this process only: Redis did not answer', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return count;
}

/** True while the member has had too many cards declined to start another payment. */
export async function isPausedForDeclines(userId: string, now = Date.now()): Promise<boolean> {
  return (await recentDeclines(userId, now)) >= MONEY_LIMITS.declines.max;
}

/** For tests. */
export function resetMoneyLimits(): void {
  memoryDeclines.clear();
}

/**
 * Refuses to start a payment for a member whose cards have just been declined
 * repeatedly. Card testing is exactly a run of declines with a few successes in
 * it, and a real member whose bank keeps refusing is better served by being told
 * to ring the bank than by a fifth attempt.
 */
export const declinedCardGuard: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) return next();
  try {
    if (await isPausedForDeclines(userId)) {
      res.setHeader('Retry-After', Math.ceil(MONEY_LIMITS.declines.windowMs / 1000));
      return res.status(429).json({
        success: false,
        message:
          'Your card has been declined a few times, so we have paused new payments for a while to keep your account safe. Please check the details with your bank, then try again in about an hour.',
      });
    }
  } catch (error) {
    // The guard failing must not stop a payment that nothing says is abusive.
    logger.warn('Could not check recent declined payments', { error: error instanceof Error ? error.message : String(error) });
  }
  next();
};

/**
 * Refuses to start a payment while an admin has paused payments (see
 * assertPaymentsOpen in feature-flags.service): a 503 with the code
 * PAYMENTS_PAUSED, before the route reads or writes anything. The functions that
 * go on to create the charge ask again, so a payment started some other way is
 * stopped too; this is the early answer, with nothing half done behind it.
 */
export const paymentsOpenGuard: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => {
  assertPaymentsOpen().then(() => next(), next);
};

/**
 * What to mount on a route that starts a payment: the pause switch, the pause
 * after declines, then the per-hour ceiling.
 * `router.post(path, authenticate, startingAPayment, ...)`.
 * One handler rather than a list, so the route's own handler keeps its types.
 * The pause is first, so a paused platform does not spend a member's hourly
 * allowance on attempts that were never going to start.
 */
export const startingAPayment: RequestHandler = (req, res, next) => {
  paymentsOpenGuard(req, res, (paused?: unknown) => {
    if (paused) return next(paused);
    void declinedCardGuard(req, res, (declined?: unknown) => {
      if (declined) return next(declined);
      void paymentStartCeiling(req, res, next);
    });
  });
};

// ---------------------------------------------------------------------------
// Holds recorded in the database
// ---------------------------------------------------------------------------

/**
 * The request ceiling above stands in front of the routes it is mounted on. This
 * one stands in front of every hold, whichever route or flow asked for it (a
 * car, a mentor session, an order), by counting the rows: how many holds this
 * buyer has had recorded in the last hour, abandoned ones included. It is the
 * same idea as the number of offers one buyer may make on one car in a day.
 *
 * Counted from the database so it holds across instances and restarts. If the
 * count cannot be read it lets the hold through: the hold itself is a write to
 * the same database and fails on its own if the database is down.
 */
export async function assertRoomForAnotherHold(buyerId: string, now = Date.now()): Promise<void> {
  let recent: number;
  try {
    recent = await prisma.escrowPayment.count({
      where: { buyerId, createdAt: { gte: new Date(now - MONEY_LIMITS.holdsPerBuyer.windowMs) } },
    });
  } catch (error) {
    logger.warn('Could not count recent holds; allowing this one', {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (typeof recent === 'number' && recent >= MONEY_LIMITS.holdsPerBuyer.max) {
    throw new ApiError(
      429,
      'You have set up a lot of payments in the last hour. Nothing is wrong with your account; please wait a little while and try again.'
    );
  }
}
