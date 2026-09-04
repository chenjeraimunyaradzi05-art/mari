import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    postSave: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn() },
    // Blocking is symmetric and lives on the safety settings row, so the feed
    // reads it on every authenticated request to filter both directions.
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
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
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const VIEWER = 'user-123';
const OTHER = 'user-999';

function mockPost(overrides: Record<string, unknown> = {}) {
  (prisma.post.findUnique as any).mockResolvedValue({
    id: 'p1',
    authorId: OTHER,
    isHidden: false,
    isPublic: true,
    ...overrides,
  });
}

describe('Post saves', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.postSave.upsert as any).mockResolvedValue({});
    (prisma.postSave.deleteMany as any).mockResolvedValue({ count: 1 });
  });

  it('saves a post idempotently via upsert', async () => {
    mockPost();

    await request(app).post('/api/posts/p1/save').expect(201);

    const call = (prisma.postSave.upsert as any).mock.calls[0][0];
    expect(call.where).toEqual({ postId_userId: { postId: 'p1', userId: VIEWER } });
    expect(call.update).toEqual({});
    expect(call.create).toEqual({ postId: 'p1', userId: VIEWER });
  });

  it('404s for a hidden post rather than revealing it exists', async () => {
    mockPost({ isHidden: true });

    await request(app).post('/api/posts/p1/save').expect(404);
    expect(prisma.postSave.upsert).not.toHaveBeenCalled();
  });

  it("404s for someone else's private post", async () => {
    mockPost({ isPublic: false, authorId: OTHER });

    await request(app).post('/api/posts/p1/save').expect(404);
    expect(prisma.postSave.upsert).not.toHaveBeenCalled();
  });

  it('lets an author save their own private post', async () => {
    mockPost({ isPublic: false, authorId: VIEWER });

    await request(app).post('/api/posts/p1/save').expect(201);
    expect(prisma.postSave.upsert).toHaveBeenCalled();
  });

  it('404s when the post does not exist', async () => {
    (prisma.post.findUnique as any).mockResolvedValue(null);

    await request(app).post('/api/posts/p1/save').expect(404);
  });

  it('unsaving is scoped to the requesting user', async () => {
    await request(app).delete('/api/posts/p1/save').expect(200);

    expect((prisma.postSave.deleteMany as any).mock.calls[0][0].where).toEqual({
      postId: 'p1',
      userId: VIEWER,
    });
  });

  it('GET /me/saved returns the posts, not the join rows', async () => {
    (prisma.postSave.findMany as any).mockResolvedValue([
      { post: { id: 'p1', content: 'hello', author: { id: OTHER } } },
    ]);

    const res = await request(app).get('/api/posts/me/saved').expect(200);

    expect(res.body.data).toMatchObject([
      { id: 'p1', content: 'hello', author: { id: OTHER }, isSaved: true },
    ]);
  });
});

describe('Feed save state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.userSafetySettings.findUnique as any).mockResolvedValue(null);
    (prisma.userSafetySettings.findMany as any).mockResolvedValue([]);
  });

  it('marks which posts the viewer has saved on the following tab', async () => {
    (prisma.follow.findMany as any).mockResolvedValue([{ followingId: OTHER }]);
    (prisma.post.findMany as any).mockResolvedValue([
      { id: 'p1', content: 'a', author: { id: OTHER } },
      { id: 'p2', content: 'b', author: { id: OTHER } },
    ]);
    (prisma.post.count as any).mockResolvedValue(2);
    (prisma.like.findMany as any).mockResolvedValue([{ postId: 'p1' }]);
    (prisma.postSave.findMany as any).mockResolvedValue([{ postId: 'p2' }]);

    const res = await request(app)
      .get('/api/posts/feed?tab=following')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.data[0]).toMatchObject({ id: 'p1', isLiked: true, isSaved: false });
    expect(res.body.data[1]).toMatchObject({ id: 'p2', isLiked: false, isSaved: true });
  });

  it('does not query saves for a signed-out viewer', async () => {
    (prisma.post.findMany as any).mockResolvedValue([]);
    (prisma.post.count as any).mockResolvedValue(0);

    await request(app).get('/api/posts/feed?tab=for-you').expect(200);

    expect(prisma.postSave.findMany).not.toHaveBeenCalled();
  });
});
