import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: {
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    like: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { app } from '../../index';
import { prisma } from '../../utils/prisma';

describe('Posts video feed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/posts/video-feed returns videos + nextCursor', async () => {
    const createdAt1 = new Date('2026-01-10T10:00:00.000Z');
    const createdAt2 = new Date('2026-01-09T10:00:00.000Z');

    // getVideoFeed uses take: limit+1; we provide 3 items for limit=2.
    (prisma.post.findMany as any).mockResolvedValue([
      {
        id: 'p1',
        authorId: 'a1',
        type: 'VIDEO',
        content: 'v1',
        mediaUrls: ['u1'],
        likeCount: 1,
        commentCount: 0,
        shareCount: 0,
        viewCount: 5,
        createdAt: createdAt1,
        author: { id: 'a1', displayName: 'A1', avatar: null, headline: null },
      },
      {
        id: 'p2',
        authorId: 'a2',
        type: 'VIDEO',
        content: 'v2',
        mediaUrls: ['u2'],
        likeCount: 2,
        commentCount: 1,
        shareCount: 0,
        viewCount: 7,
        createdAt: createdAt2,
        author: { id: 'a2', displayName: 'A2', avatar: null, headline: null },
      },
      {
        id: 'p3',
        authorId: 'a3',
        type: 'VIDEO',
        content: 'v3',
        mediaUrls: ['u3'],
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        viewCount: 1,
        createdAt: new Date('2026-01-08T10:00:00.000Z'),
        author: { id: 'a3', displayName: 'A3', avatar: null, headline: null },
      },
    ]);

    (prisma.like.findMany as any).mockResolvedValue([{ postId: 'p2' }]);

    const res = await request(app)
      .get('/api/posts/video-feed?limit=2')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe('p1');
    expect(res.body.data[1].id).toBe('p2');
    expect(res.body.data[1].isLiked).toBe(true);
    expect(res.body.nextCursor).toBe(createdAt2.toISOString());

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'VIDEO' }),
        take: 3,
      })
    );
  });

  it('POST /api/posts/:id/view returns 204 and increments viewCount', async () => {
    (prisma.post.update as any).mockResolvedValue({ id: 'p1' });

    await request(app)
      .post('/api/posts/p1/view')
      .set('x-test-auth', '1')
      .expect(204);

    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { viewCount: { increment: 1 } },
      })
    );
  });

  it('POST /api/posts/:id/view returns 404 when post missing', async () => {
    const err: any = new Error('Record not found');
    err.code = 'P2025';
    (prisma.post.update as any).mockRejectedValue(err);

    const res = await request(app)
      .post('/api/posts/missing/view')
      .set('x-test-auth', '1')
      .expect(404);

    expect(res.body.success).toBe(false);
  });
});
