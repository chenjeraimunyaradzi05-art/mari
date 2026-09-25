import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Who may release, and who may return, an escrow hold.
 *
 * `/api/connect` was one of the mounted prefixes no test mentioned, and it is
 * the one that decides whether a buyer's money goes to the seller or back to
 * her. The authorisation is `assertEscrowParty` in stripe-connect.service, and
 * it encodes two rules that are easy to lose in a refactor and expensive to
 * lose in production:
 *
 *   - Release ('buyer') is for the person who paid, and only her. A seller who
 *     could capture her own hold would be paying himself for a session he had
 *     not given.
 *   - Return ('either') is for either party, because a buyer backing out and a
 *     seller cancelling are both safe.
 *
 * A caller who is neither gets 404, not 403, on purpose: a 403 would turn these
 * endpoints into an oracle for which payment intents exist. The assertions
 * below check the 404 as well as the refusal, so that "improving" it to a 403
 * fails here rather than shipping.
 *
 * `server/.env` carries a real Stripe key and `src/index` calls
 * `dotenv.config()`, so utils/stripe is mocked to report not-configured. That
 * puts the service on its development mock branch, which is the right place for
 * this suite: every assertion here is about the decision taken before Stripe is
 * consulted at all.
 */

jest.mock('../src/utils/prisma', () => ({
  prisma: {
    escrowPayment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../src/middleware/auth', () => {
  const actual: any = jest.requireActual('../src/middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, res: any, next: any) => {
      const id = req.headers['x-test-user'];
      if (!id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      req.user = { id, role: req.headers['x-test-role'] || 'USER', email: `${id}@athena.com` };
      next();
    },
  };
});

jest.mock('../src/middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../src/middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../src/utils/stripe', () => {
  const actual: any = jest.requireActual('../src/utils/stripe');
  return {
    ...actual,
    isStripeConfigured: () => false,
    getStripe: jest.fn(() => {
      throw new Error('getStripe() was called on a path this suite expects to refuse first');
    }),
  };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { prisma as prismaTyped } from '../src/utils/prisma';

const prisma: any = prismaTyped;

const BUYER = 'buyer-ada';
const SELLER = 'seller-grace';
const STRANGER = 'stranger-mal';
const INTENT = 'pi_mock_escrow_1';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

function holdInStatus(status: string) {
  prisma.escrowPayment.findUnique.mockResolvedValue({
    id: 'esc-1',
    paymentIntentId: INTENT,
    buyerId: BUYER,
    sellerId: SELLER,
    amount: 15_000,
    platformFee: 3_000,
    currency: 'aud',
    status,
    capturedAt: null,
  });
}

describe('Releasing an escrow hold', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.escrowPayment.update.mockResolvedValue({ id: 'esc-1' });
    holdInStatus('AUTHORIZED');
  });

  it('refuses an anonymous caller', async () => {
    await request(app).post(`/api/connect/escrow/${INTENT}/capture`).expect(401);
    expect(prisma.escrowPayment.update).not.toHaveBeenCalled();
  });

  it('lets the buyer release the money she is holding', async () => {
    const res = await request(app)
      .post(`/api/connect/escrow/${INTENT}/capture`)
      .set(as(BUYER))
      .expect(200);

    expect(res.body.data.status).toBe('captured');
    expect(res.body.data.amountCaptured).toBe(15_000);
    expect(prisma.escrowPayment.update.mock.calls[0][0].data.status).toBe('CAPTURED');
  });

  // The seller is a party to the hold and still may not release it: confirming
  // that the service arrived is the buyer's call, not the person being paid.
  it('will not let the seller pay himself', async () => {
    await request(app).post(`/api/connect/escrow/${INTENT}/capture`).set(as(SELLER)).expect(404);
    expect(prisma.escrowPayment.update).not.toHaveBeenCalled();
  });

  it('gives a stranger the same 404 an unknown payment id gets, not a 403', async () => {
    const res = await request(app)
      .post(`/api/connect/escrow/${INTENT}/capture`)
      .set(as(STRANGER))
      .expect(404);

    expect(res.status).not.toBe(403);
    expect(prisma.escrowPayment.update).not.toHaveBeenCalled();
  });

  it('will not release a hold that has already been captured', async () => {
    holdInStatus('CAPTURED');
    await request(app).post(`/api/connect/escrow/${INTENT}/capture`).set(as(BUYER)).expect(400);
    expect(prisma.escrowPayment.update).not.toHaveBeenCalled();
  });

  it('404s an id that has no hold behind it', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(null);
    await request(app).post(`/api/connect/escrow/${INTENT}/capture`).set(as(BUYER)).expect(404);
  });
});

describe('Returning an escrow hold', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.escrowPayment.update.mockResolvedValue({ id: 'esc-1' });
    holdInStatus('AUTHORIZED');
  });

  it('lets the buyer cancel and get her money back', async () => {
    const res = await request(app)
      .post(`/api/connect/escrow/${INTENT}/cancel`)
      .set(as(BUYER))
      .send({ reason: 'Session never happened' })
      .expect(200);

    expect(res.body.data.status).toBe('canceled');
    expect(prisma.escrowPayment.update.mock.calls[0][0].data.cancelReason).toBe('Session never happened');
  });

  it('lets the seller cancel too, because returning the money is safe either way', async () => {
    await request(app).post(`/api/connect/escrow/${INTENT}/cancel`).set(as(SELLER)).expect(200);
    expect(prisma.escrowPayment.update.mock.calls[0][0].data.status).toBe('CANCELED');
  });

  it('will not let a stranger cancel two other people’s payment', async () => {
    await request(app).post(`/api/connect/escrow/${INTENT}/cancel`).set(as(STRANGER)).expect(404);
    expect(prisma.escrowPayment.update).not.toHaveBeenCalled();
  });

  it('will not cancel a hold that was already returned', async () => {
    holdInStatus('REFUNDED');
    await request(app).post(`/api/connect/escrow/${INTENT}/cancel`).set(as(BUYER)).expect(400);
    expect(prisma.escrowPayment.update).not.toHaveBeenCalled();
  });
});

describe('Opening an escrow hold', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses a hold with no recipient or no amount rather than creating a half one', async () => {
    for (const body of [{ amount: 15_000 }, { recipientId: SELLER }, {}]) {
      await request(app).post('/api/connect/escrow').set(as(BUYER)).send(body).expect(400);
    }
    expect(prisma.escrowPayment.create).not.toHaveBeenCalled();
  });

  // A seller Stripe has not finished verifying cannot be paid out, so taking
  // the buyer's money against him would strand it in a hold nobody can release.
  it('refuses to take money for a seller whose payment account is not verified', async () => {
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: 'acct_seller',
      stripeConnectStatus: 'PENDING',
      mentorProfile: null,
      creatorProfile: null,
    });

    await request(app)
      .post('/api/connect/escrow')
      .set(as(BUYER))
      .send({ recipientId: SELLER, amount: 15_000 })
      .expect(400);

    expect(prisma.escrowPayment.create).not.toHaveBeenCalled();
  });
});
