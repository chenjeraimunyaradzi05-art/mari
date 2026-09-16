import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    apprenticeship: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    organizationMember: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
    apprenticeshipBookmark: { findMany: jest.fn(async () => []) },
  },
}));

// Role and id both come from headers so one suite can be a stranger, a
// provider or an admin.
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers['x-test-anon']) return res.status(401).json({ message: 'no' });
    req.user = { id: req.headers['x-test-user'] || 'staff', role: req.headers['x-test-role'] || 'EDUCATION_PROVIDER', email: 'x@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (!req.headers['x-test-anon']) {
      req.user = { id: req.headers['x-test-user'] || 'staff', role: req.headers['x-test-role'] || 'EDUCATION_PROVIDER', email: 'x@athena.com' };
    }
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => (roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'no' })),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const whereOf = (call = 0) => prisma.apprenticeship.findMany.mock.calls[call][0].where;

describe('Who can see an unpublished apprenticeship', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findMany.mockResolvedValue([]);
  });

  it('shows only open listings to a visitor, whatever status they ask for', async () => {
    await request(app).get('/api/apprenticeships?status=DRAFT').set({ 'x-test-anon': '1' }).expect(200);
    expect(whereOf()).toMatchObject({ status: 'OPEN' });
  });

  it('shows only open listings to a member who is staff of nothing', async () => {
    await request(app).get('/api/apprenticeships?status=DRAFT').set({ 'x-test-user': 'nosy' }).expect(200);
    expect(whereOf()).toMatchObject({ status: 'OPEN' });
  });

  it('shows a provider her own drafts and nobody else’s', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ organizationId: 'org1' }]);
    await request(app).get('/api/apprenticeships?status=DRAFT').set({ 'x-test-user': 'staff' }).expect(200);
    const where = whereOf();
    expect(where.status).toBe('DRAFT');
    expect(where.OR).toEqual([{ rtoId: { in: ['org1'] } }, { hostEmployerId: { in: ['org1'] } }]);
  });

  it('lets an admin see any status', async () => {
    await request(app).get('/api/apprenticeships?status=CLOSED').set({ 'x-test-user': 'boss', 'x-test-role': 'ADMIN' }).expect(200);
    expect(whereOf()).toMatchObject({ status: 'CLOSED' });
    expect(whereOf().OR).toBeUndefined();
  });
});

describe('A provider’s own apprenticeships', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists everything her organizations own, drafts included', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ organizationId: 'org1' }, { organizationId: 'org2' }]);
    prisma.apprenticeship.findMany.mockResolvedValue([{ id: 'a1', title: 'Carpentry', status: 'DRAFT', _count: { applications: 0 } }]);

    const res = await request(app).get('/api/apprenticeships/mine').set({ 'x-test-user': 'staff' }).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(whereOf().OR).toEqual([{ rtoId: { in: ['org1', 'org2'] } }, { hostEmployerId: { in: ['org1', 'org2'] } }]);
  });

  it('is empty, not everybody’s, for a provider who belongs to no organization', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/apprenticeships/mine').set({ 'x-test-user': 'staff' }).expect(200);
    expect(res.body.data).toEqual([]);
    expect(prisma.apprenticeship.findMany).not.toHaveBeenCalled();
  });

  it('is closed to a member without a provider or employer role', async () => {
    await request(app).get('/api/apprenticeships/mine').set({ 'x-test-user': 'learner', 'x-test-role': 'USER' }).expect(403);
  });

  it('is not swallowed by the id route', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([{ organizationId: 'org1' }]);
    await request(app).get('/api/apprenticeships/mine').set({ 'x-test-user': 'staff' }).expect(200);
    expect(prisma.apprenticeship.findUnique).not.toHaveBeenCalled();
  });
});
