/**
 * What a request may ask of a list, how large a body may be, and what a body
 * may carry that the route did not name.
 *
 * Three things the audit found at once. `parseInt(req.query.limit) || 20` was
 * the whole page-size rule at about a dozen list routes, so `?limit=1000000`
 * was a million rows asked of the database by whoever typed it, and
 * `?limit=abc` was a NaN. Several routes declared express-validator chains
 * for exactly this and never read them. And one 10MB body limit covered every
 * route, sign-in included.
 *
 * Everything here goes through the real app with Prisma and the services
 * behind each route replaced, so what is asserted is what reaches them: the
 * `take` a list asked for, and that a refused body never got as far as a write.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    notification: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    giftTransaction: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    organization: { findUnique: jest.fn(async () => ({ id: 'org-1', slug: 'acme' })) },
    organizationMember: { findUnique: jest.fn(async () => null) },
    job: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    businessRegistration: { create: jest.fn() },
    languageProfile: { upsert: jest.fn() },
    internationalCredential: { create: jest.fn() },
    subscription: { upsert: jest.fn() },
    event: { create: jest.fn(), findUnique: jest.fn(async () => ({ id: 'e1', startTime: '10:00', endTime: '11:00' })), update: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'ada', role: req.headers['x-test-role'] || 'USER', email: 'ada@athena.com' };
      next();
    },
  };
});

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../services/creator.service', () => ({
  ...(jest.requireActual('../../services/creator.service') as object),
  getCreatorAnalytics: jest.fn(async () => ({})),
}));

jest.mock('../../services/search.service', () => ({
  ...(jest.requireActual('../../services/search.service') as object),
  getRecommendedJobs: jest.fn(async () => []),
}));

jest.mock('../../services/livestream.service', () => ({
  ...(jest.requireActual('../../services/livestream.service') as object),
  listStreams: jest.fn(async () => []),
  recentMessages: jest.fn(async () => []),
  giftLeaderboard: jest.fn(async () => []),
}));

jest.mock('../../services/engagement.service', () => ({
  ...(jest.requireActual('../../services/engagement.service') as object),
  getXPHistory: jest.fn(async () => []),
}));

jest.mock('../../services/mentor.service', () => ({
  ...(jest.requireActual('../../services/mentor.service') as object),
  getMentors: jest.fn(async () => ({ mentors: [], pagination: {} })),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { generateAccessToken, generateRefreshToken, getJwtSecretOrThrow } from '../../utils/jwt';
import { prisma as prismaTyped } from '../../utils/prisma';
import { getCreatorAnalytics } from '../../services/creator.service';
import { getRecommendedJobs } from '../../services/search.service';
import { giftLeaderboard, listStreams, recentMessages } from '../../services/livestream.service';
import { getMentors } from '../../services/mentor.service';
import { getXPHistory } from '../../services/engagement.service';

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('list endpoints clamp the page size they are asked for', () => {
  const takeOf = (mock: any) => mock.mock.calls[0][0].take;

  it('GET /api/notifications: a million becomes 100, text becomes the default, a negative becomes 1', async () => {
    await request(app).get('/api/notifications?limit=1000000&page=99999999999').expect(200);
    expect(takeOf(prisma.notification.findMany)).toBe(100);
    // The page is capped too, so skip stays a number the database will take as an OFFSET.
    expect(prisma.notification.findMany.mock.calls[0][0].skip).toBe(9_999 * 100);

    prisma.notification.findMany.mockClear();
    await request(app).get('/api/notifications?limit=abc&page=xyz').expect(200);
    expect(takeOf(prisma.notification.findMany)).toBe(20);
    expect(prisma.notification.findMany.mock.calls[0][0].skip).toBe(0);

    prisma.notification.findMany.mockClear();
    await request(app).get('/api/notifications?limit=-5').expect(200);
    expect(takeOf(prisma.notification.findMany)).toBe(1);
  });

  it.each(['received', 'sent'])('GET /api/creator/gifts/%s: the same', async (direction) => {
    await request(app).get(`/api/creator/gifts/${direction}?limit=100000`).expect(200);
    expect(takeOf(prisma.giftTransaction.findMany)).toBe(100);

    prisma.giftTransaction.findMany.mockClear();
    await request(app).get(`/api/creator/gifts/${direction}?limit=abc&page=-3`).expect(200);
    expect(takeOf(prisma.giftTransaction.findMany)).toBe(20);
    expect(prisma.giftTransaction.findMany.mock.calls[0][0].skip).toBe(0);
  });

  it('GET /api/creator/analytics: days stay between 7 and 90, which its validator declared and nothing read', async () => {
    await request(app).get('/api/creator/analytics?days=100000').expect(200);
    expect((getCreatorAnalytics as jest.Mock).mock.calls[0][1]).toBe(90);

    (getCreatorAnalytics as jest.Mock).mockClear();
    await request(app).get('/api/creator/analytics?days=1').expect(200);
    expect((getCreatorAnalytics as jest.Mock).mock.calls[0][1]).toBe(7);

    (getCreatorAnalytics as jest.Mock).mockClear();
    await request(app).get('/api/creator/analytics?days=abc').expect(200);
    expect((getCreatorAnalytics as jest.Mock).mock.calls[0][1]).toBe(30);
  });

  it('GET /api/jobs/recommendations/for-me: the size of the search is bounded', async () => {
    await request(app).get('/api/jobs/recommendations/for-me?limit=100000').expect(200);
    expect((getRecommendedJobs as jest.Mock).mock.calls[0][1]).toBe(50);

    (getRecommendedJobs as jest.Mock).mockClear();
    await request(app).get('/api/jobs/recommendations/for-me?limit=abc').expect(200);
    expect((getRecommendedJobs as jest.Mock).mock.calls[0][1]).toBe(10);
  });

  it('GET /api/organizations/:slug/jobs', async () => {
    await request(app).get('/api/organizations/acme/jobs?limit=500000').expect(200);
    expect(takeOf(prisma.job.findMany)).toBe(100);
  });

  it('GET /api/livestream and the room it lists: a negative or text limit never reaches the service as itself', async () => {
    await request(app).get('/api/livestream?limit=-7').expect(200);
    expect(((listStreams as jest.Mock).mock.calls[0] as Array<{ limit: number }>)[0].limit).toBe(1);

    (listStreams as jest.Mock).mockClear();
    await request(app).get('/api/livestream?limit=abc').expect(200);
    expect(((listStreams as jest.Mock).mock.calls[0] as Array<{ limit: number }>)[0].limit).toBe(20);

    await request(app).get('/api/livestream/stream-1/messages?limit=-1').expect(200);
    expect((recentMessages as jest.Mock).mock.calls[0][1]).toBe(1);

    await request(app).get('/api/livestream/stream-1/leaderboard?limit=999999').expect(200);
    expect((giftLeaderboard as jest.Mock).mock.calls[0][1]).toBe(50);
  });

  it('GET /api/engagement/xp/history: a negative limit is 1, not "from the end", and a million is 100', async () => {
    // `Math.min(parseInt(limit) || 20, 100)` stopped the million and let -1000000 through, and
    // Prisma reads a negative `take` as the last N rows.
    await request(app).get('/api/engagement/xp/history?limit=-1000000').expect(200);
    expect((getXPHistory as jest.Mock).mock.calls[0][1]).toBe(1);

    (getXPHistory as jest.Mock).mockClear();
    await request(app).get('/api/engagement/xp/history?limit=1000000').expect(200);
    expect((getXPHistory as jest.Mock).mock.calls[0][1]).toBe(100);

    (getXPHistory as jest.Mock).mockClear();
    await request(app).get('/api/engagement/xp/history?limit=abc').expect(200);
    expect((getXPHistory as jest.Mock).mock.calls[0][1]).toBe(20);
  });

  it('GET /api/mentors: a limit past 100 is refused by the validator that used to be declared and never read', async () => {
    await request(app).get('/api/mentors?limit=100000').expect(400);
    await request(app).get('/api/mentors?limit=abc').expect(400);
    expect(getMentors).not.toHaveBeenCalled();

    await request(app).get('/api/mentors?limit=100').expect(200);
    expect((getMentors as jest.Mock).mock.calls[0][2]).toBe(100);
  });
});

describe('a body carries only what the route named', () => {
  const ID = '3f2b1c0e-8a4d-4c55-9e0b-6a1d2c3b4a5f';

  it('POST /api/formation: an extra key is refused by name and nothing is written', async () => {
    const res = await request(app).post('/api/formation').send({ type: 'SOLE_TRADER', businessName: 'Ada Co', userId: 'someone-else' }).expect(400);

    expect(res.body.message).toBe('Unknown field: userId');
    expect(prisma.businessRegistration.create).not.toHaveBeenCalled();
  });

  it('POST /api/formation: a name that is not text, or is a megabyte long, is refused before it reaches Prisma', async () => {
    await request(app).post('/api/formation').send({ type: 'SOLE_TRADER', businessName: { $set: 1 } }).expect(400);
    const long = await request(app).post('/api/formation').send({ type: 'SOLE_TRADER', businessName: 'x'.repeat(201) }).expect(400);

    expect(long.body.message).toMatch(/^businessName: /);
    expect(prisma.businessRegistration.create).not.toHaveBeenCalled();
  });

  it('PATCH /api/organizations/:id: isVerified, abn and safetyScore are not hers to set', async () => {
    const res = await request(app)
      .patch(`/api/organizations/${ID}`)
      .set('x-test-role', 'ADMIN')
      .send({ name: 'Acme', isVerified: true, safetyScore: 100 })
      .expect(400);

    expect(res.body.message).toBe('Unknown fields: isVerified, safetyScore');
  });

  it('PATCH /api/organizations/:id: a website that is not a web address is refused', async () => {
    const res = await request(app)
      .patch(`/api/organizations/${ID}`)
      .set('x-test-role', 'ADMIN')
      .send({ website: 'javascript:alert(1)' })
      .expect(400);

    expect(res.body.message).toMatch(/^website: /);
  });

  it('POST /api/community-support/language-profile: an unknown field, a bad level and a missing language are each refused', async () => {
    const overposted = await request(app)
      .post('/api/community-support/language-profile')
      .send({ primaryLanguage: 'Tagalog', userId: 'someone-else' })
      .expect(400);
    expect(overposted.body.message).toContain('userId');

    await request(app).post('/api/community-support/language-profile').send({ primaryLanguage: 'Tagalog', englishProficiency: 'PERFECT' }).expect(400);
    await request(app).post('/api/community-support/language-profile').send({}).expect(400);
    expect(prisma.languageProfile.upsert).not.toHaveBeenCalled();
  });

  it('POST /api/community-support/credentials: a year that is not a number is a 400, not a Prisma error', async () => {
    const res = await request(app)
      .post('/api/community-support/credentials')
      .send({ originalCountry: 'Philippines', credentialType: 'DEGREE', credentialName: 'BSN', institution: 'UP', yearObtained: 'abc' })
      .expect(400);

    expect(res.body.message).toMatch(/^yearObtained: /);
    expect(prisma.internationalCredential.create).not.toHaveBeenCalled();
  });

  it('POST /api/admin/subscriptions/grant: a plan that does not exist, a duration that is text, and an extra key are all refused', async () => {
    const send = (body: object) => request(app).post('/api/admin/subscriptions/grant').set('x-test-role', 'ADMIN').send(body);

    await send({ userId: 'u1', tier: 'PLATINUM' }).expect(400);
    await send({ userId: 'u1', tier: 'PREMIUM_CAREER', durationDays: 'forever' }).expect(400);
    await send({ userId: 'u1', tier: 'PREMIUM_CAREER', durationDays: -5 }).expect(400);
    await send({ userId: 'u1', tier: 'PREMIUM_CAREER', status: 'ACTIVE', extra: 1 }).expect(400);
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('POST and PATCH /api/admin/events: a link that is not a web address, an over-long description and a host name that is not text are refused before any write', async () => {
    const valid = { title: 'Meet-up', description: 'Coffee', type: 'networking', format: 'virtual', date: '2030-01-01', startTime: '10:00', endTime: '11:00', image: '/icon.svg', hostName: 'Ada', hostTitle: 'Host', hostAvatar: '/a.png' };
    const post = (body: object) => request(app).post('/api/admin/events').set('x-test-role', 'ADMIN').send({ ...valid, ...body });
    const patch = (body: object) => request(app).patch('/api/admin/events/e1').set('x-test-role', 'ADMIN').send(body);

    const link = await post({ link: 'javascript:alert(1)' }).expect(400);
    expect(link.body.message).toMatch(/^link: /);
    await post({ description: 'x'.repeat(20_001) }).expect(400);
    await post({ host: { name: { $set: 1 } }, hostName: undefined }).expect(400);
    await patch({ link: 'data:text/html,<script>1</script>' }).expect(400);
    await patch({ tags: Array.from({ length: 51 }, (_, i) => `t${i}`) }).expect(400);

    expect(prisma.event.create).not.toHaveBeenCalled();
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('POST /api/payments/convert: true, null and text are not an amount', async () => {
    for (const amount of [true, null, 'ten', -5, 0]) {
      await request(app).post('/api/payments/convert').send({ amount, from: 'AUD', to: 'NZD' }).expect(400);
    }
  });
});

describe('request size', () => {
  // A string of this many characters in a JSON body is about this many bytes.
  const body = (kilobytes: number) => ({ padding: 'x'.repeat(kilobytes * 1024) });

  // The larger limits are read ahead of any route's authenticate (which this
  // suite replaces), so the parser decides on the token alone: a real signed
  // access token, as the web app and the phone app send.
  const claims = { userId: 'ada', email: 'ada@athena.com', role: 'USER', persona: 'GENERAL' };
  const signedIn = () => ({ Authorization: `Bearer ${generateAccessToken(claims)}` });

  it('answers 413 for a body over 256kb on a route with no larger limit, sign-in included', async () => {
    const login = await request(app).post('/api/auth/login').send(body(300));
    expect(login.status).toBe(413);

    const other = await request(app).post('/api/formation').set(signedIn()).send(body(300));
    expect(other.status).toBe(413);
    expect(other.body.message).toMatch(/too large/i);
  });

  it('reads a body under the limit as before', async () => {
    const res = await request(app).post('/api/formation').send({ type: 'SOLE_TRADER', businessName: 'Ada Co', ...body(100) });

    // Refused for its extra field (a 400), which is to say it was read.
    expect(res.status).toBe(400);
  });

  it('lets the routes that take a spreadsheet or an article take it from a signed-in caller', async () => {
    // Refused by the handler for what it holds (a 400), not by the parser for its size.
    const wellness = await request(app).post('/api/wellness/entries/import').set(signedIn()).send(body(300));
    expect(wellness.status).not.toBe(413);

    const blog = await request(app).post('/api/admin/blog').set(signedIn()).set('x-test-role', 'ADMIN').send(body(300));
    expect(blog.status).not.toBe(413);
  });

  it('gives a caller with no token no larger limit on those routes: a body past the default is told to sign in, unread, so a stranger cannot make the API buffer megabytes', async () => {
    // Not 413: the route needs a session, and "sign in" is the true answer. The
    // 401 is what the web and phone apps refresh an expired token on and retry.
    const res = await request(app).post('/api/admin/breaches').set('x-test-role', 'ADMIN').send(body(300));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('hands a caller with no token on unchanged when the body is within the default, for the route to answer', async () => {
    // authenticate is replaced in this suite, so reaching the handler shows as its 400 for the content.
    const res = await request(app).post('/api/wellness/entries/import').send(body(100));

    expect(res.status).toBe(400);
  });

  it('treats a forged or a refresh token as no token, and an expired one as expired, each in the words authenticate would use', async () => {
    const forged = await request(app)
      .post('/api/wellness/entries/import')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.not-a-signature')
      .send(body(300));
    expect(forged.status).toBe(401);
    expect(forged.body.message).toBe('Invalid token');

    const refresh = await request(app)
      .post('/api/wellness/entries/import')
      .set('Authorization', `Bearer ${generateRefreshToken(claims)}`)
      .send(body(300));
    expect(refresh.status).toBe(401);
    expect(refresh.body.message).toBe('Invalid token');

    // Signed with the real key, so what is refused is the expiry and nothing else:
    // the member whose fifteen minutes ran out while she pasted the spreadsheet.
    const expired = jwt.sign({ ...claims, typ: 'access' }, getJwtSecretOrThrow(), { algorithm: 'HS256', expiresIn: -60 });
    const stale = await request(app).post('/api/wellness/entries/import').set('Authorization', `Bearer ${expired}`).send(body(300));
    expect(stale.status).toBe(401);
    expect(stale.body.message).toBe('Token expired');
  });

  it('refuses a large body with an expired token at the parser, not at the route, and never reads it', async () => {
    // Declared as five megabytes and sent as a few bytes: a parser that read the
    // body would answer 400 for the length not matching, so a 401 means it was
    // answered on the token and the Content-Length alone.
    const expired = jwt.sign({ ...claims, typ: 'access' }, getJwtSecretOrThrow(), { algorithm: 'HS256', expiresIn: -60 });
    const res = await request(app)
      .post('/api/admin/breaches')
      .set('Authorization', `Bearer ${expired}`)
      .set('Content-Type', 'application/json')
      .set('Content-Length', String(5 * 1024 * 1024))
      .send('{}');

    expect(res.status).toBe(401);
  });

  it('still refuses a body past even the larger limit', async () => {
    const res = await request(app).post('/api/wellness/entries/import').set(signedIn()).send(body(1200));

    expect(res.status).toBe(413);
  });
});
