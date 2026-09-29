import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Row } from './support/prisma-where';

/**
 * How /api/inventory turns movements into stock on hand.
 *
 * Who may see and move which stock is covered in
 * src/routes/__tests__/inventory.scope.test.ts. What nothing covered was the
 * arithmetic a sole trader reads her shelf from: the sign each kind of
 * movement is stored with, the cost worked out from a unit cost, and the sum
 * GET /stock-levels makes per item and place. A sale typed as "3" has to take
 * three off, not add them, whichever sign she used.
 */

const ADA = 'ada';
const ORG = '11111111-1111-4111-8111-111111111111';
const ITEM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_ITEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SHOP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STORE_ROOM = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const db = {
  items: [] as Row[],
  locations: [] as Row[],
  transactions: [] as Row[],
};

jest.mock('../src/utils/prisma', () => {
  const where = (jest.requireActual('./support/prisma-where') as typeof import('./support/prisma-where')).matchesWhere;
  const byId = (rows: Row[], id: unknown) => rows.find((row) => row.id === id) ?? null;
  return {
    prisma: {
      inventoryItem: { findUnique: async (args: { where: { id: string } }) => byId(db.items, args.where.id) },
      inventoryLocation: { findUnique: async (args: { where: { id: string } }) => byId(db.locations, args.where.id) },
      inventoryTransaction: {
        create: async ({ data }: { data: Row }) => {
          const row = {
            id: `tx-${db.transactions.length + 1}`,
            ...data,
            locationId: data.locationId ?? null,
            item: byId(db.items, data.itemId),
            location: byId(db.locations, data.locationId),
          };
          db.transactions.push(row);
          return row;
        },
        findMany: async (args: { where?: unknown }) => db.transactions.filter((row) => where(row, args.where)),
      },
      organizationMember: {
        findFirst: async (args: { where: { organizationId: string; userId: string } }) =>
          args.where.userId === ADA && args.where.organizationId === ORG ? { id: 'membership' } : null,
        findMany: async (args: { where: { userId: string } }) => (args.where.userId === ADA ? [{ organizationId: ORG }] : []),
      },
    },
  };
});

jest.mock('../src/middleware/auth', () => {
  const actual = jest.requireActual('../src/middleware/auth') as Record<string, unknown>;
  return {
    ...actual,
    authenticate: (req: { headers: Record<string, unknown>; user?: unknown }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
      const id = req.headers['x-test-user'];
      if (typeof id !== 'string') return res.status(401).json({ success: false, message: 'Unauthorized' });
      req.user = { id, email: `${id}@example.com`, role: 'USER' };
      next();
    },
  };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';

const as = (id: string) => ({ 'x-test-user': id });

function move(body: Record<string, unknown>) {
  return request(app).post('/api/inventory/transactions').set(as(ADA)).send(body);
}

beforeEach(() => {
  db.items = [
    { id: ITEM, sku: 'CANDLE-L', name: 'Large candle', userId: ADA, organizationId: null },
    { id: ORG_ITEM, sku: 'SOAP', name: 'Soap bar', userId: null, organizationId: ORG },
  ];
  db.locations = [
    { id: SHOP, name: 'Market stall', userId: ADA, organizationId: null },
    { id: STORE_ROOM, name: 'Store room', userId: ADA, organizationId: null },
  ];
  db.transactions = [];
});

describe('Movements are stored with the sign their kind implies', () => {
  it('adds a purchase and works out its total cost from the unit cost', async () => {
    const res = await move({ itemId: ITEM, locationId: SHOP, type: 'PURCHASE', quantity: 10, unitCost: 4.5 }).expect(201);

    expect(Number(res.body.data.quantity)).toBe(10);
    expect(Number(res.body.data.totalCost)).toBe(45);
  });

  it('takes a sale off, whichever sign it was typed with', async () => {
    const typedPositive = await move({ itemId: ITEM, locationId: SHOP, type: 'SALE', quantity: 3 }).expect(201);
    const typedNegative = await move({ itemId: ITEM, locationId: SHOP, type: 'SALE', quantity: -2 }).expect(201);

    expect(Number(typedPositive.body.data.quantity)).toBe(-3);
    expect(Number(typedNegative.body.data.quantity)).toBe(-2);
  });

  it('adds a return and takes a transfer out off', async () => {
    const returned = await move({ itemId: ITEM, locationId: SHOP, type: 'RETURN', quantity: 1 }).expect(201);
    const transferred = await move({ itemId: ITEM, locationId: SHOP, type: 'TRANSFER', quantity: 4 }).expect(201);

    expect(Number(returned.body.data.quantity)).toBe(1);
    expect(Number(transferred.body.data.quantity)).toBe(-4);
  });

  it('refuses a movement of nothing, and a negative cost', async () => {
    await move({ itemId: ITEM, type: 'PURCHASE', quantity: 0 }).expect(400);
    await move({ itemId: ITEM, type: 'PURCHASE', quantity: 1, unitCost: -1 }).expect(400);
    expect(db.transactions).toHaveLength(0);
  });
});

describe('GET /api/inventory/stock-levels sums what is on each shelf', () => {
  it('adds up each item at each place, and keeps places apart', async () => {
    await move({ itemId: ITEM, locationId: SHOP, type: 'PURCHASE', quantity: 10 }).expect(201);
    await move({ itemId: ITEM, locationId: SHOP, type: 'SALE', quantity: 3 }).expect(201);
    await move({ itemId: ITEM, locationId: SHOP, type: 'RETURN', quantity: 1 }).expect(201);
    await move({ itemId: ITEM, locationId: STORE_ROOM, type: 'PURCHASE', quantity: 24 }).expect(201);
    await move({ itemId: ITEM, type: 'PURCHASE', quantity: 2 }).expect(201);

    const res = await request(app).get('/api/inventory/stock-levels').set(as(ADA)).expect(200);

    const levels = (res.body.data as Array<{ itemId: string; location?: string; quantity: number }>)
      .map(({ itemId, location, quantity }) => ({ itemId, location: location ?? null, quantity }));
    expect(levels).toHaveLength(3);
    expect(levels).toEqual(
      expect.arrayContaining([
        { itemId: ITEM, location: 'Market stall', quantity: 8 },
        { itemId: ITEM, location: 'Store room', quantity: 24 },
        { itemId: ITEM, location: null, quantity: 2 },
      ])
    );
  });

  it("counts her organisation's stock for her, and nobody's stock for a stranger", async () => {
    await move({ itemId: ORG_ITEM, type: 'PURCHASE', quantity: 50 }).expect(201);

    const hers = await request(app).get('/api/inventory/stock-levels').set(as(ADA)).expect(200);
    expect(hers.body.data).toEqual([expect.objectContaining({ itemId: ORG_ITEM, sku: 'SOAP', quantity: 50 })]);

    const stranger = await request(app).get('/api/inventory/stock-levels').set(as('mallory')).expect(200);
    expect(stranger.body.data).toEqual([]);
  });
});
