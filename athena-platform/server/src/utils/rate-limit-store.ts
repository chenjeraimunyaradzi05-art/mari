/**
 * One counter per caller across every instance of the API.
 *
 * express-rate-limit keeps its counters in the process by default, so two
 * instances behind a balancer hand every caller two budgets, and a restart
 * hands out a fresh one. This store keeps the counters in Redis when it is
 * configured and ready, and in the process otherwise, with the same fixed
 * window either way. A Redis failure mid-flight falls back rather than
 * letting the request through uncounted.
 */

import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { ensureRedisConnected, isRedisAvailable, redis as sharedRedis } from './redis';
import { logger } from './logger';

/** The slice of ioredis the store uses, so a test can hand in a stand-in. */
export interface CounterClient {
  multi(): { incr(key: string): any; pttl(key: string): any; exec(): Promise<Array<[Error | null, unknown]> | null> };
  pexpire(key: string, ms: number): Promise<unknown>;
  decr(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

type MemoryCounter = { hits: number; resetAt: number };
const MEMORY_SWEEP_AT = 50_000;

// One line a minute when the counters are per process.
let lastFallbackWarning = 0;
function noteFallback(reason: string): void {
  const now = Date.now();
  if (now - lastFallbackWarning < 60_000) return;
  lastFallbackWarning = now;
  logger.warn(`Rate-limit counters are per process: ${reason}`);
}

export class SharedRateLimitStore implements Store {
  /** Counters are shared, so express-rate-limit must not assume they are local. */
  localKeys = false;
  prefix: string;
  private windowMs = 60_000;
  private readonly memory = new Map<string, MemoryCounter>();
  private readonly client: CounterClient | null;
  private readonly available: () => boolean;

  constructor(
    prefix: string,
    options: { client?: CounterClient | null; available?: () => boolean } = {}
  ) {
    this.prefix = prefix;
    this.client = options.client === undefined ? (sharedRedis as unknown as CounterClient) : options.client;
    this.available =
      options.available ?? (() => Boolean(process.env.REDIS_URL) && isRedisAvailable());
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    // The shared client connects lazily; asking now means the first request
    // is already counted in Redis. Nothing to reach under test.
    if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
      void ensureRedisConnected();
    }
  }

  private usingRedis(): boolean {
    return this.client !== null && this.available();
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (this.usingRedis()) {
      try {
        return await this.redisIncrement(key);
      } catch (error) {
        noteFallback(`Redis request failed (${error instanceof Error ? error.message : String(error)})`);
      }
    } else {
      noteFallback(process.env.REDIS_URL ? 'Redis is not ready' : 'REDIS_URL is not set');
    }
    return this.memoryIncrement(key);
  }

  async decrement(key: string): Promise<void> {
    if (this.usingRedis()) {
      try {
        await this.client!.decr(this.prefix + key);
        return;
      } catch {
        // Fall through to the process counter.
      }
    }
    const counter = this.memory.get(key);
    if (counter && counter.hits > 0) counter.hits -= 1;
  }

  async resetKey(key: string): Promise<void> {
    this.memory.delete(key);
    if (this.usingRedis()) {
      try {
        await this.client!.del(this.prefix + key);
      } catch {
        // The process counter is already cleared.
      }
    }
  }

  private async redisIncrement(key: string): Promise<ClientRateLimitInfo> {
    const redisKey = this.prefix + key;
    const results = await this.client!.multi().incr(redisKey).pttl(redisKey).exec();
    const hits = Number(results?.[0]?.[1] ?? 0);
    let ttl = Number(results?.[1]?.[1] ?? -1);
    if (!Number.isFinite(hits) || hits < 1) {
      throw new Error('Redis returned no count');
    }
    if (!Number.isFinite(ttl) || ttl < 0) {
      // First hit in this window, or a key that lost its expiry: start the clock.
      await this.client!.pexpire(redisKey, this.windowMs);
      ttl = this.windowMs;
    }
    return { totalHits: hits, resetTime: new Date(Date.now() + ttl) };
  }

  /** Exposed so the fallback can be tested without a clock. */
  memoryIncrement(key: string, now = Date.now()): ClientRateLimitInfo {
    const existing = this.memory.get(key);
    const counter =
      existing && existing.resetAt > now
        ? { hits: existing.hits + 1, resetAt: existing.resetAt }
        : { hits: 1, resetAt: now + this.windowMs };
    this.memory.set(key, counter);

    if (this.memory.size > MEMORY_SWEEP_AT) {
      for (const [k, c] of this.memory) {
        if (c.resetAt <= now) this.memory.delete(k);
      }
    }

    return { totalHits: counter.hits, resetTime: new Date(counter.resetAt) };
  }
}
