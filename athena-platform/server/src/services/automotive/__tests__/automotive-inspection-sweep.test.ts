/**
 * The inspection requests nobody takes.
 *
 * A request used to be announced once, to at most ten workshops, and then
 * left: no reminder, no escalation, so it could sit at REQUESTED for as long
 * as the listing lasted while the buyer waited to hear from somebody. These
 * cover what happens past three days now — the workshops that were never
 * told are told, the buyer hears plainly that nobody has taken it, the admins
 * hear it has gone stale — and that it happens once, not every six hours.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, any>;

const store: { inspections: Row[]; mechanics: Row[]; notifications: Row[] } = { inspections: [], mechanics: [], notifications: [] };

jest.mock('../../../utils/prisma', () => ({
  prisma: {
    vehicleInspection: {
      findMany: jest.fn(async ({ where }: { where: Row }) =>
        store.inspections
          .filter((i) => i.status === where.status && i.kind !== where.kind.not && i.createdAt < where.createdAt.lt && where.listing.status.in.includes(i.listing.status))
          .map((i) => ({ ...i })),
      ),
    },
    mechanic: {
      findMany: jest.fn(async ({ where, skip = 0, take }: { where: Row; skip?: number; take: number }) =>
        store.mechanics
          .filter((m) => m.isActive && m.isVerified && m.doesInspections && m.ownerUserId && (!where.state || m.state === where.state))
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(skip, skip + take)
          .map((m) => ({ ownerUserId: m.ownerUserId })),
      ),
    },
    notification: {
      create: jest.fn(async ({ data }: { data: Row }) => { store.notifications.push(data); return data; }),
      // The duplicate check reads inside the Json column; the double answers it
      // the way Postgres would, so "already told" means a row really exists.
      findFirst: jest.fn(async ({ where }: { where: Row }) => store.notifications.find((n) => n.userId === where.userId && n.data.kind === where.data.equals && n.data.id === where.AND[0].data.equals) ?? null),
    },
    user: { findMany: jest.fn(async () => [{ id: 'admin' }]) },
  },
}));

jest.mock('../../../utils/redis', () => ({ runExclusively: jest.fn(async (_k: string, fn: () => unknown) => fn()) }));
jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (v: unknown) => v,
}));
jest.mock('../../stripe-connect.service', () => ({ captureEscrowPayment: jest.fn(), cancelEscrowPayment: jest.fn() }));
jest.mock('../purchase-escrow.service', () => ({ readHoldState: jest.fn(), settlePurchaseHold: jest.fn() }));

import { sweepUntakenInspections, UNTAKEN_INSPECTION_AFTER } from '../automotive-reminders.service';

const NOW = new Date('2026-09-26T09:00:00Z');
const DAY = 86400000;

const workshop = (id: string, ownerUserId: string, state = 'QLD'): Row => ({ id, ownerUserId, state, isActive: true, isVerified: true, doesInspections: true });
const request = (daysAgo: number, over: Row = {}): Row => ({
  id: 'i1', status: 'REQUESTED', kind: 'ATHENA_VETTED', requestedById: 'buyer', createdAt: new Date(NOW.getTime() - daysAgo * DAY),
  listing: { id: 'l1', title: '2018 Honda Jazz VTi', state: 'QLD', sellerId: 'seller', status: 'ACTIVE' },
  ...over,
});
const to = (kind: string) => store.notifications.filter((n) => n.data.kind === kind).map((n) => n.userId).sort();

describe('the untaken inspection sweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.inspections = [];
    store.mechanics = [];
    store.notifications = [];
  });

  it('leaves a request alone while it is still fresh', async () => {
    store.inspections = [request(1)];
    store.mechanics = [workshop('m1', 'w1')];
    expect(UNTAKEN_INSPECTION_AFTER).toBe(3 * DAY);
    expect(await sweepUntakenInspections(NOW)).toEqual({ untaken: 0, reminded: 0 });
    expect(store.notifications).toHaveLength(0);
  });

  it('tells the workshops that never heard, the buyer and the admins, once', async () => {
    store.inspections = [request(4)];
    // w1 was told when the request was made; w2 was verified since, or was
    // past the old ten-row cut. The NSW workshop cannot reach a QLD car.
    store.mechanics = [workshop('m1', 'w1'), workshop('m2', 'w2'), workshop('m3', 'w-nsw', 'NSW')];
    store.notifications = [{ userId: 'w1', title: 'A pre-purchase inspection is wanted', data: { kind: 'CAR_INSPECTION_OPEN', id: 'i1' } }];

    expect(await sweepUntakenInspections(NOW)).toEqual({ untaken: 1, reminded: 1 });
    expect(to('CAR_INSPECTION_OPEN')).toEqual(['w1', 'w2']);
    expect(to('CAR_INSPECTION_UNTAKEN')).toEqual(['admin', 'buyer']);
    const hers = store.notifications.find((n) => n.userId === 'buyer')!;
    expect(hers.message).toContain('Nothing has been charged');
    expect(hers.message).toContain('have been reminded');

    // The next sweep, six hours on, says nothing new to anybody.
    expect(await sweepUntakenInspections(new Date(NOW.getTime() + DAY / 4))).toEqual({ untaken: 0, reminded: 0 });
    expect(store.notifications).toHaveLength(4);
  });

  it('says so plainly when no workshop in the state does inspections', async () => {
    store.inspections = [request(5)];
    store.mechanics = [workshop('m3', 'w-nsw', 'NSW')];
    await sweepUntakenInspections(NOW);
    expect(to('CAR_INSPECTION_OPEN')).toEqual([]);
    expect(store.notifications.find((n) => n.userId === 'buyer')!.message).toContain('No verified workshop in QLD does inspections yet');
  });

  it('never asks the seller or the buyer to inspect the car themselves', async () => {
    store.inspections = [request(4)];
    store.mechanics = [workshop('m1', 'seller'), workshop('m2', 'buyer'), workshop('m3', 'w3')];
    expect(await sweepUntakenInspections(NOW)).toEqual({ untaken: 1, reminded: 1 });
    expect(to('CAR_INSPECTION_OPEN')).toEqual(['w3']);
  });
});
