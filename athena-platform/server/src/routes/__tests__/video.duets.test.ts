import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    video: { findUnique: jest.fn(), findMany: jest.fn(async () => []), create: jest.fn(), update: jest.fn() },
    videoLike: { findMany: jest.fn(async () => []) },
    videoSave: { findMany: jest.fn(async () => []) },
    audioTrack: { findMany: jest.fn(async () => []), findUnique: jest.fn(), updateMany: jest.fn() },
    follow: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'user-1', role: 'USER', email: 'u@athena.com' };
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
import { duetFilter } from '../../services/video-pipeline.service';

const prisma: any = prismaTyped;

describe('Duets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.video.update.mockResolvedValue({});
  });

  it('refuses a duet of a reel nobody could watch', async () => {
    prisma.video.findUnique.mockResolvedValue({ id: 'orig', status: 'PROCESSING', isHidden: false });
    await request(app)
      .post('/api/video')
      .set('x-test-user', 'user-1')
      .send({ videoUrl: 'https://cdn.example.com/reply.mp4', duetOfVideoId: 'orig' })
      .expect(400);

    prisma.video.findUnique.mockResolvedValue(null);
    await request(app)
      .post('/api/video')
      .set('x-test-user', 'user-1')
      .send({ videoUrl: 'https://cdn.example.com/reply.mp4', duetOfVideoId: 'missing' })
      .expect(400);
    expect(prisma.video.create).not.toHaveBeenCalled();
  });

  it('records the duet on the reply, counts it on the original and keeps the captions', async () => {
    prisma.video.findUnique.mockResolvedValue({ id: 'orig', status: 'PUBLISHED', isHidden: false });
    prisma.video.create.mockImplementation(async ({ data }: any) => ({ id: 'reply', ...data }));

    const res = await request(app)
      .post('/api/video')
      .set('x-test-user', 'user-1')
      .send({
        videoUrl: 'https://cdn.example.com/reply.mp4',
        duetOfVideoId: 'orig',
        captionsUrl: 'https://cdn.example.com/reply.vtt',
        title: 'My take',
      })
      .expect(201);

    expect(res.body.data).toMatchObject({ duetOfVideoId: 'orig', captionsUrl: 'https://cdn.example.com/reply.vtt' });
    expect(prisma.video.update).toHaveBeenCalledWith({ where: { id: 'orig' }, data: { duetCount: { increment: 1 } } });
  });

  it('the feed tells a duet who it answers, without the key fields of the original', async () => {
    prisma.video.findMany
      .mockResolvedValueOnce([
        { id: 'reply', authorId: 'u', duetOfVideoId: 'orig', audioTrackId: null, author: { id: 'u' } },
        { id: 'plain', authorId: 'u', duetOfVideoId: null, audioTrackId: null, author: { id: 'u' } },
      ])
      .mockResolvedValueOnce([{ id: 'orig', title: 'The original', thumbnailUrl: null, author: { id: 'o', displayName: 'Mei C.' } }]);

    const res = await request(app).get('/api/video/feed').expect(200);

    expect(res.body.data[0].duetOf).toEqual({ id: 'orig', title: 'The original', thumbnailUrl: null, author: { id: 'o', displayName: 'Mei C.' } });
    expect(res.body.data[1].duetOf).toBeNull();
  });
});

describe('duetFilter', () => {
  it('stacks the reply left of the original and mixes both soundtracks when both exist', () => {
    const { filter, maps } = duetFilter(true, true);
    expect(filter).toContain('[l][r]hstack=inputs=2[v]');
    expect(filter).toContain('[0:a][1:a]amix=inputs=2');
    expect(maps).toEqual(['-map', '[v]', '-map', '[a]']);
  });

  it('keeps whichever soundtrack exists, or none', () => {
    expect(duetFilter(true, false).maps).toEqual(['-map', '[v]', '-map', '0:a']);
    expect(duetFilter(false, true).maps).toEqual(['-map', '[v]', '-map', '1:a']);
    expect(duetFilter(false, false).maps).toEqual(['-map', '[v]']);
    expect(duetFilter(false, false).filter).not.toContain('amix');
  });
});
