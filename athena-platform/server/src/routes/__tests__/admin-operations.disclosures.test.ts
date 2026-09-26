/**
 * The writers behind the two public disclosures.
 *
 * GET /api/compliance/transparency-report and GET /api/compliance/subprocessors
 * both read tables nothing in the repository wrote, so the public transparency
 * page was permanently empty and the privacy statement pointed members at a
 * providers list that could never be filled. These are the routes that fill
 * them, and the counting behind the report.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    transparencyReport: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    subprocessor: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    contentReport: { findMany: jest.fn() },
    safetyIncident: { findMany: jest.fn() },
    moderationLog: { groupBy: jest.fn() },
    appeal: { groupBy: jest.fn() },
    auditLog: { create: jest.fn(async () => ({ id: 'audit-1' })) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.test' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import adminOperationsRoutes from '../admin-operations.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';
import { compileTransparencyReport, transparencyPeriodBounds } from '../../services/content-report.service';

const app = express();
app.use(express.json());
app.use('/api/admin', adminOperationsRoutes);
app.use(errorHandler);

const prisma: any = prismaTyped;
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.contentReport.findMany.mockResolvedValue([]);
  prisma.safetyIncident.findMany.mockResolvedValue([]);
  prisma.moderationLog.groupBy.mockResolvedValue([]);
  prisma.appeal.groupBy.mockResolvedValue([]);
});

describe('transparencyPeriodBounds', () => {
  it('runs a quarter from midnight to midnight in Brisbane', () => {
    const bounds = transparencyPeriodBounds('Q3_2026')!;
    expect(bounds.startDate.toISOString()).toBe('2026-06-30T14:00:00.000Z');
    expect(bounds.endDate.toISOString()).toBe('2026-09-30T14:00:00.000Z');
  });

  it('refuses anything that is not a quarter', () => {
    expect(transparencyPeriodBounds('2026')).toBeNull();
    expect(transparencyPeriodBounds('Q5_2026')).toBeNull();
  });
});

describe('compileTransparencyReport', () => {
  it('counts both report doors, the decisions, the response times and the appeals', async () => {
    const created = new Date('2026-07-10T00:00:00.000Z');
    prisma.contentReport.findMany.mockResolvedValue([
      { reason: 'HARASSMENT', createdAt: created, actionTakenAt: new Date(created.getTime() + 5 * HOUR) },
      { reason: 'violence', createdAt: created, actionTakenAt: new Date(created.getTime() + 30 * HOUR) },
      { reason: 'HATE', createdAt: created, actionTakenAt: null },
    ]);
    prisma.safetyIncident.findMany.mockResolvedValue([
      { reason: 'CSAM', createdAt: created, resolvedAt: new Date(created.getTime() + 100 * HOUR) },
      { reason: 'SOMETHING NEW', createdAt: created, resolvedAt: null },
    ]);
    prisma.moderationLog.groupBy.mockResolvedValue([
      { action: 'remove', _count: { _all: 4 } },
      { action: 'ban', _count: { _all: 1 } },
      { action: 'escalate', _count: { _all: 2 } },
      { action: 'escalation_acknowledged', _count: { _all: 1 } },
    ]);
    prisma.appeal.groupBy.mockResolvedValue([
      { status: 'APPROVED', _count: { _all: 1 } },
      { status: 'REJECTED', _count: { _all: 2 } },
      { status: 'PENDING', _count: { _all: 1 } },
    ]);

    const report = await compileTransparencyReport('Q3_2026', new Date('2026-10-02T00:00:00.000Z'));

    expect(report.totalReports).toBe(5);
    expect(report.reportsByCategory).toMatchObject({ harassment: 1, harmful: 1, hate_speech: 1, csam: 1, other: 1 });
    // The categories always account for every report.
    expect(Object.values(report.reportsByCategory).reduce((a, b) => a + b, 0)).toBe(5);
    expect(report.actionsByType).toEqual({ contentRemoved: 4, accountsSuspended: 0, accountsBanned: 1, warnings: 0, noAction: 0 });
    expect(report.actionsTotal).toBe(5);
    expect([report.under24Hours, report.under72Hours, report.over72Hours]).toEqual([1, 1, 1]);
    expect(report.avgResponseHours).toBe(45);
    expect(report).toMatchObject({ totalAppeals: 4, appealsUpheld: 2, appealsOverturned: 1 });
  });

  it('will not count a quarter that has not ended', async () => {
    await expect(compileTransparencyReport('Q3_2026', new Date('2026-09-15T00:00:00.000Z'))).rejects.toThrow('not ended');
  });
});

describe('/api/admin/transparency-reports', () => {
  it('compiles a finished quarter into an unpublished draft and records who did it', async () => {
    prisma.transparencyReport.findUnique.mockResolvedValue(null);
    prisma.transparencyReport.upsert.mockImplementation(async ({ create }: any) => ({ id: 'tr-1', ...create, publishedAt: null }));

    const res = await request(app).post('/api/admin/transparency-reports').send({ period: 'Q2_2026' });

    expect(res.status).toBe(201);
    const args = prisma.transparencyReport.upsert.mock.calls[0][0];
    expect(args.create.publishedAt).toBeUndefined();
    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata).toMatchObject({
      adminAction: 'TRANSPARENCY_REPORT_COMPILED',
      period: 'Q2_2026',
    });
  });

  it('never recompiles a report the public has already been shown', async () => {
    prisma.transparencyReport.findUnique.mockResolvedValue({ id: 'tr-1', period: 'Q2_2026', publishedAt: new Date() });

    const res = await request(app).post('/api/admin/transparency-reports').send({ period: 'Q2_2026' });

    expect(res.status).toBe(409);
    expect(prisma.transparencyReport.upsert).not.toHaveBeenCalled();
  });

  it('answers 400 for a period that is not a finished quarter', async () => {
    prisma.transparencyReport.findUnique.mockResolvedValue(null);

    expect((await request(app).post('/api/admin/transparency-reports').send({ period: 'last year' })).status).toBe(400);
  });

  it('publishes a draft once, and records it', async () => {
    prisma.transparencyReport.findUnique.mockResolvedValue({ id: 'tr-1', period: 'Q2_2026', publishedAt: null });
    prisma.transparencyReport.update.mockImplementation(async ({ data }: any) => ({ id: 'tr-1', period: 'Q2_2026', ...data }));

    const res = await request(app).post('/api/admin/transparency-reports/tr-1/publish');

    expect(res.status).toBe(200);
    expect(prisma.transparencyReport.update.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata.adminAction).toBe('TRANSPARENCY_REPORT_PUBLISHED');

    prisma.transparencyReport.findUnique.mockResolvedValue({ id: 'tr-1', period: 'Q2_2026', publishedAt: new Date() });
    expect((await request(app).post('/api/admin/transparency-reports/tr-1/publish')).status).toBe(409);
  });
});

describe('/api/admin/subprocessors', () => {
  it('adds a provider with its country and records the change', async () => {
    prisma.subprocessor.create.mockImplementation(async ({ data }: any) => ({ id: 'sp-1', ...data }));

    const res = await request(app)
      .post('/api/admin/subprocessors')
      .send({ name: 'Mail Provider Pty', country: 'United States', services: ['Email'], dataCategories: ['PII'], dpaSignedAt: '2026-01-15' });

    expect(res.status).toBe(201);
    const data = prisma.subprocessor.create.mock.calls[0][0].data;
    expect(data.dpaSignedAt).toBeInstanceOf(Date);
    expect(data.securityCertifications).toEqual([]);
    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata).toMatchObject({ adminAction: 'SUBPROCESSOR_CREATED', country: 'United States' });
  });

  it('refuses a provider with no country, an unknown data category or an unexpected field', async () => {
    expect((await request(app).post('/api/admin/subprocessors').send({ name: 'No Country' })).status).toBe(400);
    expect((await request(app).post('/api/admin/subprocessors').send({ name: 'X Ltd', country: 'AU', dataCategories: ['EVERYTHING'] })).status).toBe(400);
    expect((await request(app).post('/api/admin/subprocessors').send({ name: 'X Ltd', country: 'AU', isAdmin: true })).status).toBe(400);
    expect(prisma.subprocessor.create).not.toHaveBeenCalled();
  });

  it('retires rather than deletes, and 404s an unknown provider', async () => {
    prisma.subprocessor.findUnique.mockResolvedValueOnce(null);
    expect((await request(app).patch('/api/admin/subprocessors/nope').send({ isActive: false })).status).toBe(404);

    prisma.subprocessor.findUnique.mockResolvedValueOnce({ id: 'sp-1' });
    prisma.subprocessor.update.mockResolvedValue({ id: 'sp-1', isActive: false });
    const res = await request(app).patch('/api/admin/subprocessors/sp-1').send({ isActive: false });

    expect(res.status).toBe(200);
    expect(prisma.subprocessor.update.mock.calls[0][0].data).toEqual({ isActive: false });
  });
});
