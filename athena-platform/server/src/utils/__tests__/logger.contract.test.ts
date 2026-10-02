/**
 * What the real code writes to the log, read from the stream the log goes to.
 *
 * The redaction suite beside this one proves that the redactor removes what it
 * is shown. It cannot prove that the places that log do not hand it something
 * it was never taught to look for, and that is how personal data got into the
 * log: not through the key list but through a sentence ("Email sent
 * successfully to her@example.org"), an error whose message carries the call it
 * failed on, and a request path with a credential in it.
 *
 * So this runs the real paths (the email sender, a registration whose
 * confirmation mail is refused, a message that fails to store, a request to a
 * route that carries a token in its path and then fails) with canary values, in
 * the production format, into a capture stream standing where stdout is, and
 * asserts that no canary, and nothing shaped like an address or a token, came
 * out of any of them.
 */

import { Writable } from 'stream';
import express from 'express';
import request from 'supertest';
import winston from 'winston';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.BANNED_IDENTITY_HASH_KEY = 'test-ban-key';
process.env.RATE_LIMIT_ENABLED = 'false';

const mockMessageCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockMessageFindMany = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(async () => []),
    },
    bannedIdentity: { findUnique: jest.fn(async () => null) },
    inviteCode: { findFirst: jest.fn(async () => null), updateMany: jest.fn() },
    verificationToken: { create: jest.fn(), deleteMany: jest.fn(async () => ({ count: 0 })) },
    session: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    auditLog: { create: jest.fn(async () => ({})) },
    emailSuppression: { findUnique: jest.fn(async () => null) },
    message: {
      create: (...args: unknown[]) => mockMessageCreate(...args),
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy-never-matches',
}));

jest.mock('../../services/session.service', () => ({
  sessionService: { createSession: jest.fn(async () => ({ id: 'session-1' })) },
}));

jest.mock('../../services/login-alert.service', () => ({
  noteSignIn: jest.fn(async () => undefined),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../prisma';
import { logger, productionFormat } from '../logger';
import { sendEmail } from '../email';
import { storeMessage, searchMessages } from '../../services/chat-storage.service';
import { responseTimeMiddleware } from '../../middleware/responseTime';
import { errorHandler } from '../../middleware/errorHandler';

const prisma: any = prismaTyped;

// Values that exist nowhere but in these tests. If one turns up in the log, the
// code under test wrote it there.
const ADDRESS = 'canary.member@example.org';
const SUBJECT = 'Welcome Canary Member';
const MESSAGE_BODY = 'canary-message-body leaving on Tuesday, keys are with Mum';
const SEARCH_TERM = 'canary-search-term refuge near me';
const SHARE_TOKEN = 'Q2FuYXJ5U2hhcmVUb2tlbjEyMzQ1Njc4OTA';
const PHONE = '0412 345 678';

const captured: string[] = [];
const sink = new Writable({
  write(chunk, _encoding, done) {
    captured.push(String(chunk));
    done();
  },
});

/** Everything written since the last reset, as one string. */
const output = () => captured.join('\n');

/** The logger writes through streams; give them a turn before reading. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function expectNothingPersonal(text: string): void {
  for (const canary of [ADDRESS, 'canary.member', SUBJECT, MESSAGE_BODY, SEARCH_TERM, SHARE_TOKEN, PHONE, 'hashed:']) {
    expect(text).not.toContain(canary);
  }
  // Nothing shaped like an address, a bearer credential or a one-time token either.
  expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  expect(text).not.toMatch(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/);
  expect(text).not.toMatch(/\b[a-f0-9]{48,}\b/i);
}

const env = { ...process.env };
const originalFetch = global.fetch;

beforeAll(() => {
  // The production format, which is what the host's log collector receives,
  // into a stream of ours instead of stdout.
  logger.configure({
    level: 'debug',
    format: productionFormat,
    transports: [new winston.transports.Stream({ stream: sink })],
  });
});

beforeEach(() => {
  captured.length = 0;
  jest.clearAllMocks();
  delete process.env.TURNSTILE_SECRET_KEY;
});

afterEach(() => {
  process.env = { ...env };
  global.fetch = originalFetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('the format the host collects', () => {
  it('is one JSON object per line, so a collector can read it and a test can parse it', async () => {
    logger.info('a line', { userId: 'u1' });
    await settle();

    const parsed = JSON.parse(captured[0]);
    expect(parsed).toMatchObject({ level: 'info', message: 'a line', userId: 'u1' });
    expect(typeof parsed.timestamp).toBe('string');
  });
});

describe('the email sender', () => {
  function configureProduction(): void {
    process.env.NODE_ENV = 'production';
    process.env.SENDGRID_API_KEY = 'SG.canary-key-for-the-test.aaaaaaaaaaaaaaaaaaaaaa';
    process.env.SENDGRID_FROM_EMAIL = 'noreply@mail.ourdomain.org';
  }

  it('says that a message went, and to which kind of address, without saying whose', async () => {
    configureProduction();
    global.fetch = jest.fn(async () => new Response(null, { status: 202 })) as unknown as typeof fetch;

    await expect(sendEmail({ to: ADDRESS, subject: SUBJECT, html: `<p>${SUBJECT}</p>` })).resolves.toBe(true);
    await settle();

    expect(output()).toContain('Email sent');
    expect(output()).toContain('example.org');
    expectNothingPersonal(output());
  });

  it('says that a message was refused, and why, without the address, the subject or the provider’s echo of them', async () => {
    configureProduction();
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ errors: [{ message: `Does not contain a valid address: ${ADDRESS}` }] }), {
          status: 400,
        })
    ) as unknown as typeof fetch;

    await expect(sendEmail({ to: ADDRESS, subject: SUBJECT, html: '<p>hi</p>' })).resolves.toBe(false);
    await settle();

    expect(output()).toContain('Failed to send email');
    expect(output()).toContain('Does not contain a valid address');
    expectNothingPersonal(output());
  });

  it('says that an address is on the suppression list without saying which', async () => {
    configureProduction();
    prisma.emailSuppression.findUnique.mockResolvedValueOnce({ id: 'sup-1' });
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(sendEmail({ to: ADDRESS, subject: SUBJECT, html: '<p>hi</p>' })).resolves.toBe(false);
    await settle();

    expect(output()).toContain('suppression list');
    expect(global.fetch).not.toHaveBeenCalled();
    expectNothingPersonal(output());
  });
});

describe('a registration whose confirmation mail is refused', () => {
  const registration = {
    email: ADDRESS,
    password: 'A-long-passphrase-1!',
    firstName: 'Canary',
    lastName: 'Member',
    womanSelfAttested: true,
    dateOfBirth: '1990-04-01',
    persona: 'CREATOR',
  };

  it('logs that it failed and for which account, and nothing that would identify her to a reader of the log', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SENDGRID_API_KEY = 'SG.canary-key-for-the-test.aaaaaaaaaaaaaaaaaaaaaa';
    process.env.SENDGRID_FROM_EMAIL = 'noreply@mail.ourdomain.org';
    // The provider answers 403 and repeats the address back, as some of its errors do.
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ errors: [{ message: `rejected ${ADDRESS}` }] }), { status: 403 })
    ) as unknown as typeof fetch;

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-member',
      email: ADDRESS,
      firstName: 'Canary',
      lastName: 'Member',
      displayName: 'Canary Member',
      role: 'USER',
      persona: 'CREATOR',
    });
    prisma.verificationToken.create.mockResolvedValue({ id: 'new-link', createdAt: new Date('2026-10-01T00:00:00Z') });

    const res = await request(app).post('/api/auth/register').send(registration);
    await settle();

    expect(res.status).toBe(503);
    // The line that says it happened, and that finds the account.
    expect(output()).toContain('Required auth email was not accepted by the email provider');
    expect(output()).toContain('new-member');
    expectNothingPersonal(output());
  });

  it('logs a link that was withdrawn, for a resend whose mail is refused, without her address', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SENDGRID_API_KEY = 'SG.canary-key-for-the-test.aaaaaaaaaaaaaaaaaaaaaa';
    process.env.SENDGRID_FROM_EMAIL = 'noreply@mail.ourdomain.org';
    global.fetch = jest.fn(async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;

    prisma.user.findUnique.mockResolvedValue({ id: 'member-1', email: ADDRESS, firstName: 'Canary', emailVerified: false });
    prisma.verificationToken.create.mockResolvedValue({ id: 'new-link', createdAt: new Date('2026-10-01T00:00:00Z') });

    await request(app).post('/api/auth/resend-verification').send({ email: ADDRESS }).expect(200);
    for (let i = 0; i < 50 && !output().includes('has been withdrawn'); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(output()).toContain('has been withdrawn');
    expect(output()).toContain('member-1');
    expectNothingPersonal(output());
  });
});

describe('a message that fails to store', () => {
  /** What Prisma writes when a call fails: the call, its arguments, then the reason. */
  const prismaFailure = () => {
    const error = new Error(
      [
        '',
        'Invalid `prisma.message.create()` invocation:',
        '',
        '{',
        '  data: {',
        '    conversationId: "c1",',
        '    senderId: "u1",',
        `    content: "${MESSAGE_BODY}",`,
        `    metadata: { replyTo: "${ADDRESS}" }`,
        '  }',
        '}',
        '',
        'Foreign key constraint failed on the field: `conversationId`',
      ].join('\n')
    );
    error.name = 'PrismaClientKnownRequestError';
    return error;
  };

  it('logs which conversation and why, and not what was written in it', async () => {
    mockMessageCreate.mockRejectedValue(prismaFailure());

    await expect(
      storeMessage({ conversationId: 'c1', senderId: 'u1', content: MESSAGE_BODY, metadata: { replyTo: ADDRESS } })
    ).rejects.toThrow();
    await settle();

    expect(output()).toContain('Failed to store message');
    expect(output()).toContain('"conversationId":"c1"');
    expect(output()).toContain('Foreign key constraint failed');
    expectNothingPersonal(output());
  });

  it('logs a failed search without the words she searched for', async () => {
    mockMessageFindMany.mockRejectedValue(prismaFailure());

    await searchMessages('c1', SEARCH_TERM).catch(() => undefined);
    await settle();

    expect(output()).toContain('Failed to search messages');
    expectNothingPersonal(output());
  });
});

describe('a request to a route that carries a token in its path', () => {
  function appWith(handler: express.RequestHandler): express.Express {
    const router = express.Router();
    router.get('/share/:token', handler);
    const server = express();
    server.use(responseTimeMiddleware);
    server.use('/api/wellness', router);
    server.use(errorHandler);
    return server;
  }

  it('logs the route and not the link, for a request that worked', async () => {
    const server = appWith((_req, res) => {
      res.json({ ok: true });
    });

    await request(server).get(`/api/wellness/share/${SHARE_TOKEN}?pin=1234`).expect(200);
    await settle();

    expect(output()).toContain('request completed');
    expect(output()).toContain('/api/wellness/share/:token');
    expectNothingPersonal(output());
    expect(output()).not.toContain('pin=1234');
  });

  it('logs the route and not the link, for a request that failed, with the error’s own words cleaned', async () => {
    const server = appWith((_req, _res, next) => {
      next(new Error(`could not load the share for ${ADDRESS} (${PHONE})`));
    });

    await request(server).get(`/api/wellness/share/${SHARE_TOKEN}`).expect(500);
    await settle();

    expect(output()).toContain('/api/wellness/share/:token');
    expect(output()).toContain('could not load the share for [email]');
    expectNothingPersonal(output());
  });

  it('cuts a credential out of the path of a request no route answered', async () => {
    const server = appWith((_req, res) => {
      res.json({ ok: true });
    });

    await request(server).get(`/somewhere/else/${SHARE_TOKEN}`).expect(404);
    await settle();

    expect(output()).toContain('request completed');
    expectNothingPersonal(output());
  });
});
