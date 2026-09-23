/**
 * The creator payout path, which is where this platform can lose a woman's
 * money in two different directions at once.
 *
 * It used to read the balance, send a Stripe transfer, and only then write the
 * payout row and set pendingPayout to the literal 0. Two requests arriving
 * together both read the same balance and both transferred; a gift credited
 * while the transfer was in flight was destroyed by the 0. Nothing tested any
 * of it. These are the cases that must never come back.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const transfersCreate = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('../../utils/stripe', () => ({
  getStripe: () => ({ transfers: { create: transfersCreate } }),
  isStripeConfigured: () => true,
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../socket.service', () => ({
  sendNotification: jest.fn(async () => ({})),
}));

jest.mock('../stripe-connect.service', () => ({
  resolveConnectedAccountId: jest.fn(async () => 'acct_creator'),
  createConnectedAccount: jest.fn(),
  refreshConnectedAccount: jest.fn(),
}));

/**
 * A single creator's balance, held where both the service and the assertions
 * can see it, because the whole point of the conditional decrement is that two
 * calls contend for the same number.
 */
const balance = { points: 0 };

const payouts: Array<{ id: string; amount: number; status: string; completedAt: Date | null }> = [];

const prismaMock: any = {
  creatorProfile: {
    findUnique: jest.fn(async () => ({
      id: 'creator-profile-1',
      userId: 'creator-1',
      pendingPayout: balance.points,
      stripeAccountId: 'acct_creator',
    })),
    // The real conditional update: it matches nothing, and so decrements
    // nothing, once the balance has fallen below what the caller claimed.
    updateMany: jest.fn(async ({ where, data }: any) => {
      const floor = where?.pendingPayout?.gte ?? 0;
      if (balance.points < floor) return { count: 0 };
      balance.points -= data.pendingPayout.decrement;
      return { count: 1 };
    }),
    update: jest.fn(async ({ data }: any) => {
      if (data?.pendingPayout?.increment) balance.points += data.pendingPayout.increment;
      return {};
    }),
  },
  creatorPayout: {
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `payout-${payouts.length + 1}`, completedAt: null, ...data };
      payouts.push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = payouts.find(p => p.id === where.id);
      if (row) Object.assign(row, data);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const open = payouts.filter(
        p => (where.id ? p.id === where.id : true) && (where.status?.in ? where.status.in.includes(p.status) : true)
      );
      open.forEach(p => Object.assign(p, data));
      return { count: open.length };
    }),
    findFirst: jest.fn(async () => null),
  },
  user: {
    findUnique: jest.fn(async () => ({ preferredCurrency: 'AUD', region: 'ANZ' })),
  },
  $transaction: jest.fn(async (arg: any) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)
  ),
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));

import { requestPayout, settleCreatorPayout } from '../creator.service';

describe('Paying a creator what her supporters gave her', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    balance.points = 0;
    payouts.length = 0;
    transfersCreate.mockResolvedValue({ id: 'tr_1' });
  });

  it('refuses a balance below the fifty dollar minimum without touching Stripe', async () => {
    balance.points = 4_999; // $49.99

    await expect(requestPayout('creator-1')).rejects.toMatchObject({ statusCode: 400 });
    expect(transfersCreate).not.toHaveBeenCalled();
    expect(balance.points).toBe(4_999);
  });

  it('claims the balance in the database before it calls Stripe', async () => {
    balance.points = 6_000; // $60

    await requestPayout('creator-1');

    const claimOrder = prismaMock.creatorProfile.updateMany.mock.invocationCallOrder[0];
    const transferOrder = transfersCreate.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(transferOrder);
    expect(balance.points).toBe(0);
  });

  it('pays only the points it claimed, so a gift that lands mid-payout survives', async () => {
    balance.points = 6_000;

    // The gift arrives after the balance was read and before the claim, exactly
    // the window the old set-to-zero destroyed.
    transfersCreate.mockImplementation(async () => ({ id: 'tr_1' }));
    prismaMock.creatorProfile.findUnique.mockImplementationOnce(async () => {
      const snapshot = balance.points;
      balance.points += 1_500; // $15 of new gifts
      return {
        id: 'creator-profile-1',
        userId: 'creator-1',
        pendingPayout: snapshot,
        stripeAccountId: 'acct_creator',
      };
    });

    const result = await requestPayout('creator-1');

    expect(result.amount).toBe(60);
    expect(balance.points).toBe(1_500);
  });

  it('lets only one of two concurrent requests move money', async () => {
    balance.points = 6_000;

    const results = await Promise.allSettled([requestPayout('creator-1'), requestPayout('creator-1')]);

    const paid = results.filter(r => r.status === 'fulfilled');
    const refused = results.filter(r => r.status === 'rejected');

    expect(paid).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(transfersCreate).toHaveBeenCalledTimes(1);
    expect(balance.points).toBe(0);
  });

  it('keys the transfer on the payout row, so a retry cannot settle twice', async () => {
    balance.points = 6_000;

    await requestPayout('creator-1');

    expect(transfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ destination: 'acct_creator' }),
      { idempotencyKey: `creator-payout-${payouts[0].id}` }
    );
  });

  it('puts the points back when Stripe refuses the transfer', async () => {
    balance.points = 6_000;
    transfersCreate.mockRejectedValueOnce(new Error('account restricted'));

    await expect(requestPayout('creator-1')).rejects.toMatchObject({ statusCode: 502 });

    expect(balance.points).toBe(6_000);
    expect(payouts[0].status).toBe('FAILED');
  });

  it('stamps both the status and the date when Stripe says the money landed', async () => {
    balance.points = 6_000;
    await requestPayout('creator-1');

    const paidAt = new Date('2026-06-01T00:00:00.000Z');
    const settled = await settleCreatorPayout('tr_1', paidAt);

    expect(settled).toBe(true);
    // Both, because the earnings statement filters on COMPLETED *and* a
    // completedAt inside the financial year: a row with only the status is
    // still invisible to her.
    expect(prismaMock.creatorPayout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stripeTransferId: 'tr_1' }),
        data: { status: 'COMPLETED', completedAt: paidAt },
      })
    );
  });
});
