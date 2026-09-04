import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    closeFriend: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      upsert: jest.fn(),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    follow: { findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn() },
    status: { findMany: jest.fn(async () => []), create: jest.fn(), findFirst: jest.fn() },
    statusView: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), create: jest.fn() },
    post: { findMany: jest.fn(async () => []) },
    video: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'me', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'u@athena.com' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { closeFriendsAudienceWhere } from '../status.routes';

const prisma: any = prismaTyped;
const person = (id: string, name: string) => ({ id, firstName: name, lastName: 'X', displayName: `${name} X.`, avatar: null, headline: null });

describe('Close friends and story audience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the people on the list and offers people you follow', async () => {
    prisma.closeFriend.findMany.mockResolvedValue([{ friendId: 'ana', friend: person('ana', 'Ana') }]);
    prisma.follow.findMany.mockResolvedValue([
      { followingId: 'ana', following: person('ana', 'Ana') },
      { followingId: 'ben', following: person('ben', 'Ben') },
    ]);

    const res = await request(app).get('/api/users/me/close-friends').expect(200);

    expect(res.body.data.friends.map((p: any) => p.name)).toEqual(['Ana X.']);
    expect(res.body.data.suggestions.map((p: any) => p.id)).toEqual(['ben']);
  });

  it('adds and removes someone, never yourself', async () => {
    prisma.user.findUnique.mockResolvedValue(person('ben', 'Ben'));
    prisma.closeFriend.upsert.mockResolvedValue({});

    await request(app).post('/api/users/me/close-friends/ben').expect(201);
    expect(prisma.closeFriend.upsert.mock.calls[0][0].create).toEqual({ userId: 'me', friendId: 'ben' });

    await request(app).post('/api/users/me/close-friends/me').expect(400);

    await request(app).delete('/api/users/me/close-friends/ben').expect(200);
    expect(prisma.closeFriend.deleteMany.mock.calls[0][0]).toEqual({ where: { userId: 'me', friendId: 'ben' } });
  });

  it('a story can be posted to close friends only', async () => {
    prisma.status.create.mockResolvedValue({
      id: 's1',
      userId: 'me',
      type: 'IMAGE',
      mediaUrl: 'https://cdn/x.jpg',
      caption: null,
      audience: 'CLOSE_FRIENDS',
      viewCount: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });

    const res = await request(app).post('/api/status').send({ type: 'image', mediaUrl: 'https://cdn/x.jpg', audience: 'close_friends' }).expect(201);

    expect(prisma.status.create.mock.calls[0][0].data.audience).toBe('CLOSE_FRIENDS');
    expect(res.body.data.audience).toBe('close_friends');
  });

  it('the feed and the view route ask for the viewer’s audience', async () => {
    expect(closeFriendsAudienceWhere()).toEqual({ audience: 'EVERYONE' });
    expect(closeFriendsAudienceWhere('me')).toEqual({
      OR: [{ audience: 'EVERYONE' }, { userId: 'me' }, { audience: 'CLOSE_FRIENDS', user: { closeFriends: { some: { friendId: 'me' } } } }],
    });

    await request(app).get('/api/status/feed').set('x-test-user', 'me').expect(200);
    expect(prisma.status.findMany.mock.calls[0][0].where).toMatchObject({ OR: expect.any(Array) });

    prisma.status.findFirst.mockResolvedValue(null);
    await request(app).post('/api/status/s9/view').set('x-test-user', 'me').expect(404);
    expect(prisma.status.findFirst.mock.calls[0][0].where).toMatchObject({ id: 's9', OR: expect.any(Array) });
  });
});
