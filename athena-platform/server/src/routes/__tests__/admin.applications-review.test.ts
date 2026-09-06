import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    grantApplication: { findMany: jest.fn(async () => []), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    insuranceApplication: { findMany: jest.fn(async () => []), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    notification: { create: jest.fn(async () => ({})) },
    user: { findUnique: jest.fn(async () => ({ email: 'uma@example.com', firstName: 'Uma' })) },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'staff', role: req.headers['x-test-role'] || 'ADMIN', email: 'staff@athena.com' };
      next();
    },
  };
});

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';

const prisma: any = prismaTyped;

describe('Recording grant and insurance decisions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLIENT_URL = 'https://app.example';
  });

  it('is the platform admin’s alone', async () => {
    await request(app).get('/api/admin/grants/applications').set('x-test-role', 'MODERATOR').expect(403);
    await request(app).get('/api/admin/grants/applications').expect(200);
  });

  it('lists submitted applications, not drafts', async () => {
    await request(app).get('/api/admin/grants/applications').expect(200);
    expect(prisma.grantApplication.findMany.mock.calls[0][0].where).toEqual({ status: { not: 'DRAFT' } });
  });

  it('awarding a grant records the amount and tells the applicant in the app and by email', async () => {
    prisma.grantApplication.findUnique.mockResolvedValue({ id: 'g1', userId: 'u1', status: 'SUBMITTED', grant: { name: 'Boost Her Business' } });

    await request(app).patch('/api/admin/grants/applications/g1').send({ status: 'AWARDED', amountAwarded: 15000, notes: 'Congratulations.' }).expect(200);

    const data = prisma.grantApplication.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'AWARDED', amountAwarded: 15000, notes: 'Congratulations.' });
    expect(data.resultAt).toBeInstanceOf(Date);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', link: '/dashboard/grants' });
    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('uma@example.com');
    expect(mail.text).toContain('$15,000');
    expect(mail.text).toContain('https://app.example/dashboard/grants');

    await request(app).patch('/api/admin/grants/applications/g1').send({ status: 'MAYBE' }).expect(400);
  });

  it('approving insurance stamps the approval and the policy details', async () => {
    prisma.insuranceApplication.findUnique.mockResolvedValue({ id: 'i1', userId: 'u2', status: 'SUBMITTED', product: { name: 'Income Protect', provider: 'TAL' } });

    await request(app)
      .patch('/api/admin/insurance/applications/i1')
      .send({ status: 'APPROVED', premiumQuoted: 82.5, policyNumber: 'POL-1', startDate: '2026-10-01' })
      .expect(200);

    const data = prisma.insuranceApplication.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'APPROVED', premiumQuoted: 82.5, policyNumber: 'POL-1' });
    expect(data.approvedAt).toBeInstanceOf(Date);
    expect(data.startDate).toBeInstanceOf(Date);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u2', link: '/dashboard/finance/insurance' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
