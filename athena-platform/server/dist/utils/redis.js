"use strict";
/**
 * ===========================================
 * ATHENA - REDIS CLIENT UTILITY
 * ===========================================
 *
 * Shared Redis client for caching, sessions,
 * rate limiting, and presence tracking.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisPub = exports.redisSub = exports.redis = void 0;
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheDel = cacheDel;
exports.cacheDelPattern = cacheDelPattern;
exports.cacheGetOrSet = cacheGetOrSet;
exports.acquireLock = acquireLock;
exports.withLock = withLock;
exports.checkRateLimit = checkRateLimit;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
// Parse Redis URL or use defaults
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
// Create Redis client
exports.redis = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            return true;
        }
        return false;
    },
    enableReadyCheck: true,
    lazyConnect: false,
});
// Create a separate connection for subscriptions
exports.redisSub = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
});
// Create a separate connection for publishing
exports.redisPub = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
});
// Event handlers
exports.redis.on('connect', () => {
    logger_1.logger.info('Redis client connected');
});
exports.redis.on('ready', () => {
    logger_1.logger.info('Redis client ready');
});
exports.redis.on('error', (err) => {
    logger_1.logger.error('Redis client error', err);
});
exports.redis.on('close', () => {
    logger_1.logger.warn('Redis client connection closed');
});
exports.redis.on('reconnecting', () => {
    logger_1.logger.info('Redis client reconnecting...');
});
const DEFAULT_TTL = 3600; // 1 hour
/**
 * Get a value from cache with automatic JSON parsing
 */
async function cacheGet(key, options = {}) {
    const fullKey = options.prefix ? `${options.prefix}:${key}` : key;
    try {
        const value = await exports.redis.get(fullKey);
        if (value === null)
            return null;
        return JSON.parse(value);
    }
    catch (err) {
        logger_1.logger.error('Cache get error', { key: fullKey, error: err });
        return null;
    }
}
/**
 * Set a value in cache with automatic JSON stringification
 */
async function cacheSet(key, value, options = {}) {
    const fullKey = options.prefix ? `${options.prefix}:${key}` : key;
    const ttl = options.ttl ?? DEFAULT_TTL;
    try {
        const serialized = JSON.stringify(value);
        if (ttl > 0) {
            await exports.redis.setex(fullKey, ttl, serialized);
        }
        else {
            await exports.redis.set(fullKey, serialized);
        }
        return true;
    }
    catch (err) {
        logger_1.logger.error('Cache set error', { key: fullKey, error: err });
        return false;
    }
}
/**
 * Delete a value from cache
 */
async function cacheDel(key, options = {}) {
    const fullKey = options.prefix ? `${options.prefix}:${key}` : key;
    try {
        await exports.redis.del(fullKey);
        return true;
    }
    catch (err) {
        logger_1.logger.error('Cache delete error', { key: fullKey, error: err });
        return false;
    }
}
/**
 * Delete all keys matching a pattern
 */
async function cacheDelPattern(pattern) {
    try {
        const keys = await exports.redis.keys(pattern);
        if (keys.length === 0)
            return 0;
        return await exports.redis.del(...keys);
    }
    catch (err) {
        logger_1.logger.error('Cache delete pattern error', { pattern, error: err });
        return 0;
    }
}
/**
 * Cache with fetch-on-miss pattern
 */
async function cacheGetOrSet(key, fetchFn, options = {}) {
    // Try cache first
    const cached = await cacheGet(key, options);
    if (cached !== null)
        return cached;
    // Fetch fresh data
    const value = await fetchFn();
    // Store in cache
    await cacheSet(key, value, options);
    return value;
}
// ===========================================
// DISTRIBUTED LOCK
// ===========================================
/**
 * Acquire a distributed lock
 * @returns Lock release function or null if lock couldn't be acquired
 */
async function acquireLock(lockKey, ttlMs = 30000) {
    const lockValue = `${process.pid}-${Date.now()}`;
    const fullKey = `lock:${lockKey}`;
    try {
        const acquired = await exports.redis.set(fullKey, lockValue, 'PX', ttlMs, 'NX');
        if (acquired !== 'OK') {
            return null;
        }
        // Return release function
        return async () => {
            // Only release if we still hold the lock
            const currentValue = await exports.redis.get(fullKey);
            if (currentValue === lockValue) {
                await exports.redis.del(fullKey);
            }
        };
    }
    catch (err) {
        logger_1.logger.error('Lock acquire error', { lockKey, error: err });
        return null;
    }
}
/**
 * Execute a function with a distributed lock
 */
async function withLock(lockKey, fn, ttlMs = 30000) {
    const release = await acquireLock(lockKey, ttlMs);
    if (!release) {
        logger_1.logger.warn('Could not acquire lock', { lockKey });
        return null;
    }
    try {
        return await fn();
    }
    finally {
        await release();
    }
}
// ===========================================
// RATE LIMITING HELPERS
// ===========================================
/**
 * Simple sliding window rate limiter
 */
async function checkRateLimit(identifier, windowMs, maxRequests) {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const multi = exports.redis.multi();
    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);
    // Count current entries
    multi.zcard(key);
    // Add current request
    multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
    // Set expiry
    multi.pexpire(key, windowMs);
    const results = await multi.exec();
    const count = results?.[1]?.[1] || 0;
    return {
        allowed: count < maxRequests,
        remaining: Math.max(0, maxRequests - count - 1),
        resetAt: new Date(now + windowMs),
    };
}
exports.default = exports.redis;
//# sourceMappingURL=redis.js.map