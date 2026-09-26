import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    status: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    statusView: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn() },
    // Blocks live on UserSafetySettings.blockedUsers; utils/safety-store reads
    // both directions out of it.
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    // Publishing a story passes the women-only floor and the age gate, and both
    // read the User row. An adult member nobody has refused, so these tests stay
    // about seen state and captions; the gates are proved in
    // middleware/__tests__/account-gates.test.ts and refused below.
    user: {
      findUnique: jest.fn(async () => ({
        womanVerificationStatus: 'UNVERIFIED',
        dvSafetyProfile: null,
        profile: null,
        dateOfBirth: new Date('1990-01-01'),
      })),
    },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  },
}));

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
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

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { assertContentAllowed } from '../../services/moderation.service';

const prisma: any = prismaTyped;
const VIEWER = 'viewer-1';
const as = (userId: string) => ({ 'x-test-user': userId });

const story = (id: string, userId: string, minutesAgo: number, extra: Record<string, unknown> = {}) => ({
  id,
  userId,
  type: 'IMAGE',
  mediaUrl: `https://cdn.example.com/${id}.jpg`,
  caption: null,
  viewCount: 0,
  createdAt: new Date(Date.now() - minutesAgo * 60000),
  expiresAt: new Date(Date.now() + 3600000),
  user: { id: userId, displayName: `User ${userId}`, firstName: null, lastName: null, avatar: null },
  ...extra,
});

describe('Stories: seen state and views', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
  });

  it('orders your own bucket first, then unseen, and marks what you have watched', async () => {
    // Newest first, as the query asks the database for them.
    prisma.status.findMany.mockResolvedValue([
      story('s4', 'u-a', 20),
      story('s3', VIEWER, 30, { viewCount: 7 }),
      story('s2', 'u-b', 40),
      story('s1', 'u-a', 50),
    ]);
    prisma.statusView.findMany.mockResolvedValue([{ statusId: 's2' }]);

    const res = await request(app).get('/api/status/feed').set(as(VIEWER)).expect(200);

    const buckets = res.body.data;
    expect(buckets.map((b: any) => b.user.id)).toEqual([VIEWER, 'u-a', 'u-b']);
    expect(buckets[0].stories[0].viewCount).toBe(7);
    expect(buckets[1].hasUnseen).toBe(true);
    expect(buckets[2].hasUnseen).toBe(false);
    expect(buckets[2].stories[0].viewed).toBe(true);
    expect(buckets[2].stories[0].viewCount).toBeUndefined();
    // Within a member's bucket they play in the order she posted them.
    expect(buckets[1].stories.map((s: any) => s.id)).toEqual(['s1', 's4']);
  });

  // The ring took the first 500 oldest-first, so once more than that were
  // live the newest stories — including one she had just posted — were cut.
  it('builds the ring from the newest stories when there are more than it holds', async () => {
    prisma.status.findMany.mockResolvedValue([]);
    await request(app).get('/api/status/feed').set(as(VIEWER)).expect(200);
    expect(prisma.status.findMany.mock.calls[0][0]).toMatchObject({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
  });

  it('a view is recorded once per viewer and never for the author', async () => {
    prisma.status.findFirst.mockResolvedValue({ id: 's1', userId: 'u-a', expiresAt: new Date(Date.now() + 1000), viewCount: 2 });
    prisma.statusView.findUnique.mockResolvedValue(null);
    prisma.statusView.create.mockResolvedValue({});
    prisma.status.update.mockResolvedValue({ viewCount: 3 });

    const first = await request(app).post('/api/status/s1/view').set(as(VIEWER)).expect(201);
    expect(first.body.viewCount).toBe(3);

    prisma.statusView.findUnique.mockResolvedValue({ id: 'v1' });
    const again = await request(app).post('/api/status/s1/view').set(as(VIEWER)).expect(200);
    expect(again.body.viewCount).toBe(2);
    expect(prisma.statusView.create).toHaveBeenCalledTimes(1);

    const own = await request(app).post('/api/status/s1/view').set(as('u-a')).expect(200);
    expect(own.body.viewCount).toBe(2);
  });

  it('only the author can see who watched', async () => {
    prisma.status.findUnique.mockResolvedValue({ id: 's1', userId: 'u-a', viewCount: 1 });
    await request(app).get('/api/status/s1/viewers').set(as(VIEWER)).expect(403);

    prisma.statusView.findMany.mockResolvedValue([
      { user: { id: VIEWER, displayName: 'Sarah D.', firstName: null, lastName: null, avatar: null }, viewedAt: new Date() },
    ]);
    const res = await request(app).get('/api/status/s1/viewers').set(as('u-a')).expect(200);
    expect(res.body.data.viewers[0].displayName).toBe('Sarah D.');
  });

  it('keeps a blocked pair out of each other’s ring, views and viewer list', async () => {
    // She blocked him. Blocking is symmetric, so safety-store answers with the
    // same list whichever of the two is asking.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: [] });
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'her' }]);
    prisma.status.findMany.mockResolvedValue([]);

    await request(app).get('/api/status/feed').set(as('him')).expect(200);
    expect(prisma.status.findMany.mock.calls[0][0].where).toMatchObject({ userId: { notIn: ['her'] } });

    // Her story is one he could otherwise watch: the audience clause lets him
    // through, and only the block turns him away.
    prisma.status.findFirst.mockResolvedValue({ id: 's1', userId: 'her', expiresAt: new Date(Date.now() + 1000), viewCount: 2 });
    await request(app).post('/api/status/s1/view').set(as('him')).expect(404);
    expect(prisma.statusView.create).not.toHaveBeenCalled();

    // And a view he recorded before the block does not survive it: severTies
    // clears follows and close friends, never StatusView rows. Asked from her
    // side, the same block is the one she wrote down.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.status.findUnique.mockResolvedValue({ id: 's1', userId: 'her', viewCount: 3 });
    prisma.statusView.findMany.mockResolvedValue([]);
    await request(app).get('/api/status/s1/viewers').set(as('her')).expect(200);
    expect(prisma.statusView.findMany.mock.calls.at(-1)[0].where).toMatchObject({ statusId: 's1', userId: { notIn: ['him'] } });
  });

  it('puts a story caption through the moderation gate before it is published', async () => {
    prisma.status.create.mockImplementation(async ({ data }: any) => ({ id: 's8', ...data, viewCount: 0, createdAt: new Date() }));

    await request(app)
      .post('/api/status')
      .set(as(VIEWER))
      .send({ type: 'image', mediaUrl: 'https://cdn.example.com/x.jpg', caption: 'Back on site today' })
      .expect(201);
    expect(assertContentAllowed).toHaveBeenCalledWith('Back on site today', { kind: 'comment', userId: VIEWER });

    // Nothing to screen, no call.
    (assertContentAllowed as jest.Mock).mockClear();
    await request(app)
      .post('/api/status')
      .set(as(VIEWER))
      .send({ type: 'image', mediaUrl: 'https://cdn.example.com/x.jpg' })
      .expect(201);
    expect(assertContentAllowed).not.toHaveBeenCalled();
  });

  // The gates are only worth anything if they are attached to the route. They
  // were written once before and applied to nothing, which is how a platform
  // sold as women-only came to enforce it on exactly one feature.
  it('refuses to publish a story for an account a reviewer has refused', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      womanVerificationStatus: 'REJECTED',
      dvSafetyProfile: null,
      profile: null,
      dateOfBirth: new Date('1990-01-01'),
    });
    const res = await request(app)
      .post('/api/status')
      .set(as(VIEWER))
      .send({ type: 'image', mediaUrl: 'https://cdn.example.com/x.jpg' })
      .expect(403);
    expect(res.body.code).toBe('WOMAN_VERIFICATION_REJECTED');
    expect(prisma.status.create).not.toHaveBeenCalled();
  });

  it('refuses to publish a story for an account that has never given a date of birth', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ womanVerificationStatus: 'VERIFIED', dvSafetyProfile: null, profile: null })
      .mockResolvedValueOnce({ dateOfBirth: null });
    const res = await request(app)
      .post('/api/status')
      .set(as(VIEWER))
      .send({ type: 'image', mediaUrl: 'https://cdn.example.com/x.jpg' })
      .expect(403);
    expect(res.body.code).toBe('DATE_OF_BIRTH_REQUIRED');
    expect(prisma.status.create).not.toHaveBeenCalled();
  });

  it('a story can carry a caption', async () => {
    prisma.status.create.mockImplementation(async ({ data }: any) => ({
      id: 's9',
      ...data,
      viewCount: 0,
      createdAt: new Date(),
    }));
    const res = await request(app)
      .post('/api/status')
      .set(as(VIEWER))
      .send({ type: 'image', mediaUrl: 'https://cdn.example.com/x.jpg', caption: 'First day in the new role' })
      .expect(201);
    expect(res.body.data.caption).toBe('First day in the new role');
    expect(res.body.data.viewed).toBe(true);
  });
});
