import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationBadge: { findMany: jest.fn(async () => []), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(async () => ({})) },
    user: { update: jest.fn(async () => ({})) },
    notification: { create: jest.fn(async () => ({})) },
    auditLog: { create: jest.fn(async () => ({})) },
    stripeWebhookEvent: { create: jest.fn(async () => ({ id: 'evt' })) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

jest.mock('stripe', () => {
  const stripeClient = {
    identity: { verificationSessions: { create: jest.fn(async () => ({ id: 'vs_1', url: 'https://verify.stripe.com/vs_1' })) } },
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

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'ana', role: req.headers['x-test-role'] || 'USER', email: 'ana@athena.com' };
      next();
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_identity';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.CLIENT_URL = 'https://app.example';

import Stripe from 'stripe';
import { app } from '../../index';
import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const stripe = (Stripe as any).__client;

function webhookApp() {
  const a = express();
  a.use('/api/webhooks', webhookRoutes);
  a.use((err: any, _req: any, res: any, _next: any) => res.status(err?.statusCode || 500).json({ message: err?.message }));
  return a;
}

describe('Identity verification through Stripe Identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.verificationBadge.findFirst.mockResolvedValue(null);
  });

  it('starts a hosted document check and keeps one pending badge pointed at it', async () => {
    prisma.verificationBadge.create.mockResolvedValue({ id: 'b1' });

    const res = await request(app).post('/api/verification/identity/session').expect(200);

    expect(res.body.data).toEqual({ url: 'https://verify.stripe.com/vs_1', sessionId: 'vs_1' });
    const params = stripe.identity.verificationSessions.create.mock.calls[0][0];
    expect(params).toMatchObject({ type: 'document', metadata: { userId: 'ana' }, return_url: 'https://app.example/dashboard/settings/verification?identity=done' });
    expect(prisma.verificationBadge.create.mock.calls[0][0].data).toMatchObject({ userId: 'ana', type: 'IDENTITY', status: 'PENDING', metadata: { provider: 'stripe_identity', sessionId: 'vs_1' } });

    // A retry reuses the pending badge instead of stacking another.
    prisma.verificationBadge.findFirst.mockImplementation(async ({ where }: any) => (where.status === 'PENDING' ? { id: 'b1' } : null));
    await request(app).post('/api/verification/identity/session').expect(200);
    expect(prisma.verificationBadge.update.mock.calls[0][0]).toMatchObject({ where: { id: 'b1' } });
  });

  it('refuses when the identity is already verified', async () => {
    prisma.verificationBadge.findFirst.mockImplementation(async ({ where }: any) => (where.status === 'APPROVED' ? { id: 'b0' } : null));
    await request(app).post('/api/verification/identity/session').expect(409);
    expect(stripe.identity.verificationSessions.create).not.toHaveBeenCalled();
  });

  it('a passed check approves the badge, marks the profile verified and tells the member', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue({ id: 'b1', userId: 'ana', status: 'PENDING' });
    stripe.webhooks.constructEvent.mockReturnValue({ id: 'evt_v', type: 'identity.verification_session.verified', data: { object: { id: 'vs_1', status: 'verified' } } });

    await request(webhookApp()).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('stripe-signature', 't=1,v1=x').send(Buffer.from('{}')).expect(200);

    expect(prisma.verificationBadge.findFirst.mock.calls[0][0].where).toEqual({ type: 'IDENTITY', metadata: { path: ['sessionId'], equals: 'vs_1' } });
    expect(prisma.verificationBadge.update.mock.calls[0][0].data).toMatchObject({ status: 'APPROVED' });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'ana' }, data: { isVerified: true } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'ana', title: 'Identity verified' });
  });

  it('a check that needs input records why and asks the member to go again', async () => {
    prisma.verificationBadge.findFirst.mockResolvedValue({ id: 'b1', userId: 'ana', status: 'PENDING' });
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_r',
      type: 'identity.verification_session.requires_input',
      data: { object: { id: 'vs_1', status: 'requires_input', last_error: { code: 'document_unverified_other', reason: 'The document was blurry.' } } },
    });

    await request(webhookApp()).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('stripe-signature', 't=1,v1=x').send(Buffer.from('{}')).expect(200);

    expect(prisma.verificationBadge.update.mock.calls[0][0].data).toEqual({ reason: 'The document was blurry.' });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.notification.create.mock.calls[0][0].data.message).toContain('blurry');
  });

  it('the pending list is the admin’s', async () => {
    await request(app).get('/api/verification/badges/pending').expect(403);
    prisma.verificationBadge.findMany.mockResolvedValue([{ id: 'b1', type: 'EMPLOYER', status: 'PENDING', user: { id: 'u1' } }]);
    const res = await request(app).get('/api/verification/badges/pending').set('x-test-role', 'ADMIN').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(prisma.verificationBadge.findMany.mock.calls[0][0].where).toEqual({ status: 'PENDING' });
  });
});
