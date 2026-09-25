import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The two money prefixes that were mounted and had no test of any kind.
 *
 * `/api/payments` and `/api/money` were both in the list of API prefixes that
 * 199 test files never mention. That mattered more here than it would on a
 * read-only surface, because two of the guards on these routes were put in
 * *after* the behaviour they replace had already been wrong in production:
 *
 *   - `POST /api/payments/payout` used to hand `amount` straight to a Stripe
 *     transfer after checking only that it was truthy — not that it was a
 *     number, not that it was positive, and not that the creator had earned it.
 *     `processCreatorPayout` now refuses every call: payouts are made against a
 *     recorded balance from the Creator tools, and this route cannot name an
 *     arbitrary figure. Nothing was holding that refusal in place.
 *
 *   - `POST /api/payments/convert` used to read `FX_RATES[pair] || 1`, so every
 *     pair outside the twelve-entry table quoted at parity: A$100 to pesos came
 *     back as 99. It now throws 422 for a pair it holds no rate for.
 *
 * Both are one deleted line away from returning, and a test is the only thing
 * that would say so. The `/api/money` half covers ownership: MoneyTransaction
 * rows are a member's own book, and the update and delete paths authorise
 * against the row rather than against the session.
 */

jest.mock('../src/utils/prisma', () => ({
  prisma: {
    moneyTransaction: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

/**
 * Honours the header rather than signing everybody in, because two of the
 * assertions below are about who the caller is: an anonymous request has to be
 * refused, and a member on the default role has to be refused the payout route
 * that `requireRole('CREATOR')` guards. `requireRole` itself is deliberately
 * left real.
 */
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

/**
 * `server/.env` carries a real STRIPE_SECRET_KEY and `src/index` calls
 * `dotenv.config()` on import, so without this the suite would decide it was
 * configured and try to reach Stripe. The point of the payout assertion is that
 * the refusal happens before anything reaches a payment provider at all, so
 * `getStripe` is a spy that fails the test if it is ever asked for.
 */
jest.mock('../src/utils/stripe', () => {
  const actual: any = jest.requireActual('../src/utils/stripe');
  return {
    ...actual,
    isStripeConfigured: () => false,
    getStripe: jest.fn(() => {
      throw new Error('getStripe() was called on a path that must never reach a payment provider');
    }),
  };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { prisma as prismaTyped } from '../src/utils/prisma';
import { getStripe } from '../src/utils/stripe';

const prisma: any = prismaTyped;
const stripeFactory: any = getStripe;

const ADA = 'ada';
const GRACE = 'grace';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

const validPayout = {
  amount: 25_000,
  currency: 'AUD',
  destinationType: 'bank',
  destinationId: 'ba_1',
};

describe('POST /api/payments/payout does not pay an arbitrary amount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses an anonymous caller', async () => {
    await request(app).post('/api/payments/payout').send(validPayout).expect(401);
  });

  it('refuses a member who is not a creator', async () => {
    const res = await request(app)
      .post('/api/payments/payout')
      .set(as(ADA))
      .send(validPayout)
      .expect(403);

    expect(res.body.required).toEqual(['CREATOR']);
  });

  // The one that matters. A creator, a well-formed body, every field the route
  // asks for present and of the right type — and it still does not move money,
  // because this route has no idea what she has earned.
  it('refuses a creator sending a perfectly well-formed payout, and names the real path', async () => {
    const res = await request(app)
      .post('/api/payments/payout')
      .set(as(GRACE, 'CREATOR'))
      .send(validPayout)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/earned balance/i);
    expect(stripeFactory).not.toHaveBeenCalled();
  });

  it('rejects a currency the platform cannot price in', async () => {
    const res = await request(app)
      .post('/api/payments/payout')
      .set(as(GRACE, 'CREATOR'))
      .send({ ...validPayout, currency: 'XXX' })
      .expect(400);

    expect(res.body.error).toMatch(/Unsupported currency/);
  });

  it('rejects a destination type that is not one of the three that exist', async () => {
    const res = await request(app)
      .post('/api/payments/payout')
      .set(as(GRACE, 'CREATOR'))
      .send({ ...validPayout, destinationType: 'carrier_pigeon' })
      .expect(400);

    expect(res.body.error).toMatch(/Invalid destinationType/);
  });
});

describe('POST /api/payments/convert quotes a rate or says it cannot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('quotes a pair it holds a rate for, and says how old the rate is', async () => {
    const res = await request(app)
      .post('/api/payments/convert')
      .set(as(ADA))
      .send({ amount: 100, from: 'AUD', to: 'USD' })
      .expect(200);

    expect(res.body.rate).toBeGreaterThan(0);
    expect(res.body.rateAsAt).toEqual(expect.any(String));
    // 1% fee off the top, then the rate. Asserting the arithmetic rather than
    // just the shape, because the bug this replaces returned a plausible-looking
    // number too.
    expect(res.body.amount).toBeCloseTo(99 * res.body.rate, 2);
  });

  // AUD to PHP is an advertised pair — PHP is in SUPPORTED_CURRENCIES — with no
  // entry in the rate table. It used to come back as 99 pesos for A$100.
  it('refuses a pair it has no rate for instead of quoting it at parity', async () => {
    const res = await request(app)
      .post('/api/payments/convert')
      .set(as(ADA))
      .send({ amount: 100, from: 'AUD', to: 'PHP' })
      .expect(422);

    const body = res.body.message || res.body.error;
    expect(body).toMatch(/no exchange rate/i);
  });

  it('lists the pairs it can quote, so a caller can ask before it offers', async () => {
    const res = await request(app).get('/api/payments/currencies').expect(200);

    expect(res.body.currencies).toContain('PHP');
    expect(res.body.conversions).toContain('AUD_USD');
    expect(res.body.conversions).not.toContain('AUD_PHP');
  });
});

describe('/api/money transactions belong to the member who wrote them', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.moneyTransaction.findMany.mockResolvedValue([]);
  });

  it('scopes the list to the caller even when she names an organisation', async () => {
    const org = '11111111-1111-4111-8111-111111111111';
    await request(app).get(`/api/money/transactions?organizationId=${org}`).set(as(ADA)).expect(200);

    const where = prisma.moneyTransaction.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(ADA);
    expect(where.organizationId).toBe(org);
  });

  it('writes the row against the session, not against a userId in the body', async () => {
    prisma.moneyTransaction.create.mockResolvedValue({ id: 'tx-1' });

    await request(app)
      .post('/api/money/transactions')
      .set(as(ADA))
      .send({ amount: 42.5, type: 'PAYMENT', userId: GRACE })
      .expect(201);

    const data = prisma.moneyTransaction.create.mock.calls[0][0].data;
    expect(data.userId).toBe(ADA);
    // AUD, not USD: this is a Queensland platform and a figure a member types
    // in here is in her own currency.
    expect(data.currency).toBe('AUD');
  });

  it('will not record a zero or negative amount', async () => {
    for (const amount of [0, -1]) {
      await request(app)
        .post('/api/money/transactions')
        .set(as(ADA))
        .send({ amount, type: 'PAYMENT' })
        .expect(400);
    }
    expect(prisma.moneyTransaction.create).not.toHaveBeenCalled();
  });

  it('will not let one member edit another member’s row', async () => {
    prisma.moneyTransaction.findUnique.mockResolvedValue({ id: 'tx-1', userId: GRACE });

    await request(app)
      .patch('/api/money/transactions/tx-1')
      .set(as(ADA))
      .send({ status: 'COMPLETED' })
      .expect(403);

    expect(prisma.moneyTransaction.update).not.toHaveBeenCalled();
  });

  it('will not let one member delete another member’s row', async () => {
    prisma.moneyTransaction.findUnique.mockResolvedValue({ id: 'tx-1', userId: GRACE });

    await request(app).delete('/api/money/transactions/tx-1').set(as(ADA)).expect(403);

    expect(prisma.moneyTransaction.delete).not.toHaveBeenCalled();
  });

  it('lets a member delete her own row', async () => {
    prisma.moneyTransaction.findUnique.mockResolvedValue({ id: 'tx-1', userId: ADA });
    prisma.moneyTransaction.delete.mockResolvedValue({ id: 'tx-1' });

    await request(app).delete('/api/money/transactions/tx-1').set(as(ADA)).expect(204);

    expect(prisma.moneyTransaction.delete).toHaveBeenCalledWith({ where: { id: 'tx-1' } });
  });
});
