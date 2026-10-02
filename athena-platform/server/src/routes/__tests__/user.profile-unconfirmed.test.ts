import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * An account whose address nobody has confirmed has no public page.
 *
 * The row exists from the moment of sign-up with whatever name was typed into
 * the form, and the person it names may not be the person who typed it.
 * Registration was already refusing to let her sign in until she confirmed the
 * address, but the public profile and the follow button were open to anyone
 * with the id, so the account was findable and followable before it was hers.
 * Search and suggestions leave it out through hiddenMemberWhere; these hold the
 * two routes that take an id.
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
      create: jest.fn(),
    },
    followRequest: { findUnique: jest.fn(async () => null), upsert: jest.fn() },
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

const row = (id: string, emailVerified: boolean) => ({
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
  isVerified: false,
  emailVerified,
  createdAt: new Date('2026-09-05T10:00:00Z'),
  profile: null,
  skills: [],
  education: [],
  experience: [],
  _count: { followers: 0, following: 0, posts: 0 },
});

describe('GET /api/users/:id for an account nobody has confirmed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
  });

  it('answers 404 to a visitor, as it would for someone who does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(row('uma', false));

    const unconfirmed = await request(app).get('/api/users/uma').expect(404);

    prisma.user.findUnique.mockResolvedValue(null);
    const missing = await request(app).get('/api/users/nobody').expect(404);
    // The answer says nothing about which of the two it was.
    expect(unconfirmed.body.message).toBe(missing.body.message);
    expect(unconfirmed.body.message).toBe('User not found');
  });

  it('answers 404 to a signed-in member too', async () => {
    prisma.user.findUnique.mockResolvedValue(row('uma', false));
    await request(app).get('/api/users/uma').set(as('sarah')).expect(404);
  });

  it('is still there for the account itself', async () => {
    prisma.user.findUnique.mockResolvedValue(row('uma', false));

    const res = await request(app).get('/api/users/uma').set(as('uma')).expect(200);

    expect(res.body.data.id).toBe('uma');
  });

  it('shows a confirmed member as before, and never sends the confirmation flag out', async () => {
    prisma.user.findUnique.mockResolvedValue(row('mei', true));

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(res.body.data.id).toBe('mei');
    expect(res.body.data).not.toHaveProperty('emailVerified');
  });

  it('asks the database for the flag, so the decision is read from the column', async () => {
    prisma.user.findUnique.mockResolvedValue(row('mei', true));

    await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(prisma.user.findUnique.mock.calls[0][0].select.emailVerified).toBe(true);
  });
});

describe('POST /api/users/:id/follow for an account nobody has confirmed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('answers 404 and creates nothing', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uma', emailVerified: false });

    await request(app).post('/api/users/uma/follow').set(as('sarah')).expect(404);

    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.followRequest.upsert).not.toHaveBeenCalled();
  });
});
