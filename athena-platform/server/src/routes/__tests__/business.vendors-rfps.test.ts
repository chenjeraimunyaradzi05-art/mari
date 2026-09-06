import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    vendor: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(async () => []) },
    rfp: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    rfpResponse: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(async () => ({ id: 'p1', status: 'SELECTED' })),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () => []),
    },
    notification: { create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

// Who is calling comes from headers so one suite can be buyer, vendor or stranger.
jest.mock('../../middleware/auth', () => {
  const userFrom = (req: any) =>
    req.headers['x-test-user']
      ? { id: req.headers['x-test-user'], role: 'USER', email: req.headers['x-test-email'] || `${req.headers['x-test-user']}@example.com` }
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
const as = (userId: string, email?: string) => ({ 'x-test-user': userId, ...(email ? { 'x-test-email': email } : {}) });

describe('Vendor accounts and RFP responses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a member registers her business as a vendor she owns', async () => {
    prisma.vendor.create.mockImplementation(async ({ data }: any) => ({ id: 'v-new', ...data }));

    const res = await request(app)
      .post('/api/business/vendors')
      .set(as('ana'))
      .send({ name: 'Byte Studio', category: 'TECH_DEVELOPMENT', services: ['Web apps', ''], website: 'https://byte.studio' })
      .expect(201);

    expect(prisma.vendor.create.mock.calls[0][0].data).toMatchObject({ ownerId: 'ana', name: 'Byte Studio', services: ['Web apps'], isVerified: false });
    expect(res.body.data.id).toBe('v-new');
  });

  it('a catalogue entry can be claimed only from its own domain, and only once', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ id: 'v1', ownerId: null, email: 'hello@byte.co', name: 'Byte' });
    prisma.vendor.update.mockResolvedValue({ id: 'v1', ownerId: 'ana' });

    await request(app).post('/api/business/vendors/v1/claim').set(as('ana', 'ana@gmail.com')).expect(403);
    await request(app).post('/api/business/vendors/v1/claim').set(as('ana', 'ana@byte.co')).expect(200);
    expect(prisma.vendor.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { ownerId: 'ana' } });

    prisma.vendor.findUnique.mockResolvedValue({ id: 'v1', ownerId: 'someone', email: null });
    await request(app).post('/api/business/vendors/v1/claim').set(as('ana')).expect(409);
  });

  it('only a vendor’s owner can pitch, once per RFP, and the buyer is told', async () => {
    prisma.rfp.findUnique.mockResolvedValue({ id: 'r1', userId: 'buyer', status: 'OPEN', title: 'New website' });
    prisma.vendor.findUnique.mockResolvedValue({ id: 'v1', ownerId: 'ana', name: 'Byte Studio' });
    prisma.rfpResponse.findUnique.mockResolvedValue(null);
    prisma.rfpResponse.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data, vendor: { id: 'v1', name: 'Byte Studio' } }));

    await request(app)
      .post('/api/business/rfps/r1/responses')
      .set(as('ana'))
      .send({ vendorId: 'v1', proposal: 'We can build this in six weeks.', priceQuote: 12000, timeline: '6 weeks' })
      .expect(201);
    expect(prisma.rfpResponse.create.mock.calls[0][0].data).toMatchObject({ rfpId: 'r1', vendorId: 'v1', priceQuote: 12000 });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'buyer', link: '/dashboard/rfps?rfp=r1' });

    // Not the owner of that vendor.
    await request(app).post('/api/business/rfps/r1/responses').set(as('mia')).send({ vendorId: 'v1', proposal: 'Me too' }).expect(403);

    // Already pitched.
    prisma.rfpResponse.findUnique.mockResolvedValue({ id: 'p1' });
    await request(app).post('/api/business/rfps/r1/responses').set(as('ana')).send({ vendorId: 'v1', proposal: 'Again' }).expect(409);
  });

  it('selecting a proposal awards the RFP, passes on the rest and tells the vendors', async () => {
    prisma.rfp.findUnique.mockResolvedValue({ id: 'r1', userId: 'buyer', status: 'OPEN', title: 'New website' });
    prisma.rfpResponse.findUnique.mockResolvedValue({ id: 'p1', rfpId: 'r1', vendor: { id: 'v1', name: 'Byte Studio', ownerId: 'ana' } });
    prisma.rfpResponse.findMany.mockResolvedValue([{ vendor: { ownerId: 'mia' } }, { vendor: { ownerId: null } }]);

    await request(app).patch('/api/business/rfps/r1/responses/p1').set(as('stranger')).send({ status: 'SELECTED' }).expect(403);

    await request(app).patch('/api/business/rfps/r1/responses/p1').set(as('buyer')).send({ status: 'SELECTED' }).expect(200);
    expect(prisma.rfpResponse.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'SELECTED', isSelected: true } });
    expect(prisma.rfpResponse.updateMany.mock.calls[0][0].data).toEqual({ status: 'REJECTED', isSelected: false });
    expect(prisma.rfp.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'AWARDED' } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'ana', title: 'Your proposal was selected' });
    expect(prisma.notification.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ userId: 'mia', title: 'Proposal not selected' })]);
  });

  it('proposals and prices are the buyer’s to see; a vendor sees only her own', async () => {
    prisma.rfp.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'buyer',
      status: 'OPEN',
      title: 'New website',
      user: { id: 'buyer' },
      responses: [
        { id: 'p1', priceQuote: 12000, vendor: { id: 'v1', ownerId: 'ana' } },
        { id: 'p2', priceQuote: 9000, vendor: { id: 'v2', ownerId: 'mia' } },
      ],
    });

    const asBuyer = await request(app).get('/api/business/rfps/r1').set(as('buyer')).expect(200);
    expect(asBuyer.body.data.responses).toHaveLength(2);

    const asVendor = await request(app).get('/api/business/rfps/r1').set(as('ana')).expect(200);
    expect(asVendor.body.data.responses.map((r: any) => r.id)).toEqual(['p1']);
    expect(asVendor.body.data.responseCount).toBe(2);

    const asAnyone = await request(app).get('/api/business/rfps/r1').expect(200);
    expect(asAnyone.body.data.responses).toHaveLength(0);
  });
});
