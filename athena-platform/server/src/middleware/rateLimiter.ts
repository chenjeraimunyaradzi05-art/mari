/**
 * Rate Limiting Middleware
 * ========================
 * Advanced rate limiting using Redis with sliding window algorithm.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../utils/cache';
import { logger } from '../utils/logger';
import { loggablePath } from '../utils/request-path';
import { noteRedisFallback, noteRedisRecovered } from '../utils/redis-fallback';
import { ERROR_KEYS, i18nService, SupportedLocale } from '../services/i18n.service';
import { AuthRequest } from './auth';
import { addressKey } from './apiBudget';

// ===========================================
// CONFIGURATION
// ===========================================

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response) => void;
  /**
   * What this limiter is called in the log. A limiter with a name says so once
   * an hour when the same caller keeps running into it (see noteRepeatedHits).
   */
  name?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
};

/** A budget from the environment, or its default when unset, not a number, or not above zero. */
function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Limits for particular kinds of call. The overall budget per caller (an
// address, a member, a staff account) is not here: it is middleware/apiBudget.ts,
// mounted in src/index.ts. There used to be a tier table in this block and an
// `apiLimiter` built from it, and nothing ever mounted either.
const RATE_LIMITS = {
  // API-specific limits. The sign-in, sign-up, refresh and password-reset
  // limits are not here: they are express-rate-limit instances in
  // src/index.ts, backed by the shared store in utils/rate-limit-store.ts,
  // and src/__tests__/auth-limits.mount.test.ts proves they are mounted.
  search: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // a search a second, typeahead included; a scraper's wall
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
  },
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 AI requests per minute
  },
  // The reads that, added up, are a copy of the membership. Counted per member
  // (per address for a visitor with no account), in ten minutes rather than
  // one, because what is being stopped is a long walk, not a burst: a woman
  // opening profiles one after another does twelve a minute at the very most,
  // and a script does that many a second. These sit under the platform-wide
  // budget in apiBudget.ts (1,500 calls in 15 minutes), which is the ceiling on
  // everything and is far too loose to stop a crawl of one kind of page.
  profileRead: {
    windowMs: 10 * 60 * 1000,
    max: positiveIntFromEnv('PROFILE_READ_MAX', 120),
  },
  memberSearch: {
    windowMs: 10 * 60 * 1000,
    max: positiveIntFromEnv('MEMBER_SEARCH_MAX', 200),
  },
  directory: {
    windowMs: 10 * 60 * 1000,
    max: positiveIntFromEnv('DIRECTORY_READ_MAX', 300),
  },
};

// ===========================================
// SLIDING WINDOW RATE LIMITER
// ===========================================

/**
 * Without Redis, or while Redis is failing, limits still have to hold: this
 * guards login and registration among other things, and "allow everything"
 * was the previous fallback. This is the same sliding window kept in this
 * process, so a flood is slowed on every instance even in a degraded
 * deployment. Not shared across instances, which is the trade-off.
 */
const memoryHits = new Map<string, number[]>();
const MEMORY_HITS_SWEEP_AT = 50_000;

export function memorySlidingWindow(
  key: string,
  windowMs: number,
  max: number,
  now = Date.now()
): { allowed: boolean; remaining: number; resetAt: number } {
  const since = now - windowMs;
  const stamps = (memoryHits.get(key) ?? []).filter((at) => at > since);
  const allowed = stamps.length < max;
  if (allowed) stamps.push(now);
  memoryHits.set(key, stamps);

  if (memoryHits.size > MEMORY_HITS_SWEEP_AT) {
    for (const [k, list] of memoryHits) {
      if (list.every((at) => at <= since)) memoryHits.delete(k);
    }
  }

  return {
    allowed,
    remaining: Math.max(0, max - stamps.length),
    resetAt: stamps.length ? stamps[0] + windowMs : now + windowMs,
  };
}

/** For tests. */
export function resetMemoryRateLimits(): void {
  memoryHits.clear();
}

// One warning a minute, not one per request, when the fallback is in use.
let lastFallbackWarning = 0;
function noteFallback(reason: string, detail?: Record<string, unknown>): void {
  noteRedisFallback('rate_limit_sliding_window', reason);
  const now = Date.now();
  if (now - lastFallbackWarning < 60_000) return;
  lastFallbackWarning = now;
  logger.warn(`Rate limiting is using the in-process fallback: ${reason}`, detail);
}

export async function slidingWindowRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Without REDIS_URL there is nothing to reach; asking would only wait on a
  // refused socket before falling back anyway.
  const redis = process.env.REDIS_URL ? getRedisClient() : null;
  if (!redis) {
    noteFallback('Redis is not configured');
    return memorySlidingWindow(key, windowMs, max, now);
  }

  const redisKey = `ratelimit:${key}`;

  try {
    // Use Redis sorted set for sliding window
    const pipeline = redis.pipeline();

    // Remove old entries outside the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);

    // Count current requests in window
    pipeline.zcard(redisKey);

    // Add current request
    pipeline.zadd(redisKey, now.toString(), `${now}:${Math.random()}`);

    // Set expiry on the key
    pipeline.expire(redisKey, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();

    // Get count before adding current request
    const count = (results?.[1]?.[1] as number) || 0;
    const allowed = count < max;
    const remaining = Math.max(0, max - count - 1);

    // Calculate reset time
    const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    const resetAt = oldestEntry.length >= 2 
      ? parseInt(oldestEntry[1]) + windowMs 
      : now + windowMs;

    noteRedisRecovered('rate_limit_sliding_window');
    return { allowed, remaining, resetAt };
  } catch (error: any) {
    noteFallback('Redis request failed', { error: error.message });
    return memorySlidingWindow(key, windowMs, max, now);
  }
}

// ===========================================
// REPEATED REFUSALS
// ===========================================

/** How many times in an hour one caller may be refused by one limiter before it is worth a line in the log. */
export const REPEAT_REFUSALS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Says so, once an hour per caller and limiter, when the same caller keeps being
 * refused.
 *
 * A refusal is one 429, and /metrics counts those platform-wide
 * (http_requests_total{status="429"}, which the AthenaSustainedRateLimiting
 * alert reads), but a metric cannot carry an account without a series for every
 * member. What tells a person scraping profiles from a person on a bad
 * connection is the same account being refused again and again, and the one place
 * that can name her is a log line. Not for every refusal: past the threshold,
 * one line an hour, so a script hammering a limiter does not also flood the log.
 *
 * It uses the same counters as the limiters, so across instances it counts
 * together when Redis is there. It never throws and never delays the response.
 * A member is named by her id; a visitor with no account, by her address.
 */
async function noteRepeatedHits(limiter: string, req: Request): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    const who = userId ? `user:${userId}` : `ip:${addressKey(req.ip || req.socket?.remoteAddress)}`;

    const hits = await slidingWindowRateLimit(`refused:${limiter}:${who}`, HOUR_MS, REPEAT_REFUSALS_PER_HOUR);
    if (hits.allowed) return;

    const first = await slidingWindowRateLimit(`refused-logged:${limiter}:${who}`, HOUR_MS, 1);
    if (!first.allowed) return;

    logger.warn('A caller keeps running into a rate limit', {
      limiter,
      refusalsLastHour: `more than ${REPEAT_REFUSALS_PER_HOUR}`,
      ...(userId ? { userId } : { ip: addressKey(req.ip || req.socket?.remoteAddress) }),
      method: req.method,
      path: loggablePath(req),
    });
  } catch {
    // A log line about a limiter is never worth a failed request.
  }
}

// ===========================================
// MIDDLEWARE FACTORY
// ===========================================

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if should skip
    if (finalConfig.skip && finalConfig.skip(req)) {
      return next();
    }

    // Generate key
    const key = finalConfig.keyGenerator
      ? finalConfig.keyGenerator(req)
      : getDefaultKey(req);

    // Check rate limit
    const { allowed, remaining, resetAt } = await slidingWindowRateLimit(
      key,
      finalConfig.windowMs,
      finalConfig.max
    );

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', finalConfig.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

    if (!allowed) {
      // Rate limit exceeded
      res.setHeader('Retry-After', Math.ceil((resetAt - Date.now()) / 1000));

      if (finalConfig.name) void noteRepeatedHits(finalConfig.name, req);

      if (finalConfig.handler) {
        return finalConfig.handler(req, res);
      }

      const locale = ((req as any).locale as SupportedLocale) || 'en';
      const i18nKey = ERROR_KEYS.RATE_LIMIT_EXCEEDED;

      return res.status(429).json({
        error: 'Too Many Requests',
        message: i18nService.tSync(i18nKey, undefined, locale),
        i18nKey,
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      });
    }

    next();
  };
}

// ===========================================
// DEFAULT KEY GENERATOR
// ===========================================

function getDefaultKey(req: Request): string {
  const authReq = req as AuthRequest;

  // Use user ID if authenticated
  if (authReq.user?.id) {
    return `user:${authReq.user.id}`;
  }

  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

// ===========================================
// PRE-CONFIGURED LIMITERS
// ===========================================

/**
 * Search endpoint limiter
 */
export const searchLimiter = createRateLimiter({
  ...RATE_LIMITS.search,
  name: 'search',
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `search:${authReq.user?.id || req.ip}`;
  },
});

/**
 * Upload endpoint limiter
 */
export const uploadLimiter = createRateLimiter({
  ...RATE_LIMITS.upload,
  name: 'upload',
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `upload:${authReq.user?.id || req.ip}`;
  },
});

/**
 * AI/ML endpoint limiter
 */
export const aiLimiter = createRateLimiter({
  ...RATE_LIMITS.ai,
  name: 'ai',
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `ai:${authReq.user?.id || req.ip}`;
  },
});

/**
 * The key a read budget is counted under: the member when the route has
 * resolved one, and the visitor's address otherwise. An IPv6 address counts as
 * its /64 (apiBudget.addressKey), because one subscriber is handed a whole /64
 * and a script would otherwise have a new budget for every request.
 *
 * It reads req.user, so it has to be mounted after authenticate or optionalAuth.
 * Mounted ahead of them it sees nobody and counts every member by address, which
 * is exactly the per-address limit this exists to go beyond.
 */
function readBudgetKey(prefix: string) {
  return (req: Request): string => {
    const userId = (req as AuthRequest).user?.id;
    return `${prefix}:${userId ? `user:${userId}` : `ip:${addressKey(req.ip || req.socket?.remoteAddress)}`}`;
  };
}

/**
 * Profile reads: one member's page, her followers and the people she follows.
 *
 * Counted per account, so a scraper that signs in once and rotates addresses
 * has the same budget as one that does not. It is what a person walking the
 * membership profile by profile runs into, long before the platform-wide budget
 * (apiBudget.ts) does. Mount after authenticate or optionalAuth.
 */
export const profileReadLimiter = createRateLimiter({
  ...RATE_LIMITS.profileRead,
  name: 'profile-read',
  keyGenerator: readBudgetKey('profile-read'),
});

/**
 * Member search, per account. The router-level searchLimiter counts addresses
 * (it runs before the member is known); this one counts the member, and skips a
 * visitor with no account, who is already counted by address there. Mount after
 * optionalAuth.
 */
export const memberSearchLimiter = createRateLimiter({
  ...RATE_LIMITS.memberSearch,
  name: 'member-search',
  skip: (req) => !(req as AuthRequest).user?.id,
  keyGenerator: readBudgetKey('member-search'),
});

/**
 * The mentor and job directories: a page of listings per call, any number of
 * pages. Mount after optionalAuth.
 */
export const directoryReadLimiter = createRateLimiter({
  ...RATE_LIMITS.directory,
  name: 'directory-read',
  keyGenerator: readBudgetKey('directory-read'),
});

// ===========================================
// EXPORTS
// ===========================================

export { RATE_LIMITS };
