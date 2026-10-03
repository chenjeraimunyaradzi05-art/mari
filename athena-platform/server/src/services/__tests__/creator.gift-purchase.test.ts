/**
 * Buying gift balance makes a payment intent the browser then confirms. The
 * intent is keyed, because without a key every tap on Buy minted another one
 * against her card: the member, the amount and the minute, so two taps are one
 * intent and a second purchase of the same amount a minute later is a new one.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const stripeClient = {
  paymentIntents: {
    create: jest.fn(async (): Promise<any> => ({ id: 'pi_gift', client_secret: 'pi_gift_secret' })),
  },
};

jest.mock('../../utils/prisma', () => ({ prisma: {} }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/stripe', () => ({ getStripe: () => stripeClient, isStripeConfigured: () => true }));
jest.mock('../socket.service', () => ({ sendNotification: jest.fn(async () => undefined) }));
jest.mock('../stripe-connect.service', () => ({
  createConnectedAccount: jest.fn(),
  refreshConnectedAccount: jest.fn(),
  resolveConnectedAccountId: jest.fn(),
}));
jest.mock('../feature-flags.service', () => ({ assertPaymentsOpen: jest.fn(async () => undefined) }));
jest.mock('../../utils/safety-store', () => ({ isBlockedRelationship: jest.fn(async () => false) }));

import { purchaseGiftBalance } from '../creator.service';

const options = (call: number) => (stripeClient.paymentIntents.create.mock.calls[call] as any[])[1];

describe('purchaseGiftBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The clock held still, so the two calls below fall in the same minute
    // whatever the wall clock is doing, and the third is a minute later.
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-01T03:00:30Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keys the intent on the member, the amount in cents and the minute', async () => {
    const result = await purchaseGiftBalance('member-1', 10);

    expect(result).toMatchObject({ paymentIntentId: 'pi_gift', clientSecret: 'pi_gift_secret', amount: 10 });
    const [params] = stripeClient.paymentIntents.create.mock.calls[0] as any[];
    expect(params.amount).toBe(1000);
    expect(options(0).idempotencyKey).toMatch(/^gift-purchase-member-1-1000-\d+$/);
  });

  it('gives two taps in the same minute the same key, and the same amount a minute later a new one', async () => {
    await purchaseGiftBalance('member-1', 10);
    await purchaseGiftBalance('member-1', 10);
    expect(options(1).idempotencyKey).toBe(options(0).idempotencyKey);

    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-01T03:01:30Z').getTime());
    await purchaseGiftBalance('member-1', 10);
    expect(options(2).idempotencyKey).not.toBe(options(0).idempotencyKey);

    // Another member, or another amount, is never the same key.
    await purchaseGiftBalance('member-2', 10);
    await purchaseGiftBalance('member-1', 20);
    expect(new Set([options(2), options(3), options(4)].map((o) => o.idempotencyKey)).size).toBe(3);
  });
});
