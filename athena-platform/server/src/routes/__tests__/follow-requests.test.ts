import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    // The block checks read the DV safety profile's list as well as the
    // platform one, in both directions; nobody is blocked here.
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null) },
    // findFirst answers "is she in Safe Mode?"; nobody is.
    user: { findUnique: jest.fn(), findFirst: jest.fn(async () => null) },
    follow: {
      findUnique: jest.fn(async () => null),
      // Answers "is this viewer a follower of hers who has passed the women-only check?".
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      create: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    followRequest: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    notification: { create: jest.fn() },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
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

// The per-member ceiling on reaching the same other member stands down when
// there is no Redis (tests), so the cases that need it say what it answers.
jest.mock('../../middleware/socialLimits', () => {
  const actual: any = jest.requireActual('../../middleware/socialLimits');
  return { ...actual, withinTargetLimit: jest.fn(async () => true) };
});

import { app } from '../../index';
import { withinTargetLimit } from '../../middleware/socialLimits';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });
const NOW = new Date('2026-09-05T10:00:00Z');

const profile = (id: string) => ({
  id,
  firstName: 'Mei',
  lastName: 'Chen',
  displayName: 'Mei C.',
  avatar: null,
  bio: 'Product lead',
  headline: 'Product lead',
  role: 'USER',
  persona: 'PROFESSIONAL',
  city: 'Melbourne',
  state: null,
  country: 'AU',
  currentJobTitle: null,
  currentCompany: null,
  yearsExperience: null,
  isPublic: true,
  createdAt: NOW,
  profile: null,
  skills: [],
  education: [],
  experience: [],
  _count: { followers: 12, following: 3, posts: 4 },
});

describe('Follow requests and protected profiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(profile('mei'));
    prisma.follow.findUnique.mockResolvedValue(null);
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.follow.count.mockResolvedValue(0);
    prisma.followRequest.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
  });

  it('following a public member is immediate', async () => {
    prisma.follow.create.mockResolvedValue({});
    const res = await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(200);
    expect(res.body.following).toBe(true);
    expect(prisma.follow.create).toHaveBeenCalled();
    expect(prisma.followRequest.upsert).not.toHaveBeenCalled();
  });

  it('following a member who approves followers sends a request and a notification', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'connections' });
    prisma.followRequest.upsert.mockResolvedValue({ id: 'fr1', status: 'PENDING', createdAt: NOW, updatedAt: NOW });
    prisma.user.findUnique.mockResolvedValueOnce(profile('mei')).mockResolvedValue({ displayName: 'Sarah D.', firstName: 'Sarah', lastName: 'Demo' });

    const res = await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(200);

    expect(res.body).toMatchObject({ following: false, requested: true });
    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.followRequest.upsert.mock.calls[0][0]).toMatchObject({
      create: { requesterId: 'sarah', targetId: 'mei' },
      update: { status: 'PENDING' },
    });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'mei', type: 'FOLLOW_REQUEST' });
  });

  it('following a member in Safe Mode sends a request even though her profile says public', async () => {
    // Her profile visibility was never touched by Safe Mode, so it still reads
    // public; an immediate follow would let anyone holding her id become one of
    // the connections her discreet profile is kept for.
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'mei' });
    prisma.followRequest.upsert.mockResolvedValue({ id: 'fr1', status: 'PENDING', createdAt: NOW, updatedAt: NOW });
    prisma.user.findUnique.mockResolvedValueOnce(profile('mei')).mockResolvedValue({ displayName: 'Sarah D.', firstName: 'Sarah', lastName: 'Demo' });

    const res = await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(200);

    expect(res.body).toMatchObject({ following: false, requested: true });
    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.followRequest.upsert).toHaveBeenCalled();
  });

  it('a stranger holding the id of a member in Safe Mode is turned away from her profile, as from a private one', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'mei' });

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(403);

    expect(res.body.message).toBe('This profile is private');
    // Nothing of her was read on the way to refusing.
    expect(JSON.stringify(res.body)).not.toContain('Mei');
  });

  it('a follower of hers who has passed the women-only check is let in', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'mei' });
    prisma.follow.findFirst.mockResolvedValueOnce({ followerId: 'sarah' });

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(res.body.data.id).toBe('mei');
    expect(prisma.follow.findFirst.mock.calls[0][0].where).toEqual({
      followingId: 'mei',
      followerId: 'sarah',
      follower: { womanVerificationStatus: 'VERIFIED' },
    });
  });

  it('unfollowing also withdraws a pending request', async () => {
    await request(app).delete('/api/users/mei/follow').set(as('sarah')).expect(200);
    expect(prisma.followRequest.deleteMany.mock.calls[0][0]).toEqual({
      where: { requesterId: 'sarah', targetId: 'mei', status: 'PENDING' },
    });
  });

  it('a non-follower sees a limited profile of a followers-only member, with a request state', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'connections' });
    prisma.followRequest.findUnique.mockResolvedValue({ status: 'PENDING' });

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(res.body.data).toMatchObject({
      id: 'mei',
      displayName: 'Mei C.',
      isLimited: true,
      approvesFollowers: true,
      isFollowing: false,
      followRequested: true,
    });
    expect(res.body.data.bio).toBeUndefined();
    expect(res.body.data.experience).toBeUndefined();
  });

  it('a follower sees the full followers-only profile', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'connections' });
    prisma.follow.findUnique.mockResolvedValue({ followerId: 'sarah', followingId: 'mei' });

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    expect(res.body.data.isLimited).toBeUndefined();
    expect(res.body.data).toMatchObject({ bio: 'Product lead', isFollowing: true, approvesFollowers: true });
  });

  it('a private profile is closed to everyone else', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'private' });
    await request(app).get('/api/users/mei').set(as('sarah')).expect(403);
    prisma.user.findUnique.mockResolvedValue(profile('sarah'));
    await request(app).get('/api/users/sarah').set(as('sarah')).expect(200);
  });

  it('names the people you follow who follow this member', async () => {
    prisma.follow.findMany
      .mockResolvedValueOnce([{ followingId: 'priya' }, { followingId: 'ana' }, { followingId: 'mei' }])
      .mockResolvedValueOnce([
        { follower: { displayName: 'Priya R.', firstName: 'Priya', lastName: 'Rao' } },
        { follower: { displayName: null, firstName: 'Ana', lastName: 'Lopez' } },
      ]);
    prisma.follow.count.mockResolvedValue(2);

    const res = await request(app).get('/api/users/mei').set(as('sarah')).expect(200);

    // A member with no public name is named by her first name alone: the legal surname is not shown to other members.
    expect(res.body.data.mutualFollowers).toEqual({ count: 2, names: ['Priya R.', 'Ana'] });
    expect(prisma.follow.findMany.mock.calls[1][0].where).toEqual({ followingId: 'mei', followerId: { in: ['priya', 'ana'] } });
  });

  it('lists, accepts and declines requests', async () => {
    const row = {
      id: 'fr1',
      requesterId: 'sarah',
      targetId: 'mei',
      status: 'PENDING',
      createdAt: NOW,
      requester: { id: 'sarah', firstName: 'Sarah', lastName: 'Demo', displayName: 'Sarah D.', avatar: null, headline: 'PM' },
    };
    prisma.followRequest.findMany.mockResolvedValue([row]);
    const list = await request(app).get('/api/users/me/follow-requests').set(as('mei')).expect(200);
    expect(list.body.data[0]).toMatchObject({ id: 'fr1', requester: { id: 'sarah', name: 'Sarah D.', headline: 'PM' } });

    prisma.followRequest.findUnique.mockResolvedValue(row);
    prisma.follow.upsert.mockResolvedValue({});
    prisma.followRequest.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Mei C.', firstName: 'Mei', lastName: 'Chen' });
    const accepted = await request(app).post('/api/users/me/follow-requests/fr1/accept').set(as('mei')).expect(200);
    expect(accepted.body.message).toBe('Request accepted');
    expect(prisma.follow.upsert.mock.calls[0][0].create).toEqual({ followerId: 'sarah', followingId: 'mei' });
    expect(prisma.followRequest.update.mock.calls[0][0]).toMatchObject({ where: { id: 'fr1' }, data: { status: 'ACCEPTED' } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'sarah', type: 'FOLLOW' });

    await request(app).post('/api/users/me/follow-requests/fr1/decline').set(as('mei')).expect(200);
    expect(prisma.followRequest.update.mock.calls[1][0].data).toEqual({ status: 'DECLINED' });

    // Someone else cannot answer a request that is not theirs.
    await request(app).post('/api/users/me/follow-requests/fr1/accept').set(as('sarah')).expect(404);
  });
});

describe('Following across a block', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(profile('mei'));
    prisma.follow.findUnique.mockResolvedValue(null);
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.followRequest.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
  });

  function expectNothingWasCreated() {
    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.followRequest.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  }

  it('a member Mei blocked cannot follow her, and is told nothing about why', async () => {
    // The platform list: Mei's row names the person who is trying to follow.
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'mei' }]);

    const res = await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(404);

    // The answer a member who does not exist would get.
    expect(res.body.message).toBe('User not found');
    expectNothingWasCreated();
  });

  it('a member who blocked Mei cannot be followed by her either', async () => {
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'sarah' }]);

    await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(404);

    expectNothingWasCreated();
  });

  it('a block written only to the DV safety profile closes the door too', async () => {
    prisma.dvSafetyProfile.findFirst.mockResolvedValue({ userId: 'mei' });

    await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(404);

    expect(prisma.dvSafetyProfile.findFirst.mock.calls[0][0].where).toEqual({
      OR: [
        { userId: 'sarah', blockedUserIds: { has: 'mei' } },
        { userId: 'mei', blockedUserIds: { has: 'sarah' } },
      ],
    });
    expectNothingWasCreated();
  });

  it('a request to follow a member who approves her followers is refused across a block as well', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'connections' });
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'mei' }]);

    await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(404);

    expectNothingWasCreated();
  });

  it('refuses rather than guesses when the block lists cannot be read', async () => {
    prisma.userSafetySettings.findMany.mockRejectedValue(new Error('connection reset'));

    const res = await request(app).post('/api/users/mei/follow').set(as('sarah'));

    expect(res.status).toBeGreaterThanOrEqual(500);
    expectNothingWasCreated();
  });

  it('an unblocked pair is unaffected', async () => {
    prisma.follow.create.mockResolvedValue({});

    await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(200);

    expect(prisma.follow.create).toHaveBeenCalled();
  });
});

describe('Following the same member again and again', () => {
  const limit = withinTargetLimit as unknown as jest.Mock<(...args: unknown[]) => Promise<boolean>>;

  beforeEach(() => {
    jest.clearAllMocks();
    limit.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue(profile('mei'));
    prisma.follow.findUnique.mockResolvedValue(null);
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.followRequest.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
    prisma.follow.create.mockResolvedValue({});
  });

  function expectNothingWasCreated() {
    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.followRequest.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  }

  it('is counted per pair, and refused with a 429 that says to wait once the ceiling is passed', async () => {
    limit.mockResolvedValue(false);

    const res = await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(429);

    expect(limit).toHaveBeenCalledWith('follow', 'sarah', 'mei');
    expect(res.body.message).toMatch(/wait a while/i);
    expectNothingWasCreated();
  });

  it('refuses a request to follow a member who approves her followers in the same way', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'connections' });
    limit.mockResolvedValue(false);

    await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(429);

    expectNothingWasCreated();
  });

  it('does not spend any of the allowance on a press that creates nothing', async () => {
    // Already following: the button is pressed again, and the answer is the same.
    prisma.follow.findUnique.mockResolvedValue({ followerId: 'sarah', followingId: 'mei' });

    await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(200);

    expect(limit).not.toHaveBeenCalled();
  });

  it('does not count an attempt a block has already refused', async () => {
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'mei' }]);

    await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(404);

    expect(limit).not.toHaveBeenCalled();
  });

  it('lets a follow through while the pair is inside the ceiling', async () => {
    await request(app).post('/api/users/mei/follow').set(as('sarah')).expect(200);

    expect(limit).toHaveBeenCalledWith('follow', 'sarah', 'mei');
    expect(prisma.follow.create).toHaveBeenCalled();
  });
});
