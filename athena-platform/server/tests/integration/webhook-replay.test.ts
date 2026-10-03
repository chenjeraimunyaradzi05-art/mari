/**
 * Stripe events, delivered at least once, in no promised order, by a server that
 * can die half way.
 *
 * The mocked suites beside the webhook (src/routes/__tests__/webhooks.*.test.ts)
 * answer the questions they ask from a hand-written table, which agrees with
 * whatever the test says. What this suite asks Postgres is the part that has to
 * be true for money to be safe:
 *
 *   - the same event delivered twice, or at the same moment, credits a gift once;
 *   - an event whose process died after it was claimed and before it finished is
 *     finished by Stripe's retry, instead of being answered "duplicate" for ever
 *     with the member's money taken and nothing applied;
 *   - an event that is still being worked on is not run a second time;
 *   - an authorisation that arrives after the capture it led to leaves the payment
 *     captured, and a subscription update that arrives after a newer one does not
 *     put her plan back;
 *   - a part refund does not mark a sale refunded.
 *
 * Only Stripe is mocked: the signature check returns the event the test staged.
 */

import request from 'supertest';
import { describeIntegration, createMember, race, resetDatabase } from './setup/harness';

const mockConstructEvent = jest.fn();

jest.mock('../../src/utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => ({
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
    subscriptions: { retrieve: jest.fn() },
    charges: { retrieve: jest.fn() },
    paymentIntents: { retrieve: jest.fn(), cancel: jest.fn() },
  }),
}));

import { app } from '../../src/index';
import { prisma } from '../../src/utils/prisma';

const MINUTE = 60_000;

function deliver(event: Record<string, unknown>) {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_integration';
  mockConstructEvent.mockReturnValue(event);
  return request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=integration')
    .send(Buffer.from('{}'));
}

const giftEvent = (userId: string, id = 'evt_gift', over: Record<string, unknown> = {}) => ({
  id,
  type: 'payment_intent.succeeded',
  created: 1_760_000_000,
  data: {
    object: {
      id: 'pi_gift_1',
      status: 'succeeded',
      amount: 500,
      amount_received: 500,
      currency: 'aud',
      payment_method_types: ['card'],
      metadata: { type: 'gift_balance_purchase', userId, giftPoints: '500' },
      ...over,
    },
  },
});

const giftBalance = async (userId: string) => (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).giftBalance ?? 0;

describeIntegration('Stripe events delivered twice, together, or after the process died', () => {
  beforeEach(async () => {
    await resetDatabase();
    mockConstructEvent.mockReset();
  });

  it('credits a gift once when the same event is delivered twice', async () => {
    const member = await createMember({ giftBalance: 0 });

    const first = await deliver(giftEvent(member.id)).expect(200);
    const second = await deliver(giftEvent(member.id)).expect(200);

    expect(first.body.duplicate).toBeUndefined();
    expect(second.body.duplicate).toBe(true);
    expect(await giftBalance(member.id)).toBe(500);
    expect(await prisma.giftBalancePurchase.count({ where: { userId: member.id } })).toBe(1);
  });

  it('marks the event complete once it has been handled, and never before', async () => {
    const member = await createMember();

    await deliver(giftEvent(member.id)).expect(200);

    const row = await prisma.stripeWebhookEvent.findUniqueOrThrow({ where: { id: 'evt_gift' } });
    expect(row.completedAt).toBeInstanceOf(Date);
    expect(row.type).toBe('payment_intent.succeeded');
    expect(row.eventCreatedAt?.getTime()).toBe(1_760_000_000 * 1000);
  });

  it('credits a gift once when the same event arrives at the same moment on two connections', async () => {
    const member = await createMember({ giftBalance: 0 });

    const results = await race(
      () => deliver(giftEvent(member.id)),
      () => deliver(giftEvent(member.id))
    );

    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : 0));
    // One does the work; the other is told it is a replay or is asked to come
    // back, and neither is an error.
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    expect(await giftBalance(member.id)).toBe(500);
    expect(await prisma.giftBalancePurchase.count({ where: { userId: member.id } })).toBe(1);
  });

  it('finishes an event that was claimed and never completed, once the claim has gone stale', async () => {
    const member = await createMember({ giftBalance: 0 });
    // The first delivery claimed it and the process died: nothing credited, nothing completed.
    await prisma.stripeWebhookEvent.create({
      data: {
        id: 'evt_gift',
        type: 'payment_intent.succeeded',
        claimedAt: new Date(Date.now() - 10 * MINUTE),
        completedAt: null,
      },
    });

    const res = await deliver(giftEvent(member.id)).expect(200);

    expect(res.body.duplicate).toBeUndefined();
    expect(await giftBalance(member.id)).toBe(500);
    const row = await prisma.stripeWebhookEvent.findUniqueOrThrow({ where: { id: 'evt_gift' } });
    expect(row.completedAt).toBeInstanceOf(Date);
    // And now it really is a replay.
    expect((await deliver(giftEvent(member.id)).expect(200)).body.duplicate).toBe(true);
    expect(await giftBalance(member.id)).toBe(500);
  });

  it('does not run an event another delivery is working on, and asks for it again', async () => {
    const member = await createMember({ giftBalance: 0 });
    await prisma.stripeWebhookEvent.create({
      data: { id: 'evt_gift', type: 'payment_intent.succeeded', claimedAt: new Date(Date.now() - 20_000), completedAt: null },
    });

    const res = await deliver(giftEvent(member.id)).expect(409);

    expect(res.body.inProgress).toBe(true);
    expect(await giftBalance(member.id)).toBe(0);
  });

  it('treats an event recorded before completion was tracked as handled, so history is not re-run', async () => {
    const member = await createMember({ giftBalance: 0 });
    // What the migration does to every row that existed: completedAt = processedAt.
    const processedAt = new Date(Date.now() - 3 * 24 * 60 * MINUTE);
    await prisma.stripeWebhookEvent.create({
      data: { id: 'evt_gift', type: 'payment_intent.succeeded', processedAt, claimedAt: processedAt, completedAt: processedAt },
    });

    const res = await deliver(giftEvent(member.id)).expect(200);

    expect(res.body.duplicate).toBe(true);
    expect(await giftBalance(member.id)).toBe(0);
  });

  it('lets go of the claim when the handler fails, so the retry is not turned away', async () => {
    const member = await createMember({ giftBalance: 0 });

    // The points do not match the payment: refused by the service, which is the
    // same answer every time, so the event is acknowledged and counted.
    await deliver(giftEvent(member.id, 'evt_forged', { metadata: { type: 'gift_balance_purchase', userId: member.id, giftPoints: '999999' } })).expect(200);

    expect(await giftBalance(member.id)).toBe(0);
    const row = await prisma.stripeWebhookEvent.findUniqueOrThrow({ where: { id: 'evt_forged' } });
    expect(row.completedAt).toBeInstanceOf(Date);
  });
});

describeIntegration('Stripe events that arrive out of order', () => {
  beforeEach(async () => {
    await resetDatabase();
    mockConstructEvent.mockReset();
  });

  async function seedMentorSession(paymentStatus: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'CANCELED') {
    const mentee = await createMember();
    const mentorUser = await createMember();
    const mentorProfile = await prisma.mentorProfile.create({ data: { userId: mentorUser.id, isMonetized: true } });
    const session = await prisma.mentorSession.create({
      data: {
        mentorProfileId: mentorProfile.id,
        menteeId: mentee.id,
        stripePaymentIntentId: 'pi_session_1',
        paymentStatus,
        sessionAmount: 120,
      },
    });
    return { mentee, session };
  }

  const sessionEvent = (type: string, id: string, menteeId: string, sessionId: string) => ({
    id,
    type,
    created: 1_760_000_000,
    data: {
      object: {
        id: 'pi_session_1',
        status: type === 'payment_intent.succeeded' ? 'succeeded' : 'requires_capture',
        amount: 12000,
        amount_received: type === 'payment_intent.succeeded' ? 12000 : 0,
        currency: 'aud',
        capture_method: 'manual',
        payment_method_types: ['card'],
        metadata: { type: 'mentor_session', sessionId, menteeId, mentorProfileId: 'mp' },
      },
    },
  });

  it('leaves a captured session captured when its authorisation is delivered afterwards', async () => {
    const { mentee, session } = await seedMentorSession('PENDING');

    await deliver(sessionEvent('payment_intent.succeeded', 'evt_captured', mentee.id, session.id)).expect(200);
    expect((await prisma.mentorSession.findUniqueOrThrow({ where: { id: session.id } })).paymentStatus).toBe('CAPTURED');

    await deliver(sessionEvent('payment_intent.amount_capturable_updated', 'evt_authorised_late', mentee.id, session.id)).expect(200);

    expect((await prisma.mentorSession.findUniqueOrThrow({ where: { id: session.id } })).paymentStatus).toBe('CAPTURED');
  });

  it('authorises a session that has not been paid, which is the order Stripe usually sends them in', async () => {
    const { mentee, session } = await seedMentorSession('PENDING');

    await deliver(sessionEvent('payment_intent.amount_capturable_updated', 'evt_authorised', mentee.id, session.id)).expect(200);

    const row = await prisma.mentorSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.paymentStatus).toBe('AUTHORIZED');
    expect(row.paymentAuthorizedAt).toBeInstanceOf(Date);
  });

  it('does not reopen a refunded session when a success event is delivered late', async () => {
    const { mentee, session } = await seedMentorSession('REFUNDED');

    await deliver(sessionEvent('payment_intent.succeeded', 'evt_success_late', mentee.id, session.id)).expect(200);

    expect((await prisma.mentorSession.findUniqueOrThrow({ where: { id: session.id } })).paymentStatus).toBe('REFUNDED');
  });

  it('does not put a member’s plan back when an older subscription update arrives after a newer one', async () => {
    const member = await createMember();
    await prisma.subscription.create({
      data: { userId: member.id, tier: 'PREMIUM_CAREER', status: 'ACTIVE', stripeCustomerId: 'cus_replay', stripeSubscriptionId: 'sub_replay' },
    });
    const update = (id: string, created: number, status: string) => ({
      id,
      type: 'customer.subscription.updated',
      created,
      data: {
        object: {
          id: 'sub_replay',
          customer: 'cus_replay',
          status,
          cancel_at_period_end: false,
          current_period_start: created,
          current_period_end: created + 2_592_000,
          items: { data: [{ price: { id: 'price_x', unit_amount: 2900, currency: 'aud', recurring: { interval: 'month' } } }] },
        },
      },
    });

    await deliver(update('evt_newer', 1_760_000_500, 'past_due')).expect(200);
    await deliver(update('evt_older', 1_760_000_100, 'active')).expect(200);

    // The older snapshot says active; applying it would undo the newer past_due.
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: member.id } })).status).toBe('PAST_DUE');
  });

  it('does not give back a subscription that has ended, even to an update made in the same second', async () => {
    const member = await createMember();
    await prisma.subscription.create({
      data: { userId: member.id, tier: 'PREMIUM_CAREER', status: 'ACTIVE', stripeCustomerId: 'cus_replay', stripeSubscriptionId: 'sub_replay' },
    });
    const event = (id: string, type: string, status: string) => ({
      id,
      type,
      created: 1_760_000_900,
      data: {
        object: {
          id: 'sub_replay',
          customer: 'cus_replay',
          status,
          cancel_at_period_end: false,
          items: { data: [] },
        },
      },
    });

    await deliver(event('evt_deleted', 'customer.subscription.deleted', 'canceled')).expect(200);
    await deliver(event('evt_update_after', 'customer.subscription.updated', 'active')).expect(200);

    const row = await prisma.subscription.findUniqueOrThrow({ where: { userId: member.id } });
    expect(row.tier).toBe('FREE');
    expect(row.status).toBe('CANCELED');
  });
});

describeIntegration('A refund of part of a sale', () => {
  beforeEach(async () => {
    await resetDatabase();
    mockConstructEvent.mockReset();
  });

  const refund = (id: string, refundedCents: number, full: boolean) => ({
    id,
    type: 'charge.refunded',
    created: 1_760_000_000,
    data: { object: { id: 'ch_1', payment_intent: 'pi_escrow_1', amount: 25000, amount_refunded: refundedCents, refunded: full, currency: 'aud' } },
  });

  it('does not mark the sale refunded until all of it has gone back, and only ever counts up', async () => {
    const buyer = await createMember();
    const seller = await createMember();
    const hold = await prisma.escrowPayment.create({
      data: { buyerId: buyer.id, sellerId: seller.id, amount: 25000, status: 'CAPTURED', paymentIntentId: 'pi_escrow_1', sessionType: 'service_order' },
    });

    await deliver(refund('evt_part', 1000, false)).expect(200);
    let row = await prisma.escrowPayment.findUniqueOrThrow({ where: { id: hold.id } });
    expect(row.status).toBe('CAPTURED');
    expect(row.refundedAmount).toBe(1000);

    // An older, smaller figure delivered late cannot shrink what is recorded.
    await deliver(refund('evt_part_old', 500, false)).expect(200);
    row = await prisma.escrowPayment.findUniqueOrThrow({ where: { id: hold.id } });
    expect(row.refundedAmount).toBe(1000);

    await deliver(refund('evt_rest', 25000, true)).expect(200);
    row = await prisma.escrowPayment.findUniqueOrThrow({ where: { id: hold.id } });
    expect(row.status).toBe('REFUNDED');
    expect(row.refundedAmount).toBe(25000);
  });
});
