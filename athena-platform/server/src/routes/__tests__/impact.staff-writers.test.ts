import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The writers ImpactReport and DisabilityFriendlyEmployer never had.
 *
 * Both tables had readers and nothing that could put a row in them, so the
 * impact reports page and the disability-friendly employer list were
 * permanently empty. Staff can now publish a report, which is counted from
 * the records rather than typed in and never shows a number small enough to
 * point at a woman, and can list, re-check and retire an employer. Each of
 * those is in the audit log under the member of staff who did it.
 */

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    impactReport: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      findFirst: jest.fn(async () => null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(async () => ({})),
    },
    impactMetric: {
      groupBy: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      aggregate: jest.fn(async () => ({ _avg: { value: null }, _count: { _all: 0 } })),
    },
    programEnrollment: { findMany: jest.fn(async () => []) },
    organization: { findMany: jest.fn(async () => []), findUnique: jest.fn() },
    disabilityFriendlyEmployer: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  return { prisma };
});

jest.mock('../../middleware/auth', () => {
  const principal = (req: any) =>
    req.headers['x-test-user'] ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.test' } : null;
  return {
    authenticate: (req: any, res: any, next: any) => {
      const user = principal(req);
      if (!user) return res.status(401).json({ success: false, message: 'No token provided' });
      req.user = user;
      next();
    },
    optionalAuth: (req: any, _res: any, next: any) => {
      const user = principal(req);
      if (user) req.user = user;
      next();
    },
    requireRole:
      (...roles: string[]) =>
      (req: any, res: any, next: any) => {
        if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        next();
      },
    requirePremium: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
const staff = as('staff-1', 'ADMIN');
const auditRows = () => prisma.auditLog.create.mock.calls.map((c: any) => c[0].data);

/** Outcome rows as groupBy returns them: one per woman per outcome. */
const pairs = (type: string, count: number, prefix = type) =>
  Array.from({ length: count }, (_, i) => ({ metricType: type, userId: `${prefix}-${i}` }));

const storedReport = (over: Record<string, unknown> = {}) => ({
  id: 'rep-1',
  reportPeriod: 'Q1-2026',
  communityType: null,
  region: 'ANZ',
  totalUsersSupported: 12,
  employmentGained: 6,
  avgIncomeIncrease: null,
  housingSecured: 2,
  qualificationsObtained: 0,
  businessesStarted: 5,
  safetyAchieved: 1,
  totalEconomicImpact: null,
  narrativeSummary: 'First quarter.',
  dataJson: {
    method: 'COMPILED_FROM_RECORDS',
    version: 1,
    period: { label: 'Q1-2026', start: '2025-12-31T14:00:00.000Z', end: '2026-03-31T14:00:00.000Z', description: '1 Jan 2026 to 31 Mar 2026' },
    region: 'ANZ',
    communityType: null,
    outcomesRecorded: 14,
    outcomesVerified: 0,
    programmeMembers: 3,
    incomeReports: 0,
    compiledAt: '2026-04-02T00:00:00.000Z',
    compiledById: 'should-not-leak',
  },
  createdAt: new Date('2026-04-02T00:00:00Z'),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.impactReport.findFirst.mockResolvedValue(null);
  prisma.impactMetric.groupBy.mockResolvedValue([]);
  prisma.impactMetric.count.mockResolvedValue(0);
  prisma.impactMetric.aggregate.mockResolvedValue({ _avg: { value: null }, _count: { _all: 0 } });
  prisma.programEnrollment.findMany.mockResolvedValue([]);
});

describe('Publishing an impact report', () => {
  it('is staff work: a member cannot preview, publish, correct or withdraw one', async () => {
    await request(app).get('/api/impact/admin/reports/preview?period=Q1-2026').set(as('member')).expect(403);
    await request(app).post('/api/impact/admin/reports').set(as('member')).send({ period: 'Q1-2026' }).expect(403);
    await request(app).patch('/api/impact/admin/reports/rep-1').set(as('member')).send({ reason: 'A late outcome came in', recount: true }).expect(403);
    await request(app).post('/api/impact/admin/reports/rep-1/withdraw').set(as('member')).send({ reason: 'Published in error' }).expect(403);
    expect(prisma.impactReport.create).not.toHaveBeenCalled();
    expect(prisma.impactReport.delete).not.toHaveBeenCalled();
  });

  it('counts women from the records for the period, once each, in Queensland time', async () => {
    prisma.impactMetric.groupBy.mockResolvedValue([
      ...pairs('EMPLOYMENT_GAINED', 4, 'w'),
      ...pairs('HOUSING_SECURED', 2, 'w'),
      ...pairs('SAFETY_ACHIEVED', 1, 'x'),
    ]);
    prisma.impactMetric.count.mockResolvedValueOnce(9).mockResolvedValueOnce(2);
    prisma.programEnrollment.findMany.mockResolvedValue([{ userId: 'w-0' }, { userId: 'p-1' }, { userId: 'p-2' }]);

    const res = await request(app).get('/api/impact/admin/reports/preview?period=q1-2026&communityType=DV_SURVIVOR').set(staff).expect(200);

    const where = prisma.impactMetric.groupBy.mock.calls[0][0].where;
    // 1 January 2026 at midnight in Brisbane is 14:00 UTC the day before.
    expect(where.createdAt).toEqual({ gte: new Date('2025-12-31T14:00:00.000Z'), lt: new Date('2026-03-31T14:00:00.000Z') });
    expect(where.communityType).toBe('DV_SURVIVOR');
    expect(where.user).toEqual({ region: 'ANZ' });

    const { figures, basis, publishable } = res.body.data;
    // w-0..w-3, x-0, and two programme members who recorded nothing.
    expect(figures.totalUsersSupported).toBe(7);
    expect(figures.employmentGained).toBe(4);
    expect(figures.housingSecured).toBe(2);
    expect(figures.safetyAchieved).toBe(1);
    expect(figures.avgIncomeIncrease).toBeNull();
    expect(basis).toMatchObject({ method: 'COMPILED_FROM_RECORDS', outcomesRecorded: 9, outcomesVerified: 2, programmeMembers: 3 });
    expect(publishable).toBe(true);
  });

  it('refuses a period it does not recognise rather than filing one nobody can compare', async () => {
    const res = await request(app).get('/api/impact/admin/reports/preview?period=spring').set(staff).expect(400);
    expect(res.body.message ?? res.body.error).toMatch(/Q3-2026/);
  });

  it('publishes the counted figures, never figures from the body, and records who did it', async () => {
    prisma.impactMetric.groupBy.mockResolvedValue([...pairs('EMPLOYMENT_GAINED', 6), ...pairs('BUSINESS_STARTED', 5)]);
    prisma.impactReport.create.mockImplementation(async ({ data }: any) => ({ id: 'rep-new', createdAt: new Date(), ...data }));

    const res = await request(app)
      .post('/api/impact/admin/reports')
      .set(staff)
      .send({ period: 'Q1-2026', narrativeSummary: 'Our first full quarter.', totalUsersSupported: 90000, employmentGained: 5000 })
      .expect(201);

    const data = prisma.impactReport.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ reportPeriod: 'Q1-2026', communityType: null, region: 'ANZ', totalUsersSupported: 11, employmentGained: 6, businessesStarted: 5 });
    expect(data.totalEconomicImpact).toBeNull();
    expect(data.dataJson.method).toBe('COMPILED_FROM_RECORDS');
    expect(res.body.data.totalUsersSupported).toBe(11);

    const [row] = auditRows();
    expect(row).toMatchObject({ action: 'ADMIN_CONTENT_UPDATE', actorUserId: 'staff-1' });
    expect(row.metadata).toMatchObject({ adminAction: 'IMPACT_REPORT_PUBLISHED', resourceType: 'ImpactReport', resourceId: 'rep-new', reportPeriod: 'Q1-2026' });
  });

  it('will not publish a period that has not ended', async () => {
    prisma.impactMetric.groupBy.mockResolvedValue(pairs('EMPLOYMENT_GAINED', 20));
    const res = await request(app).post('/api/impact/admin/reports').set(staff).send({ period: 'FY2099' }).expect(400);
    expect(res.body.message ?? res.body.error).toMatch(/has not ended/);
    expect(prisma.impactReport.create).not.toHaveBeenCalled();
  });

  it('will not publish a report so small it could identify the women in it', async () => {
    prisma.impactMetric.groupBy.mockResolvedValue(pairs('SAFETY_ACHIEVED', 3));
    const res = await request(app).post('/api/impact/admin/reports').set(staff).send({ period: 'Q1-2026', communityType: 'DV_SURVIVOR' }).expect(400);
    expect(res.body.message ?? res.body.error).toMatch(/could identify them/);
    expect(prisma.impactReport.create).not.toHaveBeenCalled();
  });

  it('refuses a second all-communities report for the same period, which the unique index would let through', async () => {
    prisma.impactReport.findFirst.mockResolvedValue({ id: 'rep-1' });
    await request(app).post('/api/impact/admin/reports').set(staff).send({ period: 'Q1-2026' }).expect(409);
    expect(prisma.impactReport.findFirst.mock.calls[0][0].where).toEqual({ reportPeriod: 'Q1-2026', communityType: null, region: 'ANZ' });
    expect(prisma.impactReport.create).not.toHaveBeenCalled();
  });

  it('corrects a report by recounting it, says why, and keeps the before and after', async () => {
    prisma.impactReport.findUnique.mockResolvedValue(storedReport());
    prisma.impactMetric.groupBy.mockResolvedValue([...pairs('EMPLOYMENT_GAINED', 7), ...pairs('BUSINESS_STARTED', 6)]);
    prisma.impactReport.update.mockImplementation(async ({ data }: any) => ({ ...storedReport(), ...data }));

    await request(app).patch('/api/impact/admin/reports/rep-1').set(staff).send({ recount: true }).expect(400);
    await request(app).patch('/api/impact/admin/reports/rep-1').set(staff).send({ reason: 'Two outcomes were recorded late' }).expect(400);

    await request(app).patch('/api/impact/admin/reports/rep-1').set(staff).send({ reason: 'Two outcomes were recorded late', recount: true }).expect(200);
    const data = prisma.impactReport.update.mock.calls[0][0].data;
    expect(data.employmentGained).toBe(7);
    expect(data.narrativeSummary).toBe('First quarter.');

    const [row] = auditRows();
    expect(row.metadata).toMatchObject({ adminAction: 'IMPACT_REPORT_CORRECTED', reason: 'Two outcomes were recorded late', recounted: true });
    expect(row.metadata.before.figures.employmentGained).toBe(6);
    expect(row.metadata.after.figures.employmentGained).toBe(7);
  });

  it('withdraws a report with a reason, and the audit row keeps what it said', async () => {
    prisma.impactReport.findUnique.mockResolvedValue(storedReport());
    await request(app).post('/api/impact/admin/reports/rep-1/withdraw').set(staff).send({}).expect(400);
    await request(app).post('/api/impact/admin/reports/rep-1/withdraw').set(staff).send({ reason: 'Counted before the data fix' }).expect(200);

    expect(prisma.impactReport.delete).toHaveBeenCalledWith({ where: { id: 'rep-1' } });
    const [row] = auditRows();
    expect(row.metadata).toMatchObject({ adminAction: 'IMPACT_REPORT_WITHDRAWN', reason: 'Counted before the data fix', narrativeSummary: 'First quarter.' });
    expect(row.metadata.figures.totalUsersSupported).toBe(12);
  });
});

describe('A published report, as the public reads it', () => {
  it('withholds every count from one to four, says so, and shows what it was counted from', async () => {
    prisma.impactReport.findMany.mockResolvedValue([storedReport()]);
    const res = await request(app).get('/api/impact/reports').expect(200);
    const [report] = res.body.data;

    expect(report.totalUsersSupported).toBe(12);
    expect(report.employmentGained).toBe(6);
    expect(report.qualificationsObtained).toBe(0);
    expect(report.housingSecured).toBeNull();
    expect(report.safetyAchieved).toBeNull();
    expect(report.suppressed.sort()).toEqual(['housingSecured', 'safetyAchieved']);
    expect(report.minPublishedCount).toBe(5);
    expect(report.basis).toMatchObject({ method: 'COMPILED_FROM_RECORDS', outcomesRecorded: 14, period: { label: 'Q1-2026' } });
    expect(JSON.stringify(report)).not.toContain('should-not-leak');
  });
});

describe('The disability-friendly employer list', () => {
  const org = { id: 'org-1', name: 'Harbour Health', logo: null, industry: 'Health' };
  const listing = (over: Record<string, unknown> = {}) => ({
    id: 'dfe-1',
    organizationId: 'org-1',
    accessibilityRating: 4,
    accommodationsOffered: ['Adjustable desks'],
    hasWheelchairAccess: true,
    hasFlexibleWork: true,
    hasRemoteOptions: false,
    hasMentalHealthSupport: true,
    badgeType: null,
    verifiedAt: new Date('2026-09-01T00:00:00Z'),
    organization: org,
    ...over,
  });

  it('shows the public only employers that are checked and not retired', async () => {
    await request(app).get('/api/impact/disability-friendly-employers').expect(200);
    expect(prisma.disabilityFriendlyEmployer.findMany.mock.calls[0][0].where).toEqual({ verifiedAt: { not: null } });
  });

  it('is staff work', async () => {
    await request(app).post('/api/impact/admin/disability-employers').set(as('member')).send({ organizationId: 'org-1', accessibilityRating: 5, basis: 'Visited the office' }).expect(403);
    await request(app).get('/api/impact/admin/organizations?q=har').set(as('member')).expect(403);
    expect(prisma.disabilityFriendlyEmployer.create).not.toHaveBeenCalled();
  });

  it('lists an employer staff have checked, dated today, with no badge, and records what was checked', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Harbour Health' });
    prisma.disabilityFriendlyEmployer.findUnique.mockResolvedValue(null);
    prisma.disabilityFriendlyEmployer.create.mockImplementation(async ({ data }: any) => ({ id: 'dfe-1', ...data, organization: org }));

    await request(app).post('/api/impact/admin/disability-employers').set(staff).send({ organizationId: 'org-1', accessibilityRating: 4 }).expect(400);
    await request(app).post('/api/impact/admin/disability-employers').set(staff).send({ organizationId: 'org-1', accessibilityRating: 9, basis: 'Visited the office and spoke with HR' }).expect(400);

    await request(app)
      .post('/api/impact/admin/disability-employers')
      .set(staff)
      .send({ organizationId: 'org-1', accessibilityRating: 4, hasWheelchairAccess: true, badgeType: 'ACCESSIBILITY_CHAMPION', basis: 'Visited the office and spoke with HR' })
      .expect(201);

    const data = prisma.disabilityFriendlyEmployer.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organizationId: 'org-1', accessibilityRating: 4, hasWheelchairAccess: true, badgeType: null });
    expect(data.verifiedAt).toBeInstanceOf(Date);

    const [row] = auditRows();
    expect(row.metadata).toMatchObject({ adminAction: 'DISABILITY_EMPLOYER_LISTED', organizationName: 'Harbour Health', basis: 'Visited the office and spoke with HR' });
  });

  it('refuses a second listing for the same organisation, and points to the retired one to relist', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Harbour Health' });
    prisma.disabilityFriendlyEmployer.findUnique.mockResolvedValue({ id: 'dfe-1', verifiedAt: null });
    const res = await request(app)
      .post('/api/impact/admin/disability-employers')
      .set(staff)
      .send({ organizationId: 'org-1', accessibilityRating: 4, basis: 'Visited the office and spoke with HR' })
      .expect(409);
    expect(res.body.message ?? res.body.error).toMatch(/retired/);
  });

  it('dates an edit as a fresh check, relists a retired employer, and keeps the before and after', async () => {
    prisma.disabilityFriendlyEmployer.findUnique.mockResolvedValue(listing({ verifiedAt: null }));
    prisma.disabilityFriendlyEmployer.update.mockImplementation(async ({ data }: any) => ({ ...listing(), ...data }));

    const res = await request(app)
      .patch('/api/impact/admin/disability-employers/dfe-1')
      .set(staff)
      .send({ hasRemoteOptions: true, basis: 'Rechecked with their new HR lead' })
      .expect(200);

    expect(prisma.disabilityFriendlyEmployer.update.mock.calls[0][0].data.verifiedAt).toBeInstanceOf(Date);
    expect(res.body.message).toMatch(/back on the list/);
    const [row] = auditRows();
    expect(row.metadata).toMatchObject({ adminAction: 'DISABILITY_EMPLOYER_UPDATED', relisted: true });
    expect(row.metadata.before.hasRemoteOptions).toBe(false);
    expect(row.metadata.after.hasRemoteOptions).toBe(true);
  });

  it('retires an employer with a reason, keeping the row', async () => {
    prisma.disabilityFriendlyEmployer.findUnique.mockResolvedValue(listing());
    prisma.disabilityFriendlyEmployer.update.mockImplementation(async ({ data }: any) => ({ ...listing(), ...data }));

    await request(app).post('/api/impact/admin/disability-employers/dfe-1/retire').set(staff).send({ reason: 'short' }).expect(400);
    await request(app).post('/api/impact/admin/disability-employers/dfe-1/retire').set(staff).send({ reason: 'Their office moved and is not accessible' }).expect(200);

    expect(prisma.disabilityFriendlyEmployer.update.mock.calls[0][0].data).toEqual({ verifiedAt: null });
    const [row] = auditRows();
    expect(row.metadata).toMatchObject({ adminAction: 'DISABILITY_EMPLOYER_RETIRED', reason: 'Their office moved and is not accessible' });
  });
});
