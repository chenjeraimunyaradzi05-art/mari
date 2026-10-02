/**
 * The Stripe events that keep escrow rows and connected accounts honest.
 *
 * Three gaps, each of which left a screen saying something untrue:
 *  - Events about connected accounts are signed by the Connect endpoint's own
 *    secret, and this route only knew the platform's, so none of them was
 *    ever accepted: account.updated never fired, and a withdrawal that bounced
 *    at the bank was never mentioned to the woman whose money it was.
 *  - A hold captured anywhere but captureEscrowPayment (the Stripe dashboard,
 *    or a capture whose row write failed) left its row saying "held".
 *  - A declined card marked the row FAILED, and when the buyer's next card
 *    authorised on the same intent the row stayed FAILED while her money was
 *    held.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    stripeWebhookEvent: { create: jest.fn(), delete: jest.fn() },
    mentorSession: { update: jest.fn(async () => ({})) },
    escrowPayment: { updateMany: jest.fn(async () => ({ count: 1 })) },
    serviceOrder: { findFirst: jest.fn(async () => null) },
    // An hour booked on a listing, and a proposal the buyer accepted on a brief.
    serviceBooking: { findFirst: jest.fn(async () => null) },
    serviceProposal: { findFirst: jest.fn(async () => null) },
    payment: { upsert: jest.fn(), findUnique: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 0 })) },
    // findUnique and update are what the account.updated sync reads and writes.
    user: { findFirst: jest.fn(async () => null), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    mentorProfile: { updateMany: jest.fn(async () => ({ count: 0 })) },
    creatorProfile: { updateMany: jest.fn(async () => ({ count: 0 })) },
    notification: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (operations: unknown) => operations),
  },
}));

jest.mock('stripe', () => {
  const stripeClient = {
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    transfers: { create: jest.fn() },
    accountLinks: { create: jest.fn() },
    accounts: { createLoginLink: jest.fn() },
  };
  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;
  return { __esModule: true, default: StripeMock };
});

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Stripe from 'stripe';
import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const stripe = (Stripe as any).__client;

function createTestApp() {
  const app = express();
  app.use('/api/webhooks', webhookRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return app;
}

function post() {
  return request(createTestApp())
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=x')
    .send(Buffer.from('{}'));
}

function deliver(event: Record<string, unknown>) {
  stripe.webhooks.constructEvent.mockReturnValue(event);
  return post();
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_platform';
  delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt' });
  prisma.user.findFirst.mockResolvedValue(null);
});

describe('The Connect endpoint’s secret', () => {
  const connectEvent = {
    id: 'evt_c',
    type: 'payout.failed',
    account: 'acct_mentor',
    created: 1789000000,
    data: { object: { id: 'po_1', amount: 15000, currency: 'aud', automatic: false, failure_message: 'The bank account has been closed.' } },
  };

  it('accepts an event signed by the Connect endpoint when that secret is set', async () => {
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_connect';
    stripe.webhooks.constructEvent.mockImplementation((_body: unknown, _sig: unknown, secret: string) => {
      if (secret !== 'whsec_connect') throw new Error('No signatures found matching the expected signature');
      return connectEvent;
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(stripe.webhooks.constructEvent).toHaveBeenCalledTimes(2);
  });

  it('still turns away a signature neither secret made', async () => {
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_connect';
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const res = await post();

    expect(res.status).toBe(400);
    expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
  });
});

describe('A member’s bank payout', () => {
  const payoutEvent = (type: string, payout: Record<string, unknown>, account: string | undefined = 'acct_mentor') => ({
    id: `evt_${type}`,
    type,
    account,
    created: 1789000000,
    data: { object: { id: 'po_1', amount: 15000, currency: 'aud', automatic: false, ...payout } },
  });

  it('tells her when her withdrawal bounced, why, and that the money is back in her balance', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'mentor-1' });

    await deliver(payoutEvent('payout.failed', { failure_message: 'The bank account has been closed.' })).expect(200);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { stripeConnectAccountId: 'acct_mentor' },
      select: { id: true },
    });
    const notice = prisma.notification.create.mock.calls[0][0].data;
    expect(notice).toMatchObject({ userId: 'mentor-1', title: 'Your withdrawal did not reach your bank', link: '/dashboard/earnings' });
    expect(notice.message).toContain('150.00 AUD');
    expect(notice.message).toContain('The bank account has been closed.');
    expect(notice.message).toMatch(/back in your balance/);
  });

  it('tells her when a withdrawal she asked for has been paid', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'mentor-1' });

    await deliver(payoutEvent('payout.paid', {})).expect(200);

    expect(prisma.notification.create.mock.calls[0][0].data.title).toBe('Your withdrawal has been paid');
  });

  it('leaves Stripe’s own scheduled payouts to Stripe', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'mentor-1' });

    await deliver(payoutEvent('payout.paid', { automatic: true })).expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('ignores ATHENA’s own payouts, which carry no account, and accounts no member owns', async () => {
    await deliver(payoutEvent('payout.failed', {}, undefined)).expect(200);
    await deliver(payoutEvent('payout.failed', {})).expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

/**
 * A seller whose account Stripe stops paying out is told, once.
 *
 * Stripe pauses an account when a document expires, a check fails or a rule
 * changes. The webhook wrote the new status and said nothing, so she found out
 * when a payout or a booking was refused. The notice goes out at the moment the
 * status moves from ACTIVE, and the status is written first, so a redelivery of
 * the same event sees RESTRICTED already and stays quiet.
 */
describe('A connected account that stops being able to receive payouts', () => {
  const accountEvent = (account: Record<string, unknown> = {}, id = 'evt_acct') => ({
    id,
    type: 'account.updated',
    account: 'acct_mentor',
    created: 1789000000,
    data: {
      object: {
        id: 'acct_mentor',
        metadata: { userId: 'mentor-1' },
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: false,
        requirements: { currently_due: ['external_account'], disabled_reason: 'requirements.past_due' },
        ...account,
      },
    },
  });

  /** The member row as the sync reads it: her status, and the profiles it mirrors onto. */
  function memberWithStatus(status: string | null) {
    prisma.user.findUnique.mockImplementation(async (args: any) =>
      args?.select?.stripeConnectStatus
        ? { id: 'mentor-1', stripeConnectStatus: status }
        : { mentorProfile: { stripeAccountId: 'acct_mentor' }, creatorProfile: null }
    );
  }

  it('tells her once, in plain words, what Stripe is waiting for and that her earnings are safe', async () => {
    memberWithStatus('ACTIVE');

    await deliver(accountEvent()).expect(200);

    // The new status is what stops creator payouts and escrow holds up front.
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'mentor-1' },
      data: { stripeConnectAccountId: 'acct_mentor', stripeConnectStatus: 'RESTRICTED' },
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const notice = prisma.notification.create.mock.calls[0][0].data;
    expect(notice).toMatchObject({
      userId: 'mentor-1',
      type: 'SYSTEM',
      title: 'Stripe has paused payouts to your account',
      link: '/dashboard/earnings',
    });
    expect(notice.message).toMatch(/one more detail/);
    expect(notice.message).toMatch(/stays in your balance/);
  });

  it('counts how many details Stripe needs when there is more than one', async () => {
    memberWithStatus('ACTIVE');

    await deliver(accountEvent({ requirements: { currently_due: ['a', 'b', 'c'] } })).expect(200);

    expect(prisma.notification.create.mock.calls[0][0].data.message).toMatch(/3 more details/);
  });

  it('says nothing the second time: a redelivery finds the status already moved', async () => {
    memberWithStatus('RESTRICTED');

    await deliver(accountEvent({}, 'evt_acct_again')).expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('says nothing when an account becomes able to be paid, or is still being set up', async () => {
    memberWithStatus('RESTRICTED');
    await deliver(accountEvent({ payouts_enabled: true }, 'evt_up')).expect(200);

    memberWithStatus('PENDING');
    await deliver(accountEvent({ details_submitted: false }, 'evt_pending')).expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
    // The state itself is still written both times.
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
  });

  it('still records the new state when the notice cannot be written, and does not make Stripe retry', async () => {
    memberWithStatus('ACTIVE');
    prisma.notification.create.mockRejectedValueOnce(new Error('database is busy'));

    await deliver(accountEvent()).expect(200);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stripeConnectStatus: 'RESTRICTED' }) })
    );
    expect(prisma.stripeWebhookEvent.delete).not.toHaveBeenCalled();
  });

  // Stripe keeps reporting on every account ever created with her id in its
  // metadata, including a duplicate an older path minted. Applying that event
  // wrote the old account back over the one she is paid through.
  it('does not repoint a member at a superseded account, or tell her payouts have stopped when they have not', async () => {
    prisma.user.findUnique.mockImplementation(async () => ({
      id: 'mentor-1',
      stripeConnectStatus: 'ACTIVE',
      stripeConnectAccountId: 'acct_current',
    }));

    await deliver(accountEvent({ payouts_enabled: false })).expect(200);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.mentorProfile.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('ignores an account no member owns', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);

    await deliver(accountEvent({ metadata: {} })).expect(200);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('Escrow rows follow the intent', () => {
  it('marks a hold captured anywhere as CAPTURED, only while it is still held', async () => {
    await deliver({
      id: 'evt_s',
      type: 'payment_intent.succeeded',
      created: 1789000000,
      data: { object: { id: 'pi_hold', capture_method: 'manual', amount: 25000, amount_received: 25000, currency: 'aud', metadata: { buyerId: 'b', sellerId: 's' } } },
    }).expect(200);

    expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_hold', status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] } },
      data: { status: 'CAPTURED', capturedAt: new Date(1789000000 * 1000) },
    });
  });

  it('does not touch escrow for a payment that was never a hold', async () => {
    await deliver({
      id: 'evt_s2',
      type: 'payment_intent.succeeded',
      created: 1789000000,
      data: { object: { id: 'pi_gift', capture_method: 'automatic', amount: 500, amount_received: 500, currency: 'aud', metadata: {} } },
    }).expect(200);

    expect(prisma.escrowPayment.updateMany).not.toHaveBeenCalled();
  });

  it('moves a hold whose first card was declined to AUTHORIZED when the next one authorises', async () => {
    await deliver({
      id: 'evt_a',
      type: 'payment_intent.amount_capturable_updated',
      created: 1789000000,
      data: { object: { id: 'pi_hold', metadata: {} } },
    }).expect(200);

    expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_hold', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'AUTHORIZED' },
    });
  });
});

// The provider is told that money is held once it really is, which is the point at
// which confirming a time, or starting the work, is safe.
describe('Telling the provider that a booking or a proposal is paid for', () => {
  const authorised = (sessionType: string, id = 'evt_held') => ({
    id,
    type: 'payment_intent.amount_capturable_updated',
    created: 1789000000,
    data: { object: { id: 'pi_hold', metadata: { sessionType } } },
  });

  beforeEach(() => {
    prisma.escrowPayment.updateMany.mockResolvedValue({ count: 1 });
  });

  it('tells the provider of a booked hour, with the time, that it can be confirmed', async () => {
    prisma.serviceBooking.findFirst.mockResolvedValue({
      id: 'b1',
      scheduledAt: new Date('2026-10-05T00:00:00Z'),
      service: { title: 'Pitch review', providerId: 'seller-1' },
    });

    await deliver(authorised('service_booking')).expect(200);

    expect(prisma.serviceBooking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { escrow: { paymentIntentId: 'pi_hold' } } })
    );
    const notice = prisma.notification.create.mock.calls[0][0].data;
    expect(notice).toMatchObject({ userId: 'seller-1', title: 'New booking', link: '/skills-marketplace/bookings' });
    expect(notice.message).toContain('Pitch review: payment is held');
    expect(notice.message).toMatch(/Confirm the time to accept it/);
  });

  it('tells the provider of an accepted proposal that the buyer has paid and the work can start', async () => {
    prisma.serviceProposal.findFirst.mockResolvedValue({ providerId: 'seller-2', request: { title: 'Need a brand refresh' } });

    await deliver(authorised('custom_request')).expect(200);

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'seller-2',
      title: 'Your proposal was accepted',
      link: '/skills-marketplace',
    });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('Need a brand refresh');
  });

  it('does not tell the provider again when the authorisation is delivered a second time', async () => {
    // Nothing moved to AUTHORIZED the second time, because it already was.
    prisma.escrowPayment.updateMany.mockResolvedValue({ count: 0 });

    await deliver(authorised('service_booking', 'evt_again')).expect(200);
    await deliver(authorised('custom_request', 'evt_again_2')).expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('says nothing for a booking it has no record of, and still accepts the event', async () => {
    prisma.serviceBooking.findFirst.mockResolvedValue(null);

    await deliver(authorised('service_booking')).expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
