import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    audioTrack: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    video: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    videoLike: { findMany: jest.fn(async () => []) },
    videoSave: { findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'user-1', role: 'USER', email: 'u@athena.com' };
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

const track = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Sound ${id}`,
  artist: null,
  audioUrl: `https://cdn.example.com/${id}.m4a`,
  duration: 30,
  coverUrl: null,
  isOriginal: false,
  useCount: 0,
  sourceVideoId: null,
  ...overrides,
});

describe('Sounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.video.findMany.mockResolvedValue([]);
  });

  it('ranks trending sounds by how many reels used them this week', async () => {
    prisma.video.groupBy.mockResolvedValue([
      { audioTrackId: 'a', _count: { _all: 7 } },
      { audioTrackId: 'b', _count: { _all: 3 } },
    ]);
    prisma.audioTrack.findMany
      .mockResolvedValueOnce([track('b'), track('a')])
      .mockResolvedValueOnce([track('c', { useCount: 40 })]);
    prisma.video.findMany.mockResolvedValue([
      { id: 'v1', thumbnailUrl: 't1', audioTrackId: 'a' },
      { id: 'v2', thumbnailUrl: 't2', audioTrackId: 'a' },
    ]);

    const res = await request(app).get('/api/sounds/trending?period=week&limit=3').expect(200);

    const where = prisma.video.groupBy.mock.calls[0][0].where;
    expect(where.status).toBe('PUBLISHED');
    expect(where.publishedAt.gte).toBeInstanceOf(Date);

    expect(res.body.data.map((s: any) => s.id)).toEqual(['c', 'a', 'b']);
    expect(res.body.data[1].videoCount).toBe(7);
    expect(res.body.data[1].recentVideos).toHaveLength(2);
    // An all-time favourite topping up a quiet week keeps its lifetime count.
    expect(res.body.data[0].videoCount).toBe(40);
  });

  it('lifts a reel into an original sound once, then returns the same one', async () => {
    prisma.video.findUnique.mockResolvedValue({
      id: 'v9',
      authorId: 'user-2',
      status: 'PUBLISHED',
      isHidden: false,
      videoUrl: 'https://cdn.example.com/v9.mp4',
      duration: 14,
      thumbnailUrl: 't9',
      audioTrackId: null,
      author: { displayName: 'Mei C.', firstName: 'Mei', lastName: 'Chen' },
    });
    prisma.audioTrack.findUnique.mockResolvedValueOnce(null);
    prisma.audioTrack.create.mockImplementation(async ({ data }: any) => ({ ...track('new'), ...data, id: 'new' }));
    prisma.video.update.mockResolvedValue({});

    const first = await request(app).post('/api/sounds/from-video/v9').set('x-test-user', 'user-1').expect(201);
    expect(first.body.data).toMatchObject({
      id: 'new',
      title: 'Original sound - Mei C.',
      isOriginal: true,
      sourceVideoId: 'v9',
      audioUrl: 'https://cdn.example.com/v9.mp4',
    });
    expect(prisma.video.update).toHaveBeenCalledWith({ where: { id: 'v9' }, data: { audioTrackId: 'new' } });

    prisma.audioTrack.findUnique.mockResolvedValueOnce(track('new', { isOriginal: true, sourceVideoId: 'v9' }));
    const second = await request(app).post('/api/sounds/from-video/v9').set('x-test-user', 'user-1').expect(201);
    expect(second.body.data.id).toBe('new');
    expect(prisma.audioTrack.create).toHaveBeenCalledTimes(1);
  });

  it('a reel that already plays a sound hands that sound back', async () => {
    prisma.video.findUnique.mockResolvedValue({
      id: 'v3',
      authorId: 'user-2',
      status: 'PUBLISHED',
      isHidden: false,
      videoUrl: 'u',
      duration: 10,
      thumbnailUrl: null,
      audioTrackId: 'chosen',
      author: { displayName: 'Mei', firstName: null, lastName: null },
    });
    prisma.audioTrack.findUnique.mockResolvedValueOnce(track('chosen'));

    const res = await request(app).post('/api/sounds/from-video/v3').set('x-test-user', 'user-1').expect(201);
    expect(res.body.data.id).toBe('chosen');
    expect(prisma.audioTrack.create).not.toHaveBeenCalled();
  });

  it('the reel feed can be sliced to one sound and carries each reel its sound', async () => {
    prisma.video.findMany.mockResolvedValue([
      { id: 'v1', authorId: 'u', audioTrackId: 'a', author: { id: 'u' } },
      { id: 'v2', authorId: 'u', audioTrackId: null, author: { id: 'u' } },
    ]);
    prisma.audioTrack.findMany.mockResolvedValue([track('a', { title: 'Morning run' })]);

    const res = await request(app).get('/api/video/feed?sound=a').expect(200);

    expect(prisma.video.findMany.mock.calls[0][0].where.audioTrackId).toBe('a');
    expect(res.body.data[0].sound).toMatchObject({ id: 'a', title: 'Morning run' });
    expect(res.body.data[1].sound).toBeNull();
  });

  it('publishing a reel with a sound checks it exists and counts the use', async () => {
    prisma.audioTrack.findUnique.mockResolvedValueOnce(null);
    await request(app)
      .post('/api/video')
      .set('x-test-user', 'user-1')
      .send({ videoUrl: 'https://cdn.example.com/x.mp4', audioTrackId: 'missing' })
      .expect(400);

    prisma.audioTrack.findUnique.mockResolvedValueOnce({ id: 'a', isHidden: false });
    prisma.video.create.mockResolvedValue({ id: 'v1', status: 'PROCESSING' });
    prisma.video.update.mockResolvedValue({});
    prisma.audioTrack.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/video')
      .set('x-test-user', 'user-1')
      .send({ videoUrl: 'https://cdn.example.com/x.mp4', audioTrackId: 'a', title: 'Run' })
      .expect(201);

    expect(res.body.data.status).toBe('PROCESSING');
    expect(prisma.video.create.mock.calls[0][0].data).toMatchObject({ status: 'PROCESSING', audioTrackId: 'a' });
    expect(prisma.audioTrack.updateMany).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { useCount: { increment: 1 } },
    });
  });
});
