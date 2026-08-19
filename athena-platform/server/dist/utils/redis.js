"use strict";
/**
 * ===========================================
 * ATHENA - REDIS CLIENT UTILITY
 * ===========================================
 *
 * Shared Redis client for caching, sessions,
 * rate limiting, and presence tracking.
 *
 * All connections use lazyConnect so the app
 * starts even when Redis is unavailable.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisPub = exports.redisSub = exports.redis = void 0;
exports.isRedisAvailable = isRedisAvailable;
exports.ensureRedisConnected = ensureRedisConnected;
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
// Track whether Redis is available
let redisAvailable = true;
function createClient(name, opts = {}) {
    const client = new ioredis_1.default(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 10) {
                redisAvailable = false;
                logger_1.logger.warn(`Redis ${name}: giving up after ${times} retries`);
                return null; // stop retrying
            }
            return Math.min(times * 100, 3000);
        },
        reconnectOnError(err) {
            return err.message.includes('READONLY');
        },
        enableReadyCheck: true,
        lazyConnect: true,
        ...opts,
    });
    client.on('connect', () => {
        redisAvailable = true;
        logger_1.logger.info(`Redis ${name} connected`);
    });
    client.on('ready', () => logger_1.logger.info(`Redis ${name} ready`));
    client.on('error', (err) => logger_1.logger.error(`Redis ${name} error`, { error: err.message }));
    client.on('close', () => logger_1.logger.warn(`Redis ${name} connection closed`));
    return client;
}
// Main client (lazy)
exports.redis = createClient('main');
// Pub/Sub connections (lazy, unlimited retries per request for blocking ops)
exports.redisSub = createClient('sub', { maxRetriesPerRequest: null });
exports.redisPub = createClient('pub', { maxRetriesPerRequest: null });
/** Check if Redis is believed to be available */
function isRedisAvailable() {
    return redisAvailable && exports.redis.status === 'ready';
}
/**
 * Ensure the main Redis client is connected.
 * Returns true if connected, false if Redis is unavailable.
 */
async function ensureRedisConnected() {
    if (exports.redis.status === 'ready')
        return true;
    if (exports.redis.status === 'connecting' || exports.redis.status === 'connect')
        return true;
    try {
        await exports.redis.connect();
        return true;
    }
    catch {
        redisAvailable = false;
        logger_1.logger.warn('Redis is unavailable, caching/pubsub features disabled');
        return false;
    }
}
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