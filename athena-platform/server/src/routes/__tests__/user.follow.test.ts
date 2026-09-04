import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    follow: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    followRequest: { findUnique: jest.fn(async () => null), upsert: jest.fn(), deleteMany: jest.fn(async () => ({ count: 0 })) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'follower-1', role: 'USER', email: 'follower@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
  indexDocument: jest.fn(),
  deleteDocument: jest.fn(),
  IndexNames: { USERS: 'users' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('Following a member', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // First lookup: does the target exist. Second: the follower's name for
    // the notification.
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'target-1' })
      .mockResolvedValueOnce({ displayName: 'Jess', firstName: 'Jessica', lastName: 'Lee' });
  });

  it('tells the member who followed them by name, never by email, and links to the profile route', async () => {
    prisma.follow.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/users/target-1/follow').expect(200);

    expect(res.body.following).toBe(true);
    expect(prisma.follow.create).toHaveBeenCalled();
    const data = prisma.notification.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'target-1',
      type: 'FOLLOW',
      message: 'Jess started following you',
      link: '/profile/follower-1',
    });
    expect(data.message).not.toContain('@');
  });

  it('is idempotent: following twice is a 200 with no second row or notification', async () => {
    prisma.follow.findUnique.mockResolvedValue({ id: 'f1' });

    const res = await request(app).post('/api/users/target-1/follow').expect(200);

    expect(res.body.following).toBe(true);
    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('refuses to follow yourself', async () => {
    await request(app).post('/api/users/follower-1/follow').expect(400);
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });
});
