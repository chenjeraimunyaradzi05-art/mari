/**
 * Reading the membership in bulk: what a stranger, a scraper and a signed-in
 * member can and cannot get from the public and member APIs.
 *
 * A woman's profile is public unless she changed the setting, and the profile
 * route used to hand every caller, signed in or not, the whole record: her real
 * name, her city, who employs her and where she studied. Member ids are UUIDs, so
 * nothing can be counted up, but anything that lists members or reads one
 * returns them to a script as readily as to a person. The pieces under test:
 *
 *   - a visitor with no account is shown the card (name, picture, headline,
 *     counts), and the rest only after sign-in; a signed-in member still reads
 *     the whole of a public profile;
 *   - member search shows a visitor only that card, and finds her only by name
 *     and headline, not by what is in a bio or a skills list;
 *   - every list a stranger can reach is clamped to a maximum page size, whatever
 *     the caller types;
 *   - one account has one budget for profile reads, wherever it comes from, and
 *     a caller who keeps running into it is named in the log, once.
 *
 * The rows are real objects and the handlers' own `where` clauses are run over
 * them (tests/support/prisma-where), so a filter that is present and wrong fails
 * here instead of passing as "the clause was written".
 */

// The budget is read when the limiter module is loaded, so it is set first. Three
// reads, then refusal: small enough to hit in a test, and not the default of 120.
process.env.PROFILE_READ_MAX = '3';

import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Row } from './support/prisma-where';

let users: Row[] = [];
let safetySettings: Row[] = [];
let follows: Row[] = [];
const postFindMany = jest.fn(async (_args?: unknown) => [] as Row[]);
const jobFindMany = jest.fn(async (_args?: unknown) => [] as Row[]);

jest.mock('../src/utils/prisma', () => {
  const { modelOver: over } = jest.requireActual('./support/prisma-where') as typeof import('./support/prisma-where');
  return {
    prisma: {
      user: over(() => users),
      userSafetySettings: over(() => safetySettings),
      dvSafetyProfile: over(() => []),
      follow: over(() => follows),
      followRequest: over(() => []),
      post: {
        findMany: (args: unknown) => postFindMany(args),
        count: async () => 0,
      },
      job: { findMany: (args: unknown) => jobFindMany(args), count: async () => 0 },
      organization: { findUnique: async () => ({ id: 'org-1' }), findMany: async () => [], count: async () => 0 },
      mentorProfile: over(() => []),
      course: over(() => []),
      video: over(() => []),
      skill: over(() => []),
    },
  };
});

// Whoever the test says is signed in is; an Authorization header with no
// x-test-user is a token that did not resolve, which is what the real
// optionalAuth makes of an expired one.
jest.mock('../src/middleware/auth', () => {
  const actual = jest.requireActual('../src/middleware/auth') as Record<string, unknown>;
  const signedIn = (req: { headers: Record<string, unknown>; user?: unknown }) => {
    const id = req.headers['x-test-user'];
    if (typeof id === 'string') req.user = { id, email: `${id}@example.com`, role: 'USER' };
  };
  return {
    ...actual,
    optionalAuth: (req: { headers: Record<string, unknown>; user?: unknown }, _res: unknown, next: () => void) => {
      signedIn(req);
      next();
    },
    authenticate: (req: { headers: Record<string, unknown>; user?: unknown }, res: { status: (n: number) => { json: (b: unknown) => void } }, next: () => void) => {
      signedIn(req);
      if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
      next();
    },
  };
});

jest.mock('../src/utils/opensearch', () => {
  const actual = jest.requireActual('../src/utils/opensearch') as Record<string, unknown>;
  return { ...actual, getOpenSearchClient: () => null, indexDocument: jest.fn(), deleteDocument: jest.fn() };
});

jest.mock('../src/utils/cache', () => {
  const actual = jest.requireActual('../src/utils/cache') as Record<string, unknown>;
  return { ...actual, cacheGetOrSet: async (_key: string, fetch: () => Promise<unknown>) => fetch() };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { logger } from '../src/utils/logger';
import { resetMemoryRateLimits } from '../src/middleware/rateLimiter';

const as = (userId: string) => ({ 'x-test-user': userId });
const NOW = new Date('2026-09-05T10:00:00Z');

/** One member, with everything a profile can carry, so what is withheld is visible. */
const mei = (overrides: Row = {}): Row => ({
  id: 'mei',
  firstName: 'Mei',
  lastName: 'Chen',
  displayName: 'Mei C.',
  avatar: 'https://cdn.example.org/mei.webp',
  bio: 'Writes about divorce and starting again in Cairns',
  headline: 'Product lead',
  role: 'USER',
  persona: 'MID_CAREER',
  city: 'Cairns',
  state: 'QLD',
  country: 'AU',
  currentJobTitle: 'Head of Product',
  currentCompany: 'Acme Pty Ltd',
  yearsExperience: 9,
  isPublic: true,
  isActive: true,
  isVerified: true,
  emailVerified: true,
  // Neither suspended nor banned, as every account starts: moderation sets these, and
  // the lists leave a suspended or banned member out (openAccountWhere).
  isSuspended: false,
  bannedAt: null,
  createdAt: NOW,
  profile: {
    aboutMe: 'A long note about me',
    linkedinUrl: 'https://www.linkedin.com/in/mei-chen',
    websiteUrl: 'https://mei.example.org',
    openToWork: true,
    hideFromSearch: false,
    isSafeMode: false,
  },
  dvSafetyProfile: null,
  skills: [{ id: 's1', skill: { id: 's1', name: 'Product strategy' } }],
  education: [{ id: 'e1', institution: 'University of Queensland', degree: 'BA' }],
  experience: [{ id: 'x1', company: 'Acme Pty Ltd', title: 'Head of Product' }],
  _count: { followers: 12, following: 3, posts: 4 },
  ...overrides,
});

/** What the full record carries and the card must not. */
const WITHHELD_FROM_THE_CARD = [
  'city',
  'state',
  'country',
  'bio',
  'currentJobTitle',
  'currentCompany',
  'yearsExperience',
  'role',
  'profile',
  'skills',
  'education',
  'experience',
] as const;

beforeEach(() => {
  jest.clearAllMocks();
  resetMemoryRateLimits();
  delete process.env.PUBLIC_PROFILE_DETAIL;
  users = [mei(), mei({ id: 'sarah', firstName: 'Sarah', displayName: 'Sarah D.' })];
  safetySettings = [];
  follows = [];
  postFindMany.mockResolvedValue([]);
  jobFindMany.mockResolvedValue([]);
});

describe('GET /api/users/:id', () => {
  it('shows a visitor with no account the card, and nothing that identifies where she works, lives or studied', async () => {
    const res = await request(app).get('/api/users/mei').expect(200);
    const data = res.body.data;

    expect(data).toMatchObject({
      id: 'mei',
      // Her public name is on every public post she has written, so it stays on the card; her
      // legal first and last name are not sent to another reader at all (utils/member-display).
      firstName: 'Mei C.',
      lastName: '',
      displayName: 'Mei C.',
      headline: 'Product lead',
      avatar: 'https://cdn.example.org/mei.webp',
      isVerified: true,
      _count: { followers: 12, following: 3, posts: 4 },
      isLimited: true,
      signInRequired: true,
    });
    for (const field of WITHHELD_FROM_THE_CARD) expect(data).not.toHaveProperty(field);

    // Nothing in the body, anywhere, repeats what was withheld.
    const text = JSON.stringify(res.body);
    for (const secret of ['Cairns', 'Acme', 'Queensland', 'linkedin.com', 'mei.example.org', 'Product strategy', 'divorce']) {
      expect(text).not.toContain(secret);
    }
  });

  it('shows a signed-in member the whole of a public profile, as before', async () => {
    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);
    const data = res.body.data;

    expect(data).toMatchObject({
      // The whole of the profile, except the legal name: another member is shown her public name.
      lastName: '',
      city: 'Cairns',
      currentCompany: 'Acme Pty Ltd',
      bio: 'Writes about divorce and starting again in Cairns',
    });
    expect(data.skills).toHaveLength(1);
    expect(data.education).toHaveLength(1);
    expect(data.experience).toHaveLength(1);
    expect(data.profile.linkedinUrl).toContain('linkedin.com');
    expect(data).not.toHaveProperty('isLimited');
    expect(data).not.toHaveProperty('signInRequired');
    expect(data).not.toHaveProperty('emailVerified');
  });

  it('shows a member her own profile in full', async () => {
    const res = await request(app).get('/api/users/mei').set(as('mei')).expect(200);
    expect(res.body.data).toMatchObject({ lastName: 'Chen', currentCompany: 'Acme Pty Ltd' });
  });

  it('keeps the old behaviour for a visitor when the deployment says so on purpose', async () => {
    process.env.PUBLIC_PROFILE_DETAIL = 'full';

    const res = await request(app).get('/api/users/mei').expect(200);

    expect(res.body.data).toMatchObject({ lastName: '', city: 'Cairns', currentCompany: 'Acme Pty Ltd' });
    expect(res.body.data).not.toHaveProperty('isLimited');
  });

  it('reads an unrecognised setting as the cautious one', async () => {
    process.env.PUBLIC_PROFILE_DETAIL = 'everything';

    const res = await request(app).get('/api/users/mei').expect(200);

    expect(res.body.data).toMatchObject({ isLimited: true, signInRequired: true });
    expect(res.body.data).not.toHaveProperty('currentCompany');
  });

  it('keeps the card for a connections-only profile without her city, for a visitor with no account', async () => {
    safetySettings = [{ userId: 'mei', profileVisibility: 'connections' }];

    const res = await request(app).get('/api/users/mei').expect(200);

    expect(res.body.data).toMatchObject({ isLimited: true, signInRequired: true, approvesFollowers: true });
    expect(res.body.data).not.toHaveProperty('city');
  });

  it('still shows a signed-in member who is not a follower the connections-only card with her city, and no sign-in prompt', async () => {
    safetySettings = [{ userId: 'mei', profileVisibility: 'connections' }];

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(res.body.data).toMatchObject({ isLimited: true, approvesFollowers: true, city: 'Cairns', lastName: '' });
    expect(res.body.data).not.toHaveProperty('signInRequired');
    expect(res.body.data).not.toHaveProperty('currentCompany');
  });

  it('is still closed for a private profile, signed in or not', async () => {
    safetySettings = [{ userId: 'mei', profileVisibility: 'private' }];

    await request(app).get('/api/users/mei').expect(403);
    await request(app).get('/api/users/mei').set(as('sarah')).expect(403);
  });

  it('is still a 404 for an account whose address nobody confirmed, and for one that does not exist', async () => {
    users = [mei({ emailVerified: false })];

    await request(app).get('/api/users/mei').expect(404);
    await request(app).get('/api/users/nobody').expect(404);
  });

  it('asks the app to refresh when a token was sent and did not resolve, instead of handing a signed-in member the visitor card', async () => {
    // The real optionalAuth reads an expired token as no token at all. A woman
    // whose access token ran out a moment ago would be shown the signed-out card
    // and nothing would tell the app to refresh her session.
    const res = await request(app).get('/api/users/mei').set('Authorization', 'Bearer an-expired-token').expect(401);

    expect(res.body.message).toMatch(/session has ended/i);
  });

  it('does not turn a visitor with no token at all into a 401', async () => {
    await request(app).get('/api/users/mei').expect(200);
  });
});

describe('member search', () => {
  const findable = () => [
    mei({ id: 'ana', displayName: 'Ana Gardener', headline: 'Landscape designer', bio: 'Ask me about cobalt', skills: [{ skill: { name: 'Topiary' } }] }),
  ];

  it('finds a member for a visitor by name and by headline, and shows the card', async () => {
    users = findable();

    const byName = await request(app).get('/api/search/users').query({ q: 'gardener' }).expect(200);
    expect(byName.body.results.map((r: { id: string }) => r.id)).toEqual(['ana']);
    expect(byName.body.results[0]).toMatchObject({ title: 'Ana Gardener', content: 'Landscape designer' });

    const byHeadline = await request(app).get('/api/search/users').query({ q: 'landscape' }).expect(200);
    expect(byHeadline.body.results.map((r: { id: string }) => r.id)).toEqual(['ana']);
  });

  it('does not find a member for a visitor by what is in her bio or her skills', async () => {
    users = findable();

    const byBio = await request(app).get('/api/search/users').query({ q: 'cobalt' }).expect(200);
    const bySkill = await request(app).get('/api/search/users').query({ q: 'topiary' }).expect(200);

    expect(byBio.body.results).toEqual([]);
    expect(bySkill.body.results).toEqual([]);
  });

  it('never prints a bio to a visitor, not as the content and not in a highlighted snippet', async () => {
    users = [mei({ id: 'ana', displayName: 'Ana Gardener', headline: 'Landscape designer', bio: 'Ask me about cobalt and the garden' })];

    const res = await request(app).get('/api/search/users').query({ q: 'gardener' }).expect(200);

    expect(JSON.stringify(res.body)).not.toContain('cobalt');
  });

  it('finds the same member by bio and by skill, with her bio, for a signed-in member', async () => {
    users = findable();

    const byBio = await request(app).get('/api/search/users').query({ q: 'cobalt' }).set(as('sarah')).expect(200);
    const bySkill = await request(app).get('/api/search/users').query({ q: 'topiary' }).set(as('sarah')).expect(200);

    expect(byBio.body.results.map((r: { id: string }) => r.id)).toEqual(['ana']);
    expect(bySkill.body.results.map((r: { id: string }) => r.id)).toEqual(['ana']);
  });

  it('does not say what a member\'s role is to a visitor, and does not let one narrow the directory to staff', async () => {
    users = [
      mei({ id: 'ana', displayName: 'Ana Gardener', headline: 'Landscape designer', role: 'USER' }),
      mei({ id: 'ops', displayName: 'Ops Gardener', headline: 'Trust and safety', role: 'MODERATOR' }),
    ];

    const asVisitor = await request(app).get('/api/search/users').query({ q: 'gardener', role: 'MODERATOR' }).expect(200);

    // The filter is not applied for her, so it cannot be used to list the
    // moderators, and nothing in an answer says what anybody's role is (the
    // profile card leaves it out as well).
    expect(asVisitor.body.results.map((r: { id: string }) => r.id).sort()).toEqual(['ana', 'ops']);
    for (const result of asVisitor.body.results) expect(result.metadata).not.toHaveProperty('role');
    expect(JSON.stringify(asVisitor.body)).not.toContain('MODERATOR');

    const asMember = await request(app).get('/api/search/users').query({ q: 'gardener', role: 'MODERATOR' }).set(as('sarah')).expect(200);

    expect(asMember.body.results.map((r: { id: string }) => r.id)).toEqual(['ops']);
    expect(asMember.body.results[0].metadata.role).toBe('MODERATOR');
  });

  it('gives a visitor the same card on the combined search', async () => {
    users = findable();

    const res = await request(app).get('/api/search').query({ q: 'cobalt', type: 'users' }).expect(200);

    expect(res.body.results).toEqual([]);
  });
});

describe('page sizes a stranger can ask for', () => {
  it('clamps a member\'s posts to 100 whatever limit is typed', async () => {
    for (const limit of ['100000', '99999999999999999999', '-5', '0', 'abc', '1e9']) {
      postFindMany.mockClear();
      await request(app).get('/api/posts/user/mei').query({ limit }).expect(200);

      const { take } = postFindMany.mock.calls[0][0] as { take: number };
      expect(take).toBeGreaterThanOrEqual(1);
      expect(take).toBeLessThanOrEqual(100);
    }
  });

  it('clamps the page number too, so the offset stays one the database will take', async () => {
    await request(app).get('/api/posts/user/mei').query({ page: '99999999999999', limit: '100' }).expect(200);

    const { skip, take } = postFindMany.mock.calls[0][0] as { skip: number; take: number };
    expect(skip).toBeLessThanOrEqual(10_000 * 100);
    expect(take).toBe(100);
  });

  it('clamps an organisation\'s jobs to 100', async () => {
    for (const limit of ['100000', '-1', 'abc']) {
      jobFindMany.mockClear();
      await request(app).get('/api/organizations/acme/jobs').query({ limit }).expect(200);

      const { take } = jobFindMany.mock.calls[0][0] as { take: number };
      expect(take).toBeGreaterThanOrEqual(1);
      expect(take).toBeLessThanOrEqual(100);
    }
  });

  it('answers a search that asks for a million results with at most 50', async () => {
    users = Array.from({ length: 80 }, (_, index) => mei({ id: `m${index}`, displayName: `Member ${index}`, headline: 'Gardener' }));

    const res = await request(app).get('/api/search/users').query({ q: 'gardener', limit: '1000000' }).expect(200);

    expect(res.body.results.length).toBeLessThanOrEqual(50);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  it('refuses a mentor directory page larger than 100', async () => {
    await request(app).get('/api/mentors').query({ limit: '1000000' }).expect(400);
  });
});

describe('the profile-read budget', () => {
  it('stops one account after its budget, whatever address the calls come from', async () => {
    for (let call = 0; call < 3; call += 1) {
      await request(app).get('/api/users/mei').set(as('sarah')).set('X-Forwarded-For', `203.0.113.${call + 1}`).expect(200);
    }

    const refused = await request(app).get('/api/users/mei').set(as('sarah')).set('X-Forwarded-For', '203.0.113.200').expect(429);

    expect(refused.body.retryAfter).toBeGreaterThan(0);
    expect(refused.headers['retry-after']).toBeDefined();
    expect(refused.headers['x-ratelimit-limit']).toBe('3');
  });

  it('counts one account across the profile and the follower lists together', async () => {
    await request(app).get('/api/users/mei').set(as('sarah')).expect(200);
    await request(app).get('/api/users/mei/followers').set(as('sarah')).expect(200);
    await request(app).get('/api/users/mei/following').set(as('sarah')).expect(200);

    await request(app).get('/api/users/mei').set(as('sarah')).expect(429);
  });

  it('gives each account a budget of its own', async () => {
    for (let call = 0; call < 3; call += 1) await request(app).get('/api/users/mei').set(as('sarah')).expect(200);
    await request(app).get('/api/users/mei').set(as('sarah')).expect(429);

    // Another member, on the same address, is not held up by her.
    await request(app).get('/api/users/mei').set(as('priya')).expect(200);
  });

  it('counts a visitor with no account by address, apart from every member', async () => {
    for (let call = 0; call < 3; call += 1) await request(app).get('/api/users/mei').expect(200);
    await request(app).get('/api/users/mei').expect(429);

    await request(app).get('/api/users/mei').set(as('sarah')).expect(200);
  });

  it('says so in the log, once, when the same account keeps being refused', async () => {
    for (let call = 0; call < 3; call += 1) await request(app).get('/api/users/mei').set(as('sarah')).expect(200);
    // Past the point where it is worth a line: 20 refusals in the hour.
    for (let call = 0; call < 25; call += 1) await request(app).get('/api/users/mei').set(as('sarah')).expect(429);
    // The line is written after the response is sent, so give it a turn.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setTimeout(resolve, 20));

    const lines = (logger.warn as jest.Mock).mock.calls.filter((call) => call[0] === 'A caller keeps running into a rate limit');
    expect(lines).toHaveLength(1);
    const context = lines[0][1] as { limiter: string; userId: string; path: string };
    expect(context).toMatchObject({ limiter: 'profile-read', userId: 'sarah' });
    // The route's pattern, not the path with a member's id in it.
    expect(context.path).not.toContain('mei');
  });

  it('does not log anything for an account that is refused a few times', async () => {
    for (let call = 0; call < 3; call += 1) await request(app).get('/api/users/mei').set(as('sarah')).expect(200);
    for (let call = 0; call < 5; call += 1) await request(app).get('/api/users/mei').set(as('sarah')).expect(429);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const lines = (logger.warn as jest.Mock).mock.calls.filter((call) => call[0] === 'A caller keeps running into a rate limit');
    expect(lines).toHaveLength(0);
  });
});
