import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    inventoryItem: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    inventoryLocation: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn() },
    inventoryTransaction: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn() },
    organizationMember: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
  },
}));

let mockUserId = 'ada';

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: mockUserId, role: 'USER', email: `${mockUserId}@athena.com` };
      next();
    },
  };
});

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const ADA_ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';
const LOCATION = '44444444-4444-4444-8444-444444444444';

describe('Inventory is scoped to the caller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'ada';
    prisma.organizationMember.findMany.mockResolvedValue([{ organizationId: ADA_ORG }]);
    prisma.organizationMember.findFirst.mockResolvedValue(null);
  });

  it('lists her own stock and her organisations’, never the whole table', async () => {
    await request(app).get('/api/inventory/items').expect(200);

    const where = prisma.inventoryItem.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ OR: [{ userId: 'ada' }, { organizationId: { in: [ADA_ORG] } }] });
  });

  it('refuses an organisation she is not a member of instead of reading it', async () => {
    const res = await request(app).get(`/api/inventory/items?organizationId=${OTHER_ORG}`).expect(403);
    expect(res.body.error || res.body.message).toBeDefined();
    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();

    await request(app).get(`/api/inventory/stock-levels?organizationId=${OTHER_ORG}`).expect(403);
    expect(prisma.inventoryTransaction.findMany).not.toHaveBeenCalled();
  });

  it('narrows to an organisation she does belong to', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });
    await request(app).get(`/api/inventory/items?organizationId=${ADA_ORG}`).expect(200);
    expect(prisma.inventoryItem.findMany.mock.calls[0][0].where).toEqual({ organizationId: ADA_ORG });
  });

  it('will not create stock inside someone else’s organisation', async () => {
    const res = await request(app)
      .post('/api/inventory/items')
      .send({ organizationId: OTHER_ORG, sku: 'SKU-1', name: 'Candles' })
      .expect(403);
    expect(res.body).toBeDefined();
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it('stamps a personal item with its owner so it is hers alone', async () => {
    prisma.inventoryItem.create.mockResolvedValue({ id: ITEM });
    await request(app).post('/api/inventory/items').send({ sku: 'SKU-1', name: 'Candles' }).expect(201);
    expect(prisma.inventoryItem.create.mock.calls[0][0].data).toMatchObject({ userId: 'ada', organizationId: undefined });
  });

  it('a second user cannot edit, delete or move another woman’s stock', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({ organizationId: null, userId: 'ada' });
    mockUserId = 'bea';

    await request(app).patch(`/api/inventory/items/${ITEM}`).send({ name: 'Renamed' }).expect(403);
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled();

    await request(app).delete(`/api/inventory/items/${ITEM}`).expect(403);
    expect(prisma.inventoryItem.delete).not.toHaveBeenCalled();

    await request(app)
      .post('/api/inventory/transactions')
      .send({ itemId: ITEM, type: 'SALE', quantity: 5 })
      .expect(403);
    expect(prisma.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  it('a row from before the owner column belongs to nobody rather than everybody', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({ organizationId: null, userId: null });
    await request(app).patch(`/api/inventory/items/${ITEM}`).send({ name: 'Renamed' }).expect(403);
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
  });

  it('refuses a movement that files an item into another set of books’ location', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({ organizationId: null, userId: 'ada' });
    prisma.inventoryLocation.findUnique.mockResolvedValue({ organizationId: null, userId: 'ada' });
    prisma.inventoryTransaction.create.mockResolvedValue({ id: 'tx1' });
    await request(app)
      .post('/api/inventory/transactions')
      .send({ itemId: ITEM, locationId: LOCATION, type: 'PURCHASE', quantity: 5 })
      .expect(201);

    jest.clearAllMocks();
    prisma.inventoryItem.findUnique.mockResolvedValue({ organizationId: ADA_ORG, userId: null });
    prisma.inventoryLocation.findUnique.mockResolvedValue({ organizationId: null, userId: 'ada' });
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });
    await request(app)
      .post('/api/inventory/transactions')
      .send({ itemId: ITEM, locationId: LOCATION, type: 'PURCHASE', quantity: 5 })
      .expect(400);
    expect(prisma.inventoryTransaction.create).not.toHaveBeenCalled();
  });
});
