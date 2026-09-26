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

  // This used to assert `unlimited: true` and `usage: null` for a paying
  // member. It was never true — the per-minute limiter always applied — and it
  // is now deliberately false: Premium buys a larger daily window, not none.
  it('GET /api/ai/chat/usage reports the premium window for an active PREMIUM tier', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-free-1',
      subscription: { tier: 'PREMIUM_CAREER', status: 'ACTIVE' },
    });

    const res = await request(app).get('/api/ai/chat/usage').expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        tier: 'PREMIUM_CAREER',
        premium: true,
        unlimited: false,
        premiumLimit: null,
        usage: expect.objectContaining({ limit: 200, windowSeconds: 86400 }),
      })
    );
    expect(getRateLimitStatus).toHaveBeenCalledWith('ai:chat:user-free-1', 200, 86400);
  });

  it('holds a lapsed Premium subscription to the free window', async () => {
    // A tier that still names Premium on a subscription that is past due is
    // not a paying member, which is the rule the premium routes apply.
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-free-1',
      subscription: { tier: 'PREMIUM_CAREER', status: 'PAST_DUE' },
    });

    const res = await request(app).get('/api/ai/chat/usage').expect(200);

    expect(res.body.data).toEqual(
      expect.objectContaining({ premium: false, premiumLimit: 200, usage: expect.objectContaining({ limit: 20 }) })
    );
  });
});
