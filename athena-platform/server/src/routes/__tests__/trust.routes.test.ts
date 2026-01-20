import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    post: {
      count: jest.fn(),
    },
    referral: {
      count: jest.fn(),
    },
    verificationBadge: {
      count: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';

const prismaAny: any = prisma;

describe('Trust Score Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/trust-score returns calculated score', async () => {
    prismaAny.user.findUnique.mockResolvedValue({
      emailVerified: true,
      isSuspended: false,
      profile: { linkedinUrl: 'https://linkedin.com', websiteUrl: null },
    });
    prismaAny.post.count.mockResolvedValue(6);
    prismaAny.referral.count.mockResolvedValue(2);
    prismaAny.verificationBadge.count.mockResolvedValue(1);
    prismaAny.user.update.mockResolvedValue({ trustScore: 72 });

    const response = await request(app).get('/api/trust-score').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.score).toBeGreaterThan(0);
    expect(response.body.data.factors.length).toBeGreaterThan(0);
  });
});
