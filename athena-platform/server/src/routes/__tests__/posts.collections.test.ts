import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []), upsert: jest.fn(), count: jest.fn(async () => 0) },
    savedCollection: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'viewer-1', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('Saved collections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists your folders with counts, covers and the unsorted total', async () => {
    prisma.savedCollection.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Interview prep',
        description: null,
        updatedAt: new Date('2026-09-01'),
        _count: { saves: 3 },
        saves: [{ post: { mediaUrls: [] } }, { post: { mediaUrls: ['https://cdn/a.jpg'] } }],
      },
    ]);
    prisma.postSave.count.mockResolvedValue(5);

    const res = await request(app).get('/api/posts/collections').expect(200);

    expect(res.body.data.unsortedCount).toBe(5);
    expect(res.body.data.collections[0]).toMatchObject({ id: 'c1', name: 'Interview prep', count: 3, cover: 'https://cdn/a.jpg' });
  });

  it('creates a folder, refusing a duplicate name', async () => {
    prisma.savedCollection.findMany.mockResolvedValue([{ id: 'c1', name: 'Interview prep' }]);
    prisma.savedCollection.create.mockResolvedValue({ id: 'c2', name: 'Grants', description: null, updatedAt: new Date() });

    const created = await request(app).post('/api/posts/collections').send({ name: 'Grants' }).expect(201);
    expect(created.body.data).toMatchObject({ id: 'c2', name: 'Grants', count: 0 });
    expect(prisma.savedCollection.create.mock.calls[0][0].data).toEqual({ userId: 'viewer-1', name: 'Grants', description: null });

    await request(app).post('/api/posts/collections').send({ name: 'interview PREP' }).expect(409);
  });

  it('files a save into a folder you own, saving the post first if needed', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'author-1', isHidden: false, isPublic: true });
    prisma.savedCollection.findUnique.mockResolvedValue({ id: 'c1', userId: 'viewer-1' });
    prisma.postSave.upsert.mockResolvedValue({});
    prisma.savedCollection.update.mockResolvedValue({});

    const res = await request(app).patch('/api/posts/p1/save').send({ collectionId: 'c1' }).expect(200);

    expect(res.body.data.collectionId).toBe('c1');
    expect(prisma.postSave.upsert.mock.calls[0][0]).toMatchObject({
      update: { collectionId: 'c1' },
      create: { postId: 'p1', userId: 'viewer-1', collectionId: 'c1' },
    });
  });

  it('will not file into someone else’s folder', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'author-1', isHidden: false, isPublic: true });
    prisma.savedCollection.findUnique.mockResolvedValue({ id: 'c9', userId: 'other' });

    await request(app).patch('/api/posts/p1/save').send({ collectionId: 'c9' }).expect(404);
    expect(prisma.postSave.upsert).not.toHaveBeenCalled();
  });

  it('saved posts can be listed by folder or as the unsorted', async () => {
    prisma.postSave.findMany.mockResolvedValue([]);

    await request(app).get('/api/posts/me/saved?collectionId=c1').expect(200);
    expect(prisma.postSave.findMany.mock.calls[0][0].where).toEqual({ userId: 'viewer-1', collectionId: 'c1' });

    await request(app).get('/api/posts/me/saved?collectionId=none').expect(200);
    expect(prisma.postSave.findMany.mock.calls[1][0].where).toEqual({ userId: 'viewer-1', collectionId: null });
  });

  it('deleting a folder keeps the posts saved', async () => {
    prisma.savedCollection.findUnique.mockResolvedValue({ id: 'c1', userId: 'viewer-1' });
    prisma.savedCollection.delete.mockResolvedValue({});

    const res = await request(app).delete('/api/posts/collections/c1').expect(200);
    expect(res.body.message).toMatch(/still saved/);
  });
});
