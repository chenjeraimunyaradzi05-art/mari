import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    status: { findMany: jest.fn(async () => []) },
    storyHighlight: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      count: jest.fn(async () => 0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    storyHighlightItem: { create: jest.fn(), delete: jest.fn() },
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'me', role: 'USER', email: 'u@athena.com' };
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

const prisma: any = prismaTyped;

const story = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  userId: 'me',
  type: 'IMAGE',
  mediaUrl: `https://cdn/${id}.jpg`,
  caption: null,
  viewCount: 3,
  createdAt: new Date('2026-08-01T10:00:00Z'),
  expiresAt: new Date('2026-08-02T10:00:00Z'),
  ...overrides,
});

const highlight = (overrides: Record<string, unknown> = {}) => ({
  id: 'h1',
  userId: 'me',
  title: 'Launch week',
  coverUrl: null,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    { id: 'i1', statusId: 's1', type: 'VIDEO', mediaUrl: 'https://cdn/s1.mp4', caption: null, takenAt: new Date('2026-08-01T10:00:00Z'), position: 0 },
    { id: 'i2', statusId: 's2', type: 'IMAGE', mediaUrl: 'https://cdn/s2.jpg', caption: 'Day two', takenAt: new Date('2026-08-02T10:00:00Z'), position: 1 },
  ],
  ...overrides,
});

describe('Story highlights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('the archive lists your past stories and says which have expired', async () => {
    prisma.status.findMany.mockResolvedValue([story('s1')]);

    const res = await request(app).get('/api/status/highlights/archive').expect(200);

    expect(res.body.data[0]).toMatchObject({ id: 's1', type: 'image', expired: true, viewCount: 3 });
    expect(prisma.status.findMany.mock.calls[0][0].where).toEqual({ userId: 'me' });
  });

  it('creates a highlight from your own stories, in the order picked', async () => {
    prisma.status.findMany.mockResolvedValue([story('s1'), story('s2', { type: 'VIDEO', mediaUrl: 'https://cdn/s2.mp4' })]);
    prisma.storyHighlight.count.mockResolvedValue(1);
    prisma.storyHighlight.create.mockResolvedValue(highlight());

    const res = await request(app)
      .post('/api/status/highlights')
      .send({ title: 'Launch week', statusIds: ['s2', 's1', 'not-mine'] })
      .expect(201);

    const data = prisma.storyHighlight.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'me', title: 'Launch week', position: 1 });
    expect(data.items.create.map((i: any) => [i.statusId, i.position])).toEqual([
      ['s2', 0],
      ['s1', 1],
    ]);
    // The cover falls back to the first image when none was chosen.
    expect(res.body.data).toMatchObject({ id: 'h1', title: 'Launch week', itemCount: 2, coverUrl: 'https://cdn/s2.jpg' });
    expect(res.body.data.items[1]).toMatchObject({ id: 'i2', type: 'image', caption: 'Day two' });
  });

  it('refuses an empty highlight', async () => {
    prisma.status.findMany.mockResolvedValue([]);
    await request(app).post('/api/status/highlights').send({ title: 'Empty', statusIds: ['x'] }).expect(400);
  });

  it('anyone can see a profile’s highlights, unless blocked', async () => {
    prisma.storyHighlight.findMany.mockResolvedValue([highlight()]);

    const res = await request(app).get('/api/status/highlights/user/me').expect(200);
    expect(res.body.data[0].items).toHaveLength(2);

    prisma.userSafetySettings.findMany.mockResolvedValueOnce([{ userId: 'other', blockedUserIds: ['me'] }]);
    const blocked = await request(app).get('/api/status/highlights/user/me').set('x-test-user', 'other').expect(200);
    expect(blocked.body.data).toEqual([]);
  });

  it('adds a story to a highlight once and removes an item', async () => {
    prisma.storyHighlight.findUnique.mockResolvedValue(highlight());
    prisma.status.findMany.mockResolvedValue([story('s3')]);
    prisma.storyHighlightItem.create.mockResolvedValue({});

    await request(app).post('/api/status/highlights/h1/items').send({ statusId: 's3' }).expect(201);
    expect(prisma.storyHighlightItem.create.mock.calls[0][0].data).toMatchObject({ highlightId: 'h1', statusId: 's3', position: 2 });

    const again = await request(app).post('/api/status/highlights/h1/items').send({ statusId: 's1' }).expect(200);
    expect(again.body.message).toBe('Already in this highlight');

    prisma.storyHighlightItem.delete.mockResolvedValue({});
    await request(app).delete('/api/status/highlights/h1/items/i2').expect(200);
    expect(prisma.storyHighlightItem.delete.mock.calls[0][0]).toEqual({ where: { id: 'i2' } });
  });

  it('only the owner edits or deletes a highlight', async () => {
    prisma.storyHighlight.findUnique.mockResolvedValue(highlight({ userId: 'someone-else' }));
    await request(app).patch('/api/status/highlights/h1').send({ title: 'Mine now' }).expect(404);
    await request(app).delete('/api/status/highlights/h1').expect(404);
  });
});
