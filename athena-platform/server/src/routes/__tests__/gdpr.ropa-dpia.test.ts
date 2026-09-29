/**
 * The record of processing activities and the impact assessments behind it.
 *
 * Both were writable only with curl until the admin screens were built over
 * them, and the screens need the API to keep the records meaningful: an
 * assessment's risks are held to the shape the screen reads back, an
 * assessment ending at high residual risk cannot be signed off without that
 * risk being accepted on the record, and a processing activity cannot point at
 * an assessment that does not exist.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    processingActivity: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    dPIA: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { findMany: jest.fn() },
    privacyAuditLog: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'privacy@athena.test' };
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

import gdprRoutes from '../gdpr.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';

const app = express();
app.use(express.json());
app.use('/api/gdpr', gdprRoutes);
app.use(errorHandler);

const prisma: any = prismaTyped;

const assessmentBody = {
  title: 'Safety score',
  description: 'Scores accounts for signs of harassment.',
  featureOrSystem: 'SafetyScore',
  necessity: 'Harassment is the harm the platform exists to prevent.',
  proportionality: 'Only signals already visible to moderators are used.',
  residualRiskLevel: 'MEDIUM',
  risks: [{ description: 'A survivor is wrongly scored as the aggressor', likelihood: 'MEDIUM', impact: 'HIGH' }],
  mitigations: [{ measure: 'A person reviews every critical score', status: 'IN_PLACE', risk: 'Wrong score', owner: 'Trust & Safety' }],
};

const storedAssessment = (overrides: Record<string, unknown> = {}) => ({
  id: 'dpia-1',
  ...assessmentBody,
  status: 'PENDING_REVIEW',
  residualRiskAccepted: false,
  approvedBy: null,
  approvedAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.privacyAuditLog.create.mockResolvedValue({ id: 'p-1' });
  prisma.user.findMany.mockResolvedValue([]);
});

describe('Impact assessments', () => {
  it('stores each risk with a score worked out from its two ratings', async () => {
    prisma.dPIA.create.mockImplementation(async ({ data }: any) => ({ id: 'dpia-1', ...data }));

    const res = await request(app).post('/api/gdpr/dpia').send(assessmentBody);

    expect(res.status).toBe(201);
    expect(prisma.dPIA.create.mock.calls[0][0].data.risks).toEqual([
      { description: 'A survivor is wrongly scored as the aggressor', likelihood: 'MEDIUM', impact: 'HIGH', score: 6 },
    ]);
    expect(prisma.dPIA.create.mock.calls[0][0].data.mitigations).toEqual([
      { measure: 'A person reviews every critical score', status: 'IN_PLACE', risk: 'Wrong score', owner: 'Trust & Safety' },
    ]);
  });

  it('refuses risks that are not risks', async () => {
    const res = await request(app)
      .post('/api/gdpr/dpia')
      .send({ ...assessmentBody, risks: [3, 'bad'] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Each risk needs');
    expect(prisma.dPIA.create).not.toHaveBeenCalled();
  });

  it('refuses a mitigation with no measure or an unknown status', async () => {
    const res = await request(app)
      .post('/api/gdpr/dpia')
      .send({ ...assessmentBody, mitigations: [{ measure: '', status: 'SOON' }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Each mitigation needs');
  });

  it('will not approve an assessment left at high residual risk until the risk is accepted', async () => {
    prisma.dPIA.findUnique.mockResolvedValue(storedAssessment({ residualRiskLevel: 'HIGH' }));

    const refused = await request(app).patch('/api/gdpr/dpia/dpia-1').send({ status: 'APPROVED' });
    expect(refused.status).toBe(409);
    expect(prisma.dPIA.update).not.toHaveBeenCalled();

    prisma.dPIA.update.mockImplementation(async ({ data }: any) => storedAssessment({ residualRiskLevel: 'HIGH', ...data }));
    const approved = await request(app)
      .patch('/api/gdpr/dpia/dpia-1')
      .send({ status: 'APPROVED', residualRiskAccepted: true });

    expect(approved.status).toBe(200);
    expect(prisma.dPIA.update.mock.calls[0][0].data).toMatchObject({ approvedBy: 'admin-1', residualRiskAccepted: true });
  });

  it('withdraws the sign-off when an approved assessment goes back for work', async () => {
    prisma.dPIA.findUnique.mockResolvedValue(storedAssessment({ status: 'APPROVED', approvedBy: 'admin-9' }));
    prisma.dPIA.update.mockImplementation(async ({ data }: any) => storedAssessment(data));

    const res = await request(app).patch('/api/gdpr/dpia/dpia-1').send({ status: 'DRAFT' });

    expect(res.status).toBe(200);
    expect(prisma.dPIA.update.mock.calls[0][0].data).toMatchObject({ approvedBy: null, approvedAt: null });
  });

  it('names who approved each assessment', async () => {
    prisma.dPIA.findMany.mockResolvedValue([storedAssessment({ status: 'APPROVED', approvedBy: 'admin-1' })]);
    prisma.dPIA.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', email: 'privacy@athena.test', displayName: null, firstName: 'Mere', lastName: 'Tipene' },
    ]);

    const res = await request(app).get('/api/gdpr/dpia');

    expect(res.status).toBe(200);
    expect(res.body.data[0].approvedByName).toBe('Mere Tipene');
  });
});

describe('The record of processing activities', () => {
  const activity = {
    name: 'Safety scoring',
    description: 'Scoring accounts for harassment signals.',
    department: 'Trust & Safety',
    legalBasis: 'LEGITIMATE_INTERESTS',
    retentionPeriod: 'While the account is open',
  };

  it('will not link an activity to an assessment that does not exist', async () => {
    prisma.dPIA.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/gdpr/ropa')
      .send({ ...activity, dpiaRequired: true, dpiaId: 'dpia-missing' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('dpiaId');
    expect(prisma.processingActivity.create).not.toHaveBeenCalled();
  });

  it('records that the activity was reviewed today, by the server’s clock', async () => {
    prisma.processingActivity.findUnique.mockResolvedValue({ id: 'ropa-1', ...activity, isActive: true, lastReviewDate: null, dpiaId: null });
    prisma.processingActivity.update.mockImplementation(async ({ data }: any) => ({ id: 'ropa-1', ...activity, isActive: true, ...data }));

    const res = await request(app).patch('/api/gdpr/ropa/ropa-1').send({ reviewed: true });

    expect(res.status).toBe(200);
    const written = prisma.processingActivity.update.mock.calls[0][0].data.lastReviewDate as Date;
    expect(written).toBeInstanceOf(Date);
    expect(Math.abs(written.getTime() - Date.now())).toBeLessThan(10_000);
  });

  it('lets an amendment clear an optional field and unlink an assessment', async () => {
    prisma.processingActivity.findUnique.mockResolvedValue({ id: 'ropa-1', ...activity, isActive: true, dpiaId: 'dpia-1' });
    prisma.processingActivity.update.mockImplementation(async ({ data }: any) => ({ id: 'ropa-1', ...activity, isActive: true, ...data }));

    const res = await request(app).patch('/api/gdpr/ropa/ropa-1').send({ dpiaId: null, transferSafeguards: null, nextReviewDate: null });

    expect(res.status).toBe(200);
    expect(prisma.processingActivity.update.mock.calls[0][0].data).toMatchObject({
      dpiaId: null,
      transferSafeguards: null,
      nextReviewDate: null,
    });
  });
});
