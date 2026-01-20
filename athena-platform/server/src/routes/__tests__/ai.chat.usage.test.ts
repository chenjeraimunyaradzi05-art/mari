import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/cache', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true, remaining: 20, resetIn: 86400 })),
  getRateLimitStatus: jest.fn(async () => ({ allowed: true, remaining: 17, resetIn: 86400 })),
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-free-1', role: 'USER', email: 'user@test.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (_role: string) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';
import { getRateLimitStatus } from '../../utils/cache';

describe('AI chat usage endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/ai/chat/usage returns remaining quota for FREE tier', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-free-1',
      subscription: { tier: 'FREE' },
    });

    const res = await request(app).get('/api/ai/chat/usage').expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        tier: 'FREE',
        unlimited: false,
        usage: expect.objectContaining({
          limit: expect.any(Number),
          remaining: 17,
          resetIn: expect.any(Number),
          windowSeconds: expect.any(Number),
        }),
      })
    );

    expect(getRateLimitStatus).toHaveBeenCalledTimes(1);
  });

  it('GET /api/ai/chat/usage returns unlimited for PREMIUM tier', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-free-1',
      subscription: { tier: 'PREMIUM' },
    });

    const res = await request(app).get('/api/ai/chat/usage').expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        tier: 'PREMIUM',
        unlimited: true,
        usage: null,
      })
    );
  });
});
