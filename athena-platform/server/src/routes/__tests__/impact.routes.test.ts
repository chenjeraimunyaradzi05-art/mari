/**
 * /api/impact: the safety plan, the DV directory, the accessibility profile,
 * and what a member records about her own progress.
 *
 * None of it had a test. The safety plan is the most sensitive record on the
 * platform after the safe chats, the DV directory is the page a woman in
 * danger reads, and everything here took its input as it came: an unknown
 * metric type or a string where a yes/no belonged reached Prisma and came back
 * a 500, query filters went into `where` as given, and three lists read their
 * whole table on every load.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    impactMetric: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0), create: jest.fn(), groupBy: jest.fn(async () => []) },
    programEnrollment: { count: jest.fn(async () => 0) },
    communitySupportProgram: { findUnique: jest.fn() },
    impactReport: { findMany: jest.fn(async () => []), findUnique: jest.fn() },
    impactPartner: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0), findUnique: jest.fn() },
    dVSupportService: { findMany: jest.fn(async () => []) },
    safetyPlan: { findUnique: jest.fn(), upsert: jest.fn(async ({ create }: any) => ({ id: 'plan-1', ...create })) },
    accessibilityProfile: { findUnique: jest.fn(), upsert: jest.fn(async ({ create }: any) => ({ id: 'acc-1', ...create })) },
    disabilityFriendlyEmployer: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = { id, role: 'USER', email: `${id}@athena.test` };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const her = { 'x-test-user': 'her' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('The safety plan', () => {
  it('is hers alone: read and written against the signed-in member, never an id from the request', async () => {
    prisma.safetyPlan.findUnique.mockResolvedValue({ id: 'plan-1', userId: 'her', safeLocations: ['Mum’s place'] });

    await request(app).get('/api/impact/safety-plan?userId=someone-else').set(her).expect(200);
    expect(prisma.safetyPlan.findUnique).toHaveBeenCalledWith({ where: { userId: 'her' } });

    await request(app).post('/api/impact/safety-plan').set(her).send({ userId: 'someone-else', safeLocations: ['Library on Adelaide St'] }).expect(200);
    const upsert = prisma.safetyPlan.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ userId: 'her' });
    expect(upsert.create).toMatchObject({ userId: 'her', safeLocations: ['Library on Adelaide St'] });
    expect(upsert.update.lastReviewedAt).toBeInstanceOf(Date);
  });

  it('is closed to anyone not signed in', async () => {
    await request(app).get('/api/impact/safety-plan').expect(401);
    expect(prisma.safetyPlan.findUnique).not.toHaveBeenCalled();
  });

  it('takes lists of lines, not whatever the body holds', async () => {
    await request(app).post('/api/impact/safety-plan').set(her).send({ safeLocations: { $where: 'x' } }).expect(400);
    await request(app).post('/api/impact/safety-plan').set(her).send({ importantDocs: ['x'.repeat(1001)] }).expect(400);
    expect(prisma.safetyPlan.upsert).not.toHaveBeenCalled();
  });

  it('leaves a part she did not send alone, and clears one she sent as empty', async () => {
    await request(app).post('/api/impact/safety-plan').set(her).send({ exitStrategies: null }).expect(200);
    const update = prisma.safetyPlan.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('safeLocations', expect.anything());
    expect(update.safeLocations).toBeUndefined();
    expect(update.exitStrategies).toBeDefined();
  });
});

describe('The DV support directory', () => {
  it('always carries the national lines, even when the catalogue is empty', async () => {
    const res = await request(app).get('/api/impact/dv-services').expect(200);

    expect(res.body.usingFallback).toBe(true);
    expect(res.body.fallback.map((s: any) => s.phone)).toEqual(['000', '1800 737 732', '1800 811 811']);
  });

  it('drops the built-in copy of a number staff have entered themselves', async () => {
    prisma.dVSupportService.findMany.mockResolvedValue([
      { id: 'svc-1', name: 'DVConnect Womensline', type: 'CRISIS', phone: '1800 811 811', state: 'QLD', isNational: false, isActive: true },
    ]);

    const res = await request(app).get('/api/impact/dv-services').expect(200);

    expect(res.body.data[0]).toMatchObject({ id: 'svc-1', source: 'catalogue' });
    expect(res.body.fallback.map((s: any) => s.phone)).not.toContain('1800 811 811');
  });

  it('never hands a query operator to the database as a filter', async () => {
    await request(app).get('/api/impact/dv-services?state[not]=QLD&type[in]=CRISIS').expect(200);

    const where = prisma.dVSupportService.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ isActive: true });
  });
});

describe('The accessibility profile', () => {
  it('refuses a string where a yes/no belongs, and a font size the schema does not name', async () => {
    await request(app).post('/api/impact/accessibility').set(her).send({ highContrastMode: 'yes' }).expect(400);
    await request(app).post('/api/impact/accessibility').set(her).send({ preferredFontSize: 'enormous' }).expect(400);
    await request(app).post('/api/impact/accessibility').set(her).send({ otherNeeds: 'x'.repeat(2001) }).expect(400);
    expect(prisma.accessibilityProfile.upsert).not.toHaveBeenCalled();
  });

  it('saves a valid profile against the signed-in member', async () => {
    await request(app)
      .post('/api/impact/accessibility')
      .set(her)
      .send({ usesScreenReader: true, preferredFontSize: 'large', workAccommodations: ['Quiet workspace'] })
      .expect(200);

    const upsert = prisma.accessibilityProfile.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ userId: 'her' });
    expect(upsert.create).toMatchObject({ userId: 'her', usesScreenReader: true, preferredFontSize: 'large', highContrastMode: false });
  });
});

describe('Impact metrics', () => {
  it('refuses a metric type the schema does not have with a 400, not a 500', async () => {
    await request(app).post('/api/impact/metrics').set(her).send({ metricType: 'FEELINGS' }).expect(400);
    expect(prisma.impactMetric.create).not.toHaveBeenCalled();
  });

  it('refuses a value that is not a number, and evidence that is not a web link', async () => {
    await request(app).post('/api/impact/metrics').set(her).send({ metricType: 'INCOME_INCREASED', value: 'lots' }).expect(400);
    await request(app)
      .post('/api/impact/metrics')
      .set(her)
      .send({ metricType: 'INCOME_INCREASED', evidenceUrl: 'javascript:alert(1)' })
      .expect(400);
    expect(prisma.impactMetric.create).not.toHaveBeenCalled();
  });

  it('refuses a programme that does not exist', async () => {
    prisma.communitySupportProgram.findUnique.mockResolvedValue(null);
    await request(app).post('/api/impact/metrics').set(her).send({ metricType: 'EMPLOYMENT_GAINED', programId: 'nope' }).expect(400);
    expect(prisma.impactMetric.create).not.toHaveBeenCalled();
  });

  it('records a valid metric for the signed-in member', async () => {
    prisma.impactMetric.create.mockImplementation(async ({ data }: any) => ({ id: 'm-1', ...data }));

    await request(app)
      .post('/api/impact/metrics')
      .set(her)
      .send({ metricType: 'income_increased'.toUpperCase(), value: '1250.50', evidenceUrl: 'https://example.org/payslip.pdf' })
      .expect(201);

    expect(prisma.impactMetric.create.mock.calls[0][0].data).toMatchObject({ userId: 'her', metricType: 'INCOME_INCREASED', value: 1250.5 });
  });

  it('pages her metrics instead of reading every one she has recorded', async () => {
    const res = await request(app).get('/api/impact/metrics?limit=5000').set(her).expect(200);

    expect(prisma.impactMetric.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'her' }, take: 100, skip: 0 });
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 100 });
  });

  it('totals the summary in the database', async () => {
    prisma.impactMetric.groupBy.mockResolvedValue([{ metricType: 'EMPLOYMENT_GAINED', _count: { _all: 2 }, _sum: { value: null } }]);
    prisma.programEnrollment.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

    const res = await request(app).get('/api/impact/summary').set(her).expect(200);

    expect(res.body.data).toEqual({
      metricsSummary: { EMPLOYMENT_GAINED: { count: 2, totalValue: 0 } },
      totalMetrics: 2,
      programsEnrolled: 3,
      programsCompleted: 1,
    });
  });
});

describe('Public catalogues', () => {
  it('pages the partner list, and refuses a focus area that is not a community', async () => {
    await request(app).get('/api/impact/partners').expect(200);
    expect(prisma.impactPartner.findMany.mock.calls[0][0]).toMatchObject({ take: 50, skip: 0 });

    await request(app).get('/api/impact/partners?focusArea=EVERYONE').expect(400);
  });

  it('does not turn a nonsense rating into a NaN filter', async () => {
    await request(app).get('/api/impact/disability-friendly-employers?minRating=abc').expect(200);

    const query = prisma.disabilityFriendlyEmployer.findMany.mock.calls[0][0];
    expect(query.where).toEqual({});
    expect(query.take).toBe(50);
  });

  it('refuses a report filter that is not a community type rather than failing in the database', async () => {
    await request(app).get('/api/impact/reports?communityType=bogus').expect(400);
    expect(prisma.impactReport.findMany).not.toHaveBeenCalled();
  });
});
