import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest } from '@jest/globals';

/**
 * The second door into the report queue is shut.
 *
 * POST /api/ai-algorithms/report wrote a ContentReport as it was sent. The
 * reported user was whoever the caller named, with no check that she wrote the
 * content, so any member could file a report against any other by id; it had no
 * limiter, no reference to quote back, no review deadline, no alert to Trust and
 * Safety and no safety-score update. The report from the report button
 * (POST /api/safety/reports) has all of those, so this route answers 410 and
 * says where to go, and nothing is written.
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
  prisma: { contentReport: { create: jest.fn() } },
}));

import router from '../ai-algorithms.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma } from '../../utils/prisma';

const app = express();
app.use(express.json());
app.use('/api/ai-algorithms', router);
app.use(errorHandler);

describe('POST /api/ai-algorithms/report', () => {
  it('answers 410, names the real report route, and writes nothing', async () => {
    const res = await request(app)
      .post('/api/ai-algorithms/report')
      .send({ contentType: 'PROFILE', contentId: 'c1', reportedUserId: 'someone-else', reason: 'HARASSMENT' })
      .expect(410);

    expect(res.body.message).toMatch(/\/api\/safety\/reports/);
    expect((prisma.contentReport as unknown as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it('answers the same to an empty body, so a stale client is told where to go rather than what it got wrong', async () => {
    await request(app).post('/api/ai-algorithms/report').send({}).expect(410);
  });
});
