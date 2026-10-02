import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import jwt from 'jsonwebtoken';
import { addressKey, apiBudgetsFromEnv, createApiBudget, createCredentialLimiters, identifyCaller } from '../apiBudget';
import { SharedRateLimitStore } from '../../utils/rate-limit-store';
import { generateAccessToken, generateRefreshToken, getJwtSecretOrThrow } from '../../utils/jwt';
import {
  PROXY_CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  trustedProxyIdentity,
} from '../trustedProxy';

/**
 * The budget of API calls follows the caller. A member with a valid token has
 * one of her own; an address with no token has the small anonymous one; a
 * token that is forged, expired or the wrong kind counts for nothing and is
 * treated as an address. These suites run the real limiter on counters held in
 * the process (the Redis store's fallback), with budgets small enough to
 * exhaust.
 */

const PROXY_SECRET = 'a-proxy-secret-that-is-long-enough-to-count';

// The web proxy is believed only when the API holds the same secret.
const originalProxySecret = process.env.PROXY_SHARED_SECRET;
beforeAll(() => {
  process.env.PROXY_SHARED_SECRET = PROXY_SECRET;
});
afterAll(() => {
  if (originalProxySecret === undefined) delete process.env.PROXY_SHARED_SECRET;
  else process.env.PROXY_SHARED_SECRET = originalProxySecret;
});

const tokenFor = (userId: string, role = 'USER') =>
  generateAccessToken({ userId, email: `${userId}@athena.test`, role, persona: 'EARLY_CAREER' });

function appWith(options: Parameters<typeof createApiBudget>[0] = {}, behindProxy = false) {
  const app = express();
  app.set('trust proxy', 1);
  if (behindProxy) app.use(trustedProxyIdentity);
  // Mounted on /api the way src/index.ts does, so req.path is what the skip rules see.
  app.use(
    '/api',
    createApiBudget({
      windowMs: 60_000,
      anonymousMax: 3,
      memberMax: 10,
      staffMax: 20,
      store: new SharedRateLimitStore('rl:test:budget:', { client: null }),
      ...options,
    })
  );
  app.get('/api/things', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/refresh', (_req, res) => res.json({ ok: true }));
  app.get('/api/metrics', (_req, res) => res.json({ ok: true }));
  app.post('/api/webhooks/stripe', (_req, res) => res.json({ ok: true }));
  return app;
}

/** Calls the route `count` times with the headers given and returns every status. */
async function callMany(app: express.Express, count: number, headers: Record<string, string> = {}) {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const call = request(app).get('/api/things');
    for (const [name, value] of Object.entries(headers)) call.set(name, value);
    statuses.push((await call).status);
  }
  return statuses;
}

describe('the anonymous budget, which is by address', () => {
  it('refuses the call after the budget, and the 101st in production', async () => {
    const production = express();
    production.use(
      '/api',
      createApiBudget({ production: true, store: new SharedRateLimitStore('rl:test:prod:', { client: null }) })
    );
    production.get('/api/things', (_req, res) => res.json({ ok: true }));

    const statuses = await callMany(production, 101);

    expect(statuses.slice(0, 100).every((status) => status === 200)).toBe(true);
    expect(statuses[100]).toBe(429);
  });

  it('keeps RATE_LIMIT_MAX as the anonymous budget, and its 100 as the production default', () => {
    const before = process.env.RATE_LIMIT_MAX;
    try {
      delete process.env.RATE_LIMIT_MAX;
      expect(apiBudgetsFromEnv(true).anonymousMax).toBe(100);
      process.env.RATE_LIMIT_MAX = '250';
      expect(apiBudgetsFromEnv(true).anonymousMax).toBe(250);
      process.env.RATE_LIMIT_MAX = 'lots';
      expect(apiBudgetsFromEnv(true).anonymousMax).toBe(100);
    } finally {
      if (before === undefined) delete process.env.RATE_LIMIT_MAX;
      else process.env.RATE_LIMIT_MAX = before;
    }
  });

  it('is relaxed outside production and strict in it', () => {
    expect(apiBudgetsFromEnv(false).anonymousMax).toBeGreaterThan(apiBudgetsFromEnv(true).anonymousMax);
    expect(apiBudgetsFromEnv(true)).toMatchObject({ anonymousMax: 100, memberMax: 1500, windowMs: 900_000 });
  });

  it('answers 429 with the reason, Retry-After and both families of rate-limit headers', async () => {
    const app = appWith();
    await callMany(app, 3);

    const refused = await request(app).get('/api/things').expect(429);

    expect(refused.body).toEqual({ success: false, message: 'Too many requests, please try again later.' });
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(refused.headers['ratelimit-limit']).toBe('3');
    expect(refused.headers['x-ratelimit-limit']).toBe('3');
    expect(refused.headers['x-ratelimit-remaining']).toBe('0');
  });
});

describe('the budget of a signed-in member', () => {
  it('lets her make far more calls than an address gets, from an address that has used up its own', async () => {
    const app = appWith({ anonymousMax: 3, memberMax: 40 });

    // The address is out of budget for anyone without a token.
    expect((await callMany(app, 4)).at(-1)).toBe(429);

    const statuses = await callMany(app, 40, { Authorization: `Bearer ${tokenFor('ada')}` });

    expect(statuses.every((status) => status === 200)).toBe(true);
    // And her own budget is finite too.
    expect((await callMany(app, 1, { Authorization: `Bearer ${tokenFor('ada')}` }))[0]).toBe(429);
  });

  it('is large enough for a day of ordinary use: a member makes a thousand calls from an address with no budget left', async () => {
    const production = express();
    production.use(
      '/api',
      createApiBudget({ production: true, store: new SharedRateLimitStore('rl:test:prod-member:', { client: null }) })
    );
    production.get('/api/things', (_req, res) => res.json({ ok: true }));

    expect((await callMany(production, 101)).at(-1)).toBe(429);

    const statuses = await callMany(production, 1000, { Authorization: `Bearer ${tokenFor('ada')}` });
    expect(statuses.every((status) => status === 200)).toBe(true);
  }, 60_000);

  it('does not share a budget between two members on one address', async () => {
    const app = appWith({ memberMax: 5 });
    const ada = { Authorization: `Bearer ${tokenFor('ada')}` };
    const bea = { Authorization: `Bearer ${tokenFor('bea')}` };

    expect((await callMany(app, 6, ada)).at(-1)).toBe(429);
    expect(await callMany(app, 5, bea)).toEqual([200, 200, 200, 200, 200]);
  });

  it('follows the member across addresses, not the address', async () => {
    const app = appWith({ memberMax: 4 }, true);
    const token = { Authorization: `Bearer ${tokenFor('ada')}` };

    const fromHome = await callMany(app, 2, { ...token, [PROXY_SECRET_HEADER]: PROXY_SECRET, [PROXY_CLIENT_IP_HEADER]: '203.0.113.7' });
    const fromWork = await callMany(app, 3, { ...token, [PROXY_SECRET_HEADER]: PROXY_SECRET, [PROXY_CLIENT_IP_HEADER]: '198.51.100.9' });

    expect(fromHome).toEqual([200, 200]);
    // Two spent at home, so only two more are left wherever she goes.
    expect(fromWork).toEqual([200, 200, 429]);
  });

  it('gives staff the larger budget', async () => {
    const app = appWith({ memberMax: 3, staffMax: 8 });

    expect((await callMany(app, 4, { Authorization: `Bearer ${tokenFor('ada')}` })).at(-1)).toBe(429);
    expect(await callMany(app, 8, { Authorization: `Bearer ${tokenFor('moderator', 'MODERATOR')}` })).toEqual(Array(8).fill(200));
  });
});

describe('a token that is not an identity', () => {
  it('is counted as the address: a forged token buys nothing', async () => {
    const app = appWith({ anonymousMax: 2, memberMax: 50 });
    const forged = jwt.sign({ userId: 'ada', role: 'ADMIN', typ: 'access' }, 'not-the-signing-key', { expiresIn: '1h' });

    const statuses = await callMany(app, 3, { Authorization: `Bearer ${forged}` });

    expect(statuses).toEqual([200, 200, 429]);
  });

  it('is counted as the address once it has expired', async () => {
    const app = appWith({ anonymousMax: 2, memberMax: 50 });
    const expired = jwt.sign({ userId: 'ada', role: 'USER', typ: 'access' }, getJwtSecretOrThrow(), { expiresIn: '-1s' });

    expect(await callMany(app, 3, { Authorization: `Bearer ${expired}` })).toEqual([200, 200, 429]);
  });

  it('is counted as the address when it is a refresh token presented as a bearer', async () => {
    const app = appWith({ anonymousMax: 2, memberMax: 50 });
    const refresh = generateRefreshToken({ userId: 'ada', email: 'ada@athena.test', role: 'USER', persona: 'EARLY_CAREER' });

    expect(await callMany(app, 3, { Authorization: `Bearer ${refresh}` })).toEqual([200, 200, 429]);
  });

  it('is counted as the address when the header is not a bearer token at all', async () => {
    const app = appWith({ anonymousMax: 2, memberMax: 50 });

    expect(await callMany(app, 3, { Authorization: 'Basic YWRhOnBhc3M=' })).toEqual([200, 200, 429]);
  });

  it('is checked once per request, whatever the limiter asks', () => {
    const verified = tokenFor('ada');
    const req: any = { headers: { authorization: `Bearer ${verified}` }, ip: '203.0.113.7', socket: {} };

    const first = identifyCaller(req);
    req.headers.authorization = 'Bearer something-else';

    expect(identifyCaller(req)).toBe(first);
    expect(first).toEqual({ key: 'user:ada', kind: 'member' });
  });
});

describe('the visitor behind the web proxy', () => {
  it('is the address the anonymous budget counts, once the proxy has proved it forwarded it', async () => {
    const app = appWith({ anonymousMax: 2 }, true);
    const visitor = (ip: string) => ({ [PROXY_SECRET_HEADER]: PROXY_SECRET, [PROXY_CLIENT_IP_HEADER]: ip });

    expect(await callMany(app, 3, visitor('203.0.113.7'))).toEqual([200, 200, 429]);
    // A different visitor through the same proxy has a budget of her own.
    expect(await callMany(app, 2, visitor('203.0.113.8'))).toEqual([200, 200]);
  });

  it('is not chosen by the caller: a forwarded address without the secret is ignored', async () => {
    const app = appWith({ anonymousMax: 2 }, true);

    // Each request names a different "visitor", but none proves the proxy sent it.
    const statuses: number[] = [];
    for (const ip of ['203.0.113.7', '203.0.113.8', '203.0.113.9']) {
      statuses.push((await request(app).get('/api/things').set(PROXY_CLIENT_IP_HEADER, ip)).status);
    }

    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe('what is left out of the budget', () => {
  it('skips the metrics scrape, the payment webhooks and the session refresh', async () => {
    const app = appWith({ anonymousMax: 1 });
    await request(app).get('/api/things').expect(200);
    await request(app).get('/api/things').expect(429);

    await request(app).get('/api/metrics').expect(200);
    await request(app).post('/api/webhooks/stripe').expect(200);
    // The refresh has a limiter of its own, and is made with an expired token.
    await request(app).post('/api/auth/refresh').expect(200);
  });
});

describe('addressKey', () => {
  it('leaves an IPv4 address alone and unwraps an IPv4-mapped one', () => {
    expect(addressKey('203.0.113.7')).toBe('203.0.113.7');
    expect(addressKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(addressKey(undefined)).toBe('unknown');
  });

  it('counts every address in an IPv6 /64 as one, however it is written', () => {
    const a = addressKey('2001:db8:1234:5678::1');
    expect(a).toBe('2001:db8:1234:5678::/64');
    expect(addressKey('2001:0db8:1234:5678:aaaa:bbbb:cccc:dddd')).toBe(a);
    expect(addressKey('2001:DB8:1234:5678:0:0:0:2')).toBe(a);
    expect(addressKey('2001:db8:1234:5679::1')).not.toBe(a);
    expect(addressKey('::1')).toBe('0:0:0:0::/64');
    expect(addressKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });

  it('returns what it cannot read, rather than guessing', () => {
    expect(addressKey('2001:db8::1::2')).toBe('2001:db8::1::2');
    expect(addressKey('not:an:address')).toBe('not:an:address');
  });
});

describe('the sign-in and sign-up limiters', () => {
  function appWithCredentialLimiters(production: boolean) {
    const { login, register } = createCredentialLimiters({
      production,
      store: (prefix) => new SharedRateLimitStore(`rl:test:${prefix}`, { client: null }),
    });
    const app = express();
    app.use('/api/auth/login', login);
    app.use('/api/auth/register', register);
    app.post('/api/auth/login', (_req, res) => res.json({ ok: true }));
    app.post('/api/auth/register', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('allow ten attempts in production, as the API documentation says', async () => {
    const app = appWithCredentialLimiters(true);
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await request(app).post('/api/auth/login')).status);

    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('count sign-in and sign-up apart, so a burst of one does not spend the other', async () => {
    const app = appWithCredentialLimiters(true);

    for (let i = 0; i < 10; i += 1) await request(app).post('/api/auth/register');
    const refused = await request(app).post('/api/auth/register').expect(429);
    expect(refused.body.message).toMatch(/sign-up/);

    // Signing in is untouched by the ten sign-ups.
    await request(app).post('/api/auth/login').expect(200);
  });
});
