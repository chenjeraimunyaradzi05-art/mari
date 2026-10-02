import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The Verified mark on a profile page. The identity blurb has always promised
 * "a verified tick on your profile", and the public profile API never selected
 * the column, so no profile could ever show one. The mark is drawn from
 * User.isVerified, which only an approved identity check sets (a reviewer's
 * approval with a recorded reason, or Stripe's own result); this is what keeps
 * the page from drawing it from anything else.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null) },
    user: { findUnique: jest.fn(), findFirst: jest.fn(async () => null) },
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

const profile = (id: string, isVerified: boolean) => ({
  id,
  firstName: 'Mei',
  lastName: 'Chen',
  displayName: 'Mei C.',
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
  isVerified,
  createdAt: new Date('2026-09-05T10:00:00Z'),
  profile: null,
  skills: [],
  education: [],
  experience: [],
  _count: { followers: 12, following: 3, posts: 4 },
});

describe('GET /api/users/:id and the Verified mark', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
  });

  it('asks the database for the mark, so it is read from the column and not guessed', async () => {
    prisma.user.findUnique.mockResolvedValue(profile('mei', false));

    await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(prisma.user.findUnique.mock.calls[0][0].select.isVerified).toBe(true);
  });

  it('carries true for a member whose identity was verified', async () => {
    prisma.user.findUnique.mockResolvedValue(profile('mei', true));

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(res.body.data.isVerified).toBe(true);
  });

  it('carries false, not a mark, for everyone else', async () => {
    prisma.user.findUnique.mockResolvedValue(profile('mei', false));

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(res.body.data.isVerified).toBe(false);
  });

  it('carries the mark on the limited card a non-follower sees of a connections-only profile', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'connections' });
    prisma.user.findUnique.mockResolvedValue(profile('mei', true));

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(res.body.data.isLimited).toBe(true);
    expect(res.body.data.isVerified).toBe(true);
    // The limited card stays limited: the mark is not a way to more of her.
    expect(res.body.data.bio).toBeUndefined();
  });
});
