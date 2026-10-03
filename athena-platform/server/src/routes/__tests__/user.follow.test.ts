import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    // findFirst answers "is she in Safe Mode?", which decides whether following her needs her approval.
    user: { findUnique: jest.fn(), findFirst: jest.fn(async () => null) },
    follow: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    followRequest: { findUnique: jest.fn(async () => null), upsert: jest.fn(), deleteMany: jest.fn(async () => ({ count: 0 })) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    // Both stores are read when a follow, and the notification it sends, are checked for a block.
    dvSafetyProfile: { findFirst: jest.fn(async () => null) },
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

// A block closes every way one member can reach the other, and a follow is one: it
// creates a row, it can be a request that waits in her inbox, and it rings her
// phone with the follower's name. This route checked nothing, so the account she
// had blocked could follow her again the same afternoon.
describe('Following a member across a block', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mockReset, not clear: the tests above leave a queue of one-time answers behind.
    prisma.user.findUnique.mockReset();
    prisma.user.findUnique.mockResolvedValue({ id: 'target-1' });
    prisma.follow.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null); // not in Safe Mode
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
  });

  const blocks: Array<[string, () => void]> = [
    ['she has blocked the follower', () => prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'target-1' }])],
    ['the follower has blocked her', () => prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'follower-1' }])],
    ['she blocked the follower from the DV safety page alone', () => prisma.dvSafetyProfile.findFirst.mockResolvedValue({ userId: 'target-1' })],
  ];

  it.each(blocks)('is refused as though she did not exist, and stores and sends nothing, when %s', async (_name, block) => {
    block();

    const res = await request(app).post('/api/users/target-1/follow').expect(404);

    expect(res.body.message).toBe('User not found');
    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.followRequest.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('is refused too when the member would have had to approve the follow: no request is left waiting', async () => {
    // She is in Safe Mode, which makes every follow a request; the request is the way in.
    prisma.user.findFirst.mockResolvedValue({ id: 'target-1' });
    prisma.dvSafetyProfile.findFirst.mockResolvedValue({ userId: 'target-1' });

    await request(app).post('/api/users/target-1/follow').expect(404);

    expect(prisma.followRequest.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('does not follow on a guess when the block lists cannot be read', async () => {
    prisma.dvSafetyProfile.findFirst.mockRejectedValue(new Error('connection reset'));

    await request(app).post('/api/users/target-1/follow').expect(500);

    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('still follows a member nobody has blocked', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'target-1' }).mockResolvedValueOnce({ displayName: 'Jess', firstName: 'Jessica' });

    await request(app).post('/api/users/target-1/follow').expect(200);

    expect(prisma.follow.create).toHaveBeenCalled();
  });
});
