"use strict";
/**
 * Redis Cache Utility
 * Provides caching layer for performance optimization
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheKeys = void 0;
exports.getRedisClient = getRedisClient;
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDel = cacheDel;
exports.cacheDelPattern = cacheDelPattern;
exports.cacheGetOrSet = cacheGetOrSet;
exports.invalidateUserCache = invalidateUserCache;
exports.invalidateJobCache = invalidateJobCache;
exports.invalidateOrgCache = invalidateOrgCache;
exports.invalidateFeedCache = invalidateFeedCache;
exports.checkRateLimit = checkRateLimit;
exports.getRateLimitStatus = getRateLimitStatus;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
// Initialize Redis client
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redis = null;
// Cache configuration
const DEFAULT_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'athena:';
function getRedisClient() {
    if (!redis) {
        try {
            redis = new ioredis_1.default(redisUrl, {
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                enableReadyCheck: true,
            });
            redis.on('error', (err) => {
                logger_1.logger.error('Redis connection error', { error: err.message });
            });
            redis.on('connect', () => {
                logger_1.logger.info('Redis connected');
            });
        }
        catch (error) {
            logger_1.logger.warn('Redis not available, caching disabled');
            return null;
        }
    }
    return redis;
}
// ==========================================
// CORE CACHE OPERATIONS
// ==========================================
async function cacheGet(key) {
    try {
        const client = getRedisClient();
        if (!client)
            return null;
        const data = await client.get(`${CACHE_PREFIX}${key}`);
        if (!data)
            return null;
        return JSON.parse(data);
    }
    catch (error) {
        logger_1.logger.error('Cache get error', { key, error });
        return null;
    }
}
async function cacheSet(key, value, ttlSeconds = DEFAULT_TTL) {
    try {
        const client = getRedisClient();
        if (!client)
            return false;
        await client.setex(`${CACHE_PREFIX}${key}`, ttlSeconds, JSON.stringify(value));
        return true;
    }
    catch (error) {
        logger_1.logger.error('Cache set error', { key, error });
        return false;
    }
}
async function cacheDel(key) {
    try {
        const client = getRedisClient();
        if (!client)
            return false;
        await client.del(`${CACHE_PREFIX}${key}`);
        return true;
    }
    catch (error) {
        logger_1.logger.error('Cache delete error', { key, error });
        return false;
    }
}
async function cacheDelPattern(pattern) {
    try {
        const client = getRedisClient();
        if (!client)
            return false;
        const keys = await client.keys(`${CACHE_PREFIX}${pattern}`);
        if (keys.length > 0) {
            await client.del(...keys);
        }
        return true;
    }
    catch (error) {
        logger_1.logger.error('Cache delete pattern error', { pattern, error });
        return false;
    }
}
// ==========================================
// CACHE-ASIDE PATTERN
// ==========================================
async function cacheGetOrSet(key, fetchFn, ttlSeconds = DEFAULT_TTL) {
    // Try cache first
    const cached = await cacheGet(key);
    if (cached !== null) {
        return cached;
    }
    // Fetch from source
    const data = await fetchFn();
    // Cache the result
    await cacheSet(key, data, ttlSeconds);
    return data;
}
// ==========================================
// SPECIFIC CACHE KEYS
// ==========================================
exports.CacheKeys = {
    // User caches
    user: (id) => `user:${id}`,
    userProfile: (id) => `user:profile:${id}`,
    // Job caches
    job: (id) => `job:${id}`,
    jobList: (page, filters) => `jobs:list:${page}:${filters}`,
    jobSearch: (query) => `jobs:search:${query}`,
    // Organization caches
    org: (id) => `org:${id}`,
    orgBySlug: (slug) => `org:slug:${slug}`,
    // Course caches
    course: (id) => `course:${id}`,
    courseList: (page, filters) => `courses:list:${page}:${filters}`,
    // Feed caches
    feed: (userId, page) => `feed:${userId}:${page}`,
    feedTrending: (hours, limit) => `feed:trending:${hours}:${limit}`,
    // Stats caches
    platformStats: () => 'stats:platform',
    userStats: (id) => `stats:user:${id}`,
    // Analytics
    analytics: (key) => `analytics:${key}`,
    // Leaderboard
    referralLeaderboard: () => 'referrals:leaderboard',
    leaderboard: (scope) => `leaderboard:${scope}`,
    // Search
    search: (query) => `search:${query}`,
};
// ==========================================
// CACHE INVALIDATION
// ==========================================
async function invalidateUserCache(userId) {
    await cacheDelPattern(`user:*:${userId}*`);
    await cacheDel(exports.CacheKeys.user(userId));
    await cacheDel(exports.CacheKeys.userProfile(userId));
    await cacheDel(exports.CacheKeys.userStats(userId));
}
async function invalidateJobCache(jobId) {
    await cacheDel(exports.CacheKeys.job(jobId));
    await cacheDelPattern('jobs:list:*');
    await cacheDelPattern('jobs:search:*');
}
async function invalidateOrgCache(orgId, slug) {
    await cacheDel(exports.CacheKeys.org(orgId));
    if (slug) {
        await cacheDel(exports.CacheKeys.orgBySlug(slug));
    }
}
async function invalidateFeedCache(userId) {
    await cacheDelPattern(`feed:${userId}:*`);
}
// ==========================================
// RATE LIMITING WITH REDIS
// ==========================================
async function checkRateLimit(key, maxRequests, windowSeconds) {
    try {
        const client = getRedisClient();
        if (!client) {
            return { allowed: true, remaining: maxRequests, resetIn: 0 };
        }
        const now = Date.now();
        const windowKey = `${CACHE_PREFIX}ratelimit:${key}`;
        // Use sliding window with sorted set
        const pipeline = client.pipeline();
        pipeline.zremrangebyscore(windowKey, 0, now - windowSeconds * 1000);
        pipeline.zadd(windowKey, now, `${now}-${Math.random()}`);
        pipeline.zcard(windowKey);
        pipeline.expire(windowKey, windowSeconds);
        const results = await pipeline.exec();
        const count = results?.[2]?.[1] || 0;
        const allowed = count <= maxRequests;
        const remaining = Math.max(0, maxRequests - count);
        const resetIn = windowSeconds;
        return { allowed, remaining, resetIn };
    }
    catch (error) {
        logger_1.logger.error('Rate limit check error', { key, error });
        return { allowed: true, remaining: maxRequests, resetIn: 0 };
    }
}
async function getRateLimitStatus(key, maxRequests, windowSeconds) {
    try {
        const client = getRedisClient();
        if (!client) {
            return { allowed: true, remaining: maxRequests, resetIn: 0 };
        }
        const now = Date.now();
        const windowKey = `${CACHE_PREFIX}ratelimit:${key}`;
        const pipeline = client.pipeline();
        pipeline.zremrangebyscore(windowKey, 0, now - windowSeconds * 1000);
        pipeline.zcard(windowKey);
        pipeline.expire(windowKey, windowSeconds);
        const results = await pipeline.exec();
        const count = results?.[1]?.[1] || 0;
        const allowed = count < maxRequests;
        const remaining = Math.max(0, maxRequests - count);
        const resetIn = windowSeconds;
        return { allowed, remaining, resetIn };
    }
    catch (error) {
        logger_1.logger.error('Rate limit status error', { key, error });
        return { allowed: true, remaining: maxRequests, resetIn: 0 };
    }
}
//# sourceMappingURL=cache.js.map