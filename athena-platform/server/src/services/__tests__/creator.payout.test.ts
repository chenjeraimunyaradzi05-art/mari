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
    findUnique: jest.fn(async (): Promise<any> => ({ preferredCurrency: 'AUD', region: 'ANZ', stripeConnectStatus: 'ACTIVE' })),
  },
  $transaction: jest.fn(async (arg: any) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)
  ),
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));

import { requestPayout, settleCreatorPayout } from '../creator.service';
import { refreshConnectedAccount } from '../stripe-connect.service';

const refresh = refreshConnectedAccount as unknown as jest.Mock<(...args: any[]) => Promise<void>>;

/** A member whose payout account Stripe has verified and enabled. */
const activeAccount = (extra: Record<string, unknown> = {}) => ({
  preferredCurrency: 'AUD',
  region: 'ANZ',
  stripeConnectStatus: 'ACTIVE',
  ...extra,
});

describe('Paying a creator what her supporters gave her', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    balance.points = 0;
    payouts.length = 0;
    transfersCreate.mockResolvedValue({ id: 'tr_1' });
    // An implementation set by one test outlives clearAllMocks, so each starts from
    // a creator whose account Stripe has verified, and says otherwise itself.
    prismaMock.user.findUnique.mockResolvedValue(activeAccount());
    refresh.mockReset();
    refresh.mockResolvedValue(undefined);
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

  // Points are bought in Australian dollars at a cent each, so they are paid out
  // in Australian dollars at a cent each, whatever currency she has chosen to see
  // her own figures in. Paid out in her chosen currency, a point bought for a
  // cent of dong was cashed for a cent of dollars.
  it.each(['VND', 'PHP', 'usd'])(
    'pays in Australian dollars, one cent a point, whatever currency she prefers (%s)',
    async (preferredCurrency) => {
      balance.points = 6_050;
      prismaMock.user.findUnique.mockResolvedValue(activeAccount({ preferredCurrency }));

      await requestPayout('creator-1');

      expect(transfersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 6_050, currency: 'aud', destination: 'acct_creator' }),
        expect.anything()
      );
      // The row records dollars, and it is the same number that was sent.
      expect(payouts[0]).toMatchObject({ amount: 60.5 });
    }
  );

  // Stripe stops paying a restricted account, and the account.updated webhook
  // writes that status. Until then a withdrawal claimed her balance, asked for a
  // transfer Stripe was always going to refuse, and put the balance back, on
  // every press of the button.
  it.each(['RESTRICTED', 'DISABLED'])(
    'does not start a withdrawal while Stripe has paused her account (%s)',
    async (stripeConnectStatus) => {
      balance.points = 6_000;
      prismaMock.user.findUnique.mockResolvedValue({ stripeConnectStatus });

      await expect(requestPayout('creator-1')).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/Stripe has paused payouts/),
      });

      expect(transfersCreate).not.toHaveBeenCalled();
      expect(prismaMock.creatorProfile.updateMany).not.toHaveBeenCalled();
      expect(balance.points).toBe(6_000);
      expect(payouts).toHaveLength(0);
    }
  );

  // The terms promise payouts to a verified account. An account id that exists
  // is not that: an account that has not finished Stripe's checks was sent a
  // transfer, refused, and had the balance claimed and put back on every press.
  describe('an account Stripe has not verified', () => {
    it.each([['PENDING'], [null], [undefined]])(
      'is not paid, says what to do, and takes nothing from her balance (%s)',
      async (stripeConnectStatus) => {
        balance.points = 6_000;
        prismaMock.user.findUnique.mockResolvedValue({ stripeConnectStatus });

        await expect(requestPayout('creator-1')).rejects.toMatchObject({
          statusCode: 409,
          message: expect.stringMatching(/payout account is not ready.*Your balance is unchanged/),
        });

        expect(transfersCreate).not.toHaveBeenCalled();
        expect(prismaMock.creatorProfile.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.creatorPayout.create).not.toHaveBeenCalled();
        expect(balance.points).toBe(6_000);
        expect(payouts).toHaveLength(0);
      }
    );

    it('is asked about once, at Stripe, before she is turned away, because the status is only as fresh as its last event', async () => {
      balance.points = 6_000;
      prismaMock.user.findUnique.mockResolvedValue({ stripeConnectStatus: 'PENDING' });

      await expect(requestPayout('creator-1')).rejects.toMatchObject({ statusCode: 409 });

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledWith('creator-1', 'acct_creator');
    });

    it('is paid when Stripe says she has finished setting up since the row was written', async () => {
      balance.points = 6_000;
      // Read before the refresh, and again after it.
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ stripeConnectStatus: 'PENDING' })
        .mockResolvedValueOnce({ stripeConnectStatus: 'ACTIVE' });

      await requestPayout('creator-1');

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(transfersCreate).toHaveBeenCalledTimes(1);
    });

    it('is turned away, rather than paid on a guess, when the refresh itself fails', async () => {
      balance.points = 6_000;
      prismaMock.user.findUnique.mockResolvedValue({ stripeConnectStatus: null });
      refresh.mockRejectedValue(new Error('stripe is down'));

      await expect(requestPayout('creator-1')).rejects.toMatchObject({ statusCode: 409 });

      expect(transfersCreate).not.toHaveBeenCalled();
      expect(balance.points).toBe(6_000);
    });

    it('does not ask Stripe at all for an account it already reads as verified', async () => {
      balance.points = 6_000;

      await requestPayout('creator-1');

      expect(refresh).not.toHaveBeenCalled();
    });

    it('is paid when Stripe says a paused account has been put right', async () => {
      balance.points = 6_000;
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ stripeConnectStatus: 'RESTRICTED' })
        .mockResolvedValueOnce({ stripeConnectStatus: 'ACTIVE' });

      await requestPayout('creator-1');

      expect(transfersCreate).toHaveBeenCalledTimes(1);
    });
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

// A card dispute on points a supporter spent on gifts pauses the withdrawals of
// the creators who were sent them (payment-disputes.service). The pause stops
// the withdrawal and nothing else.
describe('A withdrawal while a card dispute is being looked at', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    balance.points = 0;
    payouts.length = 0;
    transfersCreate.mockResolvedValue({ id: 'tr_1' });
    prismaMock.user.findUnique.mockResolvedValue(activeAccount());
    refresh.mockReset();
    refresh.mockResolvedValue(undefined);
  });

  it('is refused before anything is claimed, and her balance is untouched', async () => {
    balance.points = 6_000;
    prismaMock.creatorProfile.findUnique.mockResolvedValueOnce({
      id: 'creator-profile-1',
      userId: 'creator-1',
      pendingPayout: 6_000,
      payoutHold: true,
    });

    await expect(requestPayout('creator-1')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/Withdrawals are paused.*balance is safe/),
    });

    expect(transfersCreate).not.toHaveBeenCalled();
    expect(prismaMock.creatorProfile.updateMany).not.toHaveBeenCalled();
    expect(balance.points).toBe(6_000);
    expect(payouts).toHaveLength(0);
  });

  it('is refused, and says why, when the pause lands between the check and the claim', async () => {
    balance.points = 6_000;
    prismaMock.creatorProfile.findUnique
      .mockResolvedValueOnce({ id: 'creator-profile-1', userId: 'creator-1', pendingPayout: 6_000, payoutHold: false })
      // Read again once the claim has matched nothing: the pause is there now.
      .mockResolvedValueOnce({ payoutHold: true });
    let claimedWhere: any;
    prismaMock.creatorProfile.updateMany.mockImplementationOnce(async ({ where }: any) => {
      claimedWhere = where;
      return { count: 0 };
    });

    await expect(requestPayout('creator-1')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/Withdrawals have just been paused.*balance is unchanged/),
    });

    // The claim itself carries the pause, so it cannot take points for a transfer that is not going out.
    expect(claimedWhere).toMatchObject({ userId: 'creator-1', payoutHold: false });
    expect(transfersCreate).not.toHaveBeenCalled();
    expect(payouts).toHaveLength(0);
    expect(balance.points).toBe(6_000);
  });

  it('goes through once the hold has been lifted', async () => {
    balance.points = 6_000;
    prismaMock.creatorProfile.findUnique.mockResolvedValueOnce({
      id: 'creator-profile-1',
      userId: 'creator-1',
      pendingPayout: 6_000,
      payoutHold: false,
    });

    await requestPayout('creator-1');

    expect(transfersCreate).toHaveBeenCalledTimes(1);
  });
});
