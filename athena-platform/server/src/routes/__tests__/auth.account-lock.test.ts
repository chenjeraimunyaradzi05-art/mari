/**
 * A member locking her own account.
 *
 * "Sign out everywhere" ends the sessions that exist and nothing more: whoever
 * holds her password signs straight back in. The lock is the step beyond it.
 * These run the real auth router, the real authenticate middleware, the real
 * session service and the real lock service over in-memory tables, so a session
 * that is revoked is a row that really changes and a link that is spent is a
 * row that really goes.
 *
 * What matters most: the lock ends every session and then holds against every
 * way of getting a new one (password, Google, refresh), a token minted while
 * the lock was being made is refused too, the unlock link works once and not
 * after it expires, the "this was not me" link locks with no session and also
 * works once, and nothing here says whether an address has an account.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.JWT_SECRET = '5b7d0c9e1f3a4c6e8b2d4f6a8c0e2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2a4c6e';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.GOOGLE_CLIENT_ID = 'athena-google-client';

type SessionRow = {
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
type TokenRow = { id: string; userId: string; token: string; type: string; expiresAt: Date; createdAt: Date };

let sessions: SessionRow[] = [];
let tokens: TokenRow[] = [];
let audit: Array<Record<string, any>> = [];
let nextId = 1;
let clock = Date.now();
const users = new Map<string, Record<string, any>>();

function sessionMatches(row: SessionRow, where: any): boolean {
  if (typeof where.id === 'string' && row.id !== where.id) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.refreshToken !== undefined && row.refreshToken !== where.refreshToken) return false;
  if (where.token !== undefined && row.token !== where.token) return false;
  if (where.revokedAt === null && row.revokedAt !== null) return false;
  if (where.expiresAt?.gt && !(row.expiresAt > where.expiresAt.gt)) return false;
  return true;
}

function tokenMatches(row: TokenRow, where: any): boolean {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.token !== undefined && row.token !== where.token) return false;
  if (where.type !== undefined && row.type !== where.type) return false;
  if (where.expiresAt?.gt && !(row.expiresAt > where.expiresAt.gt)) return false;
  if (where.createdAt?.lt && !(row.createdAt < where.createdAt.lt)) return false;
  return true;
}

function userMatches(row: Record<string, any>, where: any): boolean {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.email !== undefined && row.email !== where.email) return false;
  if (where.googleId !== undefined && row.googleId !== where.googleId) return false;
  if (where.facebookId !== undefined && row.facebookId !== where.facebookId) return false;
  if (where.lockedAt === null && row.lockedAt !== null) return false;
  if (where.lockedAt?.not === null && row.lockedAt === null) return false;
  return true;
}

const prismaMock: any = {
  session: {
    findFirst: jest.fn(async ({ where }: any) => sessions.find((row) => sessionMatches(row, where)) ?? null),
    findUnique: jest.fn(async ({ where }: any) => sessions.find((row) => sessionMatches(row, where)) ?? null),
    findMany: jest.fn(async ({ where }: any) => sessions.filter((row) => sessionMatches(row, where))),
    create: jest.fn(async ({ data }: any) => {
      const row: SessionRow = { id: `s${nextId++}`, revokedAt: null, createdAt: new Date(), ...data };
      sessions.push(row);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hit = sessions.filter((row) => sessionMatches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = sessions.find((candidate) => sessionMatches(candidate, where));
      if (!row) throw new Error('no such session');
      Object.assign(row, data);
      return row;
    }),
  },
  user: {
    findUnique: jest.fn(async ({ where }: any) => {
      const row = [...users.values()].find((candidate) => userMatches(candidate, where));
      return row ? { ...row } : null;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hit = [...users.values()].filter((row) => userMatches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = [...users.values()].find((candidate) => userMatches(candidate, where));
      if (!row) throw new Error('no such user');
      Object.assign(row, data);
      return { ...row };
    }),
  },
  verificationToken: {
    create: jest.fn(async ({ data }: any) => {
      clock += 1;
      const row: TokenRow = { id: `t${nextId++}`, createdAt: new Date(clock), ...data };
      tokens.push(row);
      return row;
    }),
    findFirst: jest.fn(async ({ where }: any) => tokens.find((row) => tokenMatches(row, where)) ?? null),
    deleteMany: jest.fn(async ({ where }: any) => {
      const hit = tokens.filter((row) => tokenMatches(row, where));
      tokens = tokens.filter((row) => !hit.includes(row));
      return { count: hit.length };
    }),
  },
  auditLog: {
    create: jest.fn(async ({ data }: any) => {
      audit.push(data);
      return data;
    }),
  },
  $transaction: jest.fn(async (work: any) => work(prismaMock)),
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy-never-matches',
}));

jest.mock('../../utils/loginAttempts', () => ({
  getLockoutStatus: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  recordFailedLogin: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  clearFailedLogins: jest.fn(async () => undefined),
}));

jest.mock('../../services/login-alert.service', () => ({ noteSignIn: jest.fn(async () => undefined) }));

jest.mock('../../utils/email', () => ({
  INTERACTIVE_DELIVERY: {},
  sendAccountExistsEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendAccountLockedEmail: jest.fn(async () => true),
}));

import authRoutes from '../auth.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { ACCOUNT_LOCKED_MESSAGE } from '../../middleware/auth';
import { sessionService } from '../../services/session.service';
import { issueLockLink, LOCK_LINK_TOKEN_TYPE, UNLOCK_TOKEN_TYPE } from '../../services/account-lock.service';
import { sessionEvents } from '../../utils/session-events';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { hashOpaqueToken } from '../../utils/opaqueToken';
import { sendAccountLockedEmail } from '../../utils/email';

const mailUnlock = sendAccountLockedEmail as unknown as jest.Mock<(...args: any[]) => Promise<boolean>>;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

const realFetch = global.fetch;
const fetchMock = jest.fn<typeof fetch>();

const PASSWORD = 'her-own-password';
const baseUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'her',
  email: 'her@ourdomain.org',
  firstName: 'Maya',
  lastName: 'Lowe',
  displayName: 'Maya Lowe',
  avatar: null,
  role: 'USER',
  persona: 'EARLY_CAREER',
  preferredLocale: 'en-AU',
  preferredCurrency: 'AUD',
  timezone: 'Australia/Brisbane',
  region: 'ANZ',
  country: 'AU',
  referralCode: 'ABC',
  referralCredits: 0,
  womanSelfAttested: true,
  womanVerificationStatus: 'UNVERIFIED',
  isPublic: true,
  allowMessages: true,
  isSuspended: false,
  bannedAt: null,
  lockedAt: null,
  emailVerified: true,
  emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
  googleId: null,
  facebookId: null,
  passwordHash: `hashed:${PASSWORD}`,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorEnabledAt: null,
  twoFactorRecoveryCodes: [] as string[],
  dateOfBirth: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  lastLoginAt: null,
  ...overrides,
});

async function signIn(userId = 'her', userAgent = 'Chrome') {
  const row = users.get(userId)!;
  const claims = { userId, email: row.email, role: row.role, persona: row.persona };
  const access = generateAccessToken(claims);
  const refresh = generateRefreshToken(claims);
  const session = await sessionService.createSession(userId, access, refresh, userAgent, '203.0.113.7');
  return { access, refresh, session };
}

const asBearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const live = (userId = 'her') => sessions.filter((row) => row.userId === userId && row.revokedAt === null);
const tokensOfType = (type: string) => tokens.filter((row) => row.type === type);
const flush = () => new Promise((resolve) => setImmediate(resolve));

let announced: Array<{ userId: string; reason: string }> = [];

beforeEach(() => {
  sessions = [];
  tokens = [];
  audit = [];
  nextId = 1;
  users.clear();
  users.set('her', baseUser());
  jest.clearAllMocks();
  mailUnlock.mockResolvedValue(true);
  global.fetch = fetchMock as unknown as typeof fetch;
  announced = [];
  sessionEvents.removeAllListeners('revoked');
  sessionEvents.onRevoked((event) => announced.push({ userId: event.userId, reason: event.reason }));
});

afterEach(() => {
  sessionEvents.removeAllListeners('revoked');
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('POST /api/auth/lock', () => {
  it('needs a signed-in member', async () => {
    await request(app).post('/api/auth/lock').expect(401);
    expect(users.get('her')!.lockedAt).toBeNull();
  });

  it('locks the account, ends every session on every device and tells the live sockets why', async () => {
    const phone = await signIn('her', 'Phone');
    await signIn('her', 'Laptop');
    await signIn('her', 'Tablet');

    const res = await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);

    expect(users.get('her')!.lockedAt).toBeInstanceOf(Date);
    expect(live()).toHaveLength(0);
    expect(announced).toContainEqual({ userId: 'her', reason: 'locked' });
    expect(res.body.data).toEqual({ locked: true, unlockEmailSent: true });
    // This device is signed out with the rest: the cookie is cleared.
    expect(String(res.headers['set-cookie'])).toMatch(/refreshToken=;/);
  });

  it('mails the address on the account a one-time link and stores only its hash', async () => {
    const phone = await signIn();

    await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);

    expect(mailUnlock).toHaveBeenCalledTimes(1);
    const [to, firstName, rawToken] = mailUnlock.mock.calls[0];
    expect(to).toBe('her@ourdomain.org');
    expect(firstName).toBe('Maya');
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

    const rows = tokensOfType(UNLOCK_TOKEN_TYPE);
    expect(rows).toHaveLength(1);
    expect(rows[0].token).toBe(hashOpaqueToken(rawToken));
    expect(rows[0].token).not.toBe(rawToken);
    // Short enough that a stale email is not a way in, long enough to be read late.
    const lifetime = rows[0].expiresAt.getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(lifetime).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('writes an audit row that says what happened, from where', async () => {
    const phone = await signIn();
    await request(app).post('/api/auth/lock').set(asBearer(phone.access)).set('User-Agent', 'Phone/1.0').expect(200);

    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'ACCOUNT_LOCKED',
      actorUserId: 'her',
      targetUserId: 'her',
      userAgent: 'Phone/1.0',
      metadata: { source: 'settings', unlockEmailSent: true },
    });
  });

  it('is honest when the unlock email could not be sent: still locked, and says so', async () => {
    mailUnlock.mockResolvedValue(false);
    const phone = await signIn();

    const res = await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);

    expect(users.get('her')!.lockedAt).toBeInstanceOf(Date);
    expect(live()).toHaveLength(0);
    expect(res.body.data).toEqual({ locked: true, unlockEmailSent: false });
    expect(res.body.message).toMatch(/could not send/i);
    expect(res.body.message).toMatch(/sign-in page/i);
    // A link that was never delivered is withdrawn, so it is not a live way in.
    expect(tokensOfType(UNLOCK_TOKEN_TYPE)).toHaveLength(0);
  });

  it('spends every "this was not me" link the account holds', async () => {
    await issueLockLink('her');
    await issueLockLink('her');
    const phone = await signIn();

    await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);

    expect(tokensOfType(LOCK_LINK_TOKEN_TYPE)).toHaveLength(0);
  });

  it('leaves another member’s account and sessions alone', async () => {
    users.set('other', baseUser({ id: 'other', email: 'other@ourdomain.org' }));
    const hers = await signIn('her');
    await signIn('other');

    await request(app).post('/api/auth/lock').set(asBearer(hers.access)).expect(200);

    expect(users.get('other')!.lockedAt).toBeNull();
    expect(live('other')).toHaveLength(1);
  });
});

describe('while the account is locked', () => {
  async function lockedAccount() {
    const phone = await signIn();
    await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);
    jest.clearAllMocks();
    return phone;
  }

  it('stops the access token of a session that existed before the lock, at once', async () => {
    const phone = await lockedAccount();
    await request(app).get('/api/auth/sessions').set(asBearer(phone.access)).expect(401);
  });

  it('refuses a session that slipped in while the lock was being made', async () => {
    await lockedAccount();
    // A sign-in that had already passed its checks when she pressed the button.
    const late = await signIn('her', 'Late sign-in');

    const res = await request(app).get('/api/auth/sessions').set(asBearer(late.access)).expect(403);
    expect(res.body.message).toBe(ACCOUNT_LOCKED_MESSAGE);
  });

  it('refuses a sign-in with the right password, in the lock wording, and opens no session', async () => {
    await lockedAccount();

    const res = await request(app).post('/api/auth/login').send({ email: 'her@ourdomain.org', password: PASSWORD }).expect(403);

    expect(res.body.message).toBe(ACCOUNT_LOCKED_MESSAGE);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(sessions.filter((row) => row.revokedAt === null)).toHaveLength(0);
  });

  it('does not tell someone who only has the address that the account is locked', async () => {
    await lockedAccount();

    const res = await request(app).post('/api/auth/login').send({ email: 'her@ourdomain.org', password: 'not-it' }).expect(401);

    expect(res.body.message).toBe('Invalid email or password');
  });

  it('refuses a refresh, ends what is still open and clears the cookie', async () => {
    await lockedAccount();
    // A refresh token that is still live in someone's hands.
    const stray = await signIn('her', 'Stray');

    const res = await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${stray.refresh}`).expect(403);

    expect(res.body.message).toBe(ACCOUNT_LOCKED_MESSAGE);
    expect(live()).toHaveLength(0);
    expect(String(res.headers['set-cookie'])).toMatch(/refreshToken=;/);
  });

  it('refuses the Google door before writing anything onto the account', async () => {
    await lockedAccount();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          sub: 'google-sub-1',
          aud: 'athena-google-client',
          email: 'her@ourdomain.org',
          email_verified: 'true',
          given_name: 'Maya',
          family_name: 'Lowe',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' }).expect(403);

    expect(res.body.message).toBe(ACCOUNT_LOCKED_MESSAGE);
    // Not linked, not marked as signed in: a refused request changes nothing.
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(users.get('her')!.googleId).toBeNull();
    expect(sessions.filter((row) => row.revokedAt === null)).toHaveLength(0);
  });
});

describe('POST /api/auth/unlock', () => {
  async function lockedWithLink() {
    const phone = await signIn();
    await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);
    const link = mailUnlock.mock.calls[0][2] as string;
    jest.clearAllMocks();
    return link;
  }

  it('clears the lock, issues no session, and the next sign-in works', async () => {
    const link = await lockedWithLink();

    const res = await request(app).post('/api/auth/unlock').send({ token: link }).expect(200);

    expect(users.get('her')!.lockedAt).toBeNull();
    expect(res.body.message).toMatch(/sign in again/i);
    // Unlocking is not signing in.
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body.data?.accessToken).toBeUndefined();
    expect(live()).toHaveLength(0);

    await request(app).post('/api/auth/login').send({ email: 'her@ourdomain.org', password: PASSWORD }).expect(200);
  });

  it('works once: the same link a second time is refused', async () => {
    const link = await lockedWithLink();

    await request(app).post('/api/auth/unlock').send({ token: link }).expect(200);
    const again = await request(app).post('/api/auth/unlock').send({ token: link }).expect(400);

    expect(again.body.message).toMatch(/not valid|expired|already been used/i);
  });

  it('works once even when two requests carry the link at the same moment', async () => {
    const link = await lockedWithLink();

    const [first, second] = await Promise.all([
      request(app).post('/api/auth/unlock').send({ token: link }),
      request(app).post('/api/auth/unlock').send({ token: link }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 400]);
    expect(audit.filter((row) => row.action === 'ACCOUNT_UNLOCKED')).toHaveLength(1);
  });

  it('is refused after the link has expired, and the account stays locked', async () => {
    const link = await lockedWithLink();
    tokensOfType(UNLOCK_TOKEN_TYPE).forEach((row) => {
      row.expiresAt = new Date(Date.now() - 1_000);
    });

    await request(app).post('/api/auth/unlock').send({ token: link }).expect(400);

    expect(users.get('her')!.lockedAt).toBeInstanceOf(Date);
  });

  it('refuses a token that is not shaped like one, and one that was never issued', async () => {
    await lockedWithLink();

    await request(app).post('/api/auth/unlock').send({ token: 'short' }).expect(400);
    await request(app).post('/api/auth/unlock').send({}).expect(400);
    await request(app).post('/api/auth/unlock').send({ token: 'a'.repeat(64) }).expect(400);
    // A "this was not me" link is not an unlock link.
    const lockLink = await issueLockLink('her');
    await request(app).post('/api/auth/unlock').send({ token: lockLink }).expect(400);

    expect(users.get('her')!.lockedAt).toBeInstanceOf(Date);
  });

  it('ends a session that slipped in while it was locked, so unlocking does not bring it back to life', async () => {
    const link = await lockedWithLink();
    await signIn('her', 'Late sign-in');
    expect(live()).toHaveLength(1);

    await request(app).post('/api/auth/unlock').send({ token: link }).expect(200);

    expect(live()).toHaveLength(0);
  });

  it('writes an audit row for the unlock', async () => {
    const link = await lockedWithLink();
    await request(app).post('/api/auth/unlock').send({ token: link }).expect(200);

    expect(audit.filter((row) => row.action === 'ACCOUNT_UNLOCKED')).toEqual([
      expect.objectContaining({ actorUserId: 'her', targetUserId: 'her', metadata: { source: 'email-link' } }),
    ]);
  });
});

describe('POST /api/auth/lock-by-token', () => {
  it('locks the account from the emailed link with no session at all', async () => {
    const phone = await signIn();
    const link = await issueLockLink('her');

    await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(200);

    expect(users.get('her')!.lockedAt).toBeInstanceOf(Date);
    expect(live()).toHaveLength(0);
    expect(announced).toContainEqual({ userId: 'her', reason: 'locked' });
    // The way back is mailed to her, as it is for a lock from her settings.
    expect(mailUnlock).toHaveBeenCalledTimes(1);
    expect(mailUnlock.mock.calls[0][0]).toBe('her@ourdomain.org');
    expect(audit[0]).toMatchObject({ action: 'ACCOUNT_LOCKED', metadata: { source: 'email-link', unlockEmailSent: true } });
    await request(app).get('/api/auth/sessions').set(asBearer(phone.access)).expect(401);
  });

  it('says the unlock email is on its way only when it was accepted', async () => {
    const link = await issueLockLink('her');

    const res = await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(200);

    expect(res.body.message).toMatch(/emailed you a link to unlock it/i);
    expect(res.body.data).toEqual({ locked: true, unlockEmailSent: true });
  });

  it('does not say it emailed a link when the mail provider refused it: still locked, and told to ask for a new one', async () => {
    mailUnlock.mockResolvedValue(false);
    const link = await issueLockLink('her');

    const res = await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(200);

    expect(users.get('her')!.lockedAt).toBeInstanceOf(Date);
    expect(res.body.data).toEqual({ locked: true, unlockEmailSent: false });
    expect(res.body.message).not.toMatch(/we have emailed/i);
    expect(res.body.message).toMatch(/could not send the unlock email/i);
    expect(res.body.message).toMatch(/sign-in page/i);
  });

  it('does not say it emailed a link when the account was already locked and no new email went', async () => {
    const phone = await signIn();
    const link = await issueLockLink('her');
    await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);
    // The lock spent every "this was not me" link, so a link made after it is the one a late alert would carry.
    const late = await issueLockLink('her');
    mailUnlock.mockClear();

    const res = await request(app).post('/api/auth/lock-by-token').send({ token: late }).expect(200);

    expect(mailUnlock).not.toHaveBeenCalled();
    expect(res.body.message).not.toMatch(/we have emailed/i);
    expect(res.body.message).toMatch(/already locked/i);
    expect(res.body.message).toMatch(/sign-in page/i);
    // The earlier link was spent by the lock itself.
    await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(400);
  });

  it('works once: the link is spent, so it cannot be used again', async () => {
    const link = await issueLockLink('her');

    await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(200);
    const again = await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(400);

    expect(again.body.message).toMatch(/not valid|expired|already been used/i);
    expect(mailUnlock).toHaveBeenCalledTimes(1);
  });

  it('does not lock on a link that has expired, or that was never issued', async () => {
    const link = await issueLockLink('her');
    tokensOfType(LOCK_LINK_TOKEN_TYPE).forEach((row) => {
      row.expiresAt = new Date(Date.now() - 1_000);
    });

    await request(app).post('/api/auth/lock-by-token').send({ token: link }).expect(400);
    await request(app).post('/api/auth/lock-by-token').send({ token: 'b'.repeat(64) }).expect(400);
    await request(app).post('/api/auth/lock-by-token').send({ token: 'nope' }).expect(400);

    expect(users.get('her')!.lockedAt).toBeNull();
  });

  it('does not accept an unlock link in its place, so one cannot be turned against the other', async () => {
    const phone = await signIn();
    await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);
    const unlockLink = mailUnlock.mock.calls[0][2] as string;

    await request(app).post('/api/auth/lock-by-token').send({ token: unlockLink }).expect(400);
  });

  it('keeps the link good for about a week, because the alert may be read days after it was sent', async () => {
    await issueLockLink('her');
    const lifetime = tokensOfType(LOCK_LINK_TOKEN_TYPE)[0].expiresAt.getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(lifetime).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it('does not mail a second unlock link when the account was already locked', async () => {
    const first = await issueLockLink('her');
    const second = await issueLockLink('her');

    await request(app).post('/api/auth/lock-by-token').send({ token: first }).expect(200);
    // The first lock spent every lock link, so the second is refused rather than re-locking.
    await request(app).post('/api/auth/lock-by-token').send({ token: second }).expect(400);

    expect(mailUnlock).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/auth/request-unlock', () => {
  const asked = (email: string) => request(app).post('/api/auth/request-unlock').send({ email });

  it('mails a new link to the address on a locked account, after it has answered', async () => {
    const phone = await signIn();
    await request(app).post('/api/auth/lock').set(asBearer(phone.access)).expect(200);
    const firstLink = mailUnlock.mock.calls[0][2] as string;
    jest.clearAllMocks();

    const res = await asked('her@ourdomain.org').expect(200);
    await flush();

    expect(res.body.message).toBe('If that account is locked, a link to unlock it is on its way.');
    expect(mailUnlock).toHaveBeenCalledTimes(1);
    expect(mailUnlock.mock.calls[0][0]).toBe('her@ourdomain.org');
    const newLink = mailUnlock.mock.calls[0][2] as string;
    expect(newLink).not.toBe(firstLink);
    // One live link: the new one replaces the old once its mail has gone.
    expect(tokensOfType(UNLOCK_TOKEN_TYPE)).toHaveLength(1);
    await request(app).post('/api/auth/unlock').send({ token: firstLink }).expect(400);
    await request(app).post('/api/auth/unlock').send({ token: newLink }).expect(200);
  });

  it('answers exactly the same for an address with no account and for one that is not locked, and mails nobody', async () => {
    const locked = users.get('her')!;
    const unlockedAnswer = await asked('her@ourdomain.org').expect(200);
    const unknownAnswer = await asked('nobody@ourdomain.org').expect(200);
    await flush();

    expect(unknownAnswer.body).toEqual(unlockedAnswer.body);
    expect(unknownAnswer.status).toBe(unlockedAnswer.status);
    expect(mailUnlock).not.toHaveBeenCalled();
    expect(locked.lockedAt).toBeNull();
  });

  it('refuses something that is not an address', async () => {
    await asked('not-an-address').expect(400);
  });
});

describe('an address nobody has confirmed', () => {
  it('does not renew a session, ends what is open and clears the cookie, so un-confirming an address ends its sessions', async () => {
    const stray = await signIn('her', 'Stray');
    users.get('her')!.emailVerified = false;

    const res = await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${stray.refresh}`).expect(403);

    // The sentence the sign-in screens match on to offer a new link.
    expect(res.body.message).toBe('Please verify your email before signing in.');
    expect(live()).toHaveLength(0);
    expect(String(res.headers['set-cookie'])).toMatch(/refreshToken=;/);
  });

  it('still refuses sign-in in the sentence the screens match on, and opens no session', async () => {
    users.get('her')!.emailVerified = false;

    const res = await request(app).post('/api/auth/login').send({ email: 'her@ourdomain.org', password: PASSWORD }).expect(403);

    expect(res.body.message).toBe('Please verify your email before signing in.');
    expect(sessions).toHaveLength(0);
  });

  it('does not tell someone with only the address, because the password is checked first', async () => {
    users.get('her')!.emailVerified = false;

    await request(app).post('/api/auth/login').send({ email: 'her@ourdomain.org', password: 'not-it' }).expect(401);
  });
});
