/**
 * A deployment with no Stripe key must not tell anyone she can be paid.
 *
 * refreshConnectedAccount tested only whether a key existed, and wrote the stored
 * account ACTIVE and monetised when it did not, with no look at the environment
 * the way every other mock path in the service makes (canUseMockStripe). A
 * production deployment that booted without its key, or had it revoked, therefore
 * flipped every connected account it touched to "verified and able to be paid",
 * and the booking, order and withdrawal gates all believed it. In production it
 * now refuses with a 503, like the rest; a developer's machine, which has nothing
 * to verify against, keeps the local flow.
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

let keyIsSet = true;
const stripe = {
  accounts: {
    retrieve: jest.fn(async (id: string): Promise<any> => ({
      id,
      details_submitted: false,
      charges_enabled: false,
      payouts_enabled: false,
    })),
  },
  accountLinks: { create: jest.fn(async (): Promise<any> => ({ url: 'https://connect.stripe.com/setup/e/acct_1' })) },
};
jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => keyIsSet,
  getStripe: () => stripe,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { createConnectedAccount, refreshConnectedAccount, resolveConnectedAccountId } from '../stripe-connect.service';

const prisma: any = prismaTyped;
const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;

beforeEach(() => {
  jest.clearAllMocks();
  keyIsSet = true;
  env.NODE_ENV = 'production';
});

afterAll(() => {
  env.NODE_ENV = originalNodeEnv;
});

describe('refreshConnectedAccount without a Stripe key', () => {
  it('refuses with a 503 in production, and writes nothing about the account', async () => {
    keyIsSet = false;

    await expect(refreshConnectedAccount('member-1', 'acct_1')).rejects.toMatchObject({ statusCode: 503 });

    // Nothing was said about the account either way: not ACTIVE, not monetised.
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.mentorProfile.updateMany).not.toHaveBeenCalled();
    expect(prisma.creatorProfile.updateMany).not.toHaveBeenCalled();
    expect(stripe.accounts.retrieve).not.toHaveBeenCalled();
  });

  it('says what is missing, so whoever reads the log knows which variable to set', async () => {
    keyIsSet = false;

    await expect(refreshConnectedAccount('member-1', 'acct_1')).rejects.toMatchObject({
      message: expect.stringContaining('STRIPE_SECRET_KEY'),
    });
  });

  it('writes what Stripe says when there is a key: an account that has submitted nothing is PENDING, not ACTIVE', async () => {
    await refreshConnectedAccount('member-1', 'acct_1');

    expect(stripe.accounts.retrieve).toHaveBeenCalledWith('acct_1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { stripeConnectAccountId: 'acct_1', stripeConnectStatus: 'PENDING' },
    });
    expect(prisma.mentorProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'member-1' },
      data: { stripeAccountId: 'acct_1', isMonetized: false },
    });
  });

  it('still lets a developer’s machine with no key run the local flow, where there is nothing to verify against', async () => {
    keyIsSet = false;
    env.NODE_ENV = 'development';

    await refreshConnectedAccount('member-1', 'acct_mock_member-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { stripeConnectAccountId: 'acct_mock_member-1', stripeConnectStatus: 'ACTIVE' },
    });
  });

  it('does the same under test, so suites that run without a key keep the local flow', async () => {
    keyIsSet = false;
    env.NODE_ENV = 'test';

    await refreshConnectedAccount('member-1', 'acct_mock_member-1');

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });
});

describe('what reaches refreshConnectedAccount', () => {
  it('refuses to hand a member with an account an onboarding link, in production without a key', async () => {
    keyIsSet = false;
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: 'acct_1',
      mentorProfile: null,
      creatorProfile: null,
    });

    await expect(
      createConnectedAccount({ userId: 'member-1', email: 'ana@example.com', country: 'AU', type: 'mentor' })
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('adopts a profile account without also declaring it verified, when there is no key to ask', async () => {
    keyIsSet = false;
    prisma.user.findUnique.mockResolvedValue({
      stripeConnectAccountId: null,
      mentorProfile: { stripeAccountId: 'acct_old' },
      creatorProfile: null,
    });

    expect(await resolveConnectedAccountId('member-1')).toBe('acct_old');

    // The id is adopted, and nothing more: no status was invented for it.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { stripeConnectAccountId: 'acct_old' },
    });
  });
});
