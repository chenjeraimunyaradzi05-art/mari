/**
 * Refreshing a session, the way production does it.
 *
 * The integration suite for sessions sends the refresh token in the request
 * body, which production ignores: there a browser refreshes from its HttpOnly
 * cookie and only from a trusted origin. So nothing tested the cookie-only
 * mode, the origin rule, or the one client that cannot use either, the phone
 * app. That app was handed no refresh token at all (the response never carried
 * one) and was therefore signed out every time its access token expired.
 *
 * What is pinned here:
 *  - a browser refreshes from its cookie, from a trusted origin, and its new
 *    token comes back as a cookie and never in the body;
 *  - a client that says it is native (X-Athena-Client: mobile) is handed the
 *    refresh token in the body at sign-in and on every refresh, presents it in
 *    the body, and is never given or read a cookie;
 *  - two refreshes that race leave one live session and the loser is told to
 *    ask again (409), not signed out, and never burns the member's sessions;
 *  - a token replayed after the grace window still revokes everything.
 *
 * The session service runs for real over an in-memory session table; only the
 * database and the outside world are stood in for.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';

process.env.JWT_SECRET = '5b7d0c9e1f3a4c6e8b2d4f6a8c0e2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2a4c6e';
process.env.ALLOWED_ORIGINS = 'https://app.ourdomain.org';

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

let sessions: SessionRow[] = [];
let nextSessionId = 1;
let latch: { size: number; waiting: Array<() => void> } | null = null;
const users = new Map<string, Record<string, unknown>>();

function matches(row: SessionRow, where: any): boolean {
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
    if (latch && where.refreshToken !== undefined && where.revokedAt === undefined) {
      const gate = latch;
      await new Promise<void>((resolve) => {
        gate.waiting.push(resolve);
        if (gate.waiting.length >= gate.size) gate.waiting.splice(0).forEach((release) => release());
      });
    }
    return sessions.find((row) => matches(row, where)) ?? null;
  }),
  findUnique: jest.fn(async ({ where }: any) => sessions.find((row) => matches(row, where)) ?? null),
  create: jest.fn(async ({ data }: any) => {
    const row: SessionRow = { id: `s${nextSessionId++}`, revokedAt: null, createdAt: new Date(), ...data };
    sessions.push(row);
    return row;
  }),
  updateMany: jest.fn(async ({ where, data }: any) => {
    const hit = sessions.filter((row) => matches(row, where));
    hit.forEach((row) => Object.assign(row, data));
    return { count: hit.length };
  }),
  update: jest.fn(async ({ where, data }: any) => {
    const row = sessions.find((candidate) => matches(candidate, where));
    if (!row) throw new Error('no such session');
    Object.assign(row, data);
    return row;
  }),
};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    session: sessionDelegate,
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return users.get(where.id) ?? null;
        return [...users.values()].find((user) => user.email === where.email) ?? null;
      }),
      update: jest.fn(async () => ({})),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({ session: sessionDelegate }),
  },
}));

jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy-never-matches',
}));

jest.mock('../../services/login-alert.service', () => ({ noteSignIn: jest.fn(async () => undefined) }));

jest.mock('../../utils/email', () => ({
  INTERACTIVE_DELIVERY: {},
  sendAccountExistsEmail: jest.fn(async () => true),
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import authRoutes from '../auth.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { sessionService } from '../../services/session.service';
import { sessionEvents } from '../../utils/session-events';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

const TRUSTED_ORIGIN = 'https://app.ourdomain.org';
const NATIVE = { 'X-Athena-Client': 'mobile' };

const MEMBER = {
  id: 'member-1',
  email: 'mara@ourdomain.org',
  role: 'USER',
  persona: 'EARLY_CAREER',
  isSuspended: false,
  bannedAt: null,
};

const livingSessions = (userId = MEMBER.id) => sessions.filter((row) => row.userId === userId && row.revokedAt === null);

/** A session the way sign-in leaves it, and the tokens that belong to it. */
async function openSession(userAgent = 'Browser A') {
  const claims = { userId: MEMBER.id, email: MEMBER.email, role: MEMBER.role, persona: MEMBER.persona };
  const access = generateAccessToken(claims);
  const refresh = generateRefreshToken(claims);
  const session = await sessionService.createSession(MEMBER.id, access, refresh, userAgent, '203.0.113.7');
  return { access, refresh, session };
}

function refreshCookieIn(response: request.Response): string | null {
  const header = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const cookie = header.find((entry) => entry.startsWith('refreshToken='));
  if (!cookie) return null;
  return decodeURIComponent(cookie.split(';')[0].slice('refreshToken='.length));
}

function cookieHeaderCleared(response: request.Response): boolean {
  const header = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return header.some((entry) => entry.startsWith('refreshToken=;'));
}

const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  sessions = [];
  nextSessionId = 1;
  latch = null;
  users.clear();
  users.set(MEMBER.id, { ...MEMBER });
  jest.clearAllMocks();
  process.env.NODE_ENV = 'production';
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  sessionEvents.removeAllListeners('revoked');
});

describe('POST /api/auth/refresh from a browser, in production', () => {
  it('refuses a request that names no origin, and touches no session', async () => {
    const { refresh } = await openSession();

    const response = await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${refresh}`).send({});

    expect(response.status).toBe(403);
    expect(livingSessions()).toHaveLength(1);
  });

  it('refuses a request from another site, though it carries the cookie', async () => {
    const { refresh } = await openSession();

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'https://elsewhere.example')
      .set('Cookie', `refreshToken=${refresh}`)
      .send({});

    expect(response.status).toBe(403);
    expect(livingSessions()).toHaveLength(1);
  });

  it('refreshes from the cookie, and sends the new refresh token only as a cookie', async () => {
    const { refresh, session } = await openSession();

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', `refreshToken=${refresh}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data).not.toHaveProperty('refreshToken');
    const rotated = refreshCookieIn(response);
    expect(rotated).toEqual(expect.any(String));
    expect(rotated).not.toBe(refresh);
    expect(sessions.find((row) => row.id === session.id)?.revokedAt).toBeInstanceOf(Date);
    expect(livingSessions()).toHaveLength(1);
  });

  it('ignores a refresh token sent in the body, which would be a forgery channel', async () => {
    const { refresh } = await openSession();

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .send({ refreshToken: refresh });

    expect(response.status).toBe(400);
    expect(livingSessions()).toHaveLength(1);
  });

  it('is not turned into a way to read the cookie by saying it is a phone', async () => {
    const { refresh } = await openSession();

    const response = await request(app)
      .post('/api/auth/refresh')
      .set(NATIVE)
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', `refreshToken=${refresh}`)
      .send({});

    // A native client sends its token in the body. The cookie is not read.
    expect(response.status).toBe(400);
    expect(refreshCookieIn(response)).toBeNull();
    expect(livingSessions()).toHaveLength(1);
  });
});

describe('POST /api/auth/refresh from the phone app', () => {
  it('takes the token in the body without any origin, and answers with the next one in the body', async () => {
    const { refresh, session } = await openSession('Athena/1.0 (Android)');

    const response = await request(app)
      .post('/api/auth/refresh')
      .set(NATIVE)
      .set('User-Agent', 'Athena/1.0 (Android)')
      .send({ refreshToken: refresh });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).not.toBe(refresh);
    expect(refreshCookieIn(response)).toBeNull();
    expect(sessions.find((row) => row.id === session.id)?.revokedAt).toBeInstanceOf(Date);
    expect(livingSessions()).toHaveLength(1);
  });

  it('can keep rotating: the token it was handed is good for the next refresh', async () => {
    const { refresh } = await openSession('Athena/1.0 (Android)');

    const first = await request(app).post('/api/auth/refresh').set(NATIVE).set('User-Agent', 'Athena/1.0 (Android)').send({ refreshToken: refresh });
    const second = await request(app)
      .post('/api/auth/refresh')
      .set(NATIVE)
      .set('User-Agent', 'Athena/1.0 (Android)')
      .send({ refreshToken: first.body.data.refreshToken });

    expect(second.status).toBe(200);
    expect(second.body.data.refreshToken).not.toBe(first.body.data.refreshToken);
    expect(livingSessions()).toHaveLength(1);
  });

  it('refuses a missing token, and one that is not a string', async () => {
    await openSession();

    const none = await request(app).post('/api/auth/refresh').set(NATIVE).send({});
    const wrongType = await request(app).post('/api/auth/refresh').set(NATIVE).send({ refreshToken: { $ne: null } });

    expect(none.status).toBe(400);
    expect(wrongType.status).toBe(400);
    expect(livingSessions()).toHaveLength(1);
  });

  it('refuses an access token presented as a refresh token', async () => {
    const { access } = await openSession();

    const response = await request(app).post('/api/auth/refresh').set(NATIVE).send({ refreshToken: access });

    expect(response.status).toBe(401);
    expect(livingSessions()).toHaveLength(1);
  });

  it('answers an expired or forged token as a signed-out visitor, not as a server fault', async () => {
    const claims = { userId: MEMBER.id, email: MEMBER.email, role: MEMBER.role, persona: MEMBER.persona };
    const expired = jwt.sign({ ...claims, typ: 'refresh' }, process.env.JWT_SECRET as string, { algorithm: 'HS256', expiresIn: -60 });
    const forged = jwt.sign({ ...claims, typ: 'refresh' }, 'not the server key at all, but long enough', { algorithm: 'HS256' });

    for (const token of [expired, forged, 'not-a-token']) {
      const response = await request(app).post('/api/auth/refresh').set(NATIVE).send({ refreshToken: token });
      expect(response.status).toBe(401);
    }
  });

  it('tells a browser to drop a cookie that no longer verifies', async () => {
    const claims = { userId: MEMBER.id, email: MEMBER.email, role: MEMBER.role, persona: MEMBER.persona };
    const expired = jwt.sign({ ...claims, typ: 'refresh' }, process.env.JWT_SECRET as string, { algorithm: 'HS256', expiresIn: -60 });

    const response = await request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('Cookie', `refreshToken=${expired}`).send({});

    expect(response.status).toBe(401);
    expect(cookieHeaderCleared(response)).toBe(true);
  });
});

describe('two refreshes with one token', () => {
  it('leave one live session; the loser is told to ask again, and no other device is signed out', async () => {
    const phone = await openSession('Phone');
    const laptop = await openSession('Laptop');

    // Both requests read the session as live before either rotates it.
    latch = { size: 2, waiting: [] };
    const [a, b] = await Promise.all([
      request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('User-Agent', 'Laptop').set('Cookie', `refreshToken=${laptop.refresh}`).send({}),
      request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('User-Agent', 'Laptop').set('Cookie', `refreshToken=${laptop.refresh}`).send({}),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.code).toBe('REFRESH_IN_PROGRESS');
    // The cookie the winner just set is not cleared by the loser.
    expect(cookieHeaderCleared(loser)).toBe(false);
    // The phone is untouched, and the laptop has exactly one session.
    expect(sessions.find((row) => row.id === phone.session.id)?.revokedAt).toBeNull();
    expect(livingSessions()).toHaveLength(2);
  });

  it('answers a straggler that arrives just after the rotation with 409, not a sign-out', async () => {
    const phone = await openSession('Phone');
    const laptop = await openSession('Laptop');

    const first = await request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('User-Agent', 'Laptop').set('Cookie', `refreshToken=${laptop.refresh}`).send({});
    expect(first.status).toBe(200);

    const straggler = await request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('User-Agent', 'Laptop').set('Cookie', `refreshToken=${laptop.refresh}`).send({});

    expect(straggler.status).toBe(409);
    expect(straggler.body.code).toBe('REFRESH_IN_PROGRESS');
    expect(cookieHeaderCleared(straggler)).toBe(false);
    expect(sessions.find((row) => row.id === phone.session.id)?.revokedAt).toBeNull();
    expect(livingSessions()).toHaveLength(2);
  });
});

describe('a refresh token replayed after it was rotated', () => {
  it('revokes every session once the grace window has passed, and clears the cookie', async () => {
    const phone = await openSession('Phone');
    const laptop = await openSession('Laptop');
    const heard: string[] = [];
    sessionEvents.onRevoked((event) => heard.push(event.reason));

    const rotated = await request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('User-Agent', 'Laptop').set('Cookie', `refreshToken=${laptop.refresh}`).send({});
    expect(rotated.status).toBe(200);
    // The retired token was retired a minute ago, not a moment ago.
    sessions.find((row) => row.id === laptop.session.id)!.revokedAt = new Date(Date.now() - 60_000);

    const replay = await request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('User-Agent', 'Laptop').set('Cookie', `refreshToken=${laptop.refresh}`).send({});

    expect(replay.status).toBe(401);
    expect(cookieHeaderCleared(replay)).toBe(true);
    expect(livingSessions()).toHaveLength(0);
    expect(sessions.find((row) => row.id === phone.session.id)?.revokedAt).toBeInstanceOf(Date);
    expect(heard).toContain('reuse-detected');
  });

  it('does the same for the phone app, from the body', async () => {
    const { refresh, session } = await openSession('Athena/1.0 (Android)');
    const other = await openSession('Laptop');

    const rotated = await request(app).post('/api/auth/refresh').set(NATIVE).set('User-Agent', 'Athena/1.0 (Android)').send({ refreshToken: refresh });
    expect(rotated.status).toBe(200);
    sessions.find((row) => row.id === session.id)!.revokedAt = new Date(Date.now() - 60_000);

    const replay = await request(app).post('/api/auth/refresh').set(NATIVE).set('User-Agent', 'Athena/1.0 (Android)').send({ refreshToken: refresh });

    expect(replay.status).toBe(401);
    expect(livingSessions()).toHaveLength(0);
    expect(sessions.find((row) => row.id === other.session.id)?.revokedAt).toBeInstanceOf(Date);
  });

  it('is treated as theft at once when it comes from a different client', async () => {
    const laptop = await openSession('Laptop');
    await request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('User-Agent', 'Laptop').set('Cookie', `refreshToken=${laptop.refresh}`).send({});

    const replay = await request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('User-Agent', 'Some other client').set('Cookie', `refreshToken=${laptop.refresh}`).send({});

    expect(replay.status).toBe(401);
    expect(livingSessions()).toHaveLength(0);
  });
});

describe('a refresh for an account that has since been closed', () => {
  it('ends every session of a suspended account, and gives nothing', async () => {
    users.set(MEMBER.id, { ...MEMBER, isSuspended: true });
    const { refresh } = await openSession();
    await openSession('Phone');
    const heard: string[] = [];
    sessionEvents.onRevoked((event) => heard.push(event.reason));

    const response = await request(app).post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('Cookie', `refreshToken=${refresh}`).send({});

    expect(response.status).toBe(403);
    expect(response.body.data).toBeUndefined();
    // The browser is told to drop the cookie, and is not given a new one.
    expect(cookieHeaderCleared(response)).toBe(true);
    expect(livingSessions()).toHaveLength(0);
    expect(heard).toEqual(['suspended']);
  });

  it('does the same for a banned account whose suspension flag was never set', async () => {
    users.set(MEMBER.id, { ...MEMBER, isSuspended: false, bannedAt: new Date() });
    const { refresh } = await openSession();
    const heard: string[] = [];
    sessionEvents.onRevoked((event) => heard.push(event.reason));

    const response = await request(app).post('/api/auth/refresh').set(NATIVE).send({ refreshToken: refresh });

    expect(response.status).toBe(403);
    expect(response.body).not.toHaveProperty('data');
    expect(livingSessions()).toHaveLength(0);
    expect(heard).toEqual(['banned']);
  });
});

describe('POST /api/auth/login hands out the refresh token to the right kind of client', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    users.set(MEMBER.id, {
      ...MEMBER,
      emailVerified: true,
      passwordHash: 'hashed:A-long-passphrase-1!',
      twoFactorEnabled: false,
      firstName: 'Mara',
      lastName: 'Nguyen',
    });
  });

  const credentials = { email: MEMBER.email, password: 'A-long-passphrase-1!' };

  it('a browser gets a cookie and nothing in the body', async () => {
    const response = await request(app).post('/api/auth/login').send(credentials);

    expect(response.status).toBe(200);
    expect(refreshCookieIn(response)).toEqual(expect.any(String));
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data).not.toHaveProperty('refreshToken');
  });

  it('the phone app gets the token in the body and no cookie, and it works on /refresh', async () => {
    const response = await request(app).post('/api/auth/login').set(NATIVE).send(credentials);

    expect(response.status).toBe(200);
    expect(refreshCookieIn(response)).toBeNull();
    expect(response.body.data.refreshToken).toEqual(expect.any(String));

    process.env.NODE_ENV = 'production';
    const refreshed = await request(app).post('/api/auth/refresh').set(NATIVE).send({ refreshToken: response.body.data.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('never puts the password hash in either answer', async () => {
    const browser = await request(app).post('/api/auth/login').send(credentials);
    const phone = await request(app).post('/api/auth/login').set(NATIVE).send(credentials);

    expect(JSON.stringify(browser.body)).not.toContain('hashed:');
    expect(JSON.stringify(phone.body)).not.toContain('hashed:');
  });
});

describe('a device the member signed out comes back online and refreshes', () => {
  it('is refused, and the other devices stay signed in', async () => {
    const phone = await openSession('Phone');
    const laptop = await openSession('Laptop');
    // The laptop is signed out from the phone's device list, and asks for a
    // refresh a quarter of an hour later, as an access token that has just run
    // out does.
    await sessionService.revokeSession(laptop.session.id);
    sessions.find((row) => row.id === laptop.session.id)!.revokedAt = new Date(Date.now() - 15 * 60_000);
    const heard: string[] = [];
    sessionEvents.onRevoked((event) => heard.push(event.reason));

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('User-Agent', 'Laptop')
      .set('Cookie', `refreshToken=${laptop.refresh}`)
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.data).toBeUndefined();
    // Not read as a stolen token: nothing is burned and nobody is told.
    expect(sessions.find((row) => row.id === phone.session.id)?.revokedAt).toBeNull();
    expect(livingSessions()).toHaveLength(1);
    expect(heard).toEqual([]);
  });

  it('is the same for the phone app after her password was changed elsewhere', async () => {
    const here = await openSession('Laptop');
    const phone = await openSession('Athena/1.0 (Android)');
    await sessionService.revokeAllUserSessions(MEMBER.id, { reason: 'password-changed', exceptSessionId: here.session.id });
    sessions.find((row) => row.id === phone.session.id)!.revokedAt = new Date(Date.now() - 10 * 60_000);

    const response = await request(app)
      .post('/api/auth/refresh')
      .set(NATIVE)
      .set('User-Agent', 'Athena/1.0 (Android)')
      .send({ refreshToken: phone.refresh });

    expect(response.status).toBe(401);
    expect(sessions.find((row) => row.id === here.session.id)?.revokedAt).toBeNull();
    expect(livingSessions()).toHaveLength(1);
  });
});
