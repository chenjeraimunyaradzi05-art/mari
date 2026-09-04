import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    liveStream: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    liveStreamMessage: { create: jest.fn(), findMany: jest.fn() },
    follow: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    notification: { createMany: jest.fn(async () => ({ count: 0 })), create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    giftTransaction: { create: jest.fn(), groupBy: jest.fn(async () => []) },
    creatorProfile: { updateMany: jest.fn(async () => ({ count: 1 })) },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  },
}));

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

const prisma: any = prismaTyped;
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

    prisma.user.findUnique.mockResolvedValue({ id: VIEWER, displayName: 'Sarah', giftBalance: 50 });
    prisma.giftTransaction.create.mockResolvedValue({ id: 'g1', createdAt: new Date() });
    prisma.liveStream.update.mockResolvedValue({ totalGiftPoints: 5 });
    prisma.user.update.mockResolvedValue({});

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

  it('the host cannot gift their own stream', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(streamRow({ status: 'LIVE' }));
    await request(app).post('/api/livestream/s1/gift').set(as(HOST)).send({ giftType: 'star' }).expect(400);
  });

  it('chat is refused on a stream that is not live', async () => {
    prisma.liveStream.findUnique.mockResolvedValue({ id: 's1', status: 'ENDED', hostId: HOST });
    await request(app).post('/api/livestream/s1/messages').set(as(VIEWER)).send({ content: 'hi' }).expect(409);
  });

  it('the RTMP hook accepts a key for an unended stream and rejects unknown ones', async () => {
    prisma.liveStream.findUnique.mockResolvedValueOnce({ id: 's1', hostId: HOST, status: 'SCHEDULED' });
    const ok = await request(app).post('/api/livestream/key/validate').send({ key: 'secret-key' }).expect(200);
    expect(ok.body.data).toEqual({ valid: true, streamId: 's1', hostId: HOST });

    prisma.liveStream.findUnique.mockResolvedValueOnce(null);
    await request(app).post('/api/livestream/key/validate').send({ key: 'nope' }).expect(403);
  });
});
