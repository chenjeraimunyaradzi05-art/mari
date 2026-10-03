/**
 * Pile-on detection: many accounts turning on one member at once.
 *
 * The per-member limits (middleware/socialLimits) bound how fast one account
 * can act. A pile-on is the opposite shape: no account does anything unusual,
 * and a few dozen of them each comment, mention or follow the same woman inside
 * an hour. It is how a campaign against her looks from the inside, whether it
 * was organised somewhere else on the internet or one man made a handful of
 * accounts, and it is exactly what a per-account limit cannot see.
 *
 * This keeps, per member, the accounts that have reached her recently through
 * something that rings her bell (a comment, a mention, a follow or a request to
 * follow, a repost), and counts how many of them do not follow her already. A
 * crowd of her own followers is a good day; a crowd of strangers is the signal.
 * Past the threshold, for as long as it lasts:
 *
 *  - what strangers do to her stops ringing her phone and filling her
 *    notifications (the caller asks quietedByPileOn before it writes one). Her
 *    followers are unaffected. Nothing is removed: the comments are still on her
 *    posts, where she can remove, block or report them. This is the alert being
 *    paused, not the activity, and she is told so;
 *  - staff are told, through the same safety queue the other automated flags
 *    use (an AdminFlag, shown at /admin/moderation, plus a notice to the
 *    admins), with the accounts involved so a moderator can look at who they
 *    are. She is the person being contacted, not the person at fault, and the
 *    flag says so in as many words so nobody sanctions her for it.
 *
 * Nothing here decides that any account did anything wrong, and nothing is
 * enforced against them: a person looks. The thresholds are the operator's, in
 * the environment, with conservative defaults so an ordinary busy day for a
 * woman with a public profile does not trip it:
 *
 *   PILE_ON_THRESHOLD         distinct accounts that do not follow her (15)
 *   PILE_ON_WINDOW_MINUTES    how recently they reached her (60)
 *   PILE_ON_CALM_MINUTES      how long the quieter state lasts (120)
 *
 * The count lives in Redis, as a sorted set per member scored by time, the same
 * technique as the sliding-window limiter, so every instance sees the same
 * crowd. Without Redis (local development) it is kept in this process. Failing
 * to count never fails the notification it was asked about: the answer is then
 * "not a pile-on" and the notification goes out as it did before this existed,
 * with the failure counted for the ops screen.
 */

import { prisma } from '../utils/prisma';
import { getRedisClient } from '../utils/cache';
import { logger } from '../utils/logger';
import { recordCondition, recordFailure } from '../utils/ops-metrics';
import { bestEffort } from '../utils/best-effort';
import { notifyAdmins } from './admin-notify.service';

/** The AdminFlag.type a pile-on is raised under; the staff queue labels it. */
export const PILE_ON_FLAG_TYPE = 'PILE_ON';

const DEFAULT_THRESHOLD = 15;
const DEFAULT_WINDOW_MINUTES = 60;
const DEFAULT_CALM_MINUTES = 120;

/** More accounts than this are not tracked individually; the count only needs to pass the threshold. */
const MAX_TRACKED_ACCOUNTS = 500;
/** How many of the accounts are written into the staff note. */
const NOTE_ACCOUNT_LIMIT = 25;

function positiveInteger(raw: string | undefined, fallback: number): number {
  const parsed = raw === undefined ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function pileOnSettings() {
  return {
    threshold: positiveInteger(process.env.PILE_ON_THRESHOLD, DEFAULT_THRESHOLD),
    windowMs: positiveInteger(process.env.PILE_ON_WINDOW_MINUTES, DEFAULT_WINDOW_MINUTES) * 60_000,
    calmMs: positiveInteger(process.env.PILE_ON_CALM_MINUTES, DEFAULT_CALM_MINUTES) * 60_000,
  };
}

// ===========================================
// The count, in Redis or in this process
// ===========================================

const contactsKey = (targetId: string) => `pileon:contacts:${targetId}`;
const calmKey = (targetId: string) => `pileon:calm:${targetId}`;

/** Local development, and Redis failing: per member, account to the last time it reached her. */
const memoryContacts = new Map<string, Map<string, number>>();
const memoryCalmUntil = new Map<string, number>();
const MEMORY_TARGETS_SWEEP_AT = 10_000;

function redisIfConfigured() {
  return process.env.REDIS_URL ? getRedisClient() : null;
}

/** For tests. */
export function resetPileOnState(): void {
  memoryContacts.clear();
  memoryCalmUntil.clear();
}

/** Records the contact and returns every account that has reached her inside the window. */
async function trackContact(targetId: string, actorId: string, windowMs: number, now: number): Promise<string[]> {
  const redis = redisIfConfigured();
  if (redis) {
    try {
      const key = contactsKey(targetId);
      const pipeline = redis.pipeline();
      pipeline.zadd(key, now.toString(), actorId);
      pipeline.zremrangebyscore(key, 0, now - windowMs);
      pipeline.zrevrange(key, 0, MAX_TRACKED_ACCOUNTS - 1);
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      const results = await pipeline.exec();
      const accounts = results?.[2]?.[1];
      if (Array.isArray(accounts)) return accounts.map(String);
      throw new Error('Redis did not return the list of accounts');
    } catch (error) {
      recordFailure('pile-on.redis', error);
      // Fall through to the in-process count rather than count nothing.
    }
  }

  const since = now - windowMs;
  const contacts = memoryContacts.get(targetId) ?? new Map<string, number>();
  contacts.set(actorId, now);
  for (const [account, at] of contacts) {
    if (at <= since) contacts.delete(account);
  }
  memoryContacts.set(targetId, contacts);

  if (memoryContacts.size > MEMORY_TARGETS_SWEEP_AT) {
    for (const [member, list] of memoryContacts) {
      if ([...list.values()].every((at) => at <= since)) memoryContacts.delete(member);
    }
  }
  return [...contacts.keys()].slice(-MAX_TRACKED_ACCOUNTS);
}

async function isCalm(targetId: string, now: number): Promise<boolean> {
  const redis = redisIfConfigured();
  if (redis) {
    try {
      return (await redis.exists(calmKey(targetId))) === 1;
    } catch (error) {
      recordFailure('pile-on.redis', error);
    }
  }
  return (memoryCalmUntil.get(targetId) ?? 0) > now;
}

/** Starts the quieter state. True only for the call that started it, so staff are told once. */
async function enterCalm(targetId: string, calmMs: number, now: number): Promise<boolean> {
  const redis = redisIfConfigured();
  if (redis) {
    try {
      const started = (await redis.set(calmKey(targetId), String(now), 'PX', calmMs, 'NX')) === 'OK';
      // Remembered here too, so the gauge below can count it and so the
      // in-process answer agrees if Redis stops answering mid-way.
      if (started) memoryCalmUntil.set(targetId, now + calmMs);
      return started;
    } catch (error) {
      recordFailure('pile-on.redis', error);
    }
  }
  if ((memoryCalmUntil.get(targetId) ?? 0) > now) return false;
  memoryCalmUntil.set(targetId, now + calmMs);
  return true;
}

/** How many members this instance has put in the quieter state, as a gauge for the ops snapshot. */
function reportActive(now: number): void {
  let active = 0;
  for (const [member, until] of memoryCalmUntil) {
    if (until > now) active += 1;
    else memoryCalmUntil.delete(member);
  }
  recordCondition(
    'social.pile_on_active',
    active,
    active > 0 ? 'Members whose notifications from strangers are paused because many accounts turned on them at once. Look at the safety queue.' : null
  );
}

// ===========================================
// Raising it
// ===========================================

async function followersAmong(targetId: string, accounts: string[]): Promise<Set<string>> {
  const rows = await prisma.follow.findMany({
    where: { followingId: targetId, followerId: { in: accounts } },
    select: { followerId: true },
  });
  return new Set(rows.map((row) => row.followerId));
}

/**
 * Tells staff, and tells her. Both are best effort and neither is allowed to
 * throw into the notification that triggered it: the flag is the record, and
 * the quieter state is already in force whether or not it could be written.
 */
async function raise(targetId: string, strangers: string[], settings: ReturnType<typeof pileOnSettings>): Promise<void> {
  const windowMinutes = Math.round(settings.windowMs / 60_000);
  const flagged = await bestEffort(
    'pile-on staff flag',
    prisma.adminFlag.create({
      data: {
        userId: targetId,
        type: PILE_ON_FLAG_TYPE,
        severity: 'HIGH',
        flaggedById: 'system',
        reason:
          `Many accounts that do not follow this member reached her within ${windowMinutes} minutes ` +
          'by comment, mention or follow. She is the person being contacted, not the person at fault. ' +
          'Her alerts from these accounts have been paused.',
        notes:
          `${strangers.length} distinct accounts that do not follow her (threshold ${settings.threshold}).\n` +
          `Accounts, most recent first${strangers.length > NOTE_ACCOUNT_LIMIT ? ` (first ${NOTE_ACCOUNT_LIMIT} of ${strangers.length})` : ''}:\n` +
          strangers.slice(0, NOTE_ACCOUNT_LIMIT).join('\n'),
      },
    })
  );

  if (flagged) {
    await bestEffort(
      'pile-on admin notice',
      notifyAdmins({
        title: 'A member may be the target of a pile-on',
        message:
          'Many accounts that do not follow a member have reached her in a short time. Her alerts from them are paused, and she is waiting in the safety queue.',
        link: '/admin/moderation#safety-concerns',
        data: { flagId: flagged.id, flagType: PILE_ON_FLAG_TYPE, severity: 'HIGH' },
      })
    );
  }

  await bestEffort(
    'pile-on notice to the member',
    prisma.notification.create({
      data: {
        userId: targetId,
        type: 'SYSTEM',
        title: 'We have quieted your notifications',
        message:
          'A lot of accounts you do not follow have reached out to you in a short time, so we have paused alerts from them to keep your phone calm. ' +
          'Nothing has been removed: comments and mentions are still on your posts, and you can block or report anyone from there.' +
          (flagged ? ' Our moderators have been told.' : ''),
        link: '/safety-center',
      },
    })
  );

  logger.warn('A member is the target of a pile-on; her alerts from strangers are paused', {
    targetId,
    accounts: strangers.length,
    windowMinutes,
    flagId: flagged?.id,
  });
}

// ===========================================
// What a caller asks
// ===========================================

/**
 * Records that `actorId` just did something that would notify `targetId` and
 * says whether that notification should be held back because she is being
 * piled on. True means skip the bell and the push for this one.
 *
 * Never throws: a failure here is counted and answered "no", so the worst case
 * is the behaviour from before this existed.
 */
export async function quietedByPileOn(targetId: string, actorId: string, now = Date.now()): Promise<boolean> {
  if (!targetId || !actorId || targetId === actorId) return false;

  try {
    const settings = pileOnSettings();
    const accounts = await trackContact(targetId, actorId, settings.windowMs, now);

    if (await isCalm(targetId, now)) {
      // Already quieter: only her own followers still get through.
      return !(await followersAmong(targetId, [actorId])).has(actorId);
    }

    // Cheap exit: fewer accounts than the threshold cannot hold that many strangers.
    if (accounts.length < settings.threshold) return false;

    const followers = await followersAmong(targetId, accounts);
    const strangers = accounts.filter((account) => !followers.has(account));
    if (strangers.length < settings.threshold) return false;

    if (await enterCalm(targetId, settings.calmMs, now)) {
      reportActive(now);
      await raise(targetId, strangers, settings);
    }
    return !followers.has(actorId);
  } catch (error) {
    recordFailure('pile-on.check', error);
    logger.warn('Pile-on check failed; the notification goes out as usual', {
      targetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
