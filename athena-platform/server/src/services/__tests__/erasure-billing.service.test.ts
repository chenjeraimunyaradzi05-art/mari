/**
 * Erasing an account must end what Stripe is billing for it first.
 *
 * Both deletion paths used to leave the membership running: the self-serve one
 * deleted the local row and lost the Stripe id with it, the register-driven one
 * kept the row and never told Stripe anything. Either way the card went on being
 * charged for an account nobody could open. These hold the order (billing ends
 * before anything is written), the refusal (billing that could not be ended
 * stops the erasure with a 409), and the flag raised for staff when a payout
 * account that may hold money is about to be unlinked.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    subscription: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

const cancelMembership = jest.fn<(id: string, mode: string) => Promise<unknown>>();
jest.mock('../membership-admin.service', () => ({
  cancelMembershipAtStripe: (id: string, mode: string) => cancelMembership(id, mode),
}));

const stripeConfigured = jest.fn(() => true);
const balanceRetrieve = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: () => stripeConfigured(),
  getStripe: () => ({ balance: { retrieve: balanceRetrieve } }),
}));

const notifyAdmins = jest.fn<(notice: any) => Promise<number>>(async () => 1);
jest.mock('../admin-notify.service', () => ({ notifyAdmins: (notice: any) => notifyAdmins(notice) }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { endBillingBeforeErasure, BILLING_NOT_ENDED_MESSAGE } from '../erasure-billing.service';
import { ApiError } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
  stripeConfigured.mockReturnValue(true);
  prisma.subscription.findUnique.mockResolvedValue(null);
  prisma.user.findUnique.mockResolvedValue({ stripeConnectAccountId: null });
  cancelMembership.mockResolvedValue({});
  balanceRetrieve.mockResolvedValue({ available: [], pending: [] });
});

describe('the membership', () => {
  it('is ended at Stripe straight away, not at the end of the period she has paid for', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status: 'ACTIVE' });

    const result = await endBillingBeforeErasure('her');

    expect(cancelMembership).toHaveBeenCalledTimes(1);
    expect(cancelMembership).toHaveBeenCalledWith('sub-row-1', 'now');
    expect(result.subscriptionCancelled).toBe(true);
  });

  it('is ended for a trial and a past-due membership as well, which are still billed', async () => {
    for (const status of ['TRIALING', 'PAST_DUE']) {
      cancelMembership.mockClear();
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status });
      await endBillingBeforeErasure('her');
      expect(cancelMembership).toHaveBeenCalledTimes(1);
    }
  });

  it('asks Stripe nothing of a free member with no subscription', async () => {
    const result = await endBillingBeforeErasure('her');

    expect(cancelMembership).not.toHaveBeenCalled();
    expect(result).toEqual({ subscriptionCancelled: false, payoutBalanceFlagged: false });
  });

  it('asks Stripe nothing of a row that names no subscription, or one that has already ended', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-row-1', stripeSubscriptionId: null, status: 'ACTIVE' });
    await endBillingBeforeErasure('her');
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status: 'CANCELED' });
    await endBillingBeforeErasure('her');

    expect(cancelMembership).not.toHaveBeenCalled();
  });

  it('refuses the erasure with a 409 when billing could not be ended, so she is never left erased and still billed', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status: 'ACTIVE' });
    cancelMembership.mockRejectedValue(new ApiError(502, 'Stripe would not cancel this membership'));

    const failure = await endBillingBeforeErasure('her').catch((error) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.statusCode).toBe(409);
    expect(failure.message).toBe(BILLING_NOT_ENDED_MESSAGE);
    // Said plainly: nothing has been deleted.
    expect(BILLING_NOT_ENDED_MESSAGE).toMatch(/has not been deleted/);
  });

  it('refuses the same way when the cancel throws something that is not an ApiError at all', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status: 'ACTIVE' });
    cancelMembership.mockRejectedValue(new Error('socket hang up'));

    await expect(endBillingBeforeErasure('her')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not look at her payout account once billing could not be ended', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status: 'ACTIVE' });
    prisma.user.findUnique.mockResolvedValue({ stripeConnectAccountId: 'acct_1' });
    cancelMembership.mockRejectedValue(new Error('down'));

    await expect(endBillingBeforeErasure('her')).rejects.toBeInstanceOf(ApiError);

    expect(balanceRetrieve).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });
});

describe('a payout account', () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ stripeConnectAccountId: 'acct_her' });
  });

  it('that holds money is flagged to staff, with the id, before the link to it is erased', async () => {
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 12_500, currency: 'aud' }], pending: [] });

    const result = await endBillingBeforeErasure('her');

    expect(balanceRetrieve).toHaveBeenCalledWith({ stripeAccount: 'acct_her' });
    expect(result.payoutBalanceFlagged).toBe(true);
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    const notice = notifyAdmins.mock.calls[0][0];
    expect(notice.message).toContain('acct_her');
    expect(notice.message).toMatch(/still held money/);
    expect(notice.data).toMatchObject({ stripeConnectAccountId: 'acct_her', balance: 'money' });
    // The notice says which Stripe account, never who: nothing here is the member's name or address.
    expect(JSON.stringify(notice)).not.toMatch(/her@|@example/);
  });

  it('with money only pending, or owing, is flagged as well: anything other than zero', async () => {
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 0, currency: 'aud' }], pending: [{ amount: -300, currency: 'aud' }] });

    const result = await endBillingBeforeErasure('her');

    expect(result.payoutBalanceFlagged).toBe(true);
  });

  it('that is empty raises nothing', async () => {
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 0, currency: 'aud' }], pending: [] });

    const result = await endBillingBeforeErasure('her');

    expect(result.payoutBalanceFlagged).toBe(false);
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('whose balance Stripe will not say is flagged as unchecked rather than assumed empty', async () => {
    balanceRetrieve.mockRejectedValue(new Error('Stripe is down'));

    const result = await endBillingBeforeErasure('her');

    expect(result.payoutBalanceFlagged).toBe(true);
    expect(notifyAdmins.mock.calls[0][0].message).toMatch(/could not be checked/);
  });

  it('on a deployment with no Stripe key is flagged as unchecked too, because the id is still about to go', async () => {
    stripeConfigured.mockReturnValue(false);

    const result = await endBillingBeforeErasure('her');

    expect(balanceRetrieve).not.toHaveBeenCalled();
    expect(result.payoutBalanceFlagged).toBe(true);
  });

  it('is left alone when the account is only suspended and the link to it stays: staff are not told it was removed', async () => {
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 12_500, currency: 'aud' }], pending: [] });

    const result = await endBillingBeforeErasure('her', { unlinksPayoutAccount: false });

    expect(balanceRetrieve).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
    expect(result.payoutBalanceFlagged).toBe(false);
  });

  it('still has the membership ended when only suspended, since the subscription row is kept and keeps billing', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status: 'ACTIVE' });

    const result = await endBillingBeforeErasure('her', { unlinksPayoutAccount: false });

    expect(cancelMembership).toHaveBeenCalledWith('sub-row-1', 'now');
    expect(result.subscriptionCancelled).toBe(true);
  });

  it('never holds up the erasure: a flag that cannot be raised is not a refusal', async () => {
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 100, currency: 'aud' }], pending: [] });
    notifyAdmins.mockResolvedValue(0);

    await expect(endBillingBeforeErasure('her')).resolves.toMatchObject({ payoutBalanceFlagged: true });
  });
});
