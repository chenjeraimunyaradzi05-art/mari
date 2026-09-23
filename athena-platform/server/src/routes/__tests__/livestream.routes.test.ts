import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const client: any = {
    liveStream: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    liveStreamMessage: {
      create: jest.fn(),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      delete: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    follow: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    notification: { createMany: jest.fn(async () => ({ count: 0 })), create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    giftTransaction: { create: jest.fn(), groupBy: jest.fn(async () => []) },
    creatorProfile: { updateMany: jest.fn(async () => ({ count: 1 })) },
    // Both forms are in use: the array form for the chat write, and the
    // interactive callback form for the gift, where the conditional debit has
    // to be able to roll its siblings back.
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(client) : Promise.all(arg))),
  };
  return { prisma: client };
});

jest.mock('../../utils/safety-store', () => {
  const actual: any = jest.requireActual('../../utils/safety-store');
  return {
    ...actual,
    isBlockedRelationship: jest.fn(async () => false),
    getBlockedRelationshipIds: jest.fn(async () => [] as string[]),
    blockUser: jest.fn(async () => ({ created: true })),
  };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'host-1', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'u@athena.com' };
    }
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
import { blockUser, getBlockedRelationshipIds, isBlockedRelationship } from '../../utils/safety-store';

const prisma: any = prismaTyped;
const blocked = isBlockedRelationship as jest.MockedFunction<typeof isBlockedRelationship>;
const blockedIds = getBlockedRelationshipIds as jest.MockedFunction<typeof getBlockedRelationshipIds>;
const block = blockUser as jest.MockedFunction<typeof blockUser>;
const HOST = 'host-1';
const VIEWER = 'viewer-1';
const host = { id: HOST, displayName: 'Mei C.', avatar: null, headline: null, isVerified: false };

const streamRow = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  hostId: HOST,
  host,
  title: 'Salary negotiation, live',
  description: null,
  category: 'career',
  thumbnailUrl: null,
  status: 'SCHEDULED',
  streamKey: 'secret-key',
  ingestUrl: null,
  playbackUrl: 'https://cdn.example.com/hls/secret-key/index.m3u8',
  viewerCount: 0,
  peakViewers: 0,
  totalGiftPoints: 0,
  messageCount: 0,
  scheduledFor: null,
  startedAt: null,
  endedAt: null,
  replayVideoId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const as = (userId: string) => ({ 'x-test-user': userId });

describe('Live streams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.LIVESTREAM_RTMP_INGEST_URL;
    delete process.env.LIVESTREAM_PLAYBACK_URL_TEMPLATE;
    delete process.env.LIVESTREAM_WEBHOOK_SECRET;
    blocked.mockResolvedValue(false);
    blockedIds.mockResolvedValue([]);
    block.mockResolvedValue({ created: true });
    // Conditional writes default to "the row was there": a test that wants the
    // losing side of a race says so itself.
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.liveStream.updateMany.mockResolvedValue({ count: 1 });
    prisma.liveStreamMessage.deleteMany.mockResolvedValue({ count: 0 });
    prisma.liveStreamMessage.findMany.mockResolvedValue([]);
  });

  it('prepares a stream with a key the host can see', async () => {
    prisma.liveStream.findFirst.mockResolvedValue(null);
    prisma.liveStream.create.mockImplementation(async ({ data }: any) => streamRow({ ...data, host }));

    const res = await request(app)
      .post('/api/livestream')
      .set(as(HOST))
      .send({ title: 'Salary negotiation, live', category: 'career', playbackUrl: 'https://cdn.example.com/x.m3u8' })
      .expect(201);

    expect(res.body.data.streamKey).toHaveLength(48);
    expect(res.body.data.isHost).toBe(true);
    expect(res.body.data.ingestConfigured).toBe(false);
    expect(res.body.data.status).toBe('SCHEDULED');
  });

  it('refuses to prepare a second stream while one is live', async () => {
    prisma.liveStream.findFirst.mockResolvedValue(streamRow({ status: 'LIVE' }));

    await request(app).post('/api/livestream').set(as(HOST)).send({ title: 'Another' }).expect(409);
    expect(prisma.liveStream.create).not.toHaveBeenCalled();
  });

  it('hides the key and ingest URL from viewers', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE', ingestUrl: 'rtmp://ingest/live' }));

    const res = await request(app).get('/api/livestream/s1').set(as(VIEWER)).expect(200);

    expect(res.body.data.streamKey).toBeUndefined();
    expect(res.body.data.ingestUrl).toBeUndefined();
    expect(res.body.data.isHost).toBe(false);
    expect(res.body.data.playbackUrl).toBeDefined();
  });

  it('only the host can go live, and only with something to play', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ playbackUrl: null }));

    await request(app).post('/api/livestream/s1/start').set(as(VIEWER)).expect(403);
    await request(app).post('/api/livestream/s1/start').set(as(HOST)).expect(400);
    expect(prisma.liveStream.update).not.toHaveBeenCalled();
  });

  it('going live flips the status and tells followers', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow());
    prisma.liveStream.update.mockImplementation(async ({ data }: any) => streamRow({ ...data }));
    prisma.follow.findMany.mockResolvedValue([{ followerId: 'f1' }, { followerId: 'f2' }]);

    const res = await request(app).post('/api/livestream/s1/start').set(as(HOST)).expect(200);

    expect(res.body.data.status).toBe('LIVE');
    expect(prisma.liveStream.update.mock.calls[0][0].data.status).toBe('LIVE');
    // Notifications are written after the response; give the promise a tick.
    await new Promise((resolve) => setImmediate(resolve));
    expect(prisma.notification.createMany).toHaveBeenCalled();
    const rows = prisma.notification.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0].link).toBe('/live/s1');
  });

  it('ending a stream records when and zeroes the count', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE', viewerCount: 12 }));
    prisma.liveStream.update.mockImplementation(async ({ data }: any) => streamRow({ ...data }));

    const res = await request(app).post('/api/livestream/s1/end').set(as(HOST)).expect(200);

    expect(res.body.data.status).toBe('ENDED');
    const data = prisma.liveStream.update.mock.calls[0][0].data;
    expect(data.viewerCount).toBe(0);
    expect(data.endedAt).toBeInstanceOf(Date);
  });

  it('a gift needs enough points, then moves them and credits the stream', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    prisma.user.findUnique.mockResolvedValue({ id: VIEWER, displayName: 'Sarah', giftBalance: 3 });

    await request(app).post('/api/livestream/s1/gift').set(as(VIEWER)).send({ giftType: 'star' }).expect(402);

    // Two reads of the wallet now: the cheap pre-check, and the read-back
    // inside the transaction that reports the balance she actually has left.
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: VIEWER, displayName: 'Sarah', giftBalance: 50 })
      .mockResolvedValueOnce({ giftBalance: 45 });
    prisma.giftTransaction.create.mockResolvedValue({ id: 'g1', createdAt: new Date() });
    prisma.liveStream.update.mockResolvedValue({ totalGiftPoints: 5 });

    const res = await request(app)
      .post('/api/livestream/s1/gift')
      .set(as(VIEWER))
      .send({ giftType: 'star' })
      .expect(201);

    expect(res.body.data.totalGiftPoints).toBe(5);
    expect(res.body.data.balance).toBe(45);
    const created = prisma.giftTransaction.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ senderId: VIEWER, receiverId: HOST, streamId: 's1', giftType: 'star', giftValue: 5 });
    expect(created.creatorShare + created.platformShare).toBe(5);
  });

  // Gift points are bought with real money. The balance used to be read
  // outside the transaction and decremented unconditionally inside it, so two
  // requests that read the same balance both spent it and the wallet went
  // negative — with the creator's share of both credited and payable.
  it('takes the points with a conditional debit, so a race cannot overspend', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: VIEWER, displayName: 'Sarah', giftBalance: 5 })
      .mockResolvedValueOnce({ giftBalance: 0 });
    prisma.giftTransaction.create.mockResolvedValue({ id: 'g1', createdAt: new Date() });
    prisma.liveStream.update.mockResolvedValue({ totalGiftPoints: 5 });

    await request(app).post('/api/livestream/s1/gift').set(as(VIEWER)).send({ giftType: 'star' }).expect(201);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: VIEWER, giftBalance: { gte: 5 } },
      data: { giftBalance: { decrement: 5 } },
    });

    // The loser of the race: the pre-check still sees points, the conditional
    // debit matches no row, and she gets a clean 402 with nothing written.
    jest.clearAllMocks();
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    prisma.user.findUnique.mockResolvedValue({ id: VIEWER, displayName: 'Sarah', giftBalance: 5 });
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await request(app).post('/api/livestream/s1/gift').set(as(VIEWER)).send({ giftType: 'star' }).expect(402);

    expect(prisma.giftTransaction.create).not.toHaveBeenCalled();
    expect(prisma.creatorProfile.updateMany).not.toHaveBeenCalled();
  });

  it('the host cannot gift their own stream', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    await request(app).post('/api/livestream/s1/gift').set(as(HOST)).send({ giftType: 'star' }).expect(400);
  });

  it('chat is refused on a stream that is not live', async () => {
    prisma.liveStream.findUnique.mockResolvedValue({ id: 's1', status: 'ENDED', hostId: HOST });
    await request(app).post('/api/livestream/s1/messages').set(as(VIEWER)).send({ content: 'hi' }).expect(409);
  });

  // The room was the one social surface a block did not reach: a man she had
  // blocked hard enough that he could not message her, comment on her posts or
  // repost her could still talk to her in her own live chat, in front of her
  // audience.
  it('a block keeps someone out of the chat, the gift and the backlog', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    blocked.mockResolvedValue(true);

    await request(app).post('/api/livestream/s1/messages').set(as(VIEWER)).send({ content: 'hi' }).expect(403);
    expect(prisma.liveStreamMessage.create).not.toHaveBeenCalled();

    await request(app).post('/api/livestream/s1/gift').set(as(VIEWER)).send({ giftType: 'star' }).expect(403);
    expect(prisma.giftTransaction.create).not.toHaveBeenCalled();

    blockedIds.mockResolvedValue(['troll-1']);
    await request(app).get('/api/livestream/s1/messages').set(as(VIEWER)).expect(200);
    expect(prisma.liveStreamMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { streamId: 's1', userId: { notIn: ['troll-1'] } } })
    );
  });

  it('the host can take a message out of the room, and nobody else can', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    prisma.liveStreamMessage.findUnique.mockResolvedValue({ id: 'm1', streamId: 's1', userId: VIEWER });

    await request(app).delete('/api/livestream/s1/messages/m1').set(as(VIEWER)).expect(403);
    expect(prisma.liveStreamMessage.delete).not.toHaveBeenCalled();

    const res = await request(app).delete('/api/livestream/s1/messages/m1').set(as(HOST)).expect(200);

    expect(res.body.data.removed).toBe('m1');
    expect(prisma.liveStreamMessage.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    // The count the stream reports has to come down with it.
    expect(prisma.liveStream.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', messageCount: { gt: 0 } },
      data: { messageCount: { decrement: 1 } },
    });
  });

  it('a message belonging to another stream is not the host\'s to remove', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    prisma.liveStreamMessage.findUnique.mockResolvedValue({ id: 'm9', streamId: 'other', userId: VIEWER });

    await request(app).delete('/api/livestream/s1/messages/m9').set(as(HOST)).expect(404);
    expect(prisma.liveStreamMessage.delete).not.toHaveBeenCalled();
  });

  it('removing a viewer blocks them and clears what they said', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    prisma.user.findUnique.mockResolvedValue({ id: VIEWER, displayName: 'Sarah' });
    prisma.liveStreamMessage.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);

    await request(app).delete(`/api/livestream/s1/viewers/${VIEWER}`).set(as(VIEWER)).expect(403);
    expect(block).not.toHaveBeenCalled();

    const res = await request(app).delete(`/api/livestream/s1/viewers/${VIEWER}`).set(as(HOST)).expect(200);

    expect(res.body.data).toMatchObject({ removed: VIEWER, messagesRemoved: 2, blocked: true });
    // The block is what makes the removal outlive this broadcast: every join,
    // message and gift is refused on it from here on.
    expect(block).toHaveBeenCalledWith(HOST, VIEWER);
    expect(prisma.liveStreamMessage.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['m1', 'm2'] } } });
    expect(prisma.liveStream.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', messageCount: { gte: 2 } },
      data: { messageCount: { decrement: 2 } },
    });
  });

  // These two hooks carry no authenticate: the caller is a media server, and
  // the shared secret is the whole of their authentication. It used to be
  // skipped entirely when the variable was unset, which is the state every
  // deployment starts in, so anyone who could reach the API could end a live
  // broadcast.
  it('the RTMP hooks are closed when no secret is configured', async () => {
    await request(app).post('/api/livestream/key/validate').send({ key: 'secret-key' }).expect(503);
    await request(app)
      .post('/api/livestream/webhooks/rtmp')
      .send({ key: 'secret-key', event: 'publish_done' })
      .expect(503);
    expect(prisma.liveStream.findUnique).not.toHaveBeenCalled();
  });

  it('the RTMP hook refuses a missing or wrong secret and accepts the right one', async () => {
    process.env.LIVESTREAM_WEBHOOK_SECRET = 'hook-secret';

    await request(app).post('/api/livestream/key/validate').send({ key: 'secret-key' }).expect(401);
    await request(app)
      .post('/api/livestream/key/validate')
      .set('x-livestream-secret', 'not-the-secret')
      .send({ key: 'secret-key' })
      .expect(401);
    expect(prisma.liveStream.findUnique).not.toHaveBeenCalled();

    prisma.liveStream.findUnique.mockResolvedValueOnce({ id: 's1', hostId: HOST, status: 'SCHEDULED' });
    const ok = await request(app)
      .post('/api/livestream/key/validate')
      .set('x-livestream-secret', 'hook-secret')
      .send({ key: 'secret-key' })
      .expect(200);
    expect(ok.body.data).toEqual({ valid: true, streamId: 's1', hostId: HOST });

    prisma.liveStream.findUnique.mockResolvedValueOnce(null);
    await request(app)
      .post('/api/livestream/key/validate')
      .set('x-livestream-secret', 'hook-secret')
      .send({ key: 'nope' })
      .expect(403);
  });
});
