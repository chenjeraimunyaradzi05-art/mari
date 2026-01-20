/**
 * Redis Cache Utility
 * Provides caching layer for performance optimization
 */

import Redis from 'ioredis';
import { logger } from './logger';

// Initialize Redis client
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: Redis | null = null;

// Cache configuration
const DEFAULT_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'athena:';

export function getRedisClient(): Redis | null {
  if (!redis) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: true,
      });

      redis.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
      });

      redis.on('connect', () => {
        logger.info('Redis connected');
      });
    } catch (error) {
      logger.warn('Redis not available, caching disabled');
      return null;
    }
  }
  return redis;
}

// ==========================================
// CORE CACHE OPERATIONS
// ==========================================

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;

    const data = await client.get(`${CACHE_PREFIX}${key}`);
    if (!data) return null;

    return JSON.parse(data) as T;
  } catch (error) {
    logger.error('Cache get error', { key, error });
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds = DEFAULT_TTL): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;

    await client.setex(`${CACHE_PREFIX}${key}`, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Cache set error', { key, error });
    return false;
  }
}

export async function cacheDel(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;

    await client.del(`${CACHE_PREFIX}${key}`);
    return true;
  } catch (error) {
    logger.error('Cache delete error', { key, error });
    return false;
  }
}

export async function cacheDelPattern(pattern: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;

    const keys = await client.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    return true;
  } catch (error) {
    logger.error('Cache delete pattern error', { pattern, error });
    return false;
  }
}

// ==========================================
// CACHE-ASIDE PATTERN
// ==========================================

export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
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

export const CacheKeys = {
  // User caches
  user: (id: string) => `user:${id}`,
  userProfile: (id: string) => `user:profile:${id}`,
  
  // Job caches
  job: (id: string) => `job:${id}`,
  jobList: (page: number, filters: string) => `jobs:list:${page}:${filters}`,
  jobSearch: (query: string) => `jobs:search:${query}`,
  
  // Organization caches
  org: (id: string) => `org:${id}`,
  orgBySlug: (slug: string) => `org:slug:${slug}`,
  
  // Course caches
  course: (id: string) => `course:${id}`,
  courseList: (page: number, filters: string) => `courses:list:${page}:${filters}`,
  
  // Feed caches
  feed: (userId: string, page: number) => `feed:${userId}:${page}`,
  feedTrending: (hours: number, limit: number) => `feed:trending:${hours}:${limit}`,

  // Stats caches
  platformStats: () => 'stats:platform',
  userStats: (id: string) => `stats:user:${id}`,
  
  // Analytics
  analytics: (key: string) => `analytics:${key}`,
  
  // Leaderboard
  referralLeaderboard: () => 'referrals:leaderboard',
  leaderboard: (scope: string) => `leaderboard:${scope}`,
  
  // Search
  search: (query: string) => `search:${query}`,
};

// ==========================================
// CACHE INVALIDATION
// ==========================================

export async function invalidateUserCache(userId: string) {
  await cacheDelPattern(`user:*:${userId}*`);
  await cacheDel(CacheKeys.user(userId));
  await cacheDel(CacheKeys.userProfile(userId));
  await cacheDel(CacheKeys.userStats(userId));
}

export async function invalidateJobCache(jobId: string) {
  await cacheDel(CacheKeys.job(jobId));
  await cacheDelPattern('jobs:list:*');
  await cacheDelPattern('jobs:search:*');
}

export async function invalidateOrgCache(orgId: string, slug?: string) {
  await cacheDel(CacheKeys.org(orgId));
  if (slug) {
    await cacheDel(CacheKeys.orgBySlug(slug));
  }
}

export async function invalidateFeedCache(userId: string) {
  await cacheDelPattern(`feed:${userId}:*`);
}

// ==========================================
// RATE LIMITING WITH REDIS
// ==========================================

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
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
    const count = results?.[2]?.[1] as number || 0;

    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    const resetIn = windowSeconds;

    return { allowed, remaining, resetIn };
  } catch (error) {
    logger.error('Rate limit check error', { key, error });
    return { allowed: true, remaining: maxRequests, resetIn: 0 };
  }
}

export async function getRateLimitStatus(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
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
    const count = (results?.[1]?.[1] as number) || 0;

    const allowed = count < maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    const resetIn = windowSeconds;

    return { allowed, remaining, resetIn };
  } catch (error) {
    logger.error('Rate limit status error', { key, error });
    return { allowed: true, remaining: maxRequests, resetIn: 0 };
  }
}
