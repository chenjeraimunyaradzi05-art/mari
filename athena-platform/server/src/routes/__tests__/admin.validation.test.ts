import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    job: {
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    subscription: {
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    inviteCode: {
      createMany: jest.fn(async ({ data }: any) => ({ count: data.length })),
      findMany: jest.fn(async () => []),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'admin-1@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/audit', () => ({
  logAudit: jest.fn(async () => undefined),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

/**
 * These handlers used to pass req.body straight into Prisma, so a made-up
 * status arrived as a database error and unknown keys were written wholesale.
 * The contract now is: refuse with a 400 before anything reaches the database.
 */
describe('Admin write endpoints refuse what the schema does not name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PATCH /api/admin/jobs/:id', () => {
    it('refuses a status that is not in the enum', async () => {
      const res = await request(app).patch('/api/admin/jobs/job-1').send({ status: 'SPONSORED' });

      expect(res.status).toBe(400);
      expect(prisma.job.update).not.toHaveBeenCalled();
    });

    it('refuses keys the handler never intended to write', async () => {
      const res = await request(app)
        .patch('/api/admin/jobs/job-1')
        .send({ status: 'ACTIVE', salaryMax: 999999 });

      expect(res.status).toBe(400);
      expect(prisma.job.update).not.toHaveBeenCalled();
    });

    it('accepts the payload the admin screen actually sends', async () => {
      const res = await request(app).patch('/api/admin/jobs/job-1').send({ status: 'PAUSED' });

      expect(res.status).toBe(200);
      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'PAUSED' },
      });
    });
  });

  describe('PATCH /api/admin/subscriptions/:id', () => {
    it('refuses a tier outside the enum', async () => {
      const res = await request(app)
        .patch('/api/admin/subscriptions/sub-1')
        .send({ tier: 'PLATINUM' });

      expect(res.status).toBe(400);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('writes periodEnd to the column that exists', async () => {
      const res = await request(app)
        .patch('/api/admin/subscriptions/sub-1')
        .send({ tier: 'ENTERPRISE', periodEnd: '2027-01-01T00:00:00.000Z' });

      expect(res.status).toBe(200);
      // The column is currentPeriodEnd; the handler used to write periodEnd,
      // which Prisma refused, so every extension attempt was a 500.
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { tier: 'ENTERPRISE', currentPeriodEnd: new Date('2027-01-01T00:00:00.000Z') },
      });
    });

    it('refuses a periodEnd that is not a date', async () => {
      const res = await request(app)
        .patch('/api/admin/subscriptions/sub-1')
        .send({ periodEnd: 'whenever' });

      expect(res.status).toBe(400);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/invite-codes', () => {
    it('refuses a count beyond 100 instead of quietly clamping it', async () => {
      const res = await request(app).post('/api/admin/invite-codes').send({ count: 500 });

      expect(res.status).toBe(400);
      expect(prisma.inviteCode.createMany).not.toHaveBeenCalled();
    });

    it('refuses a prefix that is not short plain alphanumerics', async () => {
      const res = await request(app)
        .post('/api/admin/invite-codes')
        .send({ count: 1, prefix: 'DROP TABLE--' });

      expect(res.status).toBe(400);
      expect(prisma.inviteCode.createMany).not.toHaveBeenCalled();
    });

    it('creates exactly the requested codes with the prefix stamped in', async () => {
      const res = await request(app)
        .post('/api/admin/invite-codes')
        .send({ count: 3, prefix: 'gala', maxUses: 5 });

      expect(res.status).toBe(200);
      const { data } = prisma.inviteCode.createMany.mock.calls[0][0];
      expect(data).toHaveLength(3);
      for (const row of data) {
        expect(row.code).toMatch(/^GALA-[0-9A-F]{10}$/);
        expect(row.maxUses).toBe(5);
        expect(row.expiresAt).toBeNull();
      }
    });

    it('refuses a maxUses that is not a positive whole number', async () => {
      const res = await request(app)
        .post('/api/admin/invite-codes')
        .send({ count: 1, maxUses: 0 });

      expect(res.status).toBe(400);
      expect(prisma.inviteCode.createMany).not.toHaveBeenCalled();
    });
  });
});
