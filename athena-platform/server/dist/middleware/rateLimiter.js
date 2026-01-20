"use strict";
/**
 * Rate Limiting Middleware
 * ========================
 * Advanced rate limiting using Redis with sliding window algorithm.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMITS = exports.aiLimiter = exports.uploadLimiter = exports.searchLimiter = exports.authLimiter = exports.apiLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
const DEFAULT_CONFIG = {
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
exports.RATE_LIMITS = RATE_LIMITS;
// ===========================================
// SLIDING WINDOW RATE LIMITER
// ===========================================
async function slidingWindowRateLimit(key, windowMs, max) {
    const redis = (0, cache_1.getRedisClient)();
    const now = Date.now();
    const windowStart = now - windowMs;
    if (!redis) {
        // Fallback to allowing all requests if Redis is unavailable
        logger_1.logger.warn('Redis unavailable for rate limiting');
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
        const count = results?.[1]?.[1] || 0;
        const allowed = count < max;
        const remaining = Math.max(0, max - count - 1);
        // Calculate reset time
        const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
        const resetAt = oldestEntry.length >= 2
            ? parseInt(oldestEntry[1]) + windowMs
            : now + windowMs;
        return { allowed, remaining, resetAt };
    }
    catch (error) {
        logger_1.logger.error('Rate limit check failed', { error: error.message, key });
        // Fail open - allow request if rate limiting fails
        return { allowed: true, remaining: max, resetAt: now + windowMs };
    }
}
// ===========================================
// MIDDLEWARE FACTORY
// ===========================================
function createRateLimiter(config = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    return async (req, res, next) => {
        // Check if should skip
        if (finalConfig.skip && finalConfig.skip(req)) {
            return next();
        }
        // Generate key
        const key = finalConfig.keyGenerator
            ? finalConfig.keyGenerator(req)
            : getDefaultKey(req);
        // Check rate limit
        const { allowed, remaining, resetAt } = await slidingWindowRateLimit(key, finalConfig.windowMs, finalConfig.max);
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
            return res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
            });
        }
        next();
    };
}
// ===========================================
// DEFAULT KEY GENERATOR
// ===========================================
function getDefaultKey(req) {
    const authReq = req;
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
const apiLimiter = async (req, res, next) => {
    const authReq = req;
    let config = RATE_LIMITS.anonymous;
    if (authReq.user) {
        // Determine tier based on subscription
        const tier = authReq.user.subscriptionTier || 'FREE';
        if (tier.startsWith('ENTERPRISE')) {
            config = RATE_LIMITS.enterprise;
        }
        else if (tier.startsWith('PREMIUM')) {
            config = RATE_LIMITS.premium;
        }
        else {
            config = RATE_LIMITS.free;
        }
    }
    return createRateLimiter(config)(req, res, next);
};
exports.apiLimiter = apiLimiter;
/**
 * Strict limiter for authentication endpoints
 */
exports.authLimiter = createRateLimiter({
    ...RATE_LIMITS.auth,
    keyGenerator: (req) => `auth:${req.ip}:${req.body?.email || 'unknown'}`,
});
/**
 * Search endpoint limiter
 */
exports.searchLimiter = createRateLimiter({
    ...RATE_LIMITS.search,
    keyGenerator: (req) => {
        const authReq = req;
        return `search:${authReq.user?.id || req.ip}`;
    },
});
/**
 * Upload endpoint limiter
 */
exports.uploadLimiter = createRateLimiter({
    ...RATE_LIMITS.upload,
    keyGenerator: (req) => {
        const authReq = req;
        return `upload:${authReq.user?.id || req.ip}`;
    },
});
/**
 * AI/ML endpoint limiter
 */
exports.aiLimiter = createRateLimiter({
    ...RATE_LIMITS.ai,
    keyGenerator: (req) => {
        const authReq = req;
        return `ai:${authReq.user?.id || req.ip}`;
    },
});
//# sourceMappingURL=rateLimiter.js.map