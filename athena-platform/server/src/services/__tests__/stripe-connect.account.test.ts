/**
 * Creating a member's Stripe Connect account.
 *
 * One member, one account. The lookup that stops a second account being made
 * reads a column that is only written after Stripe has answered, so two requests
 * that arrive together (a double tap on "enable payouts", or the mentor and
 * creator switches pressed in the same breath) both get past it. The key Stripe
 * is sent is derived from the member, so the second request is handed the account
 * the first created and not a second one with a balance of its own.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    mentorProfile: { updateMany: jest.fn(async () => ({ count: 0 })) },
    creatorProfile: { updateMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(async (operations: unknown) => operations),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

const stripe = {
  accounts: {
    create: jest.fn(async (_params: any, _options?: any): Promise<any> => ({
      id: 'acct_new',
      details_submitted: false,
      charges_enabled: false,
      payouts_enabled: false,
    })),
  },
  accountLinks: { create: jest.fn(async (): Promise<any> => ({ url: 'https://connect.stripe.com/setup/e/acct_new' })) },
};

jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => stripe,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { createConnectedAccount } from '../stripe-connect.service';

const prisma: any = prismaTyped;

describe('createConnectedAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_connect_account';
    // No account anywhere yet: the first lookup finds nothing to adopt.
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: null,
      mentorProfile: null,
      creatorProfile: null,
    });
  });

  it('asks Stripe for the member\'s account with a key derived from the member', async () => {
    const result = await createConnectedAccount({
      userId: 'member-7',
      email: 'ada@example.com',
      country: 'AU',
      type: 'mentor',
    });

    expect(result.accountId).toBe('acct_new');
    expect(stripe.accounts.create).toHaveBeenCalledTimes(1);
    const [params, options] = stripe.accounts.create.mock.calls[0] as any[];
    expect(options).toEqual({ idempotencyKey: 'connect-account-member-7' });
    expect(params).toMatchObject({ type: 'express', country: 'AU', metadata: { userId: 'member-7', accountType: 'mentor' } });
  });

  it('uses the same key whichever way she came in, so mentor and creator share one account', async () => {
    await createConnectedAccount({ userId: 'member-7', email: 'ada@example.com', country: 'AU', type: 'mentor' });
    await createConnectedAccount({ userId: 'member-7', email: 'ada@example.com', country: 'AU', type: 'creator' });

    const keys = (stripe.accounts.create.mock.calls as any[]).map((call) => call[1].idempotencyKey);
    expect(keys).toEqual(['connect-account-member-7', 'connect-account-member-7']);
  });

  it('gives two different members two different keys', async () => {
    await createConnectedAccount({ userId: 'member-1', email: 'a@example.com', country: 'AU', type: 'mentor' });
    await createConnectedAccount({ userId: 'member-2', email: 'b@example.com', country: 'AU', type: 'mentor' });

    const keys = (stripe.accounts.create.mock.calls as any[]).map((call) => call[1].idempotencyKey);
    expect(new Set(keys).size).toBe(2);
  });
});
