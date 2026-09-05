import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    stripeWebhookEvent: { create: jest.fn() },
    mentorSession: { findFirst: jest.fn(), update: jest.fn() },
    escrowPayment: { updateMany: jest.fn(async () => ({ count: 0 })) },
    subscription: { findFirst: jest.fn(), update: jest.fn(), upsert: jest.fn() },
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
import { sendEmail } from '../../utils/email';

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

function deliver(event: Record<string, unknown>) {
  stripe.webhooks.constructEvent.mockReturnValue(event);
  return request(createTestApp())
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=x')
    .send(Buffer.from('{}'));
}

describe('Refunds, disputes and failed renewals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.TRUST_SAFETY_EMAIL = 'safety@example.com';
    process.env.CLIENT_URL = 'https://app.example';
    prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt' });
  });

  it('a refunded charge marks the mentoring session it paid for', async () => {
    prisma.mentorSession.findFirst.mockResolvedValue({ id: 's1' });
    prisma.mentorSession.update.mockResolvedValue({});

    await deliver({ id: 'evt_r', type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_9', amount_refunded: 12000 } } }).expect(200);

    expect(prisma.mentorSession.findFirst).toHaveBeenCalledWith({ where: { stripePaymentIntentId: 'pi_9' }, select: { id: true } });
    expect(prisma.mentorSession.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { paymentStatus: 'REFUNDED' } });
  });

  it('a new dispute is emailed to trust and safety; a closed one is only logged', async () => {
    await deliver({
      id: 'evt_d',
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_1', payment_intent: 'pi_9', amount: 12000, currency: 'aud', reason: 'fraudulent', status: 'needs_response', evidence_details: { due_by: 1_800_000_000 } } },
    }).expect(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('safety@example.com');
    expect(mail.subject).toContain('dp_1');
    expect(mail.text).toContain('120.00 AUD');

    await deliver({ id: 'evt_d2', type: 'charge.dispute.closed', data: { object: { id: 'dp_1', payment_intent: 'pi_9', amount: 12000, currency: 'aud', reason: 'fraudulent', status: 'won' } } }).expect(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('a failed renewal marks the subscription past due and tells the member how to fix it', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', stripeCustomerId: 'cus_1', user: { email: 'sarah@example.com', firstName: 'Sarah' } });
    prisma.subscription.update.mockResolvedValue({});

    await deliver({ id: 'evt_i', type: 'invoice.payment_failed', data: { object: { id: 'in_1', customer: 'cus_1' } } }).expect(200);

    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-1' }, data: { status: 'PAST_DUE' } });
    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('sarah@example.com');
    expect(mail.text).toContain('Hi Sarah,');
    expect(mail.text).toContain('https://app.example/dashboard/settings/billing');
  });

  it('a failed renewal for a customer we do not know is ignored quietly', async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);
    await deliver({ id: 'evt_i2', type: 'invoice.payment_failed', data: { object: { id: 'in_2', customer: 'cus_unknown' } } }).expect(200);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
