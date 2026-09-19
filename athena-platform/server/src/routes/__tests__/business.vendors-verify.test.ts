import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Vendor verification: the public directory shows verified listings only,
// the queue and the decision belong to an admin, and the owner is told.

jest.mock('../../utils/prisma', () => ({
  prisma: {
    vendor: {
      create: jest.fn(async ({ data }: any) => ({ id: 'v-new', ...data })),
      findUnique: jest.fn(async () => ({ id: 'v1', name: 'Byte Studio', ownerId: 'ana' })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, name: 'Byte Studio', ...data })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    user: { findMany: jest.fn(async () => [{ id: 'admin-1' }]) },
    notification: { create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 1 })) },
  },
}));

// Who is calling comes from headers so one suite can be anonymous, a member or an admin.
jest.mock('../../middleware/auth', () => {
  const userFrom = (req: any) =>
    req.headers['x-test-user']
      ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: `${req.headers['x-test-user']}@example.com` }
      : null;
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
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
const lastWhere = () => prisma.vendor.findMany.mock.calls.at(-1)[0].where;

describe('The public vendor directory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows verified listings only to a visitor, whatever she asks for', async () => {
    await request(app).get('/api/business/vendors').expect(200);
    expect(lastWhere()).toEqual({ isVerified: true });

    await request(app).get('/api/business/vendors?verified=false').expect(200);
    expect(lastWhere()).toEqual({ isVerified: true });
  });

  it('shows verified listings only to a member', async () => {
    await request(app).get('/api/business/vendors?category=LEGAL').set(as('ana')).expect(200);
    expect(lastWhere()).toEqual({ category: 'LEGAL', isVerified: true });
  });

  it('lets an admin see everything, and still narrow to verified', async () => {
    await request(app).get('/api/business/vendors').set(as('boss', 'ADMIN')).expect(200);
    expect(lastWhere()).toEqual({});

    await request(app).get('/api/business/vendors?verified=true').set(as('boss', 'ADMIN')).expect(200);
    expect(lastWhere()).toEqual({ isVerified: true });
  });
});

describe('The vendor verification queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is closed to members', async () => {
    await request(app).get('/api/business/vendors/pending').set(as('ana')).expect(403);
    await request(app).get('/api/business/vendors/pending').expect(401);
    expect(prisma.vendor.findMany).not.toHaveBeenCalled();
  });

  it('lists member-registered listings nobody has verified, oldest first, with the owner', async () => {
    prisma.vendor.findMany.mockResolvedValueOnce([{ id: 'v1', name: 'Byte Studio', isVerified: false, owner: { id: 'ana', email: 'ana@example.com' } }]);
    const res = await request(app).get('/api/business/vendors/pending').set(as('boss', 'ADMIN')).expect(200);

    const query = prisma.vendor.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ isVerified: false, ownerId: { not: null } });
    expect(query.orderBy).toEqual({ createdAt: 'asc' });
    expect(query.include.owner).toBeTruthy();
    expect(res.body.data[0].owner.email).toBe('ana@example.com');
    // "pending" is a queue, not an id: the detail route was never consulted.
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it('a new registration reaches the admins with the queue link', async () => {
    await request(app)
      .post('/api/business/vendors')
      .set(as('ana'))
      .send({ name: 'Byte Studio', category: 'TECH_DEVELOPMENT', website: 'https://byte.studio' })
      .expect(201);

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'ADMIN' } }));
    const notices = prisma.notification.createMany.mock.calls[0][0].data;
    expect(notices).toEqual([expect.objectContaining({ userId: 'admin-1', title: 'A business wants to join the vendor directory', link: '/admin/vendors', data: { kind: 'VENDOR_VERIFY', vendorId: 'v-new' } })]);
  });
});

describe('The admin decision on a vendor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is an admin’s alone', async () => {
    await request(app).patch('/api/business/vendors/v1/verify').set(as('ana')).send({ isVerified: true }).expect(403);
    expect(prisma.vendor.update).not.toHaveBeenCalled();
  });

  it('refuses a decision that is not a boolean', async () => {
    await request(app).patch('/api/business/vendors/v1/verify').set(as('boss', 'ADMIN')).send({ isVerified: 'yes please' }).expect(400);
  });

  it('verifying lists the vendor and tells the owner', async () => {
    const res = await request(app).patch('/api/business/vendors/v1/verify').set(as('boss', 'ADMIN')).send({ isVerified: true }).expect(200);

    expect(prisma.vendor.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { isVerified: true } });
    expect(res.body.data.isVerified).toBe(true);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'ana', title: 'Your business is listed', link: '/dashboard/vendors', data: { kind: 'VENDOR_VERIFY', vendorId: 'v1', isVerified: true } });
  });

  it('verifying as a partner sets both flags', async () => {
    await request(app).patch('/api/business/vendors/v1/verify').set(as('boss', 'ADMIN')).send({ isVerified: true, isPartner: true }).expect(200);
    expect(prisma.vendor.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { isVerified: true, isPartner: true } });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('as an ATHENA partner');
  });

  it('hiding ends the partnership too and tells the owner', async () => {
    await request(app).patch('/api/business/vendors/v1/verify').set(as('boss', 'ADMIN')).send({ isVerified: false, isPartner: true }).expect(200);
    expect(prisma.vendor.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { isVerified: false, isPartner: false } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'ana', title: 'Your listing has been hidden' });
  });

  it('says so when the vendor does not exist, and stays quiet for a listing nobody owns', async () => {
    prisma.vendor.findUnique.mockResolvedValueOnce(null);
    await request(app).patch('/api/business/vendors/nope/verify').set(as('boss', 'ADMIN')).send({ isVerified: true }).expect(404);

    prisma.vendor.findUnique.mockResolvedValueOnce({ id: 'v2', name: 'Catalogue Co', ownerId: null });
    await request(app).patch('/api/business/vendors/v2/verify').set(as('boss', 'ADMIN')).send({ isVerified: true }).expect(200);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
