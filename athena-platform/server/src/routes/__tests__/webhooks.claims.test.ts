/**
 * How a Stripe event is claimed, finished and put in order.
 *
 * The idempotency row used to be written before the handler ran and never
 * marked finished, so a process that died between the two left an event that
 * every retry was told was a duplicate. These tests drive the webhook against a
 * small in-memory StripeWebhookEvent table that enforces the primary key the way
 * Postgres does, so what is asserted is the behaviour (a replay does nothing, a
 * half-done event is finished by the retry, a late event does not undo a newer
 * one) and not the shape of a call.
 */

import request from 'supertest';
import express from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Row = {
  id: string;
  type: string;
  subjectId: string | null;
  eventCreatedAt: Date | null;
  claimedAt: Date;
  completedAt: Date | null;
};

const mockEvents = new Map<string, Row>();

jest.mock('../../utils/prisma', () => {
  const unique = () => Object.assign(new Error('Unique constraint failed on the fields: (`id`)'), { code: 'P2002' });
  const prisma: any = {
    stripeWebhookEvent: {
      create: jest.fn(async ({ data }: any) => {
        if (mockEvents.has(data.id)) throw unique();
        const row = { subjectId: null, eventCreatedAt: null, completedAt: null, claimedAt: new Date(), ...data };
        mockEvents.set(data.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => mockEvents.get(where.id) ?? null),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = mockEvents.get(where.id);
        if (!row) return { count: 0 };
        if (where.completedAt === null && row.completedAt !== null) return { count: 0 };
        if (where.claimedAt && row.claimedAt.getTime() !== where.claimedAt.getTime()) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      delete: jest.fn(async ({ where }: any) => {
        mockEvents.delete(where.id);
        return {};
      }),
      // The only question asked of the table other than the claim: has a newer
      // subscription event for this subscription already been applied?
      findFirst: jest.fn(async ({ where }: any) => {
        for (const row of mockEvents.values()) {
          if (row.id === where.id.not || row.subjectId !== where.subjectId || !row.completedAt) continue;
          if (!where.type.in.includes(row.type)) continue;
          const newer = where.OR.some((clause: any) => {
            if (clause.type && row.type !== clause.type) return false;
            const bound = clause.eventCreatedAt;
            if (!row.eventCreatedAt) return false;
            if (bound.gt) return row.eventCreatedAt > bound.gt;
            return row.eventCreatedAt >= bound.gte;
          });
          if (newer) return { id: row.id };
        }
        return null;
      }),
    },
    subscription: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
    },
    mentorSession: { updateMany: jest.fn(async () => ({ count: 1 })), findFirst: jest.fn(async () => null), update: jest.fn() },
    escrowPayment: { updateMany: jest.fn(async () => ({ count: 1 })) },
    serviceOrder: { findFirst: jest.fn(async () => null) },
    payment: { upsert: jest.fn(), findUnique: jest.fn(async () => null), update: jest.fn(), updateMany: jest.fn(async () => ({ count: 0 })) },
    invoice: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
    $executeRaw: jest.fn(async () => 1),
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return { prisma };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('stripe', () => {
  const client = { webhooks: { constructEvent: jest.fn() }, paymentIntents: { create: jest.fn(), retrieve: jest.fn() }, subscriptions: { retrieve: jest.fn() } };
  const StripeMock: any = jest.fn().mockImplementation(() => client);
  StripeMock.__client = client;
  return { __esModule: true, default: StripeMock };
});

jest.mock('../../services/escrow-renewal.service', () => ({
  recordCaptureDeadline: jest.fn(async () => undefined),
  settleOrderRenewal: jest.fn(async () => 'not_a_renewal'),
  noteLapsedOrderHold: jest.fn(async () => undefined),
}));

// What the mentor is told, and when, is what is asserted below; sending it is not.
jest.mock('../../services/mentor-session-authorisation.service', () => ({
  notifyMentorOfRequestById: jest.fn(async () => undefined),
}));

jest.mock('../../services/creator.service', () => {
  const actual: any = jest.requireActual('../../services/creator.service');
  return { ...actual, confirmGiftPurchaseFromPaymentIntent: jest.fn(async () => ({})) };
});

import Stripe from 'stripe';
import webhookRoutes from '../webhook.routes';
import { confirmGiftPurchaseFromPaymentIntent } from '../../services/creator.service';
import { prisma } from '../../utils/prisma';
import { opsSnapshot, resetOpsMetrics } from '../../utils/ops-metrics';
import { recentDeclines, resetMoneyLimits } from '../../middleware/moneyLimits';
import { noteLapsedOrderHold, recordCaptureDeadline, settleOrderRenewal } from '../../services/escrow-renewal.service';
import { notifyMentorOfRequestById } from '../../services/mentor-session-authorisation.service';

const db: any = prisma;
const stripeClient = (): any => (Stripe as any).__client;

function deliver(event: Record<string, unknown>) {
  stripeClient().webhooks.constructEvent.mockReturnValue(event);
  const app = express();
  app.use('/api/webhooks', webhookRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=a')
    .send(Buffer.from('{"ok":true}'));
}

const giftEvent = (id = 'evt_gift') => ({
  id,
  type: 'payment_intent.succeeded',
  created: 1_760_000_000,
  data: {
    object: {
      id: 'pi_gift',
      status: 'succeeded',
      amount: 500,
      amount_received: 500,
      currency: 'aud',
      metadata: { type: 'gift_balance_purchase', userId: 'user-1' },
    },
  },
});

const MINUTE = 60_000;

beforeEach(() => {
  jest.clearAllMocks();
  mockEvents.clear();
  resetOpsMetrics();
  resetMoneyLimits();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
});

describe('A Stripe event is claimed, finished, and only then a replay', () => {
  it('credits a gift once when the same event is delivered twice', async () => {
    await deliver(giftEvent()).expect(200);
    const replay = await deliver(giftEvent()).expect(200);

    expect(replay.body.duplicate).toBe(true);
    expect(confirmGiftPurchaseFromPaymentIntent).toHaveBeenCalledTimes(1);
  });

  it('marks the event complete only after its handler has finished', async () => {
    let completedWhileHandling: Date | null | undefined = undefined;
    (confirmGiftPurchaseFromPaymentIntent as any).mockImplementationOnce(async () => {
      completedWhileHandling = mockEvents.get('evt_gift')?.completedAt;
      return {};
    });

    await deliver(giftEvent()).expect(200);

    expect(completedWhileHandling).toBeNull();
    expect(mockEvents.get('evt_gift')?.completedAt).toBeInstanceOf(Date);
  });

  it('records which Stripe object a subscription event is about, and when Stripe made it', async () => {
    db.subscription.findFirst.mockResolvedValue(null);
    await deliver({
      id: 'evt_sub',
      type: 'customer.subscription.updated',
      created: 1_760_000_050,
      data: { object: { id: 'sub_9', customer: 'cus_9', status: 'active', items: { data: [] } } },
    }).expect(200);

    expect(mockEvents.get('evt_sub')).toMatchObject({
      subjectId: 'sub_9',
      eventCreatedAt: new Date(1_760_000_050 * 1000),
    });
  });

  it('turns a delivery away, and asks for it again, while another delivery is still working on the event', async () => {
    mockEvents.set('evt_gift', {
      id: 'evt_gift',
      type: 'payment_intent.succeeded',
      subjectId: null,
      eventCreatedAt: null,
      claimedAt: new Date(Date.now() - 30_000),
      completedAt: null,
    });

    const res = await deliver(giftEvent()).expect(409);

    expect(res.body).toMatchObject({ received: false, inProgress: true });
    expect(confirmGiftPurchaseFromPaymentIntent).not.toHaveBeenCalled();
    // The claim is untouched: it belongs to the delivery that is working on it.
    expect(mockEvents.get('evt_gift')?.completedAt).toBeNull();
  });

  it('finishes an event whose process died after the claim, once the claim has gone stale', async () => {
    // The first delivery claimed it and the process died: nothing was applied
    // and nothing was marked complete. This is the money-taken, nothing-credited
    // case the old table could never recover from.
    mockEvents.set('evt_gift', {
      id: 'evt_gift',
      type: 'payment_intent.succeeded',
      subjectId: null,
      eventCreatedAt: null,
      claimedAt: new Date(Date.now() - 10 * MINUTE),
      completedAt: null,
    });

    const res = await deliver(giftEvent()).expect(200);

    expect(res.body.duplicate).toBeUndefined();
    expect(confirmGiftPurchaseFromPaymentIntent).toHaveBeenCalledTimes(1);
    expect(mockEvents.get('evt_gift')?.completedAt).toBeInstanceOf(Date);

    // And now it really is a replay.
    const again = await deliver(giftEvent()).expect(200);
    expect(again.body.duplicate).toBe(true);
    expect(confirmGiftPurchaseFromPaymentIntent).toHaveBeenCalledTimes(1);
  });

  it('lets only one of two retries take over a stale claim', async () => {
    mockEvents.set('evt_gift', {
      id: 'evt_gift',
      type: 'payment_intent.succeeded',
      subjectId: null,
      eventCreatedAt: null,
      claimedAt: new Date(Date.now() - 10 * MINUTE),
      completedAt: null,
    });

    // The two retries read the same stale row, and then the other one wins the
    // conditional update between this one's read and its write.
    const realFindUnique = db.stripeWebhookEvent.findUnique.getMockImplementation();
    db.stripeWebhookEvent.findUnique.mockImplementationOnce(async (args: any) => {
      const seen = await realFindUnique(args);
      mockEvents.get('evt_gift')!.claimedAt = new Date();
      return seen;
    });

    const res = await deliver(giftEvent()).expect(409);

    expect(res.body.inProgress).toBe(true);
    expect(confirmGiftPurchaseFromPaymentIntent).not.toHaveBeenCalled();
  });

  it('claims the event afresh when the earlier delivery released it between the refusal and the read', async () => {
    mockEvents.set('evt_gift', {
      id: 'evt_gift',
      type: 'payment_intent.succeeded',
      subjectId: null,
      eventCreatedAt: null,
      claimedAt: new Date(),
      completedAt: null,
    });
    db.stripeWebhookEvent.findUnique.mockImplementationOnce(async () => {
      // The failed handler let go of its claim.
      mockEvents.delete('evt_gift');
      return null;
    });

    await deliver(giftEvent()).expect(200);

    expect(confirmGiftPurchaseFromPaymentIntent).toHaveBeenCalledTimes(1);
    expect(mockEvents.get('evt_gift')?.completedAt).toBeInstanceOf(Date);
  });

  it('lets go of the claim when the handler fails, so the retry is not turned away', async () => {
    (confirmGiftPurchaseFromPaymentIntent as any).mockRejectedValueOnce(new Error('connection reset'));

    await deliver(giftEvent()).expect(500);
    expect(mockEvents.has('evt_gift')).toBe(false);

    await deliver(giftEvent()).expect(200);
    expect(confirmGiftPurchaseFromPaymentIntent).toHaveBeenCalledTimes(2);
  });

  it('still takes the retry when the claim could not be released, once it has gone stale', async () => {
    (confirmGiftPurchaseFromPaymentIntent as any).mockRejectedValueOnce(new Error('connection reset'));
    db.stripeWebhookEvent.delete.mockRejectedValueOnce(new Error('the database went away'));

    await deliver(giftEvent()).expect(500);
    expect(mockEvents.get('evt_gift')?.completedAt).toBeNull();

    // Inside the stale window the retry waits; after it, the retry is taken.
    await deliver(giftEvent()).expect(409);
    mockEvents.get('evt_gift')!.claimedAt = new Date(Date.now() - 10 * MINUTE);
    await deliver(giftEvent()).expect(200);

    expect(confirmGiftPurchaseFromPaymentIntent).toHaveBeenCalledTimes(2);
  });

  it('does not fail the event when the completion mark cannot be written', async () => {
    db.stripeWebhookEvent.updateMany.mockRejectedValueOnce(new Error('the database blinked'));

    await deliver(giftEvent()).expect(200);

    expect(confirmGiftPurchaseFromPaymentIntent).toHaveBeenCalledTimes(1);
  });
});

describe('Events that arrive out of order', () => {
  const mentorIntent = (type: string, id: string, created: number) => ({
    id,
    type,
    created,
    data: {
      object: {
        id: 'pi_mentor',
        status: type === 'payment_intent.succeeded' ? 'succeeded' : 'requires_capture',
        amount: 12000,
        amount_received: type === 'payment_intent.succeeded' ? 12000 : 0,
        currency: 'aud',
        capture_method: 'manual',
        metadata: { type: 'mentor_session', sessionId: 'sess-1', menteeId: 'mentee-9' },
      },
    },
  });

  it('writes AUTHORIZED only over a payment that has not got past it, and CAPTURED over any live one', async () => {
    await deliver(mentorIntent('payment_intent.amount_capturable_updated', 'evt_a', 1)).expect(200);
    await deliver(mentorIntent('payment_intent.succeeded', 'evt_b', 2)).expect(200);

    const [authorised, captured] = db.mentorSession.updateMany.mock.calls.map((c: any[]) => c[0]);
    expect(authorised.data.paymentStatus).toBe('AUTHORIZED');
    expect(authorised.where.paymentStatus).toEqual({ in: ['PENDING', 'FAILED'] });
    expect(captured.data.paymentStatus).toBe('CAPTURED');
    expect(captured.where.paymentStatus).toEqual({ in: ['PENDING', 'AUTHORIZED', 'FAILED'] });
  });

  // A paid request is the mentor's to answer once the mentee's card is held, so
  // that is when she is told. She used to be told the moment the intent was
  // created, before the mentee had seen a card field, and could accept a request
  // nobody had paid for.
  it('tells the mentor of a paid request when the card is authorised, and not on any other event', async () => {
    await deliver(mentorIntent('payment_intent.amount_capturable_updated', 'evt_notify', 1)).expect(200);

    expect(notifyMentorOfRequestById).toHaveBeenCalledTimes(1);
    expect(notifyMentorOfRequestById).toHaveBeenCalledWith('sess-1');

    // Money being taken at the end of the session is not a new request.
    (notifyMentorOfRequestById as jest.Mock).mockClear();
    await deliver(mentorIntent('payment_intent.succeeded', 'evt_captured', 2)).expect(200);

    expect(notifyMentorOfRequestById).not.toHaveBeenCalled();
  });

  it('does not tell her twice: a redelivery, or an authorisation already recorded, moves nothing and sends nothing', async () => {
    // The payment has already been moved to AUTHORIZED (by the mentor accepting, which asks Stripe, or by an earlier
    // delivery), so the guarded write matches nothing.
    db.mentorSession.updateMany.mockResolvedValueOnce({ count: 0 });
    db.mentorSession.findFirst.mockResolvedValueOnce({ id: 'sess-1' });

    await deliver(mentorIntent('payment_intent.amount_capturable_updated', 'evt_again', 3)).expect(200);

    expect(notifyMentorOfRequestById).not.toHaveBeenCalled();
  });

  it('still records the authorisation when the notice cannot be sent, and does not make Stripe retry', async () => {
    (notifyMentorOfRequestById as jest.Mock).mockRejectedValueOnce(new Error('the mail provider is down') as never);

    await deliver(mentorIntent('payment_intent.amount_capturable_updated', 'evt_mail', 4)).expect(200);

    expect(db.mentorSession.updateMany.mock.calls[0][0].data.paymentStatus).toBe('AUTHORIZED');
  });

  it('does not treat an authorisation that arrives after the capture as a payment that fits no session', async () => {
    // The session is the mentee's and the intent is its own, and the payment has
    // already been captured, so the guarded write matches nothing.
    db.mentorSession.updateMany.mockResolvedValueOnce({ count: 0 });
    db.mentorSession.findFirst.mockResolvedValueOnce({ id: 'sess-1' });
    const { logger } = jest.requireMock('../../utils/logger') as any;

    await deliver(mentorIntent('payment_intent.amount_capturable_updated', 'evt_late', 3)).expect(200);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('moved past it'),
      expect.objectContaining({ paymentIntentId: 'pi_mentor', sessionId: 'sess-1' })
    );
    expect(opsSnapshot().operations['stripe_webhook.mentor_session_unmatched']?.failure ?? 0).toBe(0);
  });

  it('lets a refunded or cancelled mentor payment stay over: a late success does not reopen it', async () => {
    await deliver(mentorIntent('payment_intent.succeeded', 'evt_c', 4)).expect(200);

    const where = db.mentorSession.updateMany.mock.calls[0][0].where.paymentStatus.in;
    expect(where).not.toContain('REFUNDED');
    expect(where).not.toContain('CANCELED');
  });

  it('does not let a decline from an earlier card mark a live escrow hold failed', async () => {
    await deliver({
      id: 'evt_declined_late',
      type: 'payment_intent.payment_failed',
      created: 5,
      data: { object: { id: 'pi_hold', status: 'requires_payment_method', amount: 5000, currency: 'aud', metadata: { buyerId: 'buyer-1', sellerId: 'seller-1' } } },
    }).expect(200);

    const call = db.escrowPayment.updateMany.mock.calls[0][0];
    expect(call.data).toEqual({ status: 'FAILED' });
    expect(call.where.status).toEqual({ in: ['PENDING'] });
  });

  describe('subscription events', () => {
    const subEvent = (id: string, type: string, created: number, status = 'active') => ({
      id,
      type,
      created,
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status,
          cancel_at_period_end: false,
          current_period_start: created,
          current_period_end: created + 2_592_000,
          items: { data: [{ price: { id: 'price_career', unit_amount: 2900, currency: 'aud', recurring: { interval: 'month' } } }] },
        },
      },
    });

    beforeEach(() => {
      process.env.STRIPE_PRICE_CAREER = 'price_career';
      db.subscription.findFirst.mockResolvedValue({ id: 'db-sub-1', userId: 'user-1' });
    });

    it('applies an update, then ignores an older one that arrives after it', async () => {
      await deliver(subEvent('evt_new', 'customer.subscription.updated', 2_000, 'active')).expect(200);
      expect(db.subscription.update).toHaveBeenCalledTimes(1);

      // The earlier snapshot, delivered late, says trialing: applying it would
      // put her status back where it was.
      await deliver(subEvent('evt_old', 'customer.subscription.updated', 1_000, 'trialing')).expect(200);

      expect(db.subscription.update).toHaveBeenCalledTimes(1);
      expect(db.subscription.update.mock.calls[0][0].data.status).toBe('ACTIVE');
    });

    it('applies events in the order Stripe made them when they arrive in that order', async () => {
      await deliver(subEvent('evt_1', 'customer.subscription.updated', 1_000, 'trialing')).expect(200);
      await deliver(subEvent('evt_2', 'customer.subscription.updated', 2_000, 'active')).expect(200);

      expect(db.subscription.update.mock.calls.map((c: any[]) => c[0].data.status)).toEqual(['TRIALING', 'ACTIVE']);
    });

    it('never gives a deleted subscription back, even to an update made in the same second', async () => {
      await deliver(subEvent('evt_del', 'customer.subscription.deleted', 3_000, 'canceled')).expect(200);
      expect(db.subscription.update).toHaveBeenCalledTimes(1);
      expect(db.subscription.update.mock.calls[0][0].data).toMatchObject({ tier: 'FREE', status: 'CANCELED' });

      await deliver(subEvent('evt_late_update', 'customer.subscription.updated', 3_000, 'active')).expect(200);

      expect(db.subscription.update).toHaveBeenCalledTimes(1);
    });

    it('does not compare an event with the ones it is about a different subscription from', async () => {
      await deliver(subEvent('evt_a', 'customer.subscription.updated', 5_000)).expect(200);
      const other = subEvent('evt_b', 'customer.subscription.updated', 1_000);
      (other.data.object as any).id = 'sub_2';

      await deliver(other).expect(200);

      expect(db.subscription.update).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Declined payments are counted against whoever was paying', () => {
  const declined = (id: string, metadata: Record<string, string>) => ({
    id,
    type: 'payment_intent.payment_failed',
    created: 10,
    data: { object: { id: `pi_${id}`, status: 'requires_payment_method', amount: 500, currency: 'aud', metadata } },
  });

  it('counts a decline by whichever key the flow wrote its payer under', async () => {
    await deliver(declined('evt_d1', { type: 'gift_balance_purchase', userId: 'member-a' })).expect(200);
    await deliver(declined('evt_d2', { type: 'mentor_session', menteeId: 'member-b', sessionId: 's-1' })).expect(200);
    await deliver(declined('evt_d3', { buyerId: 'member-c', sellerId: 'seller-1' })).expect(200);

    expect(await recentDeclines('member-a')).toBe(1);
    expect(await recentDeclines('member-b')).toBe(1);
    expect(await recentDeclines('member-c')).toBe(1);
  });

  it('counts a cancelled intent as nothing: she changed her mind, her card did not refuse', async () => {
    await deliver({
      id: 'evt_cancelled',
      type: 'payment_intent.canceled',
      created: 10,
      data: { object: { id: 'pi_c', status: 'canceled', amount: 500, currency: 'aud', metadata: { userId: 'member-a' } } },
    }).expect(200);

    expect(await recentDeclines('member-a')).toBe(0);
  });

  it('counts a replayed decline once', async () => {
    await deliver(declined('evt_same', { userId: 'member-a' })).expect(200);
    await deliver(declined('evt_same', { userId: 'member-a' })).expect(200);

    expect(await recentDeclines('member-a')).toBe(1);
  });

  // The decline is counted when the event has been applied in full. Counted on
  // the way in, a handler that failed half way and was retried by Stripe would
  // count the same decline once per attempt, and five declines is the pause.
  it('counts a decline once even when the event fails half way and is retried', async () => {
    const event = declined('evt_flaky', { type: 'mentor_session', menteeId: 'member-b', sessionId: 's-1' });
    db.mentorSession.updateMany.mockRejectedValueOnce(new Error('the database blinked'));

    await deliver(event).expect(500);
    expect(await recentDeclines('member-b')).toBe(0);

    await deliver(event).expect(200);
    expect(await recentDeclines('member-b')).toBe(1);
  });

  it('does not fail the event when it cannot say who was paying', async () => {
    await deliver(declined('evt_nobody', {})).expect(200);
  });
});

describe('Holds under marketplace orders', () => {
  const holdIntent = (type: string, extra: Record<string, unknown> = {}, metadata: Record<string, string> = {}) => ({
    id: 'evt_hold',
    type,
    created: 20,
    data: {
      object: {
        id: 'pi_new',
        status: type === 'payment_intent.canceled' ? 'canceled' : 'requires_capture',
        amount: 12000,
        currency: 'aud',
        capture_method: 'manual',
        metadata: { buyerId: 'buyer-1', sellerId: 'seller-1', sessionType: 'service_order', ...metadata },
        ...extra,
      },
    },
  });

  it('records Stripe’s deadline for an authorised hold, and moves an order onto it when it is a renewal', async () => {
    await deliver(holdIntent('payment_intent.amount_capturable_updated', { latest_charge: 'ch_1' }, { renewsEscrowId: 'esc-old', renewsOrderId: 'order-1' })).expect(200);

    expect(recordCaptureDeadline).toHaveBeenCalledWith(expect.objectContaining({ id: 'pi_new' }));
    expect(settleOrderRenewal).toHaveBeenCalledWith(expect.objectContaining({ id: 'pi_new' }));
    // Both run after the hold's own row has been moved to AUTHORIZED.
    expect(db.escrowPayment.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      (settleOrderRenewal as any).mock.invocationCallOrder[0]
    );
  });

  it('hands the event back to Stripe, and lets go of the claim, when the move onto the new hold fails', async () => {
    (settleOrderRenewal as any).mockRejectedValueOnce(new Error('the database blinked'));

    await deliver(holdIntent('payment_intent.amount_capturable_updated')).expect(500);
    expect(mockEvents.has('evt_hold')).toBe(false);

    await deliver(holdIntent('payment_intent.amount_capturable_updated')).expect(200);
    expect(settleOrderRenewal).toHaveBeenCalledTimes(2);
  });

  it('tells the people behind an order when its hold is cancelled, and not for a hold that is only declined', async () => {
    await deliver(holdIntent('payment_intent.canceled', { cancellation_reason: 'automatic' })).expect(200);
    expect(noteLapsedOrderHold).toHaveBeenCalledWith(expect.objectContaining({ id: 'pi_new', cancellation_reason: 'automatic' }));

    jest.clearAllMocks();
    mockEvents.clear();
    await deliver({ ...holdIntent('payment_intent.payment_failed'), id: 'evt_declined' }).expect(200);
    expect(noteLapsedOrderHold).not.toHaveBeenCalled();
  });
});
