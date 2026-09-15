/**
 * Per-account login lockout
 * =========================
 * Tracks failed login attempts keyed by email + IP and locks that tuple
 * temporarily after too many failures. Backed by Redis when available;
 * without it, or while it is failing, the same counters are kept in this
 * process so a password-guessing run is still slowed on every instance.
 * "Allow everything" was the previous fallback, which meant a deployment
 * without Redis had no lockout at all.
 */

import { getRedisClient } from './cache';
import { logger } from './logger';

const FAILED_KEY_PREFIX = 'login:fails';
const LOCK_KEY_PREFIX = 'login:lock';

const MAX_FAILURES = parseInt(process.env.LOGIN_MAX_FAILURES || '5', 10);
const FAILURE_WINDOW_SECONDS = parseInt(
  process.env.LOGIN_FAILURE_WINDOW_SECONDS || `${15 * 60}`,
  10
);
const LOCK_DURATION_SECONDS = parseInt(
  process.env.LOGIN_LOCK_DURATION_SECONDS || `${15 * 60}`,
  10
);

function normalizeKeyPart(value: string | undefined): string {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9:._-]/g, '_')
    .slice(0, 254);
}

function failKey(email: string, ipAddress?: string): string {
  return `${FAILED_KEY_PREFIX}:${normalizeKeyPart(email)}:${normalizeKeyPart(ipAddress)}`;
}

function lockKey(email: string, ipAddress?: string): string {
  return `${LOCK_KEY_PREFIX}:${normalizeKeyPart(email)}:${normalizeKeyPart(ipAddress)}`;
}

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds: number;
}

// ===========================================
// IN-PROCESS FALLBACK
// ===========================================

type Counter = { count: number; expiresAt: number };
const memoryFails = new Map<string, Counter>();
const memoryLocks = new Map<string, number>();
const MEMORY_SWEEP_AT = 20_000;

function sweepMemory(now: number): void {
  if (memoryFails.size + memoryLocks.size < MEMORY_SWEEP_AT) return;
  for (const [key, counter] of memoryFails) {
    if (counter.expiresAt <= now) memoryFails.delete(key);
  }
  for (const [key, until] of memoryLocks) {
    if (until <= now) memoryLocks.delete(key);
  }
}

function memoryLockStatus(key: string, now: number): LockoutStatus {
  const until = memoryLocks.get(key);
  if (until && until > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((until - now) / 1000) };
  }
  if (until) memoryLocks.delete(key);
  return { locked: false, retryAfterSeconds: 0 };
}

function memoryRecordFailure(email: string, ipAddress: string | undefined, now: number): LockoutStatus {
  sweepMemory(now);
  const key = failKey(email, ipAddress);
  const existing = memoryFails.get(key);
  const counter =
    existing && existing.expiresAt > now
      ? { count: existing.count + 1, expiresAt: existing.expiresAt }
      : { count: 1, expiresAt: now + FAILURE_WINDOW_SECONDS * 1000 };
  memoryFails.set(key, counter);

  if (counter.count >= MAX_FAILURES) {
    memoryLocks.set(lockKey(email, ipAddress), now + LOCK_DURATION_SECONDS * 1000);
    memoryFails.delete(key);
    return { locked: true, retryAfterSeconds: LOCK_DURATION_SECONDS };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

/** For tests. */
export function resetLoginAttemptMemory(): void {
  memoryFails.clear();
  memoryLocks.clear();
}

// One line a minute when the fallback is carrying the lockout.
let lastFallbackWarning = 0;
function noteFallback(reason: string): void {
  const now = Date.now();
  if (now - lastFallbackWarning < 60_000) return;
  lastFallbackWarning = now;
  logger.warn(`Login lockout is using the in-process fallback: ${reason}`);
}

function redisOrNull() {
  // Without REDIS_URL there is nothing to connect to; asking would only wait
  // on a refused socket before falling back anyway.
  if (!process.env.REDIS_URL) return null;
  return getRedisClient();
}

// ===========================================
// PUBLIC API
// ===========================================

/**
 * Returns whether the account is currently locked, and how long the caller
 * should wait before retrying.
 */
export async function getLockoutStatus(
  email: string,
  ipAddress?: string
): Promise<LockoutStatus> {
  const now = Date.now();
  const client = redisOrNull();
  if (!client) {
    noteFallback('Redis is not configured');
    return memoryLockStatus(lockKey(email, ipAddress), now);
  }

  try {
    const ttl = await client.ttl(lockKey(email, ipAddress));
    if (ttl > 0) {
      return { locked: true, retryAfterSeconds: ttl };
    }
    return { locked: false, retryAfterSeconds: 0 };
  } catch {
    noteFallback('Redis request failed');
    return memoryLockStatus(lockKey(email, ipAddress), now);
  }
}

/**
 * Records a failed login attempt. If the count crosses MAX_FAILURES inside
 * the rolling window, places a lock on the account.
 */
export async function recordFailedLogin(
  email: string,
  ipAddress?: string
): Promise<LockoutStatus> {
  const now = Date.now();
  const client = redisOrNull();
  if (!client) {
    noteFallback('Redis is not configured');
    return memoryRecordFailure(email, ipAddress, now);
  }

  try {
    const key = failKey(email, ipAddress);
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, FAILURE_WINDOW_SECONDS);
    }

    if (count >= MAX_FAILURES) {
      await client.set(lockKey(email, ipAddress), '1', 'EX', LOCK_DURATION_SECONDS);
      await client.del(key);
      return { locked: true, retryAfterSeconds: LOCK_DURATION_SECONDS };
    }

    return { locked: false, retryAfterSeconds: 0 };
  } catch {
    noteFallback('Redis request failed');
    return memoryRecordFailure(email, ipAddress, now);
  }
}

/**
 * Clears the failed-attempts counter (call on successful login).
 */
export async function clearFailedLogins(
  email: string,
  ipAddress?: string
): Promise<void> {
  memoryFails.delete(failKey(email, ipAddress));
  memoryLocks.delete(lockKey(email, ipAddress));

  const client = redisOrNull();
  if (!client) return;
  try {
    await client.del(failKey(email, ipAddress));
    await client.del(lockKey(email, ipAddress));
  } catch {
    // ignore
  }
}
