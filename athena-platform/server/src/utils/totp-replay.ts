/**
 * A one-time code is only one-time if the server remembers it was used.
 *
 * An authenticator code is valid for its thirty-second step and the steps
 * either side of it, so a code read over someone's shoulder, or pulled from
 * a phishing page, could be replayed for up to ninety seconds after the
 * owner used it. This records the step each account last spent, in Redis
 * when there is one and otherwise in this process, and refuses a second
 * claim on the same step.
 */

import { getRedisClient } from './cache';
import { logger } from './logger';
import { TOTP_REPLAY_TTL_SECONDS } from './totp';

const KEY_PREFIX = 'totp:used';

// In-process fallback: userId:step -> when it stops mattering.
const memoryClaims = new Map<string, number>();
const MEMORY_SWEEP_AT = 10_000;

function memoryClaim(key: string, now: number, ttlMs: number): boolean {
  const expiresAt = memoryClaims.get(key);
  if (expiresAt && expiresAt > now) return false;
  memoryClaims.set(key, now + ttlMs);

  if (memoryClaims.size > MEMORY_SWEEP_AT) {
    for (const [k, at] of memoryClaims) {
      if (at <= now) memoryClaims.delete(k);
    }
  }
  return true;
}

/** For tests. */
export function resetTotpReplayMemory(): void {
  memoryClaims.clear();
}

/**
 * True when this call is the first to spend the step for the account; false
 * when the same code has already been accepted. Without Redis configured
 * the record is per process, which holds on one instance.
 */
export async function claimTotpStep(userId: string, step: number, now = Date.now()): Promise<boolean> {
  const key = `${KEY_PREFIX}:${userId}:${step}`;
  const ttlMs = TOTP_REPLAY_TTL_SECONDS * 1000;

  const redis = process.env.REDIS_URL ? getRedisClient() : null;
  if (!redis) {
    return memoryClaim(key, now, ttlMs);
  }

  try {
    const result = await redis.set(key, '1', 'EX', TOTP_REPLAY_TTL_SECONDS, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.warn('TOTP replay record fell back to this process', {
      error: error instanceof Error ? error.message : String(error),
    });
    return memoryClaim(key, now, ttlMs);
  }
}
