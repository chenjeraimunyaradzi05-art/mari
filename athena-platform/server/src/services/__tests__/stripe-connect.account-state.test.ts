/**
 * What a connected account's state is, and which account is the member's.
 *
 * Three gaps in how Stripe's word about an account became the platform's:
 *
 * - A hold, an order and a car purchase are paid as destination charges, which
 *   send the seller's share as a transfer, and Stripe refuses a transfer to an
 *   account whose `transfers` capability is not active. The status that gates a
 *   hold looked only at payouts, so an account could be ACTIVE and still fail the
 *   capture after the buyer had paid.
 * - Stripe goes on sending account.updated for every account ever created with a
 *   member's id in its metadata, including a duplicate an older path minted, and
 *   applying one wrote the old account back over the one she is paid through.
 * - Whether a new account is created on a manual payout schedule, so that the
 *   Withdraw button and Stripe's automatic payouts do not compete for the same
 *   balance, has to be decided in test mode, so it is a setting.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(async () => ({})) },
    mentorProfile: { updateMany: jest.fn(async () => ({ count: 0 })) },
    creatorProfile: { updateMany: jest.fn(async () => ({ count: 0 })) },
    notification: { create: jest.fn(async () => ({})) },
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
import { applyAccountState, createConnectedAccount, syncConnectedAccountFromStripe } from '../stripe-connect.service';

const prisma: any = prismaTyped;
const env = process.env as Record<string, string | undefined>;

/** An account Stripe has fully verified, with every capability on. */
const account = (overrides: Record<string, unknown> = {}): any => ({
  id: 'acct_1',
  metadata: { userId: 'member-1' },
  details_submitted: true,
  charges_enabled: true,
  payouts_enabled: true,
  capabilities: { card_payments: 'active', transfers: 'active' },
  requirements: { currently_due: [] },
  ...overrides,
});

const statusWritten = () => prisma.user.update.mock.calls[0][0].data.stripeConnectStatus;
const monetisedWritten = () => prisma.mentorProfile.updateMany.mock.calls[0][0].data.isMonetized;

beforeEach(() => {
  jest.clearAllMocks();
  env.STRIPE_SECRET_KEY = 'sk_test_account_state';
  delete env.STRIPE_CONNECT_PAYOUT_SCHEDULE;
  prisma.user.findUnique.mockResolvedValue({ mentorProfile: null, creatorProfile: null });
});

describe('an account’s status needs the transfers capability', () => {
  it('is ACTIVE and monetised only when it can take charges, pay out and receive transfers', async () => {
    await applyAccountState('member-1', account());

    expect(statusWritten()).toBe('ACTIVE');
    expect(monetisedWritten()).toBe(true);
  });

  it.each([
    ['still being switched on', { transfers: 'pending' }],
    ['switched off', { transfers: 'inactive' }],
    ['never requested', {}],
  ])('is RESTRICTED, not ACTIVE, when the transfers capability is %s, though it can pay out', async (_label, capabilities) => {
    // Verified and able to pay out, and still a hold made for her would fail at the
    // capture, after the buyer had paid.
    await applyAccountState('member-1', account({ capabilities }));

    expect(statusWritten()).toBe('RESTRICTED');
    expect(monetisedWritten()).toBe(false);
  });

  it('is RESTRICTED when payouts are off, whatever the capability', async () => {
    await applyAccountState('member-1', account({ payouts_enabled: false }));

    expect(statusWritten()).toBe('RESTRICTED');
  });

  it('stays PENDING until the member has submitted her details', async () => {
    await applyAccountState('member-1', account({ details_submitted: false, payouts_enabled: false, capabilities: {} }));

    expect(statusWritten()).toBe('PENDING');
    expect(monetisedWritten()).toBe(false);
  });
});

describe('creating an account: the payout schedule', () => {
  const create = () => createConnectedAccount({ userId: 'member-7', email: 'ana@example.com', country: 'AU', type: 'mentor' });

  beforeEach(() => {
    // No account anywhere yet.
    prisma.user.findUnique.mockResolvedValue({ stripeConnectAccountId: null, mentorProfile: null, creatorProfile: null });
  });

  it('leaves Stripe’s own schedule alone when nothing is set', async () => {
    await create();

    expect(stripe.accounts.create.mock.calls[0][0]).not.toHaveProperty('settings');
  });

  it('creates the account on a manual schedule when asked to, so a balance waits until she withdraws it', async () => {
    env.STRIPE_CONNECT_PAYOUT_SCHEDULE = 'manual';

    await create();

    expect(stripe.accounts.create.mock.calls[0][0]).toMatchObject({
      type: 'express',
      country: 'AU',
      settings: { payouts: { schedule: { interval: 'manual' } } },
    });
  });

  it('reads the setting without regard to case or stray spaces, as it is typed into a dashboard', async () => {
    env.STRIPE_CONNECT_PAYOUT_SCHEDULE = '  Manual ';

    await create();

    expect(stripe.accounts.create.mock.calls[0][0].settings).toEqual({ payouts: { schedule: { interval: 'manual' } } });
  });

  it.each(['automatic', 'weekly', 'anything else'])('sends nothing for %p: only a manual schedule is a choice made here', async (value) => {
    env.STRIPE_CONNECT_PAYOUT_SCHEDULE = value;

    await create();

    expect(stripe.accounts.create.mock.calls[0][0]).not.toHaveProperty('settings');
  });
});

describe('account.updated for an account the member is no longer paid through', () => {
  it('is not applied, so her identity is not pointed back at an account she has moved off', async () => {
    // She is paid through acct_current; Stripe reports on acct_old, an older
    // duplicate with her id in its metadata.
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      stripeConnectStatus: 'ACTIVE',
      stripeConnectAccountId: 'acct_current',
    });

    const matched = await syncConnectedAccountFromStripe(account({ id: 'acct_old', payouts_enabled: false }));

    expect(matched).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.mentorProfile.updateMany).not.toHaveBeenCalled();
    // And she is not told that payouts to her account have stopped: they have not.
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('is applied when it is for the account she is paid through', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      stripeConnectStatus: 'PENDING',
      stripeConnectAccountId: 'acct_1',
    });

    expect(await syncConnectedAccountFromStripe(account({ id: 'acct_1' }))).toBe(true);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { stripeConnectAccountId: 'acct_1', stripeConnectStatus: 'ACTIVE' },
    });
  });

  it('is applied when she has no account recorded yet, which is the first event for the one just created', async () => {
    // The webhook can arrive before the row that records the account has been written.
    prisma.user.findUnique.mockResolvedValue({ id: 'member-1', stripeConnectStatus: null, stripeConnectAccountId: null });

    expect(await syncConnectedAccountFromStripe(account({ id: 'acct_new' }))).toBe(true);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('finds an account by its own id when its metadata names no member', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'member-9',
      stripeConnectStatus: 'ACTIVE',
      stripeConnectAccountId: 'acct_legacy',
    });

    expect(await syncConnectedAccountFromStripe(account({ id: 'acct_legacy', metadata: {} }))).toBe(true);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeConnectAccountId: 'acct_legacy' } })
    );
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });
});
