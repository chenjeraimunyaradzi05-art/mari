/**
 * POST /api/gdpr/dsar/rectify — the correction right (APP 13, GDPR Art 16).
 *
 * It had no test at all. It writes to the member's own account row on her say
 * so, which makes the two things worth holding it to the ones that would hurt
 * most if they slipped: only the fields the register lists as correctable are
 * ever written, and a new sign-in address is never applied until the new inbox
 * has answered.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dSARRequest: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    verificationToken: { deleteMany: jest.fn(), create: jest.fn() },
    privacyAuditLog: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'member@example.org' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/email.service', () => ({
  emailService: {
    sendEmailChangeConfirmation: jest.fn(async () => true),
    sendEmailChangeNotice: jest.fn(async () => true),
  },
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

const ACCOUNT = {
  id: 'member-1',
  firstName: 'Ana',
  lastName: 'Old',
  email: 'member@example.org',
  city: null,
  state: null,
  country: null,
  bio: null,
  headline: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.dSARRequest.create.mockResolvedValue({ id: 'dsar-1', userId: 'member-1' });
  prisma.dSARRequest.findUnique.mockResolvedValue({ id: 'dsar-1', userId: 'member-1' });
  prisma.dSARRequest.update.mockResolvedValue({ id: 'dsar-1' });
  prisma.user.findUnique.mockResolvedValue({ ...ACCOUNT });
  prisma.user.findFirst.mockResolvedValue(null);
  prisma.user.update.mockResolvedValue({ ...ACCOUNT });
  prisma.privacyAuditLog.create.mockResolvedValue({ id: 'p-1' });
  prisma.auditLog.create.mockResolvedValue({ id: 'a-1' });
  prisma.verificationToken.create.mockResolvedValue({ id: 't-1' });
  prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
});

describe('POST /api/gdpr/dsar/rectify', () => {
  it('writes only the fields the register lists as correctable, and names the rest back', async () => {
    const res = await request(app)
      .post('/api/gdpr/dsar/rectify')
      .send({ corrections: { lastName: 'New', role: 'ADMIN', isSuspended: false } });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ lastName: 'New' });
    expect(res.body.data.applied).toEqual(['lastName']);
    expect(prisma.dSARRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'COMPLETED' });
  });

  it('does not move the sign-in address until the new inbox confirms it', async () => {
    const res = await request(app)
      .post('/api/gdpr/dsar/rectify')
      .send({ corrections: { email: 'new-address@example.org' } });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('AWAITING_EMAIL_CONFIRMATION');
    // No write to the account's email now; a token and a pending request instead.
    for (const call of prisma.user.update.mock.calls) {
      expect(call[0].data.email).toBeUndefined();
    }
    expect(prisma.verificationToken.create).toHaveBeenCalled();
    expect(prisma.dSARRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'IN_PROGRESS' });
  });

  it('refuses an address somebody else already signs in with, before filing anything', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'someone-else' });

    const res = await request(app)
      .post('/api/gdpr/dsar/rectify')
      .send({ corrections: { email: 'taken@example.org' } });

    expect(res.status).toBe(409);
    expect(prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it('refuses an empty correction and an over-long field', async () => {
    const empty = await request(app).post('/api/gdpr/dsar/rectify').send({ corrections: {} });
    expect(empty.status).toBe(400);

    const long = await request(app)
      .post('/api/gdpr/dsar/rectify')
      .send({ corrections: { firstName: 'x'.repeat(5000) } });
    expect(long.status).toBe(400);

    expect(prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it('keeps the correction when the audit insert fails, rather than answering 500 for work that is done', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('audit table unavailable'));

    const res = await request(app).post('/api/gdpr/dsar/rectify').send({ corrections: { lastName: 'New' } });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
