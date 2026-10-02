/**
 * Refresh-token rotation, and what a refresh token that has already been
 * rotated means.
 *
 * Rotation used to be find, then update, then create, with no condition on the
 * update, so two requests holding the same token both passed the find and both
 * created a session: one token produced two live pairs. And reuse detection
 * had no grace at all, so two browser tabs refreshing together made the second
 * look exactly like a thief replaying a stolen token, and the member was signed
 * out of every device for opening two tabs.
 *
 * The session table is a small in-memory stand-in with the same rules the
 * queries rely on (a conditional update that reports how many rows it changed),
 * so the race is real: a latch holds both lookups until both have happened,
 * which is the interleaving that used to produce two sessions.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Row = {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
};

let rows: Row[] = [];
let nextId = 1;
/** When set, findFirst waits until this many lookups have arrived, then lets them all go. */
let latch: { size: number; waiting: Array<() => void> } | null = null;

function matches(row: Row, where: any): boolean {
  if (typeof where.id === 'string' && row.id !== where.id) return false;
  if (where.id && typeof where.id === 'object' && 'not' in where.id && row.id === where.id.not) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.refreshToken !== undefined && row.refreshToken !== where.refreshToken) return false;
  if (where.token !== undefined && row.token !== where.token) return false;
  if (where.revokedAt === null && row.revokedAt !== null) return false;
  if (where.revokedAt && 'not' in where.revokedAt && row.revokedAt === null) return false;
  return true;
}

const sessionDelegate = {
  findFirst: jest.fn(async ({ where }: any) => {
    if (latch) {
      const gate = latch;
      await new Promise<void>((resolve) => {
        gate.waiting.push(resolve);
        if (gate.waiting.length >= gate.size) gate.waiting.splice(0).forEach((release) => release());
      });
    }
    return rows.find((row) => matches(row, where)) ?? null;
  }),
  findUnique: jest.fn(async ({ where }: any) => rows.find((row) => matches(row, where)) ?? null),
  create: jest.fn(async ({ data }: any) => {
    const row: Row = { id: `s${nextId++}`, revokedAt: null, createdAt: new Date(), ...data };
    rows.push(row);
    return row;
  }),
  updateMany: jest.fn(async ({ where, data }: any) => {
    const hit = rows.filter((row) => matches(row, where));
    hit.forEach((row) => Object.assign(row, data));
    return { count: hit.length };
  }),
  update: jest.fn(async ({ where, data }: any) => {
    const row = rows.find((candidate) => matches(candidate, where));
    if (!row) throw new Error('no such session');
    Object.assign(row, data);
    return row;
  }),
};

/** The handsets registered for push, by owner, for the tests about what ending a session does to them. */
let pushTokens: Array<{ id: string; userId: string; isActive: boolean }> = [];
const pushTokenDelegate = {
  updateMany: jest.fn(async ({ where, data }: any) => {
    const hit = pushTokens.filter((row) => row.userId === where.userId && (where.isActive === undefined || row.isActive === where.isActive));
    hit.forEach((row) => Object.assign(row, data));
    return { count: hit.length };
  }),
};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    session: sessionDelegate,
    pushToken: pushTokenDelegate,
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({ session: sessionDelegate }),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { hashOpaqueToken } from '../../utils/opaqueToken';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { sessionEvents } from '../../utils/session-events';
import { REFRESH_REUSE_GRACE_MS, RefreshConflictError, sessionService } from '../session.service';

const payload = { userId: 'u1', email: 'u1@athena.test', role: 'USER', persona: 'EARLY_CAREER' };

function pair(user = payload) {
  return { access: generateAccessToken(user), refresh: generateRefreshToken(user) };
}

/** `null` is a client that sent no user agent at all (undefined would take the default). */
async function signedIn(user = payload, userAgent: string | null = 'Browser A') {
  const tokens = pair(user);
  const session = await sessionService.createSession(
    user.userId,
    tokens.access,
    tokens.refresh,
    userAgent ?? undefined,
    '203.0.113.9'
  );
  return { ...tokens, session };
}

const live = (userId = 'u1') => rows.filter((row) => row.userId === userId && row.revokedAt === null);

beforeEach(() => {
  rows = [];
  nextId = 1;
  latch = null;
  pushTokens = [];
  jest.clearAllMocks();
});

describe('rotateRefreshToken', () => {
  it('retires the old session and leaves exactly one live session with the new pair', async () => {
    const first = await signedIn();
    const next = pair();

    const created = await sessionService.rotateRefreshToken(first.refresh, next.access, next.refresh, 'Browser A', '203.0.113.9');

    expect(live()).toHaveLength(1);
    expect(live()[0].id).toBe(created.id);
    expect(rows.find((row) => row.id === first.session.id)?.revokedAt).toBeInstanceOf(Date);
    expect(live()[0].refreshToken).toBe(hashOpaqueToken(next.refresh));
  });

  it('lets one of two simultaneous requests win and tells the other to ask again', async () => {
    const first = await signedIn();
    const a = pair();
    const b = pair();

    // Both lookups are held until both have arrived, so each sees a live
    // session: the interleaving that used to create two.
    latch = { size: 2, waiting: [] };
    const results = await Promise.allSettled([
      sessionService.rotateRefreshToken(first.refresh, a.access, a.refresh, 'Browser A'),
      sessionService.rotateRefreshToken(first.refresh, b.access, b.refresh, 'Browser A'),
    ]);

    const won = results.filter((result) => result.status === 'fulfilled');
    const lost = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0].reason).toBeInstanceOf(RefreshConflictError);

    // One token, one new pair. Not two.
    expect(live()).toHaveLength(1);
    expect(rows.filter((row) => row.revokedAt === null && row.id !== first.session.id)).toHaveLength(1);
  });

  it('does not touch the member’s other devices when it loses', async () => {
    const phone = await signedIn(payload, 'Phone');
    const laptop = await signedIn(payload, 'Laptop');
    const a = pair();
    const b = pair();

    latch = { size: 2, waiting: [] };
    await Promise.allSettled([
      sessionService.rotateRefreshToken(laptop.refresh, a.access, a.refresh, 'Laptop'),
      sessionService.rotateRefreshToken(laptop.refresh, b.access, b.refresh, 'Laptop'),
    ]);

    expect(rows.find((row) => row.id === phone.session.id)?.revokedAt).toBeNull();
  });

  it('treats a session that has just gone as a lost race, not a missing one', async () => {
    const first = await signedIn();
    await sessionService.revokeSession(first.session.id, 'logout');
    const next = pair();

    await expect(sessionService.rotateRefreshToken(first.refresh, next.access, next.refresh)).rejects.toBeInstanceOf(
      RefreshConflictError
    );
    expect(live()).toHaveLength(0);
  });

  it('creates nothing when the conditional retire matched no row', async () => {
    const first = await signedIn();
    const next = pair();
    // Another request retires the session between this one's lookup and its update.
    sessionDelegate.updateMany.mockImplementationOnce(async () => ({ count: 0 }));

    await expect(sessionService.rotateRefreshToken(first.refresh, next.access, next.refresh)).rejects.toBeInstanceOf(
      RefreshConflictError
    );
    expect(rows).toHaveLength(1);
  });
});

describe('lookups by token', () => {
  it('ask for the hash only, never the token itself', async () => {
    const first = await signedIn();

    await sessionService.findActiveSessionByRefreshToken(first.refresh);
    await sessionService.findActiveSessionByAccessToken(first.access);
    await sessionService.detectRefreshTokenReuse(first.refresh);

    const asked = JSON.stringify([
      ...sessionDelegate.findFirst.mock.calls,
      ...sessionDelegate.findUnique.mock.calls,
    ]);
    expect(asked).not.toContain(first.refresh);
    expect(asked).not.toContain(first.access);
    expect(asked).toContain(hashOpaqueToken(first.refresh));
  });
});

describe('detectRefreshTokenReuse', () => {
  const heard: Array<{ userId: string; reason: string }> = [];
  beforeEach(() => {
    heard.length = 0;
    sessionEvents.removeAllListeners('revoked');
    sessionEvents.onRevoked((event) => heard.push({ userId: event.userId, reason: event.reason }));
  });

  /** A refresh token that was rotated `msAgo` ago, with another live device beside it. */
  async function rotatedAgo(msAgo: number, userAgent: string | null = 'Browser A') {
    const retiredTokens = await signedIn(payload, userAgent);
    const otherDevice = await signedIn(payload, 'Phone');
    const row = rows.find((candidate) => candidate.id === retiredTokens.session.id)!;
    row.revokedAt = new Date(Date.now() - msAgo);
    return { retiredTokens, otherDevice };
  }

  it('knows nothing of a token that never belonged to a session, and revokes nothing', async () => {
    await signedIn();

    const replay = await sessionService.detectRefreshTokenReuse(generateRefreshToken(payload), { userAgent: 'Browser A' });

    expect(replay).toEqual({ kind: 'unknown' });
    expect(live()).toHaveLength(1);
    expect(heard).toEqual([]);
  });

  it('reads a replay moments after the rotation, from the same device, as a second tab', async () => {
    const { retiredTokens, otherDevice } = await rotatedAgo(1_500);

    const replay = await sessionService.detectRefreshTokenReuse(retiredTokens.refresh, { userAgent: 'Browser A' });

    expect(replay).toEqual({ kind: 'concurrent', userId: 'u1' });
    // Nothing was revoked, here or on her other device, and nobody was told.
    expect(rows.find((row) => row.id === otherDevice.session.id)?.revokedAt).toBeNull();
    expect(live()).toHaveLength(1);
    expect(heard).toEqual([]);
  });

  it('counts a missing user agent on both sides as the same device', async () => {
    const { retiredTokens } = await rotatedAgo(500, null);
    const replay = await sessionService.detectRefreshTokenReuse(retiredTokens.refresh, { userAgent: undefined });
    expect(replay.kind).toBe('concurrent');
  });

  it('treats a replay after the grace window as theft and revokes every session', async () => {
    const { retiredTokens } = await rotatedAgo(REFRESH_REUSE_GRACE_MS + 1_000);

    const replay = await sessionService.detectRefreshTokenReuse(retiredTokens.refresh, { userAgent: 'Browser A' });

    expect(replay).toEqual({ kind: 'reuse', userId: 'u1' });
    expect(live()).toHaveLength(0);
    expect(heard).toEqual([{ userId: 'u1', reason: 'reuse-detected' }]);
  });

  it('treats a replay inside the window from a different device as theft', async () => {
    const { retiredTokens } = await rotatedAgo(1_000, 'Browser A');

    const replay = await sessionService.detectRefreshTokenReuse(retiredTokens.refresh, { userAgent: 'Some other client' });

    expect(replay.kind).toBe('reuse');
    expect(live()).toHaveLength(0);
  });

  it('treats a replay with no context at all as theft once the member has a user agent on record', async () => {
    const { retiredTokens } = await rotatedAgo(1_000, 'Browser A');
    const replay = await sessionService.detectRefreshTokenReuse(retiredTokens.refresh);
    expect(replay.kind).toBe('reuse');
  });

  it('only revokes the account the replayed token belonged to', async () => {
    const mine = await rotatedAgo(60_000);
    const other = await signedIn({ ...payload, userId: 'u2', email: 'u2@athena.test' }, 'Browser Z');

    await sessionService.detectRefreshTokenReuse(mine.retiredTokens.refresh, { userAgent: 'Browser A' });

    expect(rows.find((row) => row.id === other.session.id)?.revokedAt).toBeNull();
    expect(live('u1')).toHaveLength(0);
  });
});

/**
 * A session its owner (or a moderator) ended is not a rotated one. The hash a
 * retired row keeps is what recognises a stolen token being replayed, and a row
 * ended on purpose used to keep it too: the device that had just been signed
 * out refreshed with it, was read as a thief, and every other session of the
 * account was burned along with it, the one the signing out was done from
 * included.
 */
describe('a session that was ended on purpose', () => {
  const heard: Array<{ userId: string; reason: string }> = [];
  beforeEach(() => {
    heard.length = 0;
    sessionEvents.removeAllListeners('revoked');
    sessionEvents.onRevoked((event) => heard.push({ userId: event.userId, reason: event.reason }));
  });

  it('is an unknown token when its device refreshes later, and nothing else is signed out', async () => {
    const oldPhone = await signedIn(payload, 'Old phone');
    const laptop = await signedIn(payload, 'Laptop');
    await sessionService.revokeSession(oldPhone.session.id);
    heard.length = 0;
    // The old phone comes back online a quarter of an hour later.
    rows.find((row) => row.id === oldPhone.session.id)!.revokedAt = new Date(Date.now() - 15 * 60_000);

    expect(await sessionService.findActiveSessionByRefreshToken(oldPhone.refresh)).toBeNull();
    const replay = await sessionService.detectRefreshTokenReuse(oldPhone.refresh, { userAgent: 'Old phone' });

    expect(replay).toEqual({ kind: 'unknown' });
    expect(rows.find((row) => row.id === laptop.session.id)?.revokedAt).toBeNull();
    expect(live()).toHaveLength(1);
    expect(heard).toEqual([]);
  });

  it('is the same after a sign-out of every device, so no later refresh raises an alarm', async () => {
    const phone = await signedIn(payload, 'Phone');
    const laptop = await signedIn(payload, 'Laptop');
    await sessionService.revokeAllUserSessions('u1', { reason: 'password-changed', exceptSessionId: phone.session.id });
    // The member signs in again on a new device afterwards.
    const tablet = await signedIn(payload, 'Tablet');
    rows.find((row) => row.id === laptop.session.id)!.revokedAt = new Date(Date.now() - 5 * 60_000);

    const replay = await sessionService.detectRefreshTokenReuse(laptop.refresh, { userAgent: 'Laptop' });

    expect(replay).toEqual({ kind: 'unknown' });
    expect(rows.find((row) => row.id === phone.session.id)?.revokedAt).toBeNull();
    expect(rows.find((row) => row.id === tablet.session.id)?.revokedAt).toBeNull();
    expect(live()).toHaveLength(2);
  });

  it('keeps nothing of its refresh token in the table, and still ends the access token', async () => {
    const phone = await signedIn(payload, 'Phone');

    await sessionService.revokeSession(phone.session.id, 'logout');

    const row = rows.find((candidate) => candidate.id === phone.session.id)!;
    expect(row.refreshToken).toBeNull();
    expect(row.revokedAt).toBeInstanceOf(Date);
    expect(await sessionService.findActiveSessionByAccessToken(phone.access)).toBeNull();
  });

  it('does not touch the hash a rotation left behind, which is what still catches a stolen token', async () => {
    const first = await signedIn(payload, 'Browser A');
    const next = pair();
    await sessionService.rotateRefreshToken(first.refresh, next.access, next.refresh, 'Browser A');
    // Signing out the new session afterwards must not erase the retired one's hash.
    const newest = rows.find((row) => row.refreshToken === hashOpaqueToken(next.refresh))!;
    await sessionService.revokeSession(newest.id);
    rows.find((row) => row.id === first.session.id)!.revokedAt = new Date(Date.now() - 60_000);

    const replay = await sessionService.detectRefreshTokenReuse(first.refresh, { userAgent: 'Browser A' });

    expect(replay).toEqual({ kind: 'reuse', userId: 'u1' });
  });
});

/**
 * A push token belongs to the handset, not to a session. Ending every session
 * used to leave every handset registered, so a phone signed out of everywhere
 * (because it was lost, or because the person it was hidden from held it) kept
 * lighting up with message previews and safety alerts.
 */
describe('push notifications when every session has ended', () => {
  beforeEach(() => {
    pushTokens = [
      { id: 'p-phone', userId: 'u1', isActive: true },
      { id: 'p-tablet', userId: 'u1', isActive: true },
      { id: 'p-theirs', userId: 'u2', isActive: true },
    ];
  });

  const activeFor = (userId: string) => pushTokens.filter((row) => row.userId === userId && row.isActive).map((row) => row.id);

  it('stops on every handset of the account, and only that account', async () => {
    await signedIn(payload, 'Phone');
    await signedIn(payload, 'Tablet');

    await sessionService.revokeAllUserSessions('u1', { reason: 'logout' });

    expect(activeFor('u1')).toEqual([]);
    expect(activeFor('u2')).toEqual(['p-theirs']);
  });

  it('is left alone when one session is spared, because the handsets cannot be told apart', async () => {
    const here = await signedIn(payload, 'Phone');
    await signedIn(payload, 'Tablet');

    await sessionService.revokeAllUserSessions('u1', { reason: 'password-changed', exceptSessionId: here.session.id });

    expect(activeFor('u1')).toEqual(['p-phone', 'p-tablet']);
  });

  it('is left alone when a single device is signed out', async () => {
    const tablet = await signedIn(payload, 'Tablet');
    await signedIn(payload, 'Phone');

    await sessionService.revokeSession(tablet.session.id);

    expect(activeFor('u1')).toEqual(['p-phone', 'p-tablet']);
  });

  it('stops when a replayed refresh token burns the account', async () => {
    const stolen = await signedIn(payload, 'Browser A');
    await signedIn(payload, 'Phone');
    const next = pair();
    await sessionService.rotateRefreshToken(stolen.refresh, next.access, next.refresh, 'Browser A');
    rows.find((row) => row.id === stolen.session.id)!.revokedAt = new Date(Date.now() - 60_000);

    await sessionService.detectRefreshTokenReuse(stolen.refresh, { userAgent: 'Browser A' });

    expect(activeFor('u1')).toEqual([]);
  });

  it('does not stop for a replay that was only a second tab', async () => {
    const first = await signedIn(payload, 'Browser A');
    const next = pair();
    await sessionService.rotateRefreshToken(first.refresh, next.access, next.refresh, 'Browser A');

    const replay = await sessionService.detectRefreshTokenReuse(first.refresh, { userAgent: 'Browser A' });

    expect(replay.kind).toBe('concurrent');
    expect(activeFor('u1')).toEqual(['p-phone', 'p-tablet']);
  });

  it('never lets a failure here undo the revocation or hide the announcement', async () => {
    await signedIn(payload, 'Phone');
    const heard: string[] = [];
    sessionEvents.removeAllListeners('revoked');
    sessionEvents.onRevoked((event) => heard.push(event.reason));
    pushTokenDelegate.updateMany.mockRejectedValueOnce(new Error('connection reset'));

    await expect(sessionService.revokeAllUserSessions('u1', { reason: 'banned' })).resolves.toMatchObject({ count: 1 });

    expect(live()).toHaveLength(0);
    expect(heard).toEqual(['banned']);
  });
});
