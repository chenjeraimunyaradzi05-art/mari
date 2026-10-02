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
      updateMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () => []),
      groupBy: jest.fn(async () => []),
      // How many holds this buyer has had recorded in the last hour.
      count: jest.fn(async () => 0),
    },
    // No card dispute is open on a payment unless a test says one is.
    paymentDispute: { findFirst: jest.fn(async () => null) },
  },
}));

// Nobody has blocked anybody unless a test says so.
jest.mock('../../utils/safety-store', () => ({ isBlockedRelationship: jest.fn(async () => false) }));

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
import { isBlockedRelationship } from '../../utils/safety-store';
import {
  createEscrowPayment,
  captureEscrowPayment,
  cancelEscrowPayment,
  getEarningsDashboard,
  resolveLapsedEscrowHold,
  adoptUnledgeredMentorSessionHold,
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

  // A caller with a row to derive a key from, a mentor booking for one, gets one
  // hold however many times the request arrives. One without keeps the SDK's own
  // per-request key and sends no second argument, as it always did.
  it('sends the caller\'s idempotency key to Stripe, and none when it has none', async () => {
    sellerIsReady();
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_new', client_secret: 'pi_new_secret' });
    prisma.escrowPayment.create.mockResolvedValue({ id: 'escrow-1' });
    const input = {
      buyerId: BUYER.id,
      sellerId: SELLER.id,
      amount: 25000,
      currency: 'aud',
      description: 'Mentor session',
    };

    await createEscrowPayment({ ...input, idempotencyKey: 'mentor-hold-sess-9' });
    expect((stripe.paymentIntents.create.mock.calls[0] as any[])[1]).toEqual({ idempotencyKey: 'mentor-hold-sess-9' });

    jest.clearAllMocks();
    sellerIsReady();
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_new2', client_secret: 'pi_new2_secret' });
    prisma.escrowPayment.create.mockResolvedValue({ id: 'escrow-2' });
    await createEscrowPayment(input);
    expect(stripe.paymentIntents.create.mock.calls[0]).toHaveLength(1);
  });

  // Two requests with one key are handed the same intent by Stripe; the second
  // one's insert is refused because the first has recorded it. Cancelling "the
  // orphan" there would cancel the live hold the first request's buyer is paying
  // into, so it is returned as the row it is.
  it('hands a second request with the same key the hold the first recorded, and does not cancel it', async () => {
    sellerIsReady();
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_same', client_secret: 'pi_same_secret' });
    prisma.escrowPayment.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    prisma.escrowPayment.findUnique.mockResolvedValue({
      id: 'escrow-first',
      buyerId: BUYER.id,
      sellerId: SELLER.id,
      amount: 25000,
      platformFee: 2500,
    });

    const hold = await createEscrowPayment({
      buyerId: BUYER.id,
      sellerId: SELLER.id,
      amount: 25000,
      currency: 'aud',
      description: 'Logo design',
      idempotencyKey: 'order-renew-esc-old-0',
    });

    expect(hold).toMatchObject({ escrowId: 'escrow-first', paymentIntentId: 'pi_same', clientSecret: 'pi_same_secret' });
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('still cancels the hold when the row that already has its id belongs to somebody else', async () => {
    sellerIsReady();
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_same', client_secret: 'pi_same_secret' });
    prisma.escrowPayment.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    prisma.escrowPayment.findUnique.mockResolvedValue({
      id: 'escrow-other',
      buyerId: 'someone-else',
      sellerId: SELLER.id,
      amount: 25000,
      platformFee: 2500,
    });
    stripe.paymentIntents.cancel.mockResolvedValue({ id: 'pi_same', status: 'canceled' });

    await expect(
      createEscrowPayment({
        buyerId: BUYER.id,
        sellerId: SELLER.id,
        amount: 25000,
        currency: 'aud',
        description: 'Logo design',
        idempotencyKey: 'order-renew-esc-old-0',
      })
    ).rejects.toThrow('Failed to create payment');
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_same');
  });

  // However a hold is asked for, one buyer cannot have an unbounded run of them
  // recorded in an hour: card testing starts a hold for each card.
  it('refuses a buyer who already has the most holds an hour allows, before asking Stripe for anything', async () => {
    sellerIsReady();
    prisma.escrowPayment.count.mockResolvedValueOnce(15);

    await expect(
      createEscrowPayment({ buyerId: BUYER.id, sellerId: SELLER.id, amount: 25000, currency: 'aud', description: 'Mentor session' })
    ).rejects.toMatchObject({ statusCode: 429 });

    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(prisma.escrowPayment.count.mock.calls[0][0].where.buyerId).toBe(BUYER.id);
  });

  // Where the account and the card are eligible the network can grant longer than
  // the usual week; 'if_available' never fails a payment where they are not. Off
  // until the owner has checked it with Stripe.
  it('asks for an extended authorisation only when that has been switched on', async () => {
    const input = { buyerId: BUYER.id, sellerId: SELLER.id, amount: 25000, currency: 'aud', description: 'Logo design' };
    const params = () => (stripe.paymentIntents.create.mock.calls[0] as any[])[0];
    const hold = async () => {
      sellerIsReady();
      stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_new', client_secret: 'pi_new_secret' });
      prisma.escrowPayment.create.mockResolvedValue({ id: 'escrow-1' });
      await createEscrowPayment(input);
    };

    delete process.env.ESCROW_REQUEST_EXTENDED_AUTHORISATION;
    await hold();
    expect(params().payment_method_options).toBeUndefined();

    jest.clearAllMocks();
    process.env.ESCROW_REQUEST_EXTENDED_AUTHORISATION = 'true';
    try {
      await hold();
      expect(params().payment_method_options).toEqual({ card: { request_extended_authorization: 'if_available' } });
      expect(params().capture_method).toBe('manual');
    } finally {
      delete process.env.ESCROW_REQUEST_EXTENDED_AUTHORISATION;
    }
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

  it('refuses a seller staff have suspended or banned, before asking Stripe for anything', async () => {
    // Her sign-in is refused, so she could not deliver or be reached about the
    // payment, and the hold would sit on the buyer's card until it lapsed.
    for (const standing of [{ isSuspended: true, bannedAt: null }, { isSuspended: false, bannedAt: new Date() }]) {
      prisma.user.findUnique.mockResolvedValue({
        stripeConnectAccountId: 'acct_seller',
        stripeConnectStatus: 'ACTIVE',
        ...standing,
      });

      await expect(
        createEscrowPayment({ buyerId: BUYER.id, sellerId: SELLER.id, amount: 25000, currency: 'aud', description: 'Mentor session' })
      ).rejects.toMatchObject({ statusCode: 409 });
    }

    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('refuses a payment across a block, in either direction, before asking Stripe for anything', async () => {
    sellerIsReady();
    (isBlockedRelationship as jest.Mock).mockResolvedValueOnce(true);

    await expect(
      createEscrowPayment({ buyerId: BUYER.id, sellerId: SELLER.id, amount: 25000, currency: 'aud', description: 'Mentor session' })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(isBlockedRelationship).toHaveBeenCalledWith(BUYER.id, SELLER.id);
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

    const result = await cancelEscrowPayment('pi_1', PLATFORM_ESCROW_ACTOR, 'not delivered');

    expect(result).toEqual({ status: 'refunded' });
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_1' }),
      // Two presses of the same button inside Stripe's idempotency window are
      // one refund, not two.
      { idempotencyKey: 'escrow-refund-escrow-1' }
    );
  });

  it('will not let a member refund a payment that has already been released to the seller', async () => {
    // Either party could cancel a CAPTURED hold, and the refund came out of
    // ATHENA's balance while the seller kept the transfer: a buyer could
    // release and then cancel, a seller could be paid and then cancel, and the
    // platform paid both times.
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'CAPTURED' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      latest_charge: { id: 'ch_1', refunded: false },
    });

    for (const member of [BUYER, SELLER]) {
      await expect(cancelEscrowPayment('pi_1', member)).rejects.toMatchObject({ statusCode: 409 });
    }
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(prisma.escrowPayment.update).not.toHaveBeenCalled();
  });

  it('takes a refund of a released payment back from the seller and the fee, not from ATHENA alone', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'CAPTURED' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      transfer_data: { destination: 'acct_seller' },
      application_fee_amount: 3750,
      latest_charge: { id: 'ch_1', refunded: false },
    });
    stripe.refunds.create.mockResolvedValue({ id: 're_1' });
    prisma.escrowPayment.update.mockResolvedValue({});

    await cancelEscrowPayment('pi_1', PLATFORM_ESCROW_ACTOR, 'dispute upheld');

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_1', reverse_transfer: true, refund_application_fee: true }),
      { idempotencyKey: 'escrow-refund-escrow-1' }
    );
  });

  it('will not refund a payment the buyer’s bank is disputing, even for the platform', async () => {
    // A refund on top of an open chargeback can return the money twice, and a
    // dispute does not reverse the seller's transfer either way: the team settles
    // the dispute at Stripe first.
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'CAPTURED' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      latest_charge: { id: 'ch_1', refunded: false },
    });
    prisma.paymentDispute.findFirst.mockResolvedValueOnce({ stripeDisputeId: 'dp_1', evidenceDueBy: null });

    await expect(cancelEscrowPayment('pi_1', PLATFORM_ESCROW_ACTOR, 'dispute upheld')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('dp_1'),
    });

    expect(prisma.paymentDispute.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { paymentIntentId: 'pi_1', outcome: 'OPEN' } })
    );
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(prisma.escrowPayment.update).not.toHaveBeenCalled();
  });

  it('does not look for a card dispute when all it is giving back is a hold', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(escrowRow({ status: 'AUTHORIZED' }));
    stripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'requires_capture' });
    stripe.paymentIntents.cancel.mockResolvedValue({});
    prisma.escrowPayment.update.mockResolvedValue({});

    await cancelEscrowPayment('pi_1', PLATFORM_ESCROW_ACTOR, 'called off');

    expect(prisma.paymentDispute.findFirst).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_1');
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

    const result = await cancelEscrowPayment('pi_1', PLATFORM_ESCROW_ACTOR);

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
      { currency: 'aud', status: 'CAPTURED', _sum: { amount: 500000, platformFee: 75000 }, _count: { _all: 34 } },
      { currency: 'aud', status: 'AUTHORIZED', _sum: { amount: 20000, platformFee: 3000 }, _count: { _all: 2 } },
      { currency: 'usd', status: 'CAPTURED', _sum: { amount: 10000, platformFee: 1500 }, _count: { _all: 1 } },
    ]);
    prisma.escrowPayment.findMany.mockResolvedValue([]);

    const dashboard = await getEarningsDashboard(SELLER.id);

    // AUD cents used to be added to USD cents and the sum called one number.
    expect(dashboard.currency).toBe('AUD');
    expect(dashboard.totalEarnings).toBe(425000);
    expect(dashboard.pendingPayouts).toBe(17000);
    expect(dashboard.byCurrency).toEqual([
      // Thirty-four sessions, although the recent-activity list is twenty long:
      // the client used to count sessions from that list and stopped at twenty.
      { currency: 'AUD', totalEarnings: 425000, pendingPayouts: 17000, completedCount: 34 },
      { currency: 'USD', totalEarnings: 8500, pendingPayouts: 0, completedCount: 1 },
    ]);
  });

  it('gives the chart a monthly series from the captured rows, in Queensland months and per currency', async () => {
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: null,
      mentorProfile: null,
      creatorProfile: null,
    });
    prisma.escrowPayment.groupBy.mockResolvedValue([]);
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 2));
    // 20:00 UTC on the last day of a month is 06:00 on the 1st in Brisbane,
    // so this one belongs to the following month.
    const lastDayLate = new Date(Date.UTC(2026, 6, 31, 20));
    prisma.escrowPayment.findMany.mockImplementation(async (args: any) =>
      args?.select
        ? [
            { amount: 10000, platformFee: 1500, currency: 'aud', capturedAt: thisMonth },
            { amount: 20000, platformFee: 3000, currency: 'aud', capturedAt: thisMonth },
            { amount: 5000, platformFee: 750, currency: 'usd', capturedAt: thisMonth },
            { amount: 4000, platformFee: 600, currency: 'aud', capturedAt: lastDayLate },
          ]
        : []
    );

    const dashboard = await getEarningsDashboard(SELLER.id);

    const seriesQuery = prisma.escrowPayment.findMany.mock.calls
      .map((call: any[]) => call[0])
      .find((args: any) => args?.select);
    expect(seriesQuery.where).toMatchObject({ sellerId: SELLER.id, status: { in: ['CAPTURED'] } });
    expect(seriesQuery.where.capturedAt.gte).toBeInstanceOf(Date);

    const month = thisMonth.toISOString().slice(0, 7);
    expect(dashboard.monthly).toEqual(
      expect.arrayContaining([
        { month: '2026-08', currency: 'AUD', earnings: 3400, count: 1 },
        { month, currency: 'AUD', earnings: 25500, count: 2 },
        { month, currency: 'USD', earnings: 4250, count: 1 },
      ])
    );
    // Oldest first, so the chart can draw it as it comes.
    const months = dashboard.monthly.map((m) => m.month);
    expect([...months].sort()).toEqual(months);
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

describe('Settling a hold that has outlived its authorisation', () => {
  it('marks a hold Stripe captured as CAPTURED, and only if it is still held', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded', amount_received: 25000 });

    const outcome = await resolveLapsedEscrowHold('pi_1');

    expect(outcome).toEqual({ state: 'captured', changed: true });
    const [args] = prisma.escrowPayment.updateMany.mock.calls[0];
    expect(args.where).toEqual({ paymentIntentId: 'pi_1', status: { in: ['PENDING', 'AUTHORIZED'] } });
    expect(args.data.status).toBe('CAPTURED');
  });

  it('marks a hold Stripe cancelled as CANCELED with the reason, and says when nothing changed', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue({
      status: 'canceled',
      cancellation_reason: 'automatic',
      canceled_at: 1789000000,
    });
    prisma.escrowPayment.updateMany.mockResolvedValueOnce({ count: 0 });

    const outcome = await resolveLapsedEscrowHold('pi_1');

    // A release got there first; the caller must not tell anyone again.
    expect(outcome).toEqual({ state: 'expired', changed: false });
    const [args] = prisma.escrowPayment.updateMany.mock.calls[0];
    expect(args.data).toMatchObject({
      status: 'CANCELED',
      cancelReason: 'The card authorisation lapsed before the payment was released',
      canceledAt: new Date(1789000000 * 1000),
    });
  });

  it('leaves a hold Stripe still holds, and one nobody paid for, exactly as they are', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ status: 'requires_capture' });
    expect(await resolveLapsedEscrowHold('pi_1')).toEqual({ state: 'still_held' });

    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ status: 'requires_payment_method' });
    expect(await resolveLapsedEscrowHold('pi_1')).toEqual({ state: 'unpaid' });

    expect(prisma.escrowPayment.updateMany).not.toHaveBeenCalled();
  });
});

// Mentor sessions booked before mentoring wrote escrow rows could be warned
// about and nothing more: capturing one early would have moved money with no
// ledger row, and a cancelled one could not be released through escrow at all.
describe('Giving a legacy mentor session the escrow row it never had', () => {
  const legacySession = {
    id: 'session-legacy',
    menteeId: 'mentee-1',
    mentorUserId: 'mentor-user-1',
    mentorProfileId: 'mentor-profile-1',
    stripePaymentIntentId: 'pi_legacy',
    paymentCapturedAt: null,
    paymentCanceledAt: null,
  };

  it('writes the row from what Stripe says, including when the authorisation clock started', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_legacy',
      status: 'requires_capture',
      amount: 18000,
      application_fee_amount: 2700,
      currency: 'aud',
      created: 1789000000,
      metadata: { type: 'mentor_session', sessionId: 'session-legacy' },
    });
    prisma.escrowPayment.create.mockResolvedValue({ id: 'escrow-new' });

    const wrote = await adoptUnledgeredMentorSessionHold(legacySession);

    expect(wrote).toBe(true);
    const [{ data }] = prisma.escrowPayment.create.mock.calls[0];
    expect(data).toMatchObject({
      paymentIntentId: 'pi_legacy',
      buyerId: 'mentee-1',
      sellerId: 'mentor-user-1',
      amount: 18000,
      platformFee: 2700,
      currency: 'aud',
      status: 'AUTHORIZED',
      sessionType: 'mentor_session',
      createdAt: new Date(1789000000 * 1000),
    });
  });

  it('records a lapsed legacy hold as cancelled rather than held', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_legacy',
      status: 'canceled',
      cancellation_reason: 'automatic',
      canceled_at: 1789600000,
      amount: 18000,
      application_fee_amount: 2700,
      currency: 'aud',
      created: 1789000000,
      metadata: { sessionId: 'session-legacy' },
    });
    prisma.escrowPayment.create.mockResolvedValue({ id: 'escrow-new' });

    await adoptUnledgeredMentorSessionHold(legacySession);

    const [{ data }] = prisma.escrowPayment.create.mock.calls[0];
    expect(data).toMatchObject({
      status: 'CANCELED',
      canceledAt: new Date(1789600000 * 1000),
      cancelReason: 'The card authorisation lapsed before the payment was released',
    });
  });

  it('refuses an intent that belongs to a different session', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_legacy',
      status: 'requires_capture',
      amount: 18000,
      currency: 'aud',
      created: 1789000000,
      metadata: { sessionId: 'somebody-elses-session' },
    });

    await expect(adoptUnledgeredMentorSessionHold(legacySession)).rejects.toThrow(/not adopting it/);
    expect(prisma.escrowPayment.create).not.toHaveBeenCalled();
  });

  it('treats a row another run wrote first as nothing to do', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_legacy',
      status: 'requires_capture',
      amount: 18000,
      currency: 'aud',
      created: 1789000000,
      metadata: {},
    });
    prisma.escrowPayment.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    expect(await adoptUnledgeredMentorSessionHold(legacySession)).toBe(false);
  });
});
