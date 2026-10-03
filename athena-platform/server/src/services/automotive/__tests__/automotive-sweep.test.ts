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
 *
 * And the hold itself, which with the live processor lasts about a week
 * against a two-week inspection period. BUYER_PROTECTION used to promise that
 * ATHENA "asks the buyer to re-authorise" when a bank would not hold for the
 * whole period; nothing did. These cover what happens instead: the warning two
 * days before, the buyer asked to pay once more when a hold ends before the
 * handover (rather than the sale being cancelled as a card "never
 * authorised"), a person when it ends during the period, and the processor
 * asked when no webhook has said.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, unknown>;

const store: { purchases: Row[]; notifications: Row[]; listings: Row[] } = { purchases: [], notifications: [], listings: [] };

jest.mock('../../../utils/prisma', () => ({
  prisma: {
    vehiclePurchase: {
      findMany: jest.fn(async ({ where }: { where: Record<string, any> }) =>
        store.purchases
          .filter((p) => (typeof where.status === 'string' ? p.status === where.status : where.status?.in ? where.status.in.includes(p.status) : true))
          .filter((p) => (where.inspectionEndsAt ? p.inspectionEndsAt !== null && p.inspectionEndsAt !== undefined : true))
          .filter((p) => (where.paidAt?.lt ? Boolean(p.paidAt) && (p.paidAt as Date) < where.paidAt.lt : true))
          .filter((p) => {
            const wanted = where.escrow?.status;
            if (wanted === undefined) return true;
            if (!p.escrow) return false;
            const status = (p.escrow as Row).status as string;
            return typeof wanted === 'string' ? status === wanted : !wanted.notIn.includes(status);
          })
          .map((p) => ({ ...p })),
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = store.purchases.find((p) => p.id === where.id);
        if (!row) throw new Error(`no purchase ${where.id}`);
        Object.assign(row, data);
        return row;
      }),
      // The conditional move: it matches only while the row still holds the
      // status the sweep read, which is what lets a dispute that landed in
      // between keep the row.
      updateMany: jest.fn(async ({ where, data }: { where: { id: string; status?: string }; data: Row }) => {
        const hit = store.purchases.filter((p) => p.id === where.id && (where.status === undefined || p.status === where.status));
        hit.forEach((p) => Object.assign(p, data));
        return { count: hit.length };
      }),
      count: jest.fn(async () => 0),
    },
    vehicleListing: { update: jest.fn(async ({ data }: { data: Row }) => data) },
    notification: {
      create: jest.fn(async ({ data }: { data: Row }) => { store.notifications.push(data); return data; }),
      // The duplicate check the sweeps make, answered from what has actually
      // been sent, so a second run can be seen to stay quiet.
      findFirst: jest.fn(async ({ where }: { where: { userId: string; data: { equals: string }; AND: Array<{ data: { equals: string } }> } }) =>
        store.notifications.find((n) => n.userId === where.userId && (n.data as Row).kind === where.data.equals && (n.data as Row).id === where.AND[0].data.equals) ?? null),
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
  CARD_HOLD_DAYS: 7,
  readHoldState: jest.fn(async () => 'AWAITING_CARD'),
  settlePurchaseHold: jest.fn(async () => ({ state: 'HELD', status: 'PAID_HELD' })),
  recheckLiveHold: jest.fn(async () => null),
  // The live-processor rule, without the processor: a real, uncaptured hold
  // runs out seven days after it was taken; a mock one never does.
  holdLapsesAt: (p: { paidAt: Date | null; escrow: { status: string; paymentIntentId: string | null } | null }) =>
    p.paidAt && p.escrow?.status === 'AUTHORIZED' && !String(p.escrow.paymentIntentId).startsWith('pi_mock_') ? new Date(p.paidAt.getTime() + 7 * 86400000) : null,
  holdHasEnded: (e: { status: string } | null | undefined) => Boolean(e) && ['CANCELED', 'FAILED'].includes(e!.status),
}));

import { sweepPurchases } from '../automotive-reminders.service';
import { logger } from '../../../utils/logger';
import { cancelEscrowPayment, captureEscrowPayment } from '../../stripe-connect.service';
import { readHoldState, recheckLiveHold, settlePurchaseHold } from '../purchase-escrow.service';

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
    (recheckLiveHold as jest.Mock).mockImplementation(async () => null);
  });

  it('releases the money when the inspection period has passed, and tells both sides', async () => {
    store.purchases = [handedOver(1)];
    const result = await sweepPurchases(NOW);
    expect(result).toMatchObject({ released: 1, stuck: 0 });
    expect(store.purchases[0].status).toBe('RELEASED');
    expect(kinds()).toEqual(expect.arrayContaining(['CAR_PURCHASE_RELEASED', 'CAR_PURCHASE_COMPLETE']));
  });

  it('does not mark a purchase released when the buyer disputed it while its hold was being captured, and tells nobody the money moved', async () => {
    store.purchases = [handedOver(1)];
    // Her dispute lands between the sweep reading HANDED_OVER and writing RELEASED.
    (captureEscrowPayment as jest.Mock).mockImplementation(async () => {
      Object.assign(store.purchases[0], { status: 'DISPUTED', disputeReason: 'The gearbox slips in third; it was described as faultless.', disputeOpenedAt: NOW });
      return { status: 'captured', amountCaptured: 100 };
    });
    const result = await sweepPurchases(NOW);
    expect(result).toMatchObject({ released: 0, stuck: 1 });
    // The row is hers: the status she set, the reason she gave, and no release date.
    expect(store.purchases[0].status).toBe('DISPUTED');
    expect(store.purchases[0].disputeReason).toContain('gearbox');
    expect(store.purchases[0].releasedAt).toBeUndefined();
    expect(kinds()).not.toEqual(expect.arrayContaining(['CAR_PURCHASE_RELEASED']));
    expect(kinds()).not.toEqual(expect.arrayContaining(['CAR_PURCHASE_COMPLETE']));
    // Written down with the purchase it belongs to, because the hold was captured and a person has to decide it.
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('automotive.purchase-release.p1'), expect.objectContaining({ purchaseId: 'p1' }));
  });

  it('leaves a dispute the buyer opened in place when it stops trying, rather than writing ATHENA\'s reason over hers', async () => {
    store.purchases = [handedOver(4, 'PENDING')];
    (captureEscrowPayment as jest.Mock).mockImplementation(async () => {
      Object.assign(store.purchases[0], { status: 'DISPUTED', disputeReason: 'The gearbox slips in third; it was described as faultless.', disputeOpenedAt: NOW });
      throw new Error('The PaymentIntent cannot be captured');
    });
    const result = await sweepPurchases(NOW);
    expect(result).toMatchObject({ released: 0, stuck: 1 });
    expect(store.purchases[0].disputeReason).toContain('gearbox');
    expect(String(store.purchases[0].disputeReason)).not.toContain('Opened by ATHENA');
    // Her dispute's own notifications went out from the route; the sweep's three would say the wrong thing over them.
    expect(kinds()).not.toEqual(expect.arrayContaining(['CAR_RELEASE_FAILED']));
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

/** A purchase whose hold was taken `paidDaysAgo` days ago, in the state and period given. */
const held = (status: 'PAID_HELD' | 'HANDED_OVER', paidDaysAgo: number, inspectionEndsInDays: number | null, escrowStatus = 'AUTHORIZED'): Row => ({
  id: 'p2', buyerId: 'buyer', sellerId: 'seller', listingId: 'l2', status,
  offerAmount: 18500, agreedAmount: 18000, paidAt: new Date(NOW.getTime() - paidDaysAgo * DAY),
  inspectionEndsAt: inspectionEndsInDays === null ? null : new Date(NOW.getTime() + inspectionEndsInDays * DAY),
  escrow: { id: 'e2', paymentIntentId: 'pi_2', status: escrowStatus },
  listing: { id: 'l2', title: '2019 Mazda CX-5 Maxx', status: status === 'PAID_HELD' ? 'UNDER_OFFER' : 'SOLD' },
});

const sentTo = (kind: string) => store.notifications.filter((n) => (n.data as Row).kind === kind).map((n) => n.userId).sort();
const bodyFor = (kind: string, userId: string) => String(store.notifications.find((n) => (n.data as Row).kind === kind && n.userId === userId)?.message ?? '');

describe('the hold on the buyer\'s card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.purchases = [];
    store.notifications = [];
    (captureEscrowPayment as jest.Mock).mockImplementation(async () => ({ status: 'captured', amountCaptured: 100 }));
    (readHoldState as jest.Mock).mockImplementation(async () => 'AWAITING_CARD');
    (recheckLiveHold as jest.Mock).mockImplementation(async () => null);
  });

  it('warns the buyer, the seller and the admins two days before a hold runs out inside the inspection period, once', async () => {
    store.purchases = [held('HANDED_OVER', 5.5, 9)];
    const result = await sweepPurchases(NOW);
    expect(result.lapsing).toBe(1);
    expect(sentTo('CAR_HOLD_LAPSING')).toEqual(['admin', 'buyer', 'seller']);
    // The buyer is told what she can do about it, and the seller what will
    // happen, rather than either being told the money is safe.
    expect(bodyFor('CAR_HOLD_LAPSING', 'buyer')).toContain('release the money before then');
    expect(bodyFor('CAR_HOLD_LAPSING', 'seller')).toContain('cannot be released to you automatically');
    // Nothing is captured early to beat the clock.
    expect(captureEscrowPayment).not.toHaveBeenCalled();

    const sent = store.notifications.length;
    expect((await sweepPurchases(NOW)).lapsing).toBe(0);
    expect(store.notifications).toHaveLength(sent);
  });

  it('warns before the handover too, and tells the seller not to hand the car over after it', async () => {
    store.purchases = [held('PAID_HELD', 5.5, null)];
    expect((await sweepPurchases(NOW)).lapsing).toBe(1);
    expect(bodyFor('CAR_HOLD_LAPSING', 'seller')).toContain('do not hand it over until the purchase page says the money is held again');
    expect(bodyFor('CAR_HOLD_LAPSING', 'buyer')).toContain('asked to pay once more');
  });

  it('says nothing when the inspection period ends before the hold does', async () => {
    store.purchases = [held('HANDED_OVER', 5.5, 1)];
    expect((await sweepPurchases(NOW)).lapsing).toBe(0);
    expect(sentTo('CAR_HOLD_LAPSING')).toEqual([]);
  });

  it('asks the buyer to pay once more when a hold ends before the handover, and does not call off the sale', async () => {
    store.purchases = [held('PAID_HELD', 8, null, 'CANCELED')];
    const result = await sweepPurchases(NOW);
    // The abandoned-hold sweep used to take this for a card that was never
    // authorised, cancel the sale and tell the seller she had been misled.
    expect(result.abandoned).toBe(0);
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(store.purchases[0].status).toBe('PAID_HELD');
    expect(result.ended).toBe(1);
    expect(sentTo('CAR_HOLD_ENDED')).toEqual(['admin', 'buyer', 'seller']);
    expect(bodyFor('CAR_HOLD_ENDED', 'buyer')).toContain('pay once more');
    expect(bodyFor('CAR_HOLD_ENDED', 'seller')).toContain('Do not hand the car over');
    expect(store.notifications.some((n) => String(n.message).includes('never authorised'))).toBe(false);

    expect((await sweepPurchases(NOW)).ended).toBe(0);
  });

  it('hands a hold that ended during the inspection period to a person at once, and calls it what it is', async () => {
    store.purchases = [handedOver(1, 'CANCELED')];
    const result = await sweepPurchases(NOW);
    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ released: 0, stuck: 1 });
    expect(store.purchases[0].status).toBe('DISPUTED');
    const reason = String(store.purchases[0].disputeReason);
    expect(reason).toContain('ended before the inspection period did');
    expect(reason).not.toContain('never authorised');
    expect(reason).not.toContain('Three days of automatic attempts');
    expect(sentTo('CAR_RELEASE_FAILED')).toEqual(['admin', 'buyer', 'seller']);
  });

  it('asks the processor about a hold past its day that no webhook has recorded, and follows it up when it has gone', async () => {
    store.purchases = [held('HANDED_OVER', 8, 6)];
    (recheckLiveHold as jest.Mock).mockImplementation(async (e: unknown) => { (e as Row).status = 'CANCELED'; return 'GONE'; });
    const result = await sweepPurchases(NOW);
    expect(recheckLiveHold).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2', paymentIntentId: 'pi_2' }));
    expect(result.ended).toBe(1);
    expect(sentTo('CAR_HOLD_ENDED')).toEqual(['admin', 'buyer', 'seller']);
    expect(bodyFor('CAR_HOLD_ENDED', 'seller')).toContain('no money held to release to you automatically');
  });

  it('moves on a purchase whose hold the webhook recorded but nobody confirmed', async () => {
    store.purchases = [{ ...held('PAID_HELD', 0, null), status: 'ACCEPTED', paidAt: null }];
    const result = await sweepPurchases(NOW);
    expect(settlePurchaseHold).toHaveBeenCalledWith('p2', NOW);
    expect(result.settled).toBe(1);
  });
});
