/**
 * Which tier a membership is on, and which membership a member's row follows.
 *
 * The webhook kept its own copy of the four Australian-dollar price ids, so a
 * membership priced in any other currency could not be placed on a tier, and a
 * checkout in one was recorded against the Australian-dollar price. And because
 * the row is found by customer as well as by subscription, a second subscription
 * for the same customer (two checkouts opened in two tabs) took her row over and
 * left the first billing her card with nothing of ours pointing at it.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    stripeWebhookEvent: {
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(async () => null),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    subscription: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return { prisma };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/admin-notify.service', () => ({ notifyAdmins: jest.fn(async () => 1) }));

jest.mock('stripe', () => {
  const stripeClient = {
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    transfers: { create: jest.fn() },
    accountLinks: { create: jest.fn() },
    accounts: { createLoginLink: jest.fn() },
    subscriptions: { retrieve: jest.fn(), cancel: jest.fn() },
  };
  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;
  return { __esModule: true, default: StripeMock };
});

// The price ids are read from the environment when the price table is built, so
// they are set before the router, and the table behind it, is loaded.
process.env.STRIPE_PRICE_CAREER = 'price_1CareerAud';
process.env.STRIPE_PRICE_PROFESSIONAL = 'price_1ProfessionalAud';
process.env.STRIPE_PRICE_CAREER_USD = 'price_1CareerUsd';
process.env.STRIPE_PRICE_PROFESSIONAL_USD = 'price_1ProfessionalUsd';
process.env.STRIPE_PRICE_CREATOR_GBP = 'price_1CreatorGbp';

import Stripe from 'stripe';
import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';
import { notifyAdmins } from '../../services/admin-notify.service';
import { tierForPriceId } from '../../config/regions';

const prisma: any = prismaTyped;
const stripe = (Stripe as any).__client;

function deliver(event: Record<string, unknown>) {
  stripe.webhooks.constructEvent.mockReturnValue(event);
  const app = express();
  app.use('/api/webhooks', webhookRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=x')
    .send(Buffer.from('{}'));
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt' });
  prisma.stripeWebhookEvent.findFirst.mockResolvedValue(null);
  prisma.subscription.findUnique.mockResolvedValue(null);
  prisma.subscription.findFirst.mockResolvedValue(null);
});

describe('the tier a price sells, in any currency', () => {
  it('knows the Australian-dollar price of each tier and the price of one in another currency', () => {
    expect(tierForPriceId('price_1CareerAud')).toBe('PREMIUM_CAREER');
    expect(tierForPriceId('price_1ProfessionalAud')).toBe('PREMIUM_PROFESSIONAL');
    expect(tierForPriceId('price_1ProfessionalUsd')).toBe('PREMIUM_PROFESSIONAL');
    expect(tierForPriceId('price_1CreatorGbp')).toBe('PREMIUM_CREATOR');
  });

  it('knows nothing of a price that is not one of ours, or of no price', () => {
    expect(tierForPriceId('price_somebody_elses')).toBeNull();
    expect(tierForPriceId('')).toBeNull();
    expect(tierForPriceId(null)).toBeNull();
    expect(tierForPriceId(undefined)).toBeNull();
  });
});

describe('customer.subscription.updated for a membership priced in another currency', () => {
  const updated = (priceId: string, currency: string) => ({
    id: 'evt_usd',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        cancel_at_period_end: false,
        current_period_start: 1_900_000_000,
        current_period_end: 1_902_592_000,
        items: { data: [{ price: { id: priceId, unit_amount: 1999, currency, recurring: { interval: 'month' } } }] },
      },
    },
  });

  it('puts her on the tier that price sells, where it used to leave her tier as it was', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1', stripeSubscriptionId: 'sub_1', status: 'ACTIVE' });

    await deliver(updated('price_1ProfessionalUsd', 'usd')).expect(200);

    const data = prisma.subscription.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ tier: 'PREMIUM_PROFESSIONAL', stripePriceId: 'price_1ProfessionalUsd', currency: 'USD' });
  });

  it('leaves the tier alone for a price that is not one of ours, rather than guessing', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1', stripeSubscriptionId: 'sub_1', status: 'ACTIVE' });

    await deliver(updated('price_somebody_elses', 'usd')).expect(200);

    const data = prisma.subscription.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('tier');
  });
});

describe('checkout.session.completed for a membership bought in another currency', () => {
  const completed = (currency: string | undefined, subscription = 'sub_new') => ({
    id: 'evt_done',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        mode: 'subscription',
        customer: 'cus_1',
        subscription,
        metadata: { userId: 'user-1', tier: 'PREMIUM_CAREER', ...(currency ? { currency } : {}) },
      },
    },
  });

  it('records the price that currency was charged, not the Australian-dollar one', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_new', status: 'trialing', items: { data: [] } });

    await deliver(completed('USD')).expect(200);

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ stripePriceId: 'price_1CareerUsd', currency: 'USD' }),
        update: expect.objectContaining({ stripePriceId: 'price_1CareerUsd', currency: 'USD' }),
      })
    );
  });

  it('records the Australian-dollar price when the session names no currency', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_new', status: 'trialing', items: { data: [] } });

    await deliver(completed(undefined)).expect(200);

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ stripePriceId: 'price_1CareerAud' }) })
    );
  });
});

describe('a second membership checkout for a member who is already being billed', () => {
  const completed = (subscription = 'sub_second') => ({
    id: `evt_${subscription}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_second',
        mode: 'subscription',
        customer: 'cus_1',
        subscription,
        metadata: { userId: 'user-1', tier: 'PREMIUM_CAREER', currency: 'AUD' },
      },
    },
  });

  const rowOn = (stripeSubscriptionId: string | null, status = 'ACTIVE') => ({ stripeSubscriptionId, status });

  const atStripe = (byId: Record<string, unknown>) =>
    stripe.subscriptions.retrieve.mockImplementation(async (id: string) => {
      const found = byId[id];
      if (found instanceof Error) throw found;
      return found;
    });

  it('cancels the new subscription when it is only a trial, because nothing has been taken, and leaves her row on the first', async () => {
    prisma.subscription.findUnique.mockResolvedValue(rowOn('sub_first'));
    atStripe({ sub_first: { id: 'sub_first', status: 'active' }, sub_second: { id: 'sub_second', status: 'trialing' } });
    stripe.subscriptions.cancel.mockResolvedValue({});

    await deliver(completed()).expect(200);

    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_second');
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('does not cancel one that has already taken a payment, and tells staff to give it back', async () => {
    prisma.subscription.findUnique.mockResolvedValue(rowOn('sub_first'));
    atStripe({ sub_first: { id: 'sub_first', status: 'trialing' }, sub_second: { id: 'sub_second', status: 'active' } });

    await deliver(completed()).expect(200);

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'A member is being billed for two memberships',
        link: '/admin/subscriptions',
        data: expect.objectContaining({ keptSubscriptionId: 'sub_first', duplicateSubscriptionId: 'sub_second' }),
      })
    );
    expect(((notifyAdmins as unknown as jest.Mock).mock.calls[0][0] as { message: string }).message).toMatch(/sub_first.*sub_second/s);
  });

  it('says nothing, and changes nothing, when an earlier run of the same event has already cancelled it', async () => {
    prisma.subscription.findUnique.mockResolvedValue(rowOn('sub_first'));
    atStripe({ sub_first: { id: 'sub_first', status: 'active' }, sub_second: { id: 'sub_second', status: 'canceled' } });

    await deliver(completed()).expect(200);

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('takes the new one when the membership on her row has ended at Stripe, because our row only lagged', async () => {
    prisma.subscription.findUnique.mockResolvedValue(rowOn('sub_first'));
    atStripe({ sub_first: { id: 'sub_first', status: 'canceled' }, sub_second: { id: 'sub_second', status: 'trialing', items: { data: [] } } });

    await deliver(completed()).expect(200);

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ stripeSubscriptionId: 'sub_second' }) })
    );
  });

  it('takes the new one when Stripe has no record of the one on her row', async () => {
    prisma.subscription.findUnique.mockResolvedValue(rowOn('sub_gone'));
    const missing: any = new Error('No such subscription');
    missing.code = 'resource_missing';
    atStripe({ sub_gone: missing, sub_second: { id: 'sub_second', status: 'trialing', items: { data: [] } } });

    await deliver(completed()).expect(200);

    expect(prisma.subscription.upsert).toHaveBeenCalled();
  });

  it('hands the event back to Stripe to retry when it cannot be told whether the first is live, rather than guess', async () => {
    prisma.subscription.findUnique.mockResolvedValue(rowOn('sub_first'));
    atStripe({ sub_first: new Error('stripe is down') });

    await deliver(completed()).expect(500);

    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(prisma.stripeWebhookEvent.delete).toHaveBeenCalled();
  });

  it('does not treat the same subscription arriving twice as a second one', async () => {
    prisma.subscription.findUnique.mockResolvedValue(rowOn('sub_second'));
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_second', status: 'trialing', items: { data: [] } });

    await deliver(completed()).expect(200);

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).toHaveBeenCalled();
  });

  it('does not look for a duplicate for a member whose last membership had already ended on her row', async () => {
    prisma.subscription.findUnique.mockResolvedValue(rowOn(null, 'CANCELED'));
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_second', status: 'trialing', items: { data: [] } });

    await deliver(completed()).expect(200);

    expect(prisma.subscription.upsert).toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

describe('subscription events for a subscription the row is not on', () => {
  const event = (type: string, id: string, status = 'canceled') => ({
    id: `evt_${type}_${id}`,
    type,
    data: {
      object: {
        id,
        customer: 'cus_1',
        status,
        cancel_at_period_end: false,
        current_period_start: 1_900_000_000,
        current_period_end: 1_902_592_000,
        items: { data: [{ price: { id: 'price_1CareerAud', unit_amount: 1999, currency: 'aud', recurring: { interval: 'month' } } }] },
      },
    },
  });

  it('does not send a paid-up member back to the free plan because another subscription of hers ended', async () => {
    // The row is found by customer, so the cancelled duplicate's event reaches it.
    prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1', stripeSubscriptionId: 'sub_first', status: 'ACTIVE' });

    await deliver(event('customer.subscription.deleted', 'sub_second')).expect(200);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('does not overwrite her row from an update about the other subscription either', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1', stripeSubscriptionId: 'sub_first', status: 'TRIALING' });

    await deliver(event('customer.subscription.updated', 'sub_second', 'active')).expect(200);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('still ends the membership the row is on when that one is deleted', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1', stripeSubscriptionId: 'sub_first', status: 'ACTIVE' });

    await deliver(event('customer.subscription.deleted', 'sub_first')).expect(200);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: expect.objectContaining({ tier: 'FREE', status: 'CANCELED', stripeSubscriptionId: null }),
    });
  });

  it('applies an event for a different subscription once the row is no longer on a live one', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1', stripeSubscriptionId: 'sub_first', status: 'CANCELED' });

    await deliver(event('customer.subscription.updated', 'sub_second', 'active')).expect(200);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stripeSubscriptionId: 'sub_second', status: 'ACTIVE' }) })
    );
  });

  it('applies the first event of a membership whose checkout has not been recorded yet', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1', stripeSubscriptionId: null, status: 'ACTIVE' });

    await deliver(event('customer.subscription.updated', 'sub_first', 'active')).expect(200);

    expect(prisma.subscription.update).toHaveBeenCalled();
  });
});
