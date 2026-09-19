import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
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
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';

const prismaAny: any = prisma;

/**
 * /salary-insights quotes this median beside member-reported pay, so it must
 * not be a "median" of one employer's range. Three listings with a published
 * range is the floor; below it the route says so instead of guessing.
 */
describe('Advertised-range median floor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.user.findUnique.mockResolvedValue({
      currentJobTitle: 'Designer',
      profile: { salaryMin: 90000, salaryMax: 90000 },
    });
  });

  it('reports no median from two listings, however clean they look', async () => {
    prismaAny.job.findMany.mockResolvedValue([
      { salaryMin: 80000, salaryMax: 100000 },
      { salaryMin: 90000, salaryMax: 110000 },
    ]);

    const response = await request(app).get('/api/algorithms/salary-equity').expect(200);

    expect(response.body.data.marketMedian).toBeNull();
    expect(response.body.data.status).toBe('insufficient_data');
    expect(response.body.data.gap).toBeNull();
    expect(response.body.data.sampleSize).toBe(2);
  });

  it('counts only listings that publish a range towards the floor', async () => {
    prismaAny.job.findMany.mockResolvedValue([
      { salaryMin: 80000, salaryMax: 100000 },
      { salaryMin: 90000, salaryMax: 110000 },
      { salaryMin: null, salaryMax: null },
      { salaryMin: null, salaryMax: null },
    ]);

    const response = await request(app).get('/api/algorithms/salary-equity').expect(200);

    expect(response.body.data.marketMedian).toBeNull();
    expect(response.body.data.sampleSize).toBe(2);
  });

  it('reports the median once three listings publish a range', async () => {
    prismaAny.job.findMany.mockResolvedValue([
      { salaryMin: 80000, salaryMax: 100000 },
      { salaryMin: 90000, salaryMax: 110000 },
      { salaryMin: 100000, salaryMax: null },
    ]);

    const response = await request(app).get('/api/algorithms/salary-equity').expect(200);

    expect(response.body.data.sampleSize).toBe(3);
    expect(response.body.data.marketMedian).toBe(100000);
    // Her profile target sits 10,000 under the advertised median.
    expect(response.body.data.status).toBe('below');
    expect(response.body.data.gap).toBe(-10000);
  });

  it('looks up the title asked for, not the one on her profile', async () => {
    prismaAny.job.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/algorithms/salary-equity?targetRole=Product%20designer')
      .expect(200);

    expect(response.body.data.targetRole).toBe('Product designer');
    expect(prismaAny.job.findMany.mock.calls[0][0].where.title.contains).toBe('Product designer');
    expect(response.body.data.status).toBe('insufficient_data');
  });
});
