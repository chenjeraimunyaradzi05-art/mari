import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    video: { findUnique: jest.fn(), findMany: jest.fn(async () => []), create: jest.fn(), update: jest.fn() },
    videoLike: { findMany: jest.fn(async () => []) },
    videoSave: { findMany: jest.fn(async () => []) },
    audioTrack: { findMany: jest.fn(async () => []), findUnique: jest.fn(), updateMany: jest.fn() },
    follow: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
    // A duet is made only of a reel its maker may be shown: not across a block, in either
    // store, and not one whose author is in Safe Mode or has closed her profile.
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    dvSafetyProfile: {
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    user: { findFirst: jest.fn(async () => null) },
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
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.follow.findUnique.mockResolvedValue(null);
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

  it('refuses a duet of a reel by someone who has blocked its maker, or who has closed her profile to her', async () => {
    const send = () =>
      request(app)
        .post('/api/video')
        .set('x-test-user', 'user-1')
        .send({ videoUrl: 'https://cdn.example.com/reply.mp4', duetOfVideoId: 'orig' });
    prisma.video.findUnique.mockResolvedValue({ id: 'orig', authorId: 'orig-author', status: 'PUBLISHED', isHidden: false });

    // The original's author blocked her.
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'orig-author' }]);
    await send().expect(400);

    // Or her profile is private to everyone but her.
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'private' });
    await send().expect(400);

    // Or she is in Safe Mode and the maker is not a verified connection.
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: 'orig-author' });
    await send().expect(400);

    expect(prisma.video.create).not.toHaveBeenCalled();
    expect(prisma.video.update).not.toHaveBeenCalled();
  });

  it('records the duet on the reply, counts it on the original and keeps the captions', async () => {
    prisma.video.findUnique.mockResolvedValue({ id: 'orig', authorId: 'orig-author', status: 'PUBLISHED', isHidden: false });
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

  it('names the original only if it is published, and by an author the viewer may be shown, blocks included', async () => {
    prisma.video.findMany
      .mockResolvedValueOnce([{ id: 'reply', authorId: 'u', duetOfVideoId: 'orig', audioTrackId: null, author: { id: 'u' } }])
      .mockResolvedValueOnce([]);
    // The viewer blocked 'him'; 'blocked-her' blocked her.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'blocked-her' }]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only'] });

    await request(app).get('/api/video/feed').set('x-test-user', 'viewer-1').expect(200);

    const { where } = prisma.video.findMany.mock.calls[1][0];
    expect(where).toMatchObject({ id: { in: ['orig'] }, status: 'PUBLISHED', isHidden: false });
    expect([...where.authorId.notIn].sort()).toEqual(['blocked-her', 'dv-only', 'him']);
    expect(where.author).toBeDefined();
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
