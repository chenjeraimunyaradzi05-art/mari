import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The crowd-sourced salary pool, which every woman searching a role is shown.
 *
 * Two things were wrong with it after validation was added. One account could
 * still add about six hundred plausible points an hour and move the median for
 * everyone, because nothing limited a member rather than a minute. And with the
 * five-point floor, p10 to p90 were salaries[0] to salaries[4] — the published
 * "band" was every contributor's exact pay, on a page that told her other
 * members never see her row. These are the guards on both.
 */

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'member@test.com' };
    next();
  },
}));

jest.mock('../../middleware/rateLimiter', () => ({
  aiLimiter: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/creator.service', () => ({
  creatorTierStanding: jest.fn(),
  refreshCreatorAnalytics: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    salaryDataPoint: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    salaryAnalysis: { create: jest.fn() },
    userFeedPreferences: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findMany: jest.fn() },
  },
}));

import router, { onePerContributor, publishablePercentile } from '../ai-algorithms.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma } from '../../utils/prisma';

const app = express();
app.use(express.json());
app.use('/api/ai-algorithms', router);
app.use(errorHandler);

type Mock = jest.Mock<(...args: any[]) => any>;
const points = prisma.salaryDataPoint as unknown as Record<'findFirst' | 'findMany' | 'count' | 'create' | 'update', Mock>;
const analyses = prisma.salaryAnalysis as unknown as { create: Mock };
const feedPrefs = prisma.userFeedPreferences as unknown as Record<'findUnique' | 'create' | 'upsert' | 'updateMany', Mock>;

const submit = (body: Record<string, unknown>) =>
  request(app).post('/api/ai-algorithms/salary-equity/submit').send(body);

/** n distinct contributors, each with one salary, `step` apart from `start`. */
const contributors = (n: number, start = 80_000, step = 1_000, gender: string | null = null) =>
  Array.from({ length: n }, (_, i) => ({
    userId: `${gender ?? 'person'}-${i}`,
    submittedAt: new Date('2026-09-01T00:00:00Z'),
    baseSalary: start + i * step,
    gender,
  }));

describe('Salary pool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    analyses.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'analysis-1', ...args.data }));
  });

  describe('POST /salary-equity/submit', () => {
    it('replaces her earlier figure for a role instead of adding a second point', async () => {
      points.findFirst.mockResolvedValue({ id: 'point-1' });

      const res = await submit({ jobTitle: 'Data Analyst', baseSalary: 95000 }).expect(200);

      expect(res.body.data).toEqual({ id: 'point-1', replaced: true });
      expect(points.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'point-1' }, data: expect.objectContaining({ baseSalary: 95000 }) })
      );
      expect(points.create).not.toHaveBeenCalled();
    });

    it('stops one account adding pay for more than five roles in a year', async () => {
      points.findFirst.mockResolvedValue(null);
      points.count.mockResolvedValue(5);

      const res = await submit({ jobTitle: 'Chief Executive', baseSalary: 4_900_000 });

      expect(res.status).toBe(429);
      expect(points.create).not.toHaveBeenCalled();
    });

    it('adds a first figure for a new role, keyed to her', async () => {
      points.findFirst.mockResolvedValue(null);
      points.count.mockResolvedValue(1);
      points.create.mockResolvedValue({ id: 'point-2' });

      const res = await submit({ jobTitle: 'Data Analyst', baseSalary: '95000', bonus: 5000 }).expect(200);

      expect(res.body.data).toEqual({ id: 'point-2', replaced: false });
      expect(points.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'member-1', normalizedTitle: 'data analyst', totalComp: 100000 }),
      });
    });
  });

  describe('GET /salary-equity/analyze', () => {
    const analyse = () => request(app).get('/api/ai-algorithms/salary-equity/analyze').query({ role: 'analyst' });

    it('publishes nothing at five contributors, where each percentile was somebody’s pay', async () => {
      points.findMany.mockResolvedValue(contributors(5));

      const res = await analyse().expect(200);

      expect(res.body.data).toBeNull();
      expect(analyses.create).not.toHaveBeenCalled();
    });

    it('counts one figure per contributor, however many rows an account left behind', async () => {
      // Nine people plus one account with six copies of an outlier: nine
      // contributors, one short of the floor, however many rows there are.
      const flood = Array.from({ length: 6 }, (_, i) => ({
        userId: 'flooder',
        submittedAt: new Date(`2026-09-0${i + 1}T00:00:00Z`),
        baseSalary: 4_900_000,
        gender: null,
      }));
      points.findMany.mockResolvedValue([...contributors(8), ...flood]);

      const res = await analyse().expect(200);

      expect(res.body.data).toBeNull();
      expect(res.body.sampleSize).toBe(9);
    });

    it('at ten contributors shows a rounded median and withholds the band', async () => {
      points.findMany.mockResolvedValue(contributors(10, 80_250, 1_000));

      const res = await analyse().expect(200);
      const bands = res.body.data.salaryBands;

      expect(bands.p50).toBe(85_000);
      expect(bands.p10).toBeNull();
      expect(bands.p25).toBeNull();
      expect(bands.p75).toBeNull();
      expect(bands.p90).toBeNull();
      expect(res.body.bandWithheld).toMatch(/20 members/);
      // No published figure is anyone's exact pay: every contributor's salary
      // ends in 250 and every published figure is a round thousand.
      const salaries = contributors(10, 80_250, 1_000).map((c) => c.baseSalary);
      expect(salaries).not.toContain(bands.p50);
    });

    it('opens the quartiles at twenty and the deciles at fifty', async () => {
      points.findMany.mockResolvedValue(contributors(20));
      let bands = (await analyse().expect(200)).body.data.salaryBands;
      expect(bands.p25).not.toBeNull();
      expect(bands.p75).not.toBeNull();
      expect(bands.p10).toBeNull();

      points.findMany.mockResolvedValue(contributors(50));
      bands = (await analyse().expect(200)).body.data.salaryBands;
      expect(bands.p10).not.toBeNull();
      expect(bands.p90).not.toBeNull();
    });

    it('withholds a gender gap until ten women and ten men have reported', async () => {
      points.findMany.mockResolvedValue([...contributors(9, 70_000, 1_000, 'WOMAN'), ...contributors(12, 90_000, 1_000, 'MAN')]);

      const res = await analyse().expect(200);

      expect(res.body.data.genderGapAmount).toBeNull();
      expect(res.body.genderGapWithheld).toMatch(/10 women and 10 men/);
    });

    it('publishes the gap from rounded medians once both sides clear the floor', async () => {
      points.findMany.mockResolvedValue([...contributors(10, 70_000, 1_000, 'WOMAN'), ...contributors(10, 90_000, 1_000, 'MAN')]);

      const res = await analyse().expect(200);

      // Medians of 74,500 and 94,500 publish as 75,000 and 95,000.
      expect(Number(res.body.data.genderGapAmount)).toBe(20_000);
    });
  });

  describe('publishablePercentile and onePerContributor', () => {
    it('refuses a cut point with fewer than five contributors on either side', () => {
      const sorted = Array.from({ length: 19 }, (_, i) => 100_000 + i);
      expect(publishablePercentile(sorted, 0.25)).toBeNull();
      expect(publishablePercentile(sorted, 0.5)).toBe(100_000);
    });

    it('keeps each account’s latest figure and every unattributed row', () => {
      const rows = [
        { userId: 'a', submittedAt: new Date('2026-01-01'), baseSalary: 1 },
        { userId: 'a', submittedAt: new Date('2026-06-01'), baseSalary: 2 },
        { userId: null, submittedAt: new Date('2025-01-01'), baseSalary: 3 },
        { userId: null, submittedAt: new Date('2025-01-01'), baseSalary: 4 },
      ];
      expect(onePerContributor(rows).map((r) => r.baseSalary).sort()).toEqual([2, 3, 4]);
    });
  });

  describe('feed preferences', () => {
    it('no longer records searches', async () => {
      const res = await request(app).post('/api/ai-algorithms/feed-preferences/search').send({ query: 'refuge near me' });

      expect(res.status).toBe(410);
      expect(feedPrefs.upsert).not.toHaveBeenCalled();
    });

    it('clears the search history that was kept before', async () => {
      await request(app).delete('/api/ai-algorithms/feed-preferences/search').expect(200);

      expect(feedPrefs.updateMany).toHaveBeenCalledWith({ where: { userId: 'member-1' }, data: { searchHistory: [] } });
    });

    it('does not return the search history or the two unread ratios', async () => {
      feedPrefs.findUnique.mockResolvedValue({
        id: 'prefs-1',
        userId: 'member-1',
        followedCategories: [],
        followedHashtags: [],
        blockedHashtags: [],
        blockedCreators: [],
        searchHistory: ['refuge near me'],
        inNetworkRatio: 0.3,
        outNetworkRatio: 0.5,
        trendingRatio: 0.2,
      });

      const res = await request(app).get('/api/ai-algorithms/feed-preferences').expect(200);

      expect(res.body.data).not.toHaveProperty('searchHistory');
      expect(res.body.data).not.toHaveProperty('outNetworkRatio');
      expect(res.body.data).not.toHaveProperty('trendingRatio');
      expect(res.body.data.inNetworkRatio).toBe(0.3);
    });

    it('stores only the ratio the feed reads, clamped', async () => {
      feedPrefs.upsert.mockImplementation(async (args: { update: Record<string, unknown> }) => ({
        searchHistory: [],
        outNetworkRatio: 0.5,
        trendingRatio: 0.2,
        ...args.update,
      }));

      await request(app)
        .patch('/api/ai-algorithms/feed-preferences')
        .send({ inNetworkRatio: 5, outNetworkRatio: 'lots', trendingRatio: -3 })
        .expect(200);

      const update = feedPrefs.upsert.mock.calls[0][0].update;
      expect(update).toEqual({ inNetworkRatio: 0.9 });
    });
  });

  describe('withdrawn placeholder routes', () => {
    it.each([
      ['get', '/api/ai-algorithms/opportunity-scan'],
      ['patch', '/api/ai-algorithms/opportunity-scan/abc/view'],
      ['get', '/api/ai-algorithms/mentor-match'],
      ['get', '/api/ai-algorithms/trust-score/someone-else'],
    ])('%s %s answers 410 and points at the real feature', async (method, path) => {
      const res = await (request(app) as any)[method](path);

      expect(res.status).toBe(410);
      expect(res.body.message).toMatch(/\/api\//);
    });
  });
});
