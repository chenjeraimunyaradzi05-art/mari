import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    courseCertificate: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    user: { update: jest.fn(async ({ data }: any) => ({ id: 'u1', ...data })) },
  },
}));

jest.mock('../../middleware/auth', () => {
  const userFrom = (req: any) => (req.headers['x-test-user'] ? { id: req.headers['x-test-user'], role: 'USER', email: 'x@athena.com' } : null);
  return {
    authenticate: (req: any, res: any, next: any) => {
      const user = userFrom(req);
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      req.user = user;
      next();
    },
    optionalAuth: (req: any, _res: any, next: any) => {
      const user = userFrom(req);
      if (user) req.user = user;
      next();
    },
    requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
    requirePremium: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('A learner’s certificates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the signed-in learner’s certificates, newest first, with the checkable code', async () => {
    prisma.courseCertificate.findMany.mockResolvedValue([
      { id: 'cert1', code: 'ABCDEFGHIJ', issuedAt: new Date('2026-08-01T00:00:00Z'), userId: 'u1', course: { id: 'c1', title: 'Founding a business', slug: 'founding-a-business', providerName: 'ATHENA', type: 'short_course', durationMonths: null } },
    ]);

    const res = await request(app).get('/api/courses/me/certificates').set('x-test-user', 'u1').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ code: 'ABCDEFGHIJ', course: { title: 'Founding a business', slug: 'founding-a-business' } });
    expect(res.body.data[0].userId).toBeUndefined();
    const args = prisma.courseCertificate.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 'u1' });
    expect(args.orderBy).toEqual({ issuedAt: 'desc' });
  });

  it('needs a signed-in learner', async () => {
    await request(app).get('/api/courses/me/certificates').expect(401);
  });
});

describe('Profile timezone', () => {
  it('accepts an IANA zone and refuses anything else', async () => {
    await request(app).patch('/api/users/me').set('x-test-user', 'u1').send({ timezone: 'Australia/Brisbane' }).expect(200);
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ timezone: 'Australia/Brisbane' });

    await request(app).patch('/api/users/me').set('x-test-user', 'u1').send({ timezone: 'somewhere nice' }).expect(400);
  });
});
