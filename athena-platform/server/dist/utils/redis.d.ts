/**
 * ===========================================
 * ATHENA - REDIS CLIENT UTILITY
 * ===========================================
 *
 * Shared Redis client for caching, sessions,
 * rate limiting, and presence tracking.
 */
import Redis from 'ioredis';
export declare const redis: Redis;
export declare const redisSub: Redis;
export declare const redisPub: Redis;
interface CacheOptions {
    /** TTL in seconds */
    ttl?: number;
    /** Cache key prefix */
    prefix?: string;
}
/**
 * Get a value from cache with automatic JSON parsing
 */
export declare function cacheGet<T>(key: string, options?: CacheOptions): Promise<T | null>;
/**
 * Set a value in cache with automatic JSON stringification
 */
export declare function cacheSet<T>(key: string, value: T, options?: CacheOptions): Promise<boolean>;
/**
 * Delete a value from cache
 */
export declare function cacheDel(key: string, options?: CacheOptions): Promise<boolean>;
/**
 * Delete all keys matching a pattern
 */
export declare function cacheDelPattern(pattern: string): Promise<number>;
/**
 * Cache with fetch-on-miss pattern
 */
export declare function cacheGetOrSet<T>(key: string, fetchFn: () => Promise<T>, options?: CacheOptions): Promise<T>;
/**
 * Acquire a distributed lock
 * @returns Lock release function or null if lock couldn't be acquired
 */
export declare function acquireLock(lockKey: string, ttlMs?: number): Promise<(() => Promise<void>) | null>;
/**
 * Execute a function with a distributed lock
 */
export declare function withLock<T>(lockKey: string, fn: () => Promise<T>, ttlMs?: number): Promise<T | null>;
/**
 * Simple sliding window rate limiter
 */
export declare function checkRateLimit(identifier: string, windowMs: number, maxRequests: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}>;
export default redis;
//# sourceMappingURL=redis.d.ts.map