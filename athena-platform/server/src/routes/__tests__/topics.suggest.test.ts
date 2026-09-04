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

const prisma: any = prismaTyped;

describe('GET /api/topics/suggest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.post.findMany.mockResolvedValue([
      { content: 'Notes on #leadership and #learning' },
      { content: 'More #leadership' },
      { content: '#Layoffs again' },
    ]);
    prisma.video.findMany.mockResolvedValue([{ description: '#leadership on camera', hashtags: [] }]);
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
});
