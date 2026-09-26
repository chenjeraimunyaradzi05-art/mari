/**
 * The mentor and creator withdrawal path, POST /api/connect/payout, and the
 * payout-method routes beside it. None of them had a test, and the gap was not
 * theoretical: the Withdraw button sent dollars, the route validated dollars,
 * and createPayout handed that number to Stripe as cents. A A$150 withdrawal
 * became a A$1.50 payout under a toast that said the money was on its way, and
 * "Withdraw all" on A$123.45 sent Stripe a fraction it refused, which reached
 * the member as a 500.
 *
 * What is asserted here is the number that actually leaves: what
 * stripe.payouts.create is called with, for what the member typed.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
  },
}));

let currentUser = { id: 'mentor-1', role: 'USER', email: 'ana@example.com', twoFactorEnabled: false };
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
  };
});

const stripeClient = {
  payouts: {
    create: jest.fn(async (params: any): Promise<any> => ({
      id: 'po_1',
      status: 'pending',
      amount: params.amount,
      currency: params.currency,
    })),
  },
  accounts: {
    listExternalAccounts: jest.fn(async (): Promise<any> => ({ data: [] })),
    updateExternalAccount: jest.fn(async (): Promise<any> => ({})),
  },
};
jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => stripeClient,
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

function memberHasAccount(accountId: string | null = 'acct_ana') {
  prisma.user.findUnique.mockResolvedValue({
    stripeConnectAccountId: accountId,
    mentorProfile: null,
    creatorProfile: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = { id: 'mentor-1', role: 'USER', email: 'ana@example.com', twoFactorEnabled: false };
  memberHasAccount();
});

describe('POST /api/connect/payout', () => {
  it('sends Stripe cents for the dollars the member typed', async () => {
    const res = await request(app).post('/api/connect/payout').send({ amount: 150 }).expect(200);

    expect(stripeClient.payouts.create).toHaveBeenCalledTimes(1);
    const [params, options] = stripeClient.payouts.create.mock.calls[0] as any[];
    expect(params.amount).toBe(15000);
    expect(params.currency).toBe('aud');
    expect(options.stripeAccount).toBe('acct_ana');
    expect(res.body.data.amount).toBe(15000);
  });

  it('pays out a balance with cents in it as a whole number of cents', async () => {
    // "Withdraw all" on A$123.45. The float product is 12345.000000000002,
    // which Stripe refuses; the integer is what has to reach it.
    await request(app).post('/api/connect/payout').send({ amount: '123.45' }).expect(200);

    const [params] = stripeClient.payouts.create.mock.calls[0] as any[];
    expect(params.amount).toBe(12345);
    expect(Number.isInteger(params.amount)).toBe(true);
  });

  it('keeps the currency the member asked for, in the form Stripe expects', async () => {
    await request(app).post('/api/connect/payout').send({ amount: 40, currency: 'NZD' }).expect(200);

    const [params] = stripeClient.payouts.create.mock.calls[0] as any[];
    expect(params).toMatchObject({ amount: 4000, currency: 'nzd' });
  });

  it('does not multiply a zero-decimal currency by a hundred', async () => {
    await request(app).post('/api/connect/payout').send({ amount: 1500, currency: 'jpy' }).expect(200);

    const [params] = stripeClient.payouts.create.mock.calls[0] as any[];
    expect(params.amount).toBe(1500);
  });

  it('refuses a fractional amount in a currency that has no cents, without calling Stripe', async () => {
    await request(app).post('/api/connect/payout').send({ amount: 1500.5, currency: 'jpy' }).expect(400);
    expect(stripeClient.payouts.create).not.toHaveBeenCalled();
  });

  it.each([['-50'], ['abc'], [0], ['1e9']])('refuses %p without calling Stripe', async (amount) => {
    await request(app).post('/api/connect/payout').send({ amount }).expect(400);
    expect(stripeClient.payouts.create).not.toHaveBeenCalled();
  });

  it('pays into the account on her own session, never one named in the body', async () => {
    await request(app)
      .post('/api/connect/payout')
      .send({ amount: 10, connectedAccountId: 'acct_someone_else' })
      .expect(200);

    const [, options] = stripeClient.payouts.create.mock.calls[0] as any[];
    expect(options.stripeAccount).toBe('acct_ana');
  });

  it('refuses a member with no payout account, without calling Stripe', async () => {
    memberHasAccount(null);

    await request(app).post('/api/connect/payout').send({ amount: 10 }).expect(409);
    expect(stripeClient.payouts.create).not.toHaveBeenCalled();
  });

  it('keys the payout so a double-tap cannot send the money twice', async () => {
    await request(app).post('/api/connect/payout').send({ amount: 25 }).expect(200);
    await request(app).post('/api/connect/payout').send({ amount: 25 }).expect(200);

    const keys = stripeClient.payouts.create.mock.calls.map((call: any[]) => call[1].idempotencyKey);
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
  });

  it('tells a member who asked for more than she holds, as a 400 rather than a failure', async () => {
    stripeClient.payouts.create.mockRejectedValueOnce(
      Object.assign(new Error('Insufficient funds'), { code: 'balance_insufficient' })
    );

    const res = await request(app).post('/api/connect/payout').send({ amount: 500 }).expect(400);
    expect(JSON.stringify(res.body)).toMatch(/balance is less than that amount/i);
  });
});

describe('payout methods', () => {
  it('lists the destinations on her own connected account', async () => {
    stripeClient.accounts.listExternalAccounts.mockResolvedValueOnce({
      data: [
        {
          id: 'ba_1',
          object: 'bank_account',
          bank_name: 'Bank of Queensland',
          last4: '6789',
          currency: 'aud',
          default_for_currency: true,
        },
      ],
    });

    const res = await request(app).get('/api/connect/payout-methods').expect(200);

    expect(stripeClient.accounts.listExternalAccounts.mock.calls[0]).toEqual(['acct_ana', { limit: 100 }]);
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: 'ba_1', type: 'bank', last4: '6789', isDefault: true }),
    ]);
  });

  it('will not make somebody else\'s bank account her default', async () => {
    stripeClient.accounts.listExternalAccounts.mockResolvedValueOnce({ data: [] });

    await request(app).post('/api/connect/payout-methods/ba_not_hers/default').expect(404);
    expect(stripeClient.accounts.updateExternalAccount).not.toHaveBeenCalled();
  });
});
