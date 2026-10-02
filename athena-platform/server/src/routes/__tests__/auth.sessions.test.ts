/**
 * The list of devices a member is signed in on, and ending them.
 *
 * GET /api/auth/sessions, DELETE /api/auth/sessions/:sessionId and
 * POST /api/auth/logout-all were guarded only by a test that read the source
 * file for the word "authenticate". Nothing exercised what they answer. These
 * run the real authenticate middleware and the real session service over an
 * in-memory session table, so a session someone else owns is a row that is
 * really there and the answer to asking for it is the one a member would get.
 *
 * What matters most: she sees her own devices and nobody else's, "this device"
 * is the one she is asking from, she cannot end a session that is not hers
 * (and cannot tell whether it exists), and the access token of a session she
 * ends stops working at once.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.JWT_SECRET = '5b7d0c9e1f3a4c6e8b2d4f6a8c0e2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2a4c6e';

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
const users = new Map<string, Record<string, unknown>>();

function matches(row: SessionRow, where: any): boolean {
  if (typeof where.id === 'string' && row.id !== where.id) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.refreshToken !== undefined && row.refreshToken !== where.refreshToken) return false;
  if (where.token !== undefined && row.token !== where.token) return false;
  if (where.revokedAt === null && row.revokedAt !== null) return false;
  if (where.expiresAt?.gt && !(row.expiresAt > where.expiresAt.gt)) return false;
  return true;
}

const sessionDelegate = {
  findFirst: jest.fn(async ({ where }: any) => sessions.find((row) => matches(row, where)) ?? null),
  findUnique: jest.fn(async ({ where }: any) => sessions.find((row) => matches(row, where)) ?? null),
  // Honours `select`, as the database does: the route's answer is only as private as the columns it asks for.
  findMany: jest.fn(async ({ where, select }: any) =>
    sessions
      .filter((row) => matches(row, where))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) =>
        select
          ? Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, (row as any)[key]]))
          : row
      )
  ),
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
    user: { findUnique: jest.fn(async ({ where }: any) => users.get(where.id) ?? null) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

jest.mock('../../services/login-alert.service', () => ({ noteSignIn: jest.fn(async () => undefined) }));
jest.mock('../../utils/email', () => ({
  INTERACTIVE_DELIVERY: {},
  sendAccountExistsEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
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

const HER = { id: 'her', email: 'her@ourdomain.org', role: 'USER', persona: 'EARLY_CAREER' };
const SOMEONE_ELSE = { id: 'someone-else', email: 'else@ourdomain.org', role: 'USER', persona: 'EARLY_CAREER' };

async function signIn(who: typeof HER, userAgent: string, ipAddress = '203.0.113.7') {
  const claims = { userId: who.id, email: who.email, role: who.role, persona: who.persona };
  const access = generateAccessToken(claims);
  const refresh = generateRefreshToken(claims);
  const session = await sessionService.createSession(who.id, access, refresh, userAgent, ipAddress);
  return { access, refresh, session };
}

const asBearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const live = (userId: string) => sessions.filter((row) => row.userId === userId && row.revokedAt === null);

let announced: Array<{ userId: string; sessionId?: string; reason: string }> = [];

beforeEach(() => {
  sessions = [];
  nextSessionId = 1;
  jest.clearAllMocks();
  users.clear();
  for (const person of [HER, SOMEONE_ELSE]) {
    users.set(person.id, { ...person, isSuspended: false, bannedAt: null, twoFactorEnabled: false, womanVerificationStatus: 'UNVERIFIED', dateOfBirth: null });
  }
  announced = [];
  sessionEvents.removeAllListeners('revoked');
  sessionEvents.onRevoked((event) => announced.push({ userId: event.userId, sessionId: event.sessionId, reason: event.reason }));
});

afterEach(() => {
  sessionEvents.removeAllListeners('revoked');
});

describe('GET /api/auth/sessions', () => {
  it('needs a signed-in member', async () => {
    const response = await request(app).get('/api/auth/sessions');
    expect(response.status).toBe(401);
  });

  it('lists her own devices and nobody else’s', async () => {
    const phone = await signIn(HER, 'Phone');
    await signIn(HER, 'Laptop');
    await signIn(SOMEONE_ELSE, 'Their laptop');

    const response = await request(app).get('/api/auth/sessions').set(asBearer(phone.access));

    expect(response.status).toBe(200);
    const agents = (response.body.data as Array<{ userAgent: string }>).map((entry) => entry.userAgent).sort();
    expect(agents).toEqual(['Laptop', 'Phone']);
  });

  it('marks the device she is asking from as this one, which is not necessarily the newest', async () => {
    const phone = await signIn(HER, 'Phone');
    await signIn(HER, 'Laptop'); // signed in later, so it is the newest

    const response = await request(app).get('/api/auth/sessions').set(asBearer(phone.access));

    const current = (response.body.data as Array<{ id: string; isCurrent: boolean }>).filter((entry) => entry.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe(phone.session.id);
  });

  it('leaves out sessions that were ended or have expired', async () => {
    const phone = await signIn(HER, 'Phone');
    const ended = await signIn(HER, 'Ended laptop');
    const lapsed = await signIn(HER, 'Lapsed tablet');
    await sessionService.revokeSession(ended.session.id, 'logout');
    sessions.find((row) => row.id === lapsed.session.id)!.expiresAt = new Date(Date.now() - 1_000);

    const response = await request(app).get('/api/auth/sessions').set(asBearer(phone.access));

    expect((response.body.data as Array<{ userAgent: string }>).map((entry) => entry.userAgent)).toEqual(['Phone']);
  });

  it('never shows the token hashes the table holds', async () => {
    const phone = await signIn(HER, 'Phone');

    const response = await request(app).get('/api/auth/sessions').set(asBearer(phone.access));

    const body = JSON.stringify(response.body);
    expect(body).not.toContain(sessions[0].token);
    expect(body).not.toContain(sessions[0].refreshToken);
    expect(Object.keys(response.body.data[0]).sort()).toEqual(
      ['createdAt', 'expiresAt', 'id', 'ipAddress', 'isCurrent', 'revokedAt', 'userAgent'].sort()
    );
  });

  it('refuses an access token whose session has been ended', async () => {
    const phone = await signIn(HER, 'Phone');
    await sessionService.revokeSession(phone.session.id, 'logout');

    const response = await request(app).get('/api/auth/sessions').set(asBearer(phone.access));

    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/auth/sessions/:sessionId', () => {
  it('ends another device of hers: its access token stops working, and the live connection is told', async () => {
    const phone = await signIn(HER, 'Phone');
    const laptop = await signIn(HER, 'Laptop');

    const response = await request(app).delete(`/api/auth/sessions/${laptop.session.id}`).set(asBearer(phone.access));

    expect(response.status).toBe(200);
    expect(sessions.find((row) => row.id === laptop.session.id)?.revokedAt).toBeInstanceOf(Date);
    expect(announced).toEqual([{ userId: 'her', sessionId: laptop.session.id, reason: 'revoked' }]);
    const gone = await request(app).get('/api/auth/sessions').set(asBearer(laptop.access));
    expect(gone.status).toBe(401);
    const stays = await request(app).get('/api/auth/sessions').set(asBearer(phone.access));
    expect(stays.status).toBe(200);
  });

  it('answers 404 for a session that belongs to someone else, and leaves it live', async () => {
    const phone = await signIn(HER, 'Phone');
    const theirs = await signIn(SOMEONE_ELSE, 'Their laptop');

    const response = await request(app).delete(`/api/auth/sessions/${theirs.session.id}`).set(asBearer(phone.access));

    expect(response.status).toBe(404);
    expect(sessions.find((row) => row.id === theirs.session.id)?.revokedAt).toBeNull();
    expect(announced).toEqual([]);
    const theirsStillWorks = await request(app).get('/api/auth/sessions').set(asBearer(theirs.access));
    expect(theirsStillWorks.status).toBe(200);
  });

  it('says the same thing for an id that does not exist, so ids cannot be probed', async () => {
    const phone = await signIn(HER, 'Phone');
    const theirs = await signIn(SOMEONE_ELSE, 'Their laptop');

    const someonesId = await request(app).delete(`/api/auth/sessions/${theirs.session.id}`).set(asBearer(phone.access));
    const noSuchId = await request(app).delete('/api/auth/sessions/does-not-exist').set(asBearer(phone.access));

    expect(noSuchId.status).toBe(someonesId.status);
    expect(noSuchId.body.message).toBe(someonesId.body.message);
  });

  it('answers 404 for one that was already ended or has expired', async () => {
    const phone = await signIn(HER, 'Phone');
    const ended = await signIn(HER, 'Ended laptop');
    const lapsed = await signIn(HER, 'Lapsed tablet');
    await sessionService.revokeSession(ended.session.id, 'logout');
    sessions.find((row) => row.id === lapsed.session.id)!.expiresAt = new Date(Date.now() - 1_000);
    announced = [];

    const first = await request(app).delete(`/api/auth/sessions/${ended.session.id}`).set(asBearer(phone.access));
    const second = await request(app).delete(`/api/auth/sessions/${lapsed.session.id}`).set(asBearer(phone.access));

    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    expect(announced).toEqual([]);
  });

  it('needs a signed-in member', async () => {
    const phone = await signIn(HER, 'Phone');

    const response = await request(app).delete(`/api/auth/sessions/${phone.session.id}`);

    expect(response.status).toBe(401);
    expect(live('her')).toHaveLength(1);
  });
});

describe('POST /api/auth/logout-all', () => {
  it('ends every device of hers, this one included, and no one else’s', async () => {
    const phone = await signIn(HER, 'Phone');
    const laptop = await signIn(HER, 'Laptop');
    const theirs = await signIn(SOMEONE_ELSE, 'Their laptop');

    const response = await request(app).post('/api/auth/logout-all').set(asBearer(phone.access));

    expect(response.status).toBe(200);
    expect(live('her')).toHaveLength(0);
    expect(live('someone-else')).toHaveLength(1);
    expect((await request(app).get('/api/auth/sessions').set(asBearer(laptop.access))).status).toBe(401);
    expect((await request(app).get('/api/auth/sessions').set(asBearer(theirs.access))).status).toBe(200);
    expect(announced).toEqual([{ userId: 'her', sessionId: undefined, reason: 'logout' }]);
    const cleared = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    expect(cleared.some((cookie) => cookie.startsWith('refreshToken=;'))).toBe(true);
  });
});
