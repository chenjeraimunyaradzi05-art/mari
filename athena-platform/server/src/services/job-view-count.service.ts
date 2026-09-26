/**
 * Whether a request for a job listing counts as someone viewing it.
 *
 * `Job.viewCount` is not a vanity number. The employer console orders an
 * organisation's "top jobs" by it and divides applications by it to report a
 * conversion rate, and she decides which listings to rewrite, pay to promote or
 * close on the strength of those two figures. GET /api/jobs/:id used to add one
 * to it on every request: every refresh, every crawler, every link-preview
 * bot, a loop of curl in a terminal, and views of drafts and paused listings
 * nobody outside the company could see. The figure measured how often the URL
 * was fetched, and anyone could set it.
 *
 * A view now counts once per viewer per listing per day, only for a live
 * listing, never for the hiring team looking at its own ad, and never for a
 * client that says it is a bot. The record of who has already been counted is
 * kept in Redis when there is one and otherwise in this process, the same
 * arrangement the TOTP replay guard uses; per process is weaker but still
 * turns a refresh loop into one view.
 */

import { createHash } from 'crypto';
import { getRedisClient } from '../utils/cache';
import { logger } from '../utils/logger';

const KEY_PREFIX = 'job:viewed';
const DEDUPE_TTL_SECONDS = 24 * 60 * 60;

// User agents that announce themselves as automated. Not a defence against a
// determined forger — the per-viewer dedupe is that — but it keeps the
// ordinary crawlers and link unfurlers, which account for most of the traffic
// to any public URL, out of a figure that is meant to count people.
const AUTOMATED_AGENT =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|curl|wget|python-requests|httpclient|axios|node-fetch|go-http-client|okhttp|java\//i;

const memoryClaims = new Map<string, number>();
const MEMORY_SWEEP_AT = 10_000;

function memoryClaim(key: string, now: number): boolean {
  const expiresAt = memoryClaims.get(key);
  if (expiresAt && expiresAt > now) return false;
  memoryClaims.set(key, now + DEDUPE_TTL_SECONDS * 1000);

  if (memoryClaims.size > MEMORY_SWEEP_AT) {
    for (const [k, at] of memoryClaims) {
      if (at <= now) memoryClaims.delete(k);
    }
  }
  return true;
}

/** For tests. */
export function resetJobViewMemory(): void {
  memoryClaims.clear();
}

export interface JobViewRequest {
  jobId: string;
  jobStatus: string;
  /** The signed-in viewer, when there is one. */
  viewerId?: string;
  /** Whether the viewer is the poster or on the organisation's team. */
  viewerIsStaff: boolean;
  ip?: string;
  userAgent?: string;
}

/**
 * True when this request should add one to the listing's view count. Claims the
 * viewer's slot for the day as a side effect, so a second call for the same
 * viewer and listing answers false.
 */
export async function claimJobView(request: JobViewRequest, now = Date.now()): Promise<boolean> {
  if (request.jobStatus !== 'ACTIVE') return false;
  if (request.viewerIsStaff) return false;

  const agent = request.userAgent ?? '';
  if (!agent || AUTOMATED_AGENT.test(agent)) return false;

  // A signed-in viewer is herself. An anonymous one is her address and her
  // browser together, hashed so that neither sits in Redis in the clear.
  const viewer = request.viewerId
    ? `u:${request.viewerId}`
    : `a:${createHash('sha256').update(`${request.ip ?? ''}|${agent}`).digest('hex').slice(0, 32)}`;
  const key = `${KEY_PREFIX}:${request.jobId}:${viewer}`;

  const redis = process.env.REDIS_URL ? getRedisClient() : null;
  if (!redis) {
    return memoryClaim(key, now);
  }

  try {
    const result = await redis.set(key, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.warn('Job view dedupe fell back to this process', {
      error: error instanceof Error ? error.message : String(error),
    });
    return memoryClaim(key, now);
  }
}
