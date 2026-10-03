/**
 * Taking back the gift points a refunded or charged-back purchase bought, and the
 * pause on withdrawals that goes with a dispute.
 *
 * A refund returned the money and left the points: the member kept everything
 * that had been refunded and could spend it on gifts that became real creator
 * earnings, paid out as real Stripe transfers. These are the properties that make
 * taking them back safe: each point goes back once however the events arrive, the
 * balance is never driven below zero, and what has already been spent is reported
 * as a shortfall instead of being invented from nowhere.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/stripe', () => ({ getStripe: () => ({}), isStripeConfigured: () => true }));
jest.mock('../socket.service', () => ({ sendNotification: jest.fn(async () => ({})) }));
jest.mock('../stripe-connect.service', () => ({
  resolveConnectedAccountId: jest.fn(),
  createConnectedAccount: jest.fn(),
  refreshConnectedAccount: jest.fn(),
}));

// One purchase and one balance, held where the service and the assertions both see them.
const purchase = { id: 'gbp-1', userId: 'member-1', paymentIntentId: 'pi_1', amountCents: 1000, giftPoints: 1000, reversedPoints: 0, createdAt: new Date('2026-09-20T00:00:00Z') };
const member = { giftBalance: 1000 };
const profiles = new Map<string, any>();

const prismaMock: any = {
  giftBalancePurchase: {
    findUnique: jest.fn(async ({ where }: any) => (where.paymentIntentId === purchase.paymentIntentId ? { ...purchase } : null)),
    // The conditional claim: it matches only while the figure is the one that was read.
    updateMany: jest.fn(async ({ where, data }: any) => {
      if (where.id !== purchase.id || where.reversedPoints !== purchase.reversedPoints) return { count: 0 };
      purchase.reversedPoints = data.reversedPoints;
      return { count: 1 };
    }),
  },
  user: {
    findUnique: jest.fn(async () => ({ giftBalance: member.giftBalance })),
    // The same guard sendGift uses: it takes nothing from a balance that is too small.
    updateMany: jest.fn(async ({ where, data }: any) => {
      if (member.giftBalance < (where.giftBalance?.gte ?? 0)) return { count: 0 };
      member.giftBalance -= data.giftBalance.decrement;
      return { count: 1 };
    }),
  },
  creatorProfile: {
    findUnique: jest.fn(async () => ({
      id: 'cp-1',
      userId: 'creator-1',
      payoutHold: true,
      payoutHoldReason: 'A card dispute on a gift balance purchase (dp_1)',
      payoutHeldAt: new Date('2026-10-01T00:00:00Z'),
      user: { id: 'creator-1', displayName: 'Mei', avatar: null, headline: null, followers: [{ id: 'f1' }], posts: [] },
    })),
    findMany: jest.fn(async ({ where }: any) =>
      [...profiles.values()].filter((p) => where.id.in.includes(p.id) && p.payoutHold === where.payoutHold)
    ),
    updateMany: jest.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const p of profiles.values()) {
        if (where.id.in.includes(p.id) && p.payoutHold === where.payoutHold) {
          Object.assign(p, data);
          count += 1;
        }
      }
      return { count };
    }),
  },
  // A transaction that rolls back what it wrote when it throws, as a real one does:
  // the retry in reverseGiftPurchase depends on the failed attempt leaving nothing behind.
  $transaction: jest.fn(async (arg: any) => {
    if (typeof arg !== 'function') return Promise.all(arg);
    // Only what the transaction itself wrote is undone: a gift sent at the same
    // moment is another transaction's, and stays.
    const before = purchase.reversedPoints;
    try {
      return await arg(prismaMock);
    } catch (error) {
      purchase.reversedPoints = before;
      throw error;
    }
  }),
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));

import { sendNotification } from '../socket.service';
import { getCreatorProfile, holdCreatorPayouts, releaseCreatorPayouts, reverseGiftPurchase } from '../creator.service';

beforeEach(() => {
  jest.clearAllMocks();
  purchase.reversedPoints = 0;
  member.giftBalance = 1000;
  profiles.clear();
  profiles.set('cp-1', { id: 'cp-1', userId: 'creator-1', payoutHold: false });
  profiles.set('cp-2', { id: 'cp-2', userId: 'creator-2', payoutHold: false });
});

describe('Taking gift points back', () => {
  it('takes every point back for a purchase refunded in full', async () => {
    const result = await reverseGiftPurchase('pi_1', 1000);

    expect(result).toMatchObject({ userId: 'member-1', tookBackPoints: 1000, shortfallPoints: 0, alreadyApplied: false });
    expect(member.giftBalance).toBe(0);
    expect(purchase.reversedPoints).toBe(1000);
  });

  it('takes the points a part refund bought, rounded down to a whole point', async () => {
    // A$2.55 of A$10.00: 255 of 1000 points.
    await reverseGiftPurchase('pi_1', 255);
    expect(member.giftBalance).toBe(745);

    // Less a fraction of a point: 1/3 of 1000 is 333.33, so 333.
    purchase.reversedPoints = 0;
    member.giftBalance = 1000;
    purchase.amountCents = 1500;
    purchase.giftPoints = 1500;
    await reverseGiftPurchase('pi_1', 500);
    expect(member.giftBalance).toBe(1000 - 500);
    purchase.amountCents = 1000;
    purchase.giftPoints = 1000;
  });

  it('takes each point back once between two part refunds, however they arrive', async () => {
    await reverseGiftPurchase('pi_1', 250);
    expect(member.giftBalance).toBe(750);

    // The same refund delivered again, and an older, smaller figure delivered late.
    await reverseGiftPurchase('pi_1', 250);
    await reverseGiftPurchase('pi_1', 100);
    expect(member.giftBalance).toBe(750);
    expect(purchase.reversedPoints).toBe(250);

    // The rest of it: only the difference.
    const rest = await reverseGiftPurchase('pi_1', 1000);
    expect(rest).toMatchObject({ tookBackPoints: 750, alreadyApplied: false });
    expect(member.giftBalance).toBe(0);
  });

  it('reports what has already been spent as a shortfall and never drives the balance below zero', async () => {
    member.giftBalance = 300;

    const result = await reverseGiftPurchase('pi_1', 1000);

    expect(result).toMatchObject({ tookBackPoints: 300, shortfallPoints: 700, alreadyApplied: false });
    expect(member.giftBalance).toBe(0);
    // Recorded as taken back: the claim is on the points, not on what was still held.
    expect(purchase.reversedPoints).toBe(1000);
  });

  it('does not take anything when none is left, and says all of it is short', async () => {
    member.giftBalance = 0;

    const result = await reverseGiftPurchase('pi_1', 1000);

    expect(result).toMatchObject({ tookBackPoints: 0, shortfallPoints: 1000 });
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it('is nothing for a payment that was not a gift-balance purchase, or that returned nothing', async () => {
    expect(await reverseGiftPurchase('pi_other', 1000)).toBeNull();
    expect(await reverseGiftPurchase('pi_1', 0)).toBeNull();
    expect(await reverseGiftPurchase('pi_1', Number.NaN)).toBeNull();
    expect(member.giftBalance).toBe(1000);
  });

  it('gives up its claim, and tries again on the new balance, when a gift moved the balance underneath it', async () => {
    let first = true;
    prismaMock.user.updateMany.mockImplementationOnce(async () => {
      if (first) {
        first = false;
        // A gift of 100 points went out between the read and the debit.
        member.giftBalance -= 100;
      }
      return { count: 0 };
    });

    const result = await reverseGiftPurchase('pi_1', 1000);

    // The whole of what was left, taken once, with the claim made once.
    expect(result).toMatchObject({ tookBackPoints: 900, shortfallPoints: 100 });
    expect(member.giftBalance).toBe(0);
    expect(purchase.reversedPoints).toBe(1000);
  });
});

describe('The pause on a creator’s withdrawals', () => {
  it('pauses only the creators asked for, records why, and tells each one who was not already paused', async () => {
    profiles.get('cp-2')!.payoutHold = true;

    const paused = await holdCreatorPayouts(['cp-1', 'cp-2'], 'A card dispute on a gift balance purchase (dp_1)');

    expect(paused).toBe(1);
    expect(profiles.get('cp-1')).toMatchObject({ payoutHold: true, payoutHoldReason: expect.stringContaining('dp_1') });
    expect(profiles.get('cp-1')!.payoutHeldAt).toBeInstanceOf(Date);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect((sendNotification as jest.Mock).mock.calls[0][0]).toMatchObject({ userId: 'creator-1', title: 'Withdrawals are paused for now' });
    // Honest about what it does: the balance is safe and keeps growing.
    expect(((sendNotification as jest.Mock).mock.calls[0][0] as any).message).toMatch(/balance is safe and keeps growing/);
  });

  it('does nothing for nobody', async () => {
    expect(await holdCreatorPayouts([], 'x')).toBe(0);
    expect(await releaseCreatorPayouts([])).toBe(0);
    expect(prismaMock.creatorProfile.updateMany).not.toHaveBeenCalled();
  });

  it('lifts it, clears the reason, and tells the creator who was paused', async () => {
    await holdCreatorPayouts(['cp-1'], 'A card dispute');
    (sendNotification as jest.Mock).mockClear();

    const lifted = await releaseCreatorPayouts(['cp-1', 'cp-2']);

    // cp-2 was never paused, so there is nothing to lift and nobody to tell.
    expect(lifted).toBe(1);
    expect(profiles.get('cp-1')).toMatchObject({ payoutHold: false, payoutHoldReason: null, payoutHeldAt: null });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect((sendNotification as jest.Mock).mock.calls[0][0]).toMatchObject({ userId: 'creator-1', title: 'Withdrawals are open again' });
  });

  it('is not undone by a notification that could not be written', async () => {
    (sendNotification as any).mockRejectedValue(new Error('socket is down'));

    await expect(holdCreatorPayouts(['cp-1'], 'A card dispute')).resolves.toBe(1);

    expect(profiles.get('cp-1')!.payoutHold).toBe(true);
    (sendNotification as any).mockResolvedValue({});
  });
});

describe('What a creator is shown of a pause on withdrawals', () => {
  it('is that it is paused and since when, and not the dispute or the payment behind it', async () => {
    const profile: any = await getCreatorProfile('creator-1');

    expect(profile.payoutHold).toBe(true);
    expect(profile.payoutHeldAt).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect('payoutHoldReason' in profile).toBe(false);
    expect(JSON.stringify(profile)).not.toContain('dp_1');
  });
});
