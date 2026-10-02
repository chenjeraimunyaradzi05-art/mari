import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    // viewerContextFor reads the DV safety profile's own block list.
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'me', role: 'USER', email: 'me@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { mayBeShownToWhere, notPrivateProfileWhere } from '../../services/audience.service';

const prisma: any = prismaTyped;

describe('People you may know', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ranks second-degree connections first and explains each suggestion', async () => {
    prisma.user.findUnique.mockResolvedValue({ persona: 'EARLY_CAREER', city: 'Brisbane', state: 'QLD' });
    prisma.follow.findMany
      // who I follow
      .mockResolvedValueOnce([{ followingId: 'mei' }])
      // who they follow
      .mockResolvedValueOnce([
        { followingId: 'priya', follower: { displayName: 'Mei C.', firstName: 'Mei' } },
        { followingId: 'ana', follower: { displayName: 'Mei C.', firstName: 'Mei' } },
        { followingId: 'me', follower: { displayName: 'Mei C.', firstName: 'Mei' } },
      ]);
    prisma.user.findMany
      // same persona
      .mockResolvedValueOnce([{ id: 'ana', persona: 'EARLY_CAREER', city: null, state: null }])
      // same city
      .mockResolvedValueOnce([{ id: 'lou', persona: 'FOUNDER', city: 'Brisbane', state: 'QLD' }])
      // the profiles for the ranked ids
      .mockResolvedValueOnce([
        { id: 'ana', displayName: 'Ana R.', firstName: 'Ana', lastName: 'R', avatar: null, headline: 'Analyst', persona: 'EARLY_CAREER', city: null },
        { id: 'priya', displayName: 'Priya S.', firstName: 'Priya', lastName: 'S', avatar: null, headline: null, persona: 'MID_CAREER', city: null },
        { id: 'lou', displayName: 'Lou M.', firstName: 'Lou', lastName: 'M', avatar: null, headline: null, persona: 'FOUNDER', city: 'Brisbane' },
      ]);
    prisma.follow.groupBy.mockResolvedValue([]);

    const res = await request(app).get('/api/users/suggested?limit=3').expect(200);

    const ids = res.body.data.map((s: any) => s.id);
    expect(ids[0]).toBe('ana');
    expect(ids).not.toContain('me');
    expect(ids).not.toContain('mei');
    const ana = res.body.data.find((s: any) => s.id === 'ana');
    expect(ana.reason).toBe('Followed by Mei C.');
    expect(ana.reasons).toEqual(['Followed by Mei C.', 'Same career stage as you']);
    const lou = res.body.data.find((s: any) => s.id === 'lou');
    expect(lou.reason).toBe('Also in Brisbane');
  });

  it('answers an empty list for a member with nobody around', async () => {
    prisma.user.findUnique.mockResolvedValue({ persona: null, city: null, state: null });
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.follow.groupBy.mockResolvedValue([]);

    const res = await request(app).get('/api/users/suggested').expect(200);
    expect(res.body.data).toEqual([]);
  });
});

/**
 * Every where clause in a tree, with nested ANDs flattened: the visibility
 * filter is composed as its own AND group and dropped into each query's list,
 * so what matters is that each clause is being ANDed in somewhere, not how
 * deep. Who actually comes back for a hidden, quiet or private member is run
 * over real rows in tests/discreet-members.test.ts.
 */
const clausesOf = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(clausesOf);
  return [node, ...clausesOf(node.AND)];
};
const hasClause = (clauses: any[], shape: unknown) =>
  clauses.some((clause) => {
    try {
      expect(clause).toEqual(shape);
      return true;
    } catch {
      return false;
    }
  });

describe('People you may know asks the question search asks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ persona: 'EARLY_CAREER', city: 'Brisbane', state: 'QLD' });
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.follow.groupBy.mockResolvedValue([{ followingId: 'popular', _count: { _all: 500 } }]);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('puts the filter in both candidate queries and in the final lookup, which is the only one a bare id passes through', async () => {
    await request(app).get('/api/users/suggested').expect(200);

    const wheres = prisma.user.findMany.mock.calls.map((call: any[]) => call[0].where);
    // Same career stage, same city, and the lookup for the ranked ids.
    expect(wheres).toHaveLength(3);
    for (const where of wheres) {
      const clauses = clausesOf(where);
      // Hidden from search, in the Safety Centre's column and the DV page's.
      expect(hasClause(clauses, { NOT: { dvSafetyProfile: { is: { hideFromSearch: true } } } })).toBe(true);
      expect(hasClause(clauses, { NOT: { profile: { is: { hideFromSearch: true } } } })).toBe(true);
      // Safe Mode, whichever page switched it on: the same rule as search, the
      // feed and the leaderboard, so the three cannot drift apart.
      expect(hasClause(clauses, mayBeShownToWhere('me'))).toBe(true);
      // A profile set to private is not offered by name either.
      expect(hasClause(clauses, notPrivateProfileWhere)).toBe(true);
      // And a member who blocked her from the DV page, before it reached the platform list.
      expect(hasClause(clauses, { NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: 'me' } } } } })).toBe(true);
      expect(hasClause(clauses, { isActive: true })).toBe(true);
    }
  });

  it('a member who is filtered out leaves a gap the next candidate fills, so the page is not short', async () => {
    prisma.user.findUnique.mockResolvedValue({ persona: null, city: null, state: null });
    // The three best-ranked ids are members the final lookup will not return.
    prisma.follow.groupBy.mockResolvedValue([
      { followingId: 'quiet-1', _count: { _all: 900 } },
      { followingId: 'quiet-2', _count: { _all: 800 } },
      { followingId: 'private-1', _count: { _all: 700 } },
      { followingId: 'open', _count: { _all: 100 } },
      { followingId: 'also-open', _count: { _all: 90 } },
    ]);
    const row = (id: string) => ({ id, displayName: id, firstName: id, lastName: 'X', avatar: null, headline: null, persona: 'MID_CAREER', city: null });
    prisma.user.findMany.mockResolvedValue([row('open'), row('also-open')]);

    const res = await request(app).get('/api/users/suggested?limit=2').expect(200);

    expect(res.body.data.map((s: any) => s.id).sort()).toEqual(['also-open', 'open']);
    // The lookup was for the whole ranked pool, not for the first page of it.
    const asked = prisma.user.findMany.mock.calls[0][0].where.AND[0].id.in;
    expect(asked).toEqual(['quiet-1', 'quiet-2', 'private-1', 'open', 'also-open']);
  });

  it('never offers an id the final lookup did not return, whatever ranked it', async () => {
    prisma.user.findUnique.mockResolvedValue({ persona: null, city: null, state: null });
    prisma.follow.groupBy.mockResolvedValue([{ followingId: 'quiet-1', _count: { _all: 900 } }]);
    prisma.user.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/users/suggested').expect(200);

    expect(res.body.data).toEqual([]);
  });

  it('fails the request rather than offering anyone when the block lists cannot be read', async () => {
    prisma.userSafetySettings.findMany.mockRejectedValue(new Error('connection reset'));

    const res = await request(app).get('/api/users/suggested');

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.data).toBeUndefined();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
