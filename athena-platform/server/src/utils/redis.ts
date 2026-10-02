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
import { recordCondition } from './ops-metrics';

// Parse Redis URL or use defaults
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

/** The longest wait between two attempts to reach Redis again. */
const RECONNECT_DELAY_CAP_MS = 3000;
/** After this many failed attempts in a row the outage is reported once; it is never given up on. */
const OUTAGE_REPORTED_AFTER_ATTEMPTS = 10;
/** How long a connection that ended, which ioredis then leaves for dead, waits to be reopened. */
const REVIVE_AFTER_MS = 30_000;

/**
 * How long to wait before reconnect attempt number `attempt` (1, 2, 3 ...):
 * a tenth of a second longer each time, never more than three seconds, and
 * always a number.
 *
 * It used to be `null` after ten attempts, about six seconds into an outage.
 * ioredis reads `null` as "stop for good" and moves the client to `end`, and
 * nothing here ever opened it again, so a Redis that was restarted by its host
 * (a deploy, a failover, a maintenance window) left every API instance with a
 * dead client until the instance itself was restarted: every scheduled sweep
 * skipped in production, including the warnings about money that is about to
 * be released, and every rate-limit counter kept in the one process. It is
 * exported so that a test can hold it to "always a number".
 */
export function redisRetryDelay(attempt: number): number {
  return Math.min(Math.max(1, attempt) * 100, RECONNECT_DELAY_CAP_MS);
}

function createClient(name: string, opts: Partial<RedisOptions> = {}, onReady?: () => void): Redis {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      // ioredis counts attempts from one again after a connection works, so
      // this is one line per outage, not one per attempt.
      if (times === OUTAGE_REPORTED_AFTER_ATTEMPTS + 1) {
        logger.error(
          `Redis ${name}: still unreachable after ${OUTAGE_REPORTED_AFTER_ATTEMPTS} attempts; it keeps trying every ${RECONNECT_DELAY_CAP_MS / 1000} seconds`
        );
      }
      return redisRetryDelay(times);
    },
    reconnectOnError(err) {
      return err.message.includes('READONLY');
    },
    enableReadyCheck: true,
    lazyConnect: true,
    ...opts,
  });

  client.on('connect', () => logger.info(`Redis ${name} connected`));
  client.on('ready', () => {
    logger.info(`Redis ${name} ready`);
    onReady?.();
  });
  client.on('error', (err) => logger.error(`Redis ${name} error`, { error: err.message }));
  client.on('close', () => logger.warn(`Redis ${name} connection closed`));

  // 'end' is a client that has stopped retrying: its connector failed outright
  // (a name that would not resolve), or it was closed. Left alone it stays dead,
  // so it is opened again after a pause. Retrying is no longer given up on in
  // retryStrategy above; this is the second line for the failures that
  // strategy is never asked about.
  let reviveTimer: NodeJS.Timeout | null = null;
  client.on('end', () => {
    logger.error(`Redis ${name}: the connection has ended; opening it again in ${REVIVE_AFTER_MS / 1000} seconds`);
    if (reviveTimer) return;
    reviveTimer = setTimeout(() => {
      reviveTimer = null;
      if (client.status === 'end') client.connect().catch(() => undefined);
    }, REVIVE_AFTER_MS);
    reviveTimer.unref();
  });

  return client;
}

// Main client (lazy)
export const redis = createClient('main', {}, () => resumeSkippedSweeps());

// Pub/Sub connections (lazy, unlimited retries per request for blocking ops)
export const redisSub = createClient('sub', { maxRetriesPerRequest: null });
export const redisPub = createClient('pub', { maxRetriesPerRequest: null });

/**
 * Whether the main client can answer right now: what the client itself says,
 * and nothing remembered. It used to be a flag that the first outage set to
 * false and nothing ever set back, so a Redis that had been away for a minute
 * was treated as gone until the next restart.
 */
export function isRedisAvailable(): boolean {
  return redis.status === 'ready';
}

/**
 * Ensure the main Redis client is connected.
 * Returns true if connected, false if Redis is unavailable.
 */
export async function ensureRedisConnected(): Promise<boolean> {
  if (redis.status === 'ready') return true;
  // A first connection that is under way is not failed yet.
  if (redis.status === 'connecting' || redis.status === 'connect') return true;
  // ioredis is waiting out its own retry delay and will connect by itself;
  // calling connect() now would open a second socket beside it.
  if (redis.status === 'reconnecting') return false;
  try {
    await redis.connect();
    return true;
  } catch {
    // The client keeps retrying in the background (see redisRetryDelay), and
    // isRedisAvailable() reads its state, so this does not decide anything.
    logger.warn('Redis is not reachable yet; it will keep trying, and the limits and sweeps are per process until it answers');
    return false;
  }
}

/** Production with a REDIS_URL: the deployment that must not run without Redis. */
export function redisIsRequired(): boolean {
  return process.env.NODE_ENV === 'production' && Boolean(process.env.REDIS_URL);
}

/** How long a readiness check waits for Redis before it says no. */
export const REDIS_PING_TIMEOUT_MS = 1000;

/** Resolves with `promise`'s answer, or with false when it has not answered in `ms`. */
function answeredWithin(promise: Promise<boolean>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise.catch(() => false),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Whether Redis answers a PING within a second, on the connection the sweeps
 * and the rate limits use. Not ready, or no answer in time, is no. A client
 * that has never been opened (or has ended) is opened and given the same
 * second, so that a probe is also what starts the connection on a process that
 * has not needed it yet.
 *
 * It asks the shared client in redis.ts, not the one in cache.ts: that one
 * retries for ever and reports "up" on its own, while this one is the one
 * whose loss stops the sweeps.
 */
export async function pingRedis(timeoutMs: number = REDIS_PING_TIMEOUT_MS): Promise<boolean> {
  if (redis.status === 'wait' || redis.status === 'end') {
    await answeredWithin(ensureRedisConnected(), timeoutMs);
  }
  if (!isRedisAvailable()) return false;
  return answeredWithin(
    redis.ping().then((answer) => answer === 'PONG'),
    timeoutMs
  );
}

/**
 * For a readiness probe: yes, unless this deployment must have Redis and it
 * does not answer. Production with a REDIS_URL must (the API will not boot
 * without one); anywhere else Redis is optional and its absence is not a
 * reason to take the instance out of rotation.
 */
export async function redisReadyForTraffic(): Promise<boolean> {
  return !redisIsRequired() || (await pingRedis());
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

let warnedNoRedisForSweeps = false;

/**
 * The sweeps that were skipped because Redis was unreachable, and have not run
 * since. /health/detailed shows how many, under the condition below, so that
 * "Redis is down" and "the reminders have stopped" are the same sentence.
 */
const skippedSweeps = new Set<string>();
export const SWEEPS_SKIPPED_CONDITION = 'redis.sweeps_skipped';

function noteSweepSkipped(key: string): boolean {
  const first = !skippedSweeps.has(key);
  skippedSweeps.add(key);
  recordCondition(
    SWEEPS_SKIPPED_CONDITION,
    skippedSweeps.size,
    `Redis is unreachable, so these scheduled sweeps are not running on this instance: ${[...skippedSweeps].join(', ')}. Reminders, expiry warnings and scheduled posts are paused until it answers; they resume by themselves. See the on-call runbook, "Redis is unreachable".`
  );
  return first;
}

/**
 * Redis answers again, so nothing is being skipped any more. The sweeps that
 * were run at their next round, which for a daily sweep is later; the condition
 * is about whether sweeps are being held back, and they are not.
 */
function resumeSkippedSweeps(): void {
  if (skippedSweeps.size === 0) return;
  logger.info('Redis answers again: the scheduled sweeps that were skipped run at their next round', {
    sweeps: [...skippedSweeps],
  });
  skippedSweeps.clear();
  recordCondition(SWEEPS_SKIPPED_CONDITION, 0, null);
}

/** For tests. */
export function resetSkippedSweeps(): void {
  skippedSweeps.clear();
  warnedNoRedisForSweeps = false;
}

/**
 * A scheduled sweep (reminders, expiries, scheduled posts) runs on one
 * instance at a time.
 *
 * With Redis the lock decides and the instances that lose it skip the round.
 * Without Redis there is nothing to coordinate with, and what the sweeps do
 * is not repeatable: the escrow-expiry sweep warns about money that is about
 * to be released, the wellness sweep sends a woman her medication and
 * check-in reminders, the scheduled-post publisher publishes. Running those
 * on every instance at once means duplicate warnings about her money,
 * duplicate reminders about her health, and a post published as many times
 * as there are instances.
 *
 * So the unlocked path is a development convenience only. Outside production
 * the sweep runs on the assumption of a single instance and says so once; in
 * production the round is skipped and the reason is logged at error, because
 * nothing here can tell whether it is the only instance and guessing wrong
 * costs a member real money or a duplicate message about her health. Note
 * that this is the *runtime* half: env.ts refuses to start a production
 * process with no REDIS_URL at all, so this catches the case the variable
 * cannot — Redis configured and then unreachable.
 */
export async function runExclusively<T>(key: string, fn: () => Promise<T>, ttlMs = 10 * 60 * 1000): Promise<T | null> {
  if (!isRedisAvailable()) {
    if (process.env.NODE_ENV === 'production') {
      // One error line per sweep per outage, then a standing condition: nine
      // sweeps a minute for an hour is not nine hundred lines anyone reads.
      if (noteSweepSkipped(key)) {
        logger.error('Skipping a scheduled sweep: Redis is unavailable, so nothing can stop every instance running it at once', {
          sweep: key,
        });
      }
      return null;
    }
    if (!warnedNoRedisForSweeps) {
      warnedNoRedisForSweeps = true;
      logger.warn('Redis is not available: scheduled sweeps run unlocked, which is only safe on a single instance');
    }
    return fn();
  }
  return withLock(`sweep:${key}`, fn, ttlMs);
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
