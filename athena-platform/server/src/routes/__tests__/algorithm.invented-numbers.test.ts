import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Two /api/algorithms endpoints answered with numbers nothing computed.
 *
 * GET /recommendation-engine-2 scored each row as a constant minus its list
 * position, and — mounted with optionalAuth — gave a signed-out caller the
 * opening of the five most-viewed posts whether or not their authors had made
 * them public. GET /income-stream sent a fixed 55/20/15/10 revenue mix and two
 * scores with hand-picked weights beside a creator's real gift income.
 */

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'creator-1', role: 'USER', email: 'creator@test.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    creatorProfile: { findUnique: jest.fn() },
    giftTransaction: { aggregate: jest.fn() },
    post: { findMany: jest.fn(), count: jest.fn() },
  },
}));

import router from '../algorithm.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma } from '../../utils/prisma';

const app = express();
app.use(express.json());
app.use('/api/algorithms', router);
app.use(errorHandler);

type Mock = jest.Mock<(...args: any[]) => any>;
const db = prisma as unknown as {
  creatorProfile: { findUnique: Mock };
  giftTransaction: { aggregate: Mock };
  post: { findMany: Mock };
};

describe('Endpoints that used to answer with invented numbers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('withdraws the recommendation list, and reads no posts to do it', async () => {
    const res = await request(app).get('/api/algorithms/recommendation-engine-2');

    expect(res.status).toBe(410);
    expect(db.post.findMany).not.toHaveBeenCalled();
  });

  it('sends a creator her real gift income and none of the fixed revenue mix', async () => {
    db.creatorProfile.findUnique.mockResolvedValue({ isMonetized: true, tier: 'Rising', followerCount: 4200, totalEarnings: 0 });
    db.giftTransaction.aggregate.mockResolvedValue({ _sum: { giftValue: 12840 }, _avg: { giftValue: 320 }, _count: 40 });

    const res = await request(app).get('/api/algorithms/income-stream').expect(200);

    expect(res.body.data).toEqual(
      expect.objectContaining({ creatorStatus: 'growing', monthlyEarnings: 128.4, avgGiftValue: 3.2, followerCount: 4200 })
    );
    expect(res.body.data).not.toHaveProperty('channels');
    expect(res.body.data).not.toHaveProperty('revenuePotentialScore');
    expect(res.body.data).not.toHaveProperty('diversificationScore');
  });
});
