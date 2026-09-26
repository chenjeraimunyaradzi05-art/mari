/**
 * GET /api/feed and GET /api/feed/opportunities are retired.
 *
 * Both served a mix that stamped every recent job with a 70% "match" and
 * every course with 60 when nothing had matched anything to anyone, and
 * neither passed the viewer's blocks to the feed underneath. They answer 410
 * with a pointer to the feeds that are real, and they read nothing on the
 * way: a retired route that still ran its query would still be serving it.
 */

import request from 'supertest';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    job: { findMany: jest.fn(async () => []) },
    course: { findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'me', role: 'USER', email: 'me@athena.com' };
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

describe('the retired mixed feed', () => {
  it.each(['/api/feed', '/api/feed/opportunities'])('%s answers 410 and points at the real feeds', async (path) => {
    const res = await request(app).get(path).expect(410);

    expect(res.body).toMatchObject({ success: false, deprecated: true });
    expect(res.body.message).toContain('/api/posts/feed');
    expect(res.body.message).toContain('/api/ai-algorithms');
    expect(res.body.data).toBeUndefined();
    expect(prisma.job.findMany).not.toHaveBeenCalled();
    expect(prisma.course.findMany).not.toHaveBeenCalled();
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });
});
