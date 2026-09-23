/**
 * The purchase sweep, and what it does when the money will not move.
 *
 * The release used to end in `logger.warn` and nothing else: a purchase whose
 * hold had never been authorised sat at HANDED_OVER for as long as the row
 * existed, the same capture failing every six hours, the seller unpaid and
 * neither side told a thing. These cover the three ways that ends now — it
 * works, it is retried and logged, or it stops and everybody hears about it —
 * and the cleanup of purchases marked paid against a card that never went
 * through.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, unknown>;

const store: { purchases: Row[]; notifications: Row[]; listings: Row[] } = { purchases: [], notifications: [], listings: [] };

jest.mock('../../../utils/prisma', () => ({
  prisma: {
    vehiclePurchase: {
      findMany: jest.fn(async ({ where }: { where: Record<string, any> }) =>
        store.purchases
          .filter((p) => p.status === where.status)
          .filter((p) => (where.inspectionEndsAt ? p.inspectionEndsAt !== null && p.inspectionEndsAt !== undefined : true))
          .filter((p) => (where.paidAt?.lt ? Boolean(p.paidAt) && (p.paidAt as Date) < where.paidAt.lt : true))
          .filter((p) => (where.escrow?.status?.notIn ? Boolean(p.escrow) && !where.escrow.status.notIn.includes((p.escrow as Row).status) : true))
          .map((p) => ({ ...p })),
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = store.purchases.find((p) => p.id === where.id);
        if (!row) throw new Error(`no purchase ${where.id}`);
        Object.assign(row, data);
        return row;
      }),
      count: jest.fn(async () => 0),
    },
    vehicleListing: { update: jest.fn(async ({ data }: { data: Row }) => data) },
    notification: {
      create: jest.fn(async ({ data }: { data: Row }) => { store.notifications.push(data); return data; }),
      findFirst: jest.fn(async () => null),
    },
    user: { findMany: jest.fn(async () => [{ id: 'admin' }]) },
    vehicle: { findMany: jest.fn(async () => []), update: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../../utils/redis', () => ({ runExclusively: jest.fn(async (_k: string, fn: () => unknown) => fn()) }));
jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (v: unknown) => v,
}));
jest.mock('../../stripe-connect.service', () => ({
  captureEscrowPayment: jest.fn(async () => ({ status: 'captured', amountCaptured: 100 })),
  cancelEscrowPayment: jest.fn(async () => ({ status: 'canceled' })),
}));
jest.mock('../purchase-escrow.service', () => ({
  readHoldState: jest.fn(async () => 'AWAITING_CARD'),
  settlePurchaseHold: jest.fn(async () => ({ state: 'HELD', status: 'PAID_HELD' })),
}));

import { sweepPurchases } from '../automotive-reminders.service';
import { logger } from '../../../utils/logger';
import { cancelEscrowPayment, captureEscrowPayment } from '../../stripe-connect.service';
import { readHoldState, settlePurchaseHold } from '../purchase-escrow.service';

const DAY = 86400000;
const NOW = new Date('2026-09-23T09:00:00Z');

/** A car handed over, with the inspection period already behind it by `endedDaysAgo`. */
const handedOver = (endedDaysAgo: number, escrowStatus: string | null = 'AUTHORIZED'): Row => ({
  id: 'p1', buyerId: 'buyer', sellerId: 'seller', listingId: 'l1', status: 'HANDED_OVER',
  offerAmount: 21000, agreedAmount: 21000, paidAt: new Date(NOW.getTime() - 30 * DAY),
  inspectionEndsAt: new Date(NOW.getTime() - endedDaysAgo * DAY),
  escrow: escrowStatus ? { id: 'e1', paymentIntentId: 'pi_1', status: escrowStatus } : null,
  listing: { id: 'l1', title: '2020 Toyota Corolla hybrid', status: 'UNDER_OFFER' },
});

const kinds = () => store.notifications.map((n) => (n.data as Row).kind);

describe('the car purchase sweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.purchases = [];
    store.notifications = [];
    (captureEscrowPayment as jest.Mock).mockImplementation(async () => ({ status: 'captured', amountCaptured: 100 }));
    (readHoldState as jest.Mock).mockImplementation(async () => 'AWAITING_CARD');
  });

  it('releases the money when the inspection period has passed, and tells both sides', async () => {
    store.purchases = [handedOver(1)];
    const result = await sweepPurchases(NOW);
    expect(result).toMatchObject({ released: 1, stuck: 0 });
    expect(store.purchases[0].status).toBe('RELEASED');
    expect(kinds()).toEqual(expect.arrayContaining(['CAR_PURCHASE_RELEASED', 'CAR_PURCHASE_COMPLETE']));
  });

  it('keeps trying inside the grace period, leaves the purchase alone, and puts the failure in the log with the purchase it belongs to', async () => {
    store.purchases = [handedOver(1)];
    (captureEscrowPayment as jest.Mock).mockImplementation(async () => { throw new Error('The PaymentIntent cannot be captured'); });
    const result = await sweepPurchases(NOW);
    expect(result).toMatchObject({ released: 0, stuck: 1 });
    // Still HANDED_OVER, so the next sweep tries again — but the reason is
    // written down, and named for the sale it belongs to, which is the whole
    // difference from the `logger.warn('could not be released')` this replaced.
    expect(store.purchases[0].status).toBe('HANDED_OVER');
    expect(store.notifications).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('automotive.purchase-release.p1'), expect.objectContaining({ error: 'The PaymentIntent cannot be captured' }));
  });

  it('stops trying past the grace period, and nobody is left waiting in silence', async () => {
    store.purchases = [handedOver(4, 'PENDING')];
    (captureEscrowPayment as jest.Mock).mockImplementation(async () => { throw new Error('The PaymentIntent cannot be captured') });
    const result = await sweepPurchases(NOW);
    expect(result).toMatchObject({ released: 0, stuck: 1 });
    expect(store.purchases[0].status).toBe('DISPUTED');
    expect(String(store.purchases[0].disputeReason)).toContain('never authorised');
    // The buyer, the seller and ATHENA, because the car is already gone and
    // only a person can decide what happens next.
    expect(store.notifications.filter((n) => (n.data as Row).kind === 'CAR_RELEASE_FAILED').map((n) => n.userId).sort()).toEqual(['admin', 'buyer', 'seller']);
    // And it is out of the sweep's own query, so the failure stops repeating.
    store.notifications = [];
    expect(await sweepPurchases(NOW)).toMatchObject({ released: 0, stuck: 0 });
    expect(store.notifications).toHaveLength(0);
  });

  it('lets go of a purchase marked paid against a card that was never authorised, and puts the car back on the market', async () => {
    store.purchases = [{ ...handedOver(0, 'PENDING'), status: 'PAID_HELD', inspectionEndsAt: null }];
    const result = await sweepPurchases(NOW);
    expect(result.abandoned).toBe(1);
    expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'buyer' }, 'The card was never authorised');
    expect(store.purchases[0].status).toBe('CANCELLED');
    expect(store.notifications.filter((n) => (n.data as Row).kind === 'CAR_PURCHASE_CANCELLED').map((n) => n.userId).sort()).toEqual(['buyer', 'seller']);
  });

  it('finishes a purchase whose hold was real all along and whose webhook simply never landed', async () => {
    store.purchases = [{ ...handedOver(0, 'PENDING'), status: 'PAID_HELD', inspectionEndsAt: null }];
    (readHoldState as jest.Mock).mockImplementation(async () => 'HELD');
    const result = await sweepPurchases(NOW);
    expect(result.abandoned).toBe(0);
    expect(settlePurchaseHold).toHaveBeenCalledWith('p1', NOW);
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(store.purchases[0].status).toBe('PAID_HELD');
  });
});
