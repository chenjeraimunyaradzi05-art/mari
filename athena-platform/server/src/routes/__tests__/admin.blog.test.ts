import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    article: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async () => null),
      count: jest.fn(async () => 0),
      create: jest.fn(),
      update: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'staff', role: req.headers['x-test-role'] || 'ADMIN', email: 'staff@athena.com' };
      next();
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { slugify } from '../admin-blog.routes';

const prisma: any = prismaTyped;

describe('Writing the blog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is for admins only', async () => {
    await request(app).get('/api/admin/blog').set('x-test-role', 'MODERATOR').expect(403);
    await request(app).post('/api/admin/blog').set('x-test-role', 'USER').send({ title: 'Hello', body: 'x' }).expect(403);
  });

  it('a new article is a draft with a slug made from its title', async () => {
    prisma.article.create.mockImplementation(async ({ data }: any) => ({ id: 'a1', ...data }));
    const res = await request(app)
      .post('/api/admin/blog')
      .send({ title: 'Why we built ATHENA in Queensland!', body: '# Hello\n\nWorld', tags: ['Founders', 'founders', 'Queensland Tech', ''] })
      .expect(201);
    expect(res.body.data).toMatchObject({ slug: 'why-we-built-athena-in-queensland', status: 'DRAFT', publishedAt: null, authorId: 'staff', tags: ['founders', 'queensland-tech'] });
  });

  it('a taken slug gets a numeric suffix', async () => {
    prisma.article.findUnique.mockImplementation(async ({ where }: any) => (where.slug === 'launch-notes' ? { id: 'other' } : null));
    prisma.article.create.mockImplementation(async ({ data }: any) => ({ id: 'a2', ...data }));
    const res = await request(app).post('/api/admin/blog').send({ title: 'Launch notes', body: 'x' }).expect(201);
    expect(res.body.data.slug).toBe('launch-notes-2');
  });

  it('publishing stamps the time once; a given time schedules it', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'a1', slug: 'hello', publishedAt: null });
    prisma.article.update.mockImplementation(async ({ data }: any) => ({ id: 'a1', ...data }));
    const published = await request(app).patch('/api/admin/blog/a1').send({ status: 'PUBLISHED' }).expect(200);
    expect(published.body.data.status).toBe('PUBLISHED');
    expect(new Date(published.body.data.publishedAt).getTime()).toBeGreaterThan(0);

    const scheduled = await request(app).patch('/api/admin/blog/a1').send({ status: 'PUBLISHED', publishedAt: '2030-01-01T09:00:00.000Z' }).expect(200);
    expect(scheduled.body.data.publishedAt).toBe('2030-01-01T09:00:00.000Z');
  });

  it('refuses a title that is too short and a status it does not know', async () => {
    await request(app).post('/api/admin/blog').send({ title: 'Hi', body: 'x' }).expect(400);
    await request(app).post('/api/admin/blog').send({ title: 'Hello there', body: 'x', status: 'LIVE' }).expect(400);
  });

  it('slugify keeps to lower-case ASCII and hyphens', () => {
    expect(slugify('  Café & Crème: a Story!  ')).toBe('cafe-creme-a-story');
    expect(slugify('___')).toBe('');
  });
});

describe('Reading the blog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only what is published and already due', async () => {
    prisma.article.findMany.mockResolvedValue([{ id: 'a1', slug: 'hello', title: 'Hello', tags: ['founders'], publishedAt: '2026-09-01T00:00:00.000Z', author: { id: 'staff', firstName: 'A', lastName: 'B' } }]);
    prisma.article.count.mockResolvedValue(1);
    const res = await request(app).get('/api/blog?tag=Founders').expect(200);
    const where = prisma.article.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PUBLISHED');
    expect(where.publishedAt.lte).toBeInstanceOf(Date);
    expect(where.tags).toEqual({ has: 'founders' });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('a draft is not found by the public, and a read of a published piece is counted', async () => {
    prisma.article.findFirst.mockResolvedValue(null);
    await request(app).get('/api/blog/secret-draft').expect(404);

    prisma.article.findFirst.mockResolvedValue({ id: 'a1', slug: 'hello', title: 'Hello', body: '# Hi', status: 'PUBLISHED', author: { id: 'staff' } });
    const res = await request(app).get('/api/blog/hello').expect(200);
    expect(res.body.data.body).toBe('# Hi');
    expect(prisma.article.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { viewCount: { increment: 1 } } });
  });

  it('counts tags across published articles', async () => {
    prisma.article.findMany.mockResolvedValue([{ tags: ['founders', 'money'] }, { tags: ['founders'] }]);
    const res = await request(app).get('/api/blog/tags').expect(200);
    expect(res.body.data).toEqual([
      { tag: 'founders', count: 2 },
      { tag: 'money', count: 1 },
    ]);
  });
});
