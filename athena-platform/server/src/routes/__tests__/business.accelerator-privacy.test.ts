import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * GET /api/business/accelerators/:id used to have no `authenticate` and to
 * include every AcceleratorEnrollment row unfiltered — name, avatar,
 * paymentStatus, paymentId, deliverables, mentorNotes — for every woman in the
 * cohort. Cohort ids are enumerable from the unauthenticated list route that
 * the public marketing page calls, so the whole roster was one request away
 * from anyone at all.
 *
 * These two tests are the guard: the route must refuse an anonymous caller,
 * and it must not select enrollments even for a signed-in one.
 */

const cohort = {
  id: 'cohort-1',
  name: 'Autumn cohort',
  maxParticipants: 30,
  sessions: [{ id: 's1', weekNumber: 1, title: 'Week one' }],
  _count: { enrollments: 4 },
};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    acceleratorCohort: {
      findUnique: jest.fn(async () => cohort),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers['x-test-auth'] !== '1') {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    req.user = { id: 'member-1', role: 'USER', email: 'member@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('Accelerator cohort detail keeps the roster private', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses an anonymous caller', async () => {
    await request(app).get('/api/business/accelerators/cohort-1').expect(401);
    expect(prisma.acceleratorCohort.findUnique).not.toHaveBeenCalled();
  });

  it('never asks the database for the enrollment rows', async () => {
    const res = await request(app)
      .get('/api/business/accelerators/cohort-1')
      .set('x-test-auth', '1')
      .expect(200);

    const include = prisma.acceleratorCohort.findUnique.mock.calls[0][0].include;
    expect(include.enrollments).toBeUndefined();
    expect(include._count).toEqual({ select: { enrollments: true } });

    expect(res.body.data.enrollments).toBeUndefined();
    // The count is the only thing the response ever derived from them.
    expect(res.body.data.spotsRemaining).toBe(26);
    expect(res.body.data.enrollmentCount).toBe(4);
  });
});
