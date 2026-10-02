/**
 * Events from a webhook endpoint on another Stripe API version than the one the
 * server reads.
 *
 * The server pins every request it makes to STRIPE_API_VERSION, but a webhook
 * payload is shaped by the version of the endpoint that sent it, and an endpoint
 * made in the Dashboard takes the account's own version, which for an account
 * opened today keeps a subscription's period on its items and an invoice's
 * subscription under `parent`. Read straight off such a payload the period was
 * null (no grace after a failed renewal, no trial end date on the billing page)
 * and a failed invoice for another subscription of the same customer could no
 * longer be told from the membership's own. The handlers now read the object
 * again through the pinned client when the versions differ, and only then.
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

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  deliverEmail: jest.fn(async () => ({ ok: true, retryable: false, status: 202, reason: null, attempts: 1 })),
}));

// The tax invoice a paid period becomes is its own service; here only that the
// webhook reaches it, with the subscription it found, matters.
jest.mock('../../services/invoice.service', () => ({
  createInvoiceForPayment: jest.fn(async () => null),
  createInvoiceForSubscription: jest.fn(async () => null),
  paidChargeFromStripeInvoice: jest.fn(() => ({ chargeId: 'ch_1', paidAt: new Date('2026-10-01T00:00:00Z'), amount: 1999, currency: 'aud' })),
  isGstRegistered: jest.fn(() => false),
  supplierReadiness: jest.fn(() => ({ ready: true, missing: [] })),
}));

jest.mock('stripe', () => {
  const stripeClient = {
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    transfers: { create: jest.fn() },
    accountLinks: { create: jest.fn() },
    accounts: { createLoginLink: jest.fn() },
    subscriptions: { retrieve: jest.fn(), cancel: jest.fn() },
    invoices: { retrieve: jest.fn() },
  };
  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;
  return { __esModule: true, default: StripeMock };
});

process.env.STRIPE_PRICE_CAREER = 'price_1CareerAud';

import Stripe from 'stripe';
import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { createInvoiceForSubscription } from '../../services/invoice.service';
import { STRIPE_API_VERSION } from '../../utils/stripe';

const prisma: any = prismaTyped;
const stripe = (Stripe as any).__client;

/** A version later than the server's, on which the fields below have moved. */
const LATER_VERSION = '2025-03-31.basil';

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

const PERIOD_START = 1_900_000_000;
const PERIOD_END = 1_902_592_000;

const price = { id: 'price_1CareerAud', unit_amount: 1999, currency: 'aud', recurring: { interval: 'month' } };

/** The subscription as the server's version shapes it: the period on the subscription. */
const pinnedSubscription = () => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  current_period_start: PERIOD_START,
  current_period_end: PERIOD_END,
  items: { data: [{ price }] },
});

/** The same subscription as a later version sends it: the period on the item, nothing on the subscription. */
const laterSubscription = () => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  items: { data: [{ price, current_period_start: PERIOD_START, current_period_end: PERIOD_END }] },
});

const updatedEvent = (object: Record<string, unknown>, apiVersion?: string | null) => ({
  id: 'evt_sub_updated',
  type: 'customer.subscription.updated',
  ...(apiVersion === undefined ? {} : { api_version: apiVersion }),
  data: { object },
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt' });
  prisma.stripeWebhookEvent.findFirst.mockResolvedValue(null);
  prisma.subscription.findUnique.mockResolvedValue(null);
  prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1', stripeSubscriptionId: 'sub_1', status: 'ACTIVE' });
  prisma.subscription.update.mockResolvedValue({});
});

describe('a subscription event from an endpoint on a later API version', () => {
  it('reads the subscription again through the pinned client, so the period is written rather than lost', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(pinnedSubscription());

    await deliver(updatedEvent(laterSubscription(), LATER_VERSION)).expect(200);

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_1');
    const data = prisma.subscription.update.mock.calls[0][0].data;
    expect(data.currentPeriodStart).toEqual(new Date(PERIOD_START * 1000));
    expect(data.currentPeriodEnd).toEqual(new Date(PERIOD_END * 1000));
    expect(data).toMatchObject({ status: 'ACTIVE', tier: 'PREMIUM_CAREER' });
  });

  it('would otherwise have written no period at all from such a payload', async () => {
    // The payload read as it is, which is what an event with no version named gets.
    await deliver(updatedEvent(laterSubscription(), null)).expect(200);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    const data = prisma.subscription.update.mock.calls[0][0].data;
    expect(data.currentPeriodStart).toBeNull();
    expect(data.currentPeriodEnd).toBeNull();
  });

  it('takes an event on the server’s own version as it is, with no second read', async () => {
    await deliver(updatedEvent(pinnedSubscription(), STRIPE_API_VERSION)).expect(200);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    const data = prisma.subscription.update.mock.calls[0][0].data;
    expect(data.currentPeriodStart).toEqual(new Date(PERIOD_START * 1000));
  });

  it('takes an event that names no version as it is', async () => {
    await deliver(updatedEvent(pinnedSubscription())).expect(200);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalled();
  });

  it('applies nothing, and lets Stripe send the event again, when the second read fails', async () => {
    stripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe is away'));

    await deliver(updatedEvent(laterSubscription(), LATER_VERSION)).expect(500);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    // The claim on the event id is released, so the retry is not turned away as a duplicate.
    expect(prisma.stripeWebhookEvent.delete).toHaveBeenCalledWith({ where: { id: 'evt_sub_updated' } });
  });

  it('does not read again an event that a newer one has already superseded', async () => {
    prisma.stripeWebhookEvent.findFirst.mockResolvedValue({ id: 'evt_newer' });

    await deliver({ ...updatedEvent(laterSubscription(), LATER_VERSION), created: 1_000 }).expect(200);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});

describe('a failed invoice from an endpoint on a later API version', () => {
  // On a later version the invoice no longer says `subscription`; it sits under `parent`.
  const laterInvoice = (id: string) => ({
    id,
    customer: 'cus_1',
    parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_other' } },
  });

  const failedEvent = (id: string, apiVersion = LATER_VERSION) => ({
    id: `evt_${id}`,
    type: 'invoice.payment_failed',
    api_version: apiVersion,
    data: { object: laterInvoice(id) },
  });

  beforeEach(() => {
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'row-1',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      user: { email: 'sarah@example.com', firstName: 'Sarah' },
    });
  });

  it('still tells another subscription’s invoice from the membership’s own, by reading the invoice again', async () => {
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_other', customer: 'cus_1', subscription: 'sub_other' });

    await deliver(failedEvent('in_other')).expect(200);

    expect(stripe.invoices.retrieve).toHaveBeenCalledWith('in_other');
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('and marks the membership past due, and writes to her, when the invoice is its own', async () => {
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_own', customer: 'cus_1', subscription: 'sub_1' });

    await deliver(failedEvent('in_own')).expect(200);

    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'row-1' }, data: { status: 'PAST_DUE' } });
    expect(sendEmail).toHaveBeenCalled();
  });

  it('reads nothing again for an invoice on the server’s own version', async () => {
    await deliver({
      id: 'evt_in_pinned',
      type: 'invoice.payment_failed',
      api_version: STRIPE_API_VERSION,
      data: { object: { id: 'in_pinned', customer: 'cus_1', subscription: 'sub_1' } },
    }).expect(200);

    expect(stripe.invoices.retrieve).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'row-1' }, data: { status: 'PAST_DUE' } });
  });
});

describe('a paid invoice from an endpoint on a later API version', () => {
  it('reads the invoice again so the period can be filed against the subscription it paid for', async () => {
    stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_paid',
      customer: 'cus_1',
      subscription: 'sub_1',
      status: 'paid',
      charge: 'ch_1',
      status_transitions: { paid_at: 1_900_000_100 },
    });
    prisma.subscription.findFirst.mockResolvedValue({ id: 'row-1' });

    await deliver({
      id: 'evt_in_paid',
      type: 'invoice.paid',
      api_version: LATER_VERSION,
      data: {
        object: { id: 'in_paid', customer: 'cus_1', parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1' } } },
      },
    }).expect(200);

    expect(stripe.invoices.retrieve).toHaveBeenCalledWith('in_paid');
    expect(createInvoiceForSubscription).toHaveBeenCalledWith('row-1', expect.objectContaining({ chargeId: 'ch_1' }));
  });
});
