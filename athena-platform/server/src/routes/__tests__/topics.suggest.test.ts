import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn(async () => []) },
    video: { findMany: jest.fn(async () => []) },
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
import { resetTrendingTopicsCache } from '../topic.routes';

const prisma: any = prismaTyped;

describe('GET /api/topics/suggest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTrendingTopicsCache();
    prisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: 'Notes on #leadership and #learning', createdAt: new Date() },
      { id: 'p2', content: 'More #leadership', createdAt: new Date() },
      { id: 'p3', content: '#Layoffs again', createdAt: new Date() },
    ]);
    prisma.video.findMany.mockResolvedValue([
      { id: 'v1', description: '#leadership on camera', hashtags: [], publishedAt: new Date() },
    ]);
  });

  it('offers topics that start with what was typed, busiest first', async () => {
    const res = await request(app).get('/api/topics/suggest?q=le').expect(200);
    expect(res.body.data.map((t: any) => t.tag)).toEqual(['leadership', 'learning', 'le']);
    expect(res.body.data[0].count).toBeGreaterThanOrEqual(2);
  });

  it('with nothing typed, offers the busiest topics', async () => {
    const res = await request(app).get('/api/topics/suggest').expect(200);
    expect(res.body.data[0].tag).toBe('leadership');
  });

  it('a new topic is offered as itself', async () => {
    const res = await request(app).get('/api/topics/suggest?q=%23Grants').expect(200);
    expect(res.body.data).toEqual([{ tag: 'grants', count: 0 }]);
  });

  it('offers a matching topic however far down the month it ranks', async () => {
    // Sixty busier tags, then the one she is typing. The suggestions used to
    // be drawn from the busiest fifty only, so this one was never offered.
    const busy = Array.from({ length: 60 }, (_, i) => ({ id: `p-${i}`, content: `#busy${i}`, createdAt: new Date() }));
    prisma.post.findMany.mockResolvedValue([...busy, ...busy, { id: 'rare', content: 'First one #quietquitting', createdAt: new Date() }]);
    prisma.video.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/topics/suggest?q=quiet').expect(200);
    expect(res.body.data).toEqual([{ tag: 'quietquitting', count: 1 }, { tag: 'quiet', count: 0 }]);
  });
});
