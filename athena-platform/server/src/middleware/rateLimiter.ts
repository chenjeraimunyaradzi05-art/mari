/**
 * Rate Limiting Middleware
 * ========================
 * Advanced rate limiting using Redis with sliding window algorithm.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../utils/cache';
import { logger } from '../utils/logger';
import { ERROR_KEYS, i18nService, SupportedLocale } from '../services/i18n.service';
import { AuthRequest } from './auth';

// ===========================================
// CONFIGURATION
// ===========================================

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response) => void;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
};

// Tiered limits based on user type
const RATE_LIMITS = {
  // Anonymous users - strictest
  anonymous: {
    windowMs: 15 * 60 * 1000,
    max: 50,
  },
  // Authenticated free users
  free: {
    windowMs: 15 * 60 * 1000,
    max: 200,
  },
  // Premium users
  premium: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
  },
  // Enterprise users
  enterprise: {
    windowMs: 15 * 60 * 1000,
    max: 5000,
  },
  // API-specific limits
  auth: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 login attempts per hour
  },
  search: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 searches per minute
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
  },
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 AI requests per minute
  },
};

// ===========================================
// SLIDING WINDOW RATE LIMITER
// ===========================================

async function slidingWindowRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!redis) {
    // Fallback to allowing all requests if Redis is unavailable
    logger.warn('Redis unavailable for rate limiting');
    return { allowed: true, remaining: max, resetAt: now + windowMs };
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

    return { allowed, remaining, resetAt };
  } catch (error: any) {
    logger.error('Rate limit check failed', { error: error.message, key });
    // Fail open - allow request if rate limiting fails
    return { allowed: true, remaining: max, resetAt: now + windowMs };
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
 * Standard API rate limiter - adjusts based on user tier
 */
export const apiLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  let config = RATE_LIMITS.anonymous;

  if (authReq.user) {
    // Determine tier based on subscription (default to FREE if not present)
    const tier = (authReq.user as any).subscriptionTier || 'FREE';
    if (tier.startsWith('ENTERPRISE')) {
      config = RATE_LIMITS.enterprise;
    } else if (tier.startsWith('PREMIUM')) {
      config = RATE_LIMITS.premium;
    } else {
      config = RATE_LIMITS.free;
    }
  }

  return createRateLimiter(config)(req, res, next);
};

/**
 * Strict limiter for authentication endpoints
 */
export const authLimiter = createRateLimiter({
  ...RATE_LIMITS.auth,
  keyGenerator: (req) => `auth:${req.ip}:${req.body?.email || 'unknown'}`,
});

/**
 * Search endpoint limiter
 */
export const searchLimiter = createRateLimiter({
  ...RATE_LIMITS.search,
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
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `ai:${authReq.user?.id || req.ip}`;
  },
});

// ===========================================
// EXPORTS
// ===========================================

export { RATE_LIMITS };
