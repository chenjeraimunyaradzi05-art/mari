/**
 * The escrow half of stripe-connect, which is the largest money surface on the
 * platform and had no test file of its own at all. Every hold a mentor,
 * a marketplace seller or a car seller is paid through passes through these
 * four functions, and what is covered here is specifically the places where
 * Stripe and the local row can disagree — because that disagreement is how the
 * money goes wrong: a hold created at Stripe with no row behind it, a capture
 * that moved money and was reported as a failure, a refund issued twice.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    escrowPayment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(async () => []),
      groupBy: jest.fn(async () => []),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

const stripe = {
  paymentIntents: {
    create: jest.fn(),
    capture: jest.fn(),
    retrieve: jest.fn(),
    cancel: jest.fn(),
  },
  refunds: { create: jest.fn() },
  balance: { retrieve: jest.fn() },
};

jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => stripe,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  createEscrowPayment,
  captureEscrowPayment,
  cancelEscrowPayment,
  getEarningsDashboard,
  PLATFORM_ESCROW_ACTOR,
} from '../stripe-connect.service';

const prisma: any = prismaTyped;

const BUYER = { id: 'buyer-1' };
const SELLER = { id: 'seller-1' };

/** A seller who is verified and can be paid, which is what escrow creation requires. */
function sellerIsReady() {
  prisma.user.findUnique.mockResolvedValue({
    stripeConnectAccountId: 'acct_seller',
    stripeConnectStatus: 'ACTIVE',
    mentorProfile: null,
    creatorProfile: null,
  });
}

const escrowRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'escrow-1',
  paymentIntentId: 'pi_1',
  buyerId: BUYER.id,
  sellerId: SELLER.id,
  amount: 25000,
  platformFee: 3750,
  currency: 'aud',
  status: 'AUTHORIZED',
  capturedAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Creating a hold', () => {
  it('cancels the hold at Stripe when the row cannot be written', async () => {
    sellerIsReady();
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_new', client_secret: 'pi_new_secret' });
    prisma.escrowPayment.create.mockRejectedValue(new Error('database is down'));
    stripe.paymentIntents.cancel.mockResolvedValue({ id: 'pi_new', status: 'canceled' });

    await expect(
      createEscrowPayment({
        buyerId: BUYER.id,
        sellerId: SELLER.id,
        amount: 25000,
        currency: 'aud',
        description: 'Mentor session',
      })
    ).rejects.toThrow('Failed to create payment');

    // Without this the intent survives with nothing on the platform aware of
    // it: no row for the expiry sweep to find, no row for either party to
    // cancel, and a buyer who can still be charged by a checkout page that was
    // already handed the client secret.
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_new');
  });

  it('refuses a seller whose payout account is not verified, before asking Stripe for anything', async () => {
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: 'acct_seller',
      stripeConnectStatus: 'PENDING',
      mentorProfile: null,
      creatorProfile: null,
    });

    await expect(
      createEscrowPayment({
        buyerId: BUYER.id,
        sellerId: SELLER.id,
        amount: 25000,
        currency: 'aud',
        description: 'Mentor session',
      })
    ).rejects.toThrow('Seller payment account is not fully verified');

    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
});

describe('Releasing a hold', () => {
  it('refuses a release before the buyer has authorised, and does not go to Stripe to find out the hard way', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'PENDING' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'requires_payment_method',
    });

    await expect(captureEscrowPayment('pi_1', BUYER)).rejects.toThrow(
      'This payment has not been authorised yet'
    );

    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it('releases a hold the row still calls PENDING when Stripe says it is authorised', async () => {
    // A row is only moved to AUTHORIZED by a webhook. Refusing on the local
    // status would strand money that is sitting at Stripe ready to be released
    // whenever that webhook has not landed.
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'PENDING' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'requires_capture' });
    stripe.paymentIntents.capture.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      amount_received: 25000,
    });
    prisma.escrowPayment.update.mockResolvedValue({});

    const result = await captureEscrowPayment('pi_1', BUYER);

    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith('pi_1');
    expect(result.amountCaptured).toBe(25000);
  });

  it('repairs the row instead of capturing twice when the money has already moved', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow());
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      amount_received: 25000,
    });
    prisma.escrowPayment.update.mockResolvedValue({});

    const result = await captureEscrowPayment('pi_1', BUYER);

    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
    expect(prisma.escrowPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CAPTURED' }) })
    );
    expect(result.amountCaptured).toBe(25000);
  });

  it('reports the release as done when the money moved but the row write failed', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow());
    stripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'requires_capture' });
    stripe.paymentIntents.capture.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      amount_received: 25000,
    });
    prisma.escrowPayment.update.mockRejectedValue(new Error('database is down'));

    // Telling the buyer her release failed after the seller has been paid is
    // how she comes back and presses it again.
    const result = await captureEscrowPayment('pi_1', BUYER);

    expect(result).toEqual({ status: 'succeeded', amountCaptured: 25000 });
  });

  it('will not let a stranger release somebody else’s hold', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow());

    await expect(captureEscrowPayment('pi_1', { id: 'someone-else' })).rejects.toThrow(
      'Escrow payment not found'
    );

    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('will not let the seller release her own hold', async () => {
    // Release is the buyer's decision, or the platform's. A seller who could
    // release her own hold could pay herself for work she had not delivered.
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow());

    await expect(captureEscrowPayment('pi_1', SELLER)).rejects.toThrow('Escrow payment not found');
  });

  it('lets the platform release a hold, for the sweeper and the flows authorised elsewhere', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow());
    stripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'requires_capture' });
    stripe.paymentIntents.capture.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      amount_received: 25000,
    });
    prisma.escrowPayment.update.mockResolvedValue({});

    await expect(captureEscrowPayment('pi_1', PLATFORM_ESCROW_ACTOR)).resolves.toMatchObject({
      amountCaptured: 25000,
    });
  });
});

describe('Giving a hold back', () => {
  it('refunds a captured hold once, under a key derived from the row', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'CAPTURED' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      latest_charge: { id: 'ch_1', refunded: false },
    });
    stripe.refunds.create.mockResolvedValue({ id: 're_1' });
    prisma.escrowPayment.update.mockResolvedValue({});

    const result = await cancelEscrowPayment('pi_1', BUYER, 'not delivered');

    expect(result).toEqual({ status: 'refunded' });
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_1' }),
      // Two presses of the same button inside Stripe's idempotency window are
      // one refund, not two.
      { idempotencyKey: 'escrow-refund-escrow-1' }
    );
  });

  it('repairs the row instead of refunding a charge Stripe has already given back', async () => {
    // This is the shape a failed row write leaves behind, and it used to be
    // unrecoverable: the row stayed CAPTURED, every later attempt asked Stripe
    // to refund an already-refunded charge, and the buyer was told her
    // cancellation had failed while her money was already back on her card.
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'CAPTURED' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      latest_charge: { id: 'ch_1', refunded: true },
    });
    prisma.escrowPayment.update.mockResolvedValue({});

    const result = await cancelEscrowPayment('pi_1', BUYER);

    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'refunded' });
    expect(prisma.escrowPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED' }) })
    );
  });

  it('repairs the row instead of cancelling an intent Stripe has already cancelled', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow());
    stripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'canceled' });
    prisma.escrowPayment.update.mockResolvedValue({});

    const result = await cancelEscrowPayment('pi_1', BUYER);

    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'canceled' });
  });

  it('reports the refund as done when the money went back but the row write failed', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'CAPTURED' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      latest_charge: { id: 'ch_1', refunded: false },
    });
    stripe.refunds.create.mockResolvedValue({ id: 're_1' });
    prisma.escrowPayment.update.mockRejectedValue(new Error('database is down'));

    const result = await cancelEscrowPayment('pi_1', BUYER);

    expect(result).toEqual({ status: 'refunded' });
  });

  it('cancels an uncaptured hold rather than trying to refund it', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow());
    stripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'requires_capture' });
    stripe.paymentIntents.cancel.mockResolvedValue({ id: 'pi_1', status: 'canceled' });
    prisma.escrowPayment.update.mockResolvedValue({});

    const result = await cancelEscrowPayment('pi_1', SELLER, 'buyer changed her mind');

    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'canceled' });
  });
});

describe('What a seller is told she has earned', () => {
  it('counts every hold, not the twenty most recent, and keeps currencies apart', async () => {
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: null,
      mentorProfile: null,
      creatorProfile: null,
    });
    prisma.escrowPayment.groupBy.mockResolvedValue([
      { currency: 'aud', status: 'CAPTURED', _sum: { amount: 500000, platformFee: 75000 } },
      { currency: 'aud', status: 'AUTHORIZED', _sum: { amount: 20000, platformFee: 3000 } },
      { currency: 'usd', status: 'CAPTURED', _sum: { amount: 10000, platformFee: 1500 } },
    ]);
    prisma.escrowPayment.findMany.mockResolvedValue([]);

    const dashboard = await getEarningsDashboard(SELLER.id);

    // AUD cents used to be added to USD cents and the sum called one number.
    expect(dashboard.currency).toBe('AUD');
    expect(dashboard.totalEarnings).toBe(425000);
    expect(dashboard.pendingPayouts).toBe(17000);
    expect(dashboard.byCurrency).toEqual([
      { currency: 'AUD', totalEarnings: 425000, pendingPayouts: 17000 },
      { currency: 'USD', totalEarnings: 8500, pendingPayouts: 0 },
    ]);
  });

  it('says the balance is unknown rather than zero when Stripe cannot be reached', async () => {
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: 'acct_seller',
      mentorProfile: null,
      creatorProfile: null,
    });
    prisma.escrowPayment.groupBy.mockResolvedValue([
      { currency: 'aud', status: 'CAPTURED', _sum: { amount: 500000, platformFee: 75000 } },
    ]);
    prisma.escrowPayment.findMany.mockResolvedValue([]);
    stripe.balance.retrieve.mockRejectedValue(new Error('stripe is down'));

    const dashboard = await getEarningsDashboard(SELLER.id);

    // Zero here told a mentor during a Stripe outage that she had no money,
    // which is a different and much worse statement than "we could not check".
    expect(dashboard.availableBalance).toBeNull();
    expect(dashboard.balanceUnavailable).toBe(true);
  });

  it('reports only the balance held in the currency the headline figures are in', async () => {
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: 'acct_seller',
      mentorProfile: null,
      creatorProfile: null,
    });
    prisma.escrowPayment.groupBy.mockResolvedValue([
      { currency: 'aud', status: 'CAPTURED', _sum: { amount: 500000, platformFee: 75000 } },
    ]);
    prisma.escrowPayment.findMany.mockResolvedValue([]);
    stripe.balance.retrieve.mockResolvedValue({
      available: [
        { currency: 'aud', amount: 120000 },
        { currency: 'usd', amount: 90000 },
      ],
    });

    const dashboard = await getEarningsDashboard(SELLER.id);

    expect(dashboard.availableBalance).toBe(120000);
    expect(dashboard.balanceUnavailable).toBe(false);
  });
});
