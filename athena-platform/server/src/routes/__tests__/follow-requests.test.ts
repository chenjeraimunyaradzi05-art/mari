import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    follow: {
      findUnique: jest.fn(async () => null),
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

import { app } from '../../index';
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

    expect(res.body.data.mutualFollowers).toEqual({ count: 2, names: ['Priya R.', 'Ana Lopez'] });
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
