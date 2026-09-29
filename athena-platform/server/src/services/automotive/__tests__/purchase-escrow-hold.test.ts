/**
 * How long the hold behind a car purchase lasts, and what happens when it ends.
 *
 * A hold on a card lasts about a week with the live processor, and the buyer's
 * inspection period is two. BUYER_PROTECTION used to cover the gap with a
 * promise — "ATHENA asks the buyer to re-authorise" — that no code kept. These
 * cover the parts of the replacement that live in purchase-escrow.service: the
 * day a hold runs out, asking the processor when no webhook has said, and the
 * second hold a buyer takes when the first ran out before the handover, which
 * used to be taken and then ignored.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, any>;

const DAY = 86400000;
const NOW = new Date('2026-09-26T01:00:00Z');

const store: { purchase: Row | null; escrowUpdates: Row[]; purchaseUpdates: Row[]; notifications: Row[] } = { purchase: null, escrowUpdates: [], purchaseUpdates: [], notifications: [] };
const retrieve = jest.fn<(id: string) => Promise<Row>>();
let live = true;

jest.mock('../../../utils/prisma', () => ({
  prisma: {
    vehiclePurchase: {
      findUnique: jest.fn(async () => (store.purchase ? { ...store.purchase } : null)),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const p = store.purchase;
        const matches = Boolean(p) && p!.id === where.id && p!.status === where.status && (where.paidAt === undefined || p!.paidAt?.getTime() === where.paidAt?.getTime());
        if (matches) { Object.assign(p!, data); store.purchaseUpdates.push(data); }
        return { count: matches ? 1 : 0 };
      }),
    },
    escrowPayment: {
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => { store.escrowUpdates.push({ where, data }); return { count: 1 }; }),
    },
    notification: {
      create: jest.fn(async ({ data }: { data: Row }) => { store.notifications.push(data); return data; }),
    },
  },
}));
jest.mock('../../../utils/stripe', () => ({
  isStripeConfigured: () => live,
  getStripe: () => ({ paymentIntents: { retrieve: (id: string) => retrieve(id) } }),
}));
jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (v: unknown) => v,
}));

import { CARD_HOLD_DAYS, holdHasEnded, holdLapsesAt, recheckLiveHold, settlePurchaseHold } from '../purchase-escrow.service';

beforeEach(() => {
  jest.clearAllMocks();
  live = true;
  store.purchase = null;
  store.escrowUpdates = [];
  store.purchaseUpdates = [];
  store.notifications = [];
});

describe('when a hold runs out', () => {
  it('is about seven days after it was taken, for a live, uncaptured hold only', () => {
    const paidAt = new Date(NOW.getTime() - 2 * DAY);
    expect(CARD_HOLD_DAYS).toBe(7);
    expect(holdLapsesAt({ paidAt, escrow: { status: 'AUTHORIZED', paymentIntentId: 'pi_live' } })?.getTime()).toBe(paidAt.getTime() + 7 * DAY);
    // The development processor's holds never run out, and neither does money
    // already captured or a hold already over.
    expect(holdLapsesAt({ paidAt, escrow: { status: 'AUTHORIZED', paymentIntentId: 'pi_mock_1' } })).toBeNull();
    expect(holdLapsesAt({ paidAt, escrow: { status: 'CAPTURED', paymentIntentId: 'pi_live' } })).toBeNull();
    expect(holdLapsesAt({ paidAt: null, escrow: { status: 'AUTHORIZED', paymentIntentId: 'pi_live' } })).toBeNull();
    live = false;
    expect(holdLapsesAt({ paidAt, escrow: { status: 'AUTHORIZED', paymentIntentId: 'pi_live' } })).toBeNull();
  });

  it('knows a hold has ended only from what the row says', () => {
    expect(holdHasEnded({ status: 'CANCELED' })).toBe(true);
    expect(holdHasEnded({ status: 'FAILED' })).toBe(true);
    expect(holdHasEnded({ status: 'AUTHORIZED' })).toBe(false);
    expect(holdHasEnded(null)).toBe(false);
  });
});

describe('asking the processor about a hold no webhook has recorded', () => {
  it('records a hold the processor has let go, and says it is gone', async () => {
    retrieve.mockResolvedValue({ id: 'pi_live', status: 'canceled', cancellation_reason: 'automatic' });
    expect(await recheckLiveHold({ id: 'e1', status: 'AUTHORIZED', paymentIntentId: 'pi_live' })).toBe('GONE');
    expect(store.escrowUpdates).toEqual([{ where: { id: 'e1', status: 'AUTHORIZED' }, data: expect.objectContaining({ status: 'CANCELED', cancelReason: 'The hold on the card ran out' }) }]);
  });

  it('leaves a hold that is still there alone', async () => {
    retrieve.mockResolvedValue({ id: 'pi_live', status: 'requires_capture' });
    expect(await recheckLiveHold({ id: 'e1', status: 'AUTHORIZED', paymentIntentId: 'pi_live' })).toBe('HELD');
    expect(store.escrowUpdates).toEqual([]);
  });

  it('never reads an unreachable processor as money gone', async () => {
    retrieve.mockRejectedValue(new Error('connect ETIMEDOUT'));
    expect(await recheckLiveHold({ id: 'e1', status: 'AUTHORIZED', paymentIntentId: 'pi_live' })).toBeNull();
    expect(store.escrowUpdates).toEqual([]);
  });

  it('does not ask about a mock hold or one the row already calls over', async () => {
    expect(await recheckLiveHold({ id: 'e1', status: 'AUTHORIZED', paymentIntentId: 'pi_mock_1' })).toBeNull();
    expect(await recheckLiveHold({ id: 'e1', status: 'CANCELED', paymentIntentId: 'pi_live' })).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe('the hold behind a purchase', () => {
  const purchase = (over: Row): Row => ({
    id: 'p1', status: 'ACCEPTED', sellerId: 'seller', offerAmount: 18000, agreedAmount: 18000, paidAt: null,
    escrow: { id: 'e1', status: 'AUTHORIZED', paymentIntentId: 'pi_live', createdAt: new Date(NOW.getTime() - 10 * 60 * 1000) },
    listing: { title: '2019 Mazda CX-5 Maxx' },
    ...over,
  });

  it('tells the seller how long a live hold lasts when the buyer first pays', async () => {
    store.purchase = purchase({});
    expect(await settlePurchaseHold('p1', NOW)).toEqual({ state: 'HELD', status: 'PAID_HELD' });
    const told = store.notifications.find((n) => n.data.kind === 'CAR_PAID');
    expect(told?.message).toContain('about 7 days');
    // The old wording promised a release the hold could not last until.
    expect(told?.message).not.toContain('it is released to you after the buyer\'s inspection period');
  });

  it('takes a second hold after the first ran out, restarts its clock and tells the seller, once', async () => {
    const firstPaid = new Date(NOW.getTime() - 9 * DAY);
    store.purchase = purchase({ status: 'PAID_HELD', paidAt: firstPaid });
    expect(await settlePurchaseHold('p1', NOW)).toEqual({ state: 'HELD', status: 'PAID_HELD' });
    expect(store.purchase!.paidAt).toEqual(NOW);
    expect(store.notifications.map((n) => n.data.kind)).toEqual(['CAR_PAID_AGAIN']);
    expect(store.notifications[0].userId).toBe('seller');

    // The other door arriving a moment later changes nothing and says nothing.
    await settlePurchaseHold('p1', new Date(NOW.getTime() + 1000));
    expect(store.notifications).toHaveLength(1);
    expect(store.purchase!.paidAt).toEqual(NOW);
  });

  it('does not mistake the first hold for a second one', async () => {
    // The old pay route wrote paidAt in the same request that created the
    // intent, so the two sit a moment apart; that is one hold, not two.
    const createdAt = new Date(NOW.getTime() - 3 * DAY);
    store.purchase = purchase({ status: 'PAID_HELD', paidAt: new Date(createdAt.getTime() + 50), escrow: { id: 'e1', status: 'AUTHORIZED', paymentIntentId: 'pi_live', createdAt } });
    await settlePurchaseHold('p1', NOW);
    expect(store.notifications).toEqual([]);
    expect(store.purchaseUpdates).toEqual([]);
  });
});
