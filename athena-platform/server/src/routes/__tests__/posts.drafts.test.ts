import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    postDraft: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      count: jest.fn(async () => 0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'me', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'd1',
  userId: 'me',
  kind: 'TEXT',
  content: 'Half a thought',
  mediaUrls: [],
  mediaAlt: [],
  poll: null,
  isPublic: true,
  isSensitive: false,
  updatedAt: new Date('2026-09-05T10:00:00Z'),
  ...overrides,
});

describe('Post drafts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a draft from what was typed', async () => {
    prisma.postDraft.create.mockResolvedValue(row());

    const res = await request(app).put('/api/posts/me/drafts').send({ kind: 'TEXT', content: 'Half a thought' }).expect(201);

    expect(res.body.data).toMatchObject({ id: 'd1', content: 'Half a thought', kind: 'TEXT' });
    expect(prisma.postDraft.create.mock.calls[0][0].data).toMatchObject({ userId: 'me', content: 'Half a thought', isPublic: true });
  });

  it('updates a draft by id, and deletes it once it is empty', async () => {
    prisma.postDraft.findUnique.mockResolvedValue({ userId: 'me' });
    prisma.postDraft.update.mockResolvedValue(row({ content: 'A fuller thought' }));

    const updated = await request(app).put('/api/posts/me/drafts').send({ id: 'd1', kind: 'TEXT', content: 'A fuller thought' }).expect(200);
    expect(updated.body.data.content).toBe('A fuller thought');

    prisma.postDraft.delete.mockResolvedValue({});
    const cleared = await request(app).put('/api/posts/me/drafts').send({ id: 'd1', kind: 'TEXT', content: '   ' }).expect(200);
    expect(cleared.body.data).toBeNull();
    expect(prisma.postDraft.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });

  it('never touches someone else’s draft', async () => {
    prisma.postDraft.findUnique.mockResolvedValue({ userId: 'other' });
    await request(app).put('/api/posts/me/drafts').send({ id: 'd9', kind: 'TEXT', content: 'x' }).expect(404);
  });

  it('an empty new draft is not kept', async () => {
    const res = await request(app).put('/api/posts/me/drafts').send({ kind: 'TEXT', content: '' }).expect(200);
    expect(res.body.data).toBeNull();
    expect(prisma.postDraft.create).not.toHaveBeenCalled();
  });

  it('lists and discards drafts', async () => {
    prisma.postDraft.findMany.mockResolvedValue([row(), row({ id: 'd2', kind: 'POLL', poll: { options: ['a', 'b'], durationHours: 24 } })]);
    const list = await request(app).get('/api/posts/me/drafts').expect(200);
    expect(list.body.data.map((d: any) => d.id)).toEqual(['d1', 'd2']);
    expect(list.body.data[1].poll).toEqual({ options: ['a', 'b'], durationHours: 24 });

    await request(app).delete('/api/posts/me/drafts/d1').expect(200);
    expect(prisma.postDraft.deleteMany).toHaveBeenCalledWith({ where: { id: 'd1', userId: 'me' } });
  });
});
