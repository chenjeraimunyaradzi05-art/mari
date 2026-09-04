import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
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
