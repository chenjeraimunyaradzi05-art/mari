import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The pseudonymous display name, on the member pages and lists.
 *
 * ATHENA tells Australian members they can use a pseudonym on the platform. A
 * public name could be set but every response also carried the legal first and
 * last name beside it, so a client that preferred them put the legal name on
 * screen anyway. The server now sends another member's public name and no legal
 * name; the owner reads her own record whole. The same rule for post authors,
 * message participants and group posts is pinned in posts.reposts.test.ts,
 * message.routes.test.ts and groups.routes.test.ts.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(), findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    follow: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    followRequest: { findUnique: jest.fn(async () => null) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'viewer-1', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'u@athena.com' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  indexDocument: jest.fn(),
  deleteDocument: jest.fn(),
  IndexNames: { USERS: 'users', POSTS: 'posts' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });

const profile = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  firstName: 'Jane',
  lastName: 'Doe',
  displayName: 'Willow Rain',
  avatar: null,
  bio: 'Product lead',
  headline: 'Product lead',
  role: 'USER',
  persona: 'EARLY_CAREER',
  city: 'Melbourne',
  state: null,
  country: 'AU',
  currentJobTitle: null,
  currentCompany: null,
  yearsExperience: null,
  isPublic: true,
  isVerified: false,
  emailVerified: true,
  createdAt: new Date('2026-09-05T10:00:00Z'),
  profile: null,
  skills: [],
  education: [],
  experience: [],
  _count: { followers: 12, following: 3, posts: 4 },
  ...over,
});

describe('A member page shows the public name and never the legal one', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
  });

  it('sends another member her public name in every name field, and nothing of her legal name', async () => {
    prisma.user.findUnique.mockResolvedValue(profile('jane'));

    const res = await request(app).get('/api/users/jane').set(as('sarah')).expect(200);

    expect(res.body.data).toMatchObject({ id: 'jane', displayName: 'Willow Rain', firstName: 'Willow Rain', lastName: '' });
    const written = JSON.stringify(res.body);
    expect(written).not.toContain('Doe');
    expect(written).not.toContain('Jane');
    // Everything else on the page is as it was.
    expect(res.body.data).toMatchObject({ headline: 'Product lead', city: 'Melbourne', isVerified: false });
  });

  it('calls a member with no public name by her first name alone', async () => {
    prisma.user.findUnique.mockResolvedValue(profile('jane', { displayName: null }));

    const res = await request(app).get('/api/users/jane').set(as('sarah')).expect(200);

    expect(res.body.data).toMatchObject({ displayName: 'Jane', firstName: 'Jane', lastName: '' });
    expect(JSON.stringify(res.body)).not.toContain('Doe');
  });

  it('holds a signed-out visitor to the same, on the card they are shown', async () => {
    prisma.user.findUnique.mockResolvedValue(profile('jane'));

    const res = await request(app).get('/api/users/jane').expect(200);

    expect(res.body.data.isLimited).toBe(true);
    expect(res.body.data).toMatchObject({ displayName: 'Willow Rain', lastName: '' });
    expect(JSON.stringify(res.body)).not.toContain('Doe');
  });

  it('gives the owner her own record whole', async () => {
    prisma.user.findUnique.mockResolvedValue(profile('jane'));

    const res = await request(app).get('/api/users/jane').set(as('jane')).expect(200);

    expect(res.body.data).toMatchObject({ firstName: 'Jane', lastName: 'Doe', displayName: 'Willow Rain' });
  });

  it('names the mutual followers it shows by their public names', async () => {
    prisma.user.findUnique.mockResolvedValue(profile('jane'));
    prisma.follow.findMany
      .mockResolvedValueOnce([{ followingId: 'ana' }])
      .mockResolvedValueOnce([{ follower: { displayName: null, firstName: 'Ana' } }]);
    prisma.follow.count.mockResolvedValue(1);

    const res = await request(app).get('/api/users/jane').set(as('sarah')).expect(200);

    expect(res.body.data.mutualFollowers).toEqual({ count: 1, names: ['Ana'] });
    // The follower select never asks for a legal surname.
    const asked = prisma.follow.findMany.mock.calls.map((c: any[]) => JSON.stringify(c[0]));
    expect(asked.join('')).not.toContain('lastName');
  });
});

describe('The follower lists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ id: 'jane', isPublic: true, emailVerified: true });
  });

  it('list each member by her public name, and the select never loads a legal surname', async () => {
    prisma.follow.findMany.mockResolvedValue([
      { follower: { id: 'a', firstName: 'Ana', displayName: 'Ana the Gardener', avatar: null, headline: null } },
      { follower: { id: 'b', firstName: 'Bea', displayName: null, avatar: null, headline: null } },
    ]);

    const res = await request(app).get('/api/users/jane/followers').set(as('sarah')).expect(200);

    expect(res.body.data.map((m: any) => [m.displayName, m.firstName, m.lastName])).toEqual([
      ['Ana the Gardener', 'Ana the Gardener', ''],
      ['Bea', 'Bea', ''],
    ]);
    const listing = prisma.follow.findMany.mock.calls.map((c: any[]) => c[0]).find((args: any) => args?.include?.follower);
    const select = listing.include.follower.select;
    expect(Object.keys(select)).not.toContain('lastName');
    expect(Object.keys(select)).toContain('displayName');
  });
});

describe('The @-mention box', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('matches what is typed against the public name, not the legal first and last name', async () => {
    await request(app).get('/api/users/suggest').query({ q: 'Doe' }).set(as('sarah')).expect(200);

    const where = JSON.stringify(prisma.user.findMany.mock.calls[0][0].where);
    expect(where).not.toContain('lastName');
    // A first name is matched only for a member with no public name to be matched by.
    const asked = prisma.user.findMany.mock.calls[0][0].where.AND[1];
    expect(asked).toEqual({
      OR: [
        { displayName: { startsWith: 'Doe', mode: 'insensitive' } },
        { displayName: { contains: ' Doe', mode: 'insensitive' } },
        { AND: [{ OR: [{ displayName: null }, { displayName: '' }] }, { firstName: { startsWith: 'Doe', mode: 'insensitive' } }] },
      ],
    });
  });

  it('offers a member under her public name, or her first name, never both legal names', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'jane', displayName: 'Willow Rain', firstName: 'Jane', avatar: null, headline: null },
      { id: 'bea', displayName: null, firstName: 'Bea', avatar: null, headline: 'Analyst' },
    ]);

    const res = await request(app).get('/api/users/suggest').query({ q: 'W' }).set(as('sarah')).expect(200);

    expect(res.body.data.map((m: any) => m.name).sort()).toEqual(['Bea', 'Willow Rain']);
    expect(JSON.stringify(res.body)).not.toContain('Jane');
  });
});
