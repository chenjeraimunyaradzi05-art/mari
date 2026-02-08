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

import Redis, { RedisOptions } from 'ioredis';
import { logger } from './logger';

// Parse Redis URL or use defaults
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Track whether Redis is available
let redisAvailable = true;

function createClient(name: string, opts: Partial<RedisOptions> = {}): Redis {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) {
        redisAvailable = false;
        logger.warn(`Redis ${name}: giving up after ${times} retries`);
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
    logger.info(`Redis ${name} connected`);
  });
  client.on('ready', () => logger.info(`Redis ${name} ready`));
  client.on('error', (err) => logger.error(`Redis ${name} error`, { error: err.message }));
  client.on('close', () => logger.warn(`Redis ${name} connection closed`));

  return client;
}

// Main client (lazy)
export const redis = createClient('main');

// Pub/Sub connections (lazy, unlimited retries per request for blocking ops)
export const redisSub = createClient('sub', { maxRetriesPerRequest: null });
export const redisPub = createClient('pub', { maxRetriesPerRequest: null });

/** Check if Redis is believed to be available */
export function isRedisAvailable(): boolean {
  return redisAvailable && redis.status === 'ready';
}

/**
 * Ensure the main Redis client is connected.
 * Returns true if connected, false if Redis is unavailable.
 */
export async function ensureRedisConnected(): Promise<boolean> {
  if (redis.status === 'ready') return true;
  if (redis.status === 'connecting' || redis.status === 'connect') return true;
  try {
    await redis.connect();
    return true;
  } catch {
    redisAvailable = false;
    logger.warn('Redis is unavailable, caching/pubsub features disabled');
    return false;
  }
}

// ===========================================
// CACHE HELPERS
// ===========================================

interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Cache key prefix */
  prefix?: string;
}

const DEFAULT_TTL = 3600; // 1 hour

/**
 * Get a value from cache with automatic JSON parsing
 */
export async function cacheGet<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
  const fullKey = options.prefix ? `${options.prefix}:${key}` : key;
  
  try {
    const value = await redis.get(fullKey);
    if (value === null) return null;
    return JSON.parse(value) as T;
  } catch (err) {
    logger.error('Cache get error', { key: fullKey, error: err });
    return null;
  }
}

/**
 * Set a value in cache with automatic JSON stringification
 */
export async function cacheSet<T>(
  key: string, 
  value: T, 
  options: CacheOptions = {}
): Promise<boolean> {
  const fullKey = options.prefix ? `${options.prefix}:${key}` : key;
  const ttl = options.ttl ?? DEFAULT_TTL;
  
  try {
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      await redis.setex(fullKey, ttl, serialized);
    } else {
      await redis.set(fullKey, serialized);
    }
    return true;
  } catch (err) {
    logger.error('Cache set error', { key: fullKey, error: err });
    return false;
  }
}

/**
 * Delete a value from cache
 */
export async function cacheDel(key: string, options: CacheOptions = {}): Promise<boolean> {
  const fullKey = options.prefix ? `${options.prefix}:${key}` : key;
  
  try {
    await redis.del(fullKey);
    return true;
  } catch (err) {
    logger.error('Cache delete error', { key: fullKey, error: err });
    return false;
  }
}

/**
 * Delete all keys matching a pattern
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch (err) {
    logger.error('Cache delete pattern error', { pattern, error: err });
    return 0;
  }
}

/**
 * Cache with fetch-on-miss pattern
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key, options);
  if (cached !== null) return cached;
  
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
export async function acquireLock(
  lockKey: string,
  ttlMs: number = 30000
): Promise<(() => Promise<void>) | null> {
  const lockValue = `${process.pid}-${Date.now()}`;
  const fullKey = `lock:${lockKey}`;
  
  try {
    const acquired = await redis.set(fullKey, lockValue, 'PX', ttlMs, 'NX');
    
    if (acquired !== 'OK') {
      return null;
    }
    
    // Return release function
    return async () => {
      // Only release if we still hold the lock
      const currentValue = await redis.get(fullKey);
      if (currentValue === lockValue) {
        await redis.del(fullKey);
      }
    };
  } catch (err) {
    logger.error('Lock acquire error', { lockKey, error: err });
    return null;
  }
}

/**
 * Execute a function with a distributed lock
 */
export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlMs: number = 30000
): Promise<T | null> {
  const release = await acquireLock(lockKey, ttlMs);
  
  if (!release) {
    logger.warn('Could not acquire lock', { lockKey });
    return null;
  }
  
  try {
    return await fn();
  } finally {
    await release();
  }
}

// ===========================================
// RATE LIMITING HELPERS
// ===========================================

/**
 * Simple sliding window rate limiter
 */
export async function checkRateLimit(
  identifier: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const multi = redis.multi();
  
  // Remove old entries
  multi.zremrangebyscore(key, 0, windowStart);
  
  // Count current entries
  multi.zcard(key);
  
  // Add current request
  multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
  
  // Set expiry
  multi.pexpire(key, windowMs);
  
  const results = await multi.exec();
  const count = (results?.[1]?.[1] as number) || 0;
  
  return {
    allowed: count < maxRequests,
    remaining: Math.max(0, maxRequests - count - 1),
    resetAt: new Date(now + windowMs),
  };
}

export default redis;
