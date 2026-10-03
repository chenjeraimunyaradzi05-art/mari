/**
 * What has to stop, at Stripe, before an account is erased.
 *
 * Erasing an account left the membership running. The member's own "delete my
 * account" deleted the local Subscription row and lost the Stripe id with it;
 * the register-driven erasure kept the row (it is billing history, held seven
 * years) but never told Stripe anything. Either way Stripe went on charging a
 * card, every month, for an account nobody could sign in to, and the member
 * who found out had to chase it with her bank.
 *
 * This runs inside the shared erasure (gdpr.service.ts: eraseUser), ahead of
 * anything being written, so a deletion from the app, a data-rights request and
 * a staff erasure all end the billing the same way:
 *
 *   1. The subscription is cancelled at once, not at the end of the period. She
 *      has asked to leave; a cancel-at-period-end would bill her one more time
 *      for a membership she can no longer open.
 *   2. If Stripe cannot be asked, nothing is erased and the member is told so
 *      (409), so she is never left deleted and still billed. She can try again.
 *      The request that was refused stays in the staff queue as waiting, with
 *      the reason on it, and nothing carries it out on its own: the sweep that
 *      would (gdprService.processDueDeletionRequests) is not scheduled, which is
 *      also why a member who gave up is not erased weeks later without asking
 *      again. Staff can see it and use the administrator erasure.
 *   3. A payout account that still holds money is not dropped in silence. The
 *      erasure clears the account id off her row, and with it the only way to
 *      find the money, so staff are told, with the id, before it goes.
 */

import { prisma } from '../utils/prisma';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { notifyAdmins } from './admin-notify.service';
import { cancelMembershipAtStripe } from './membership-admin.service';

export const BILLING_NOT_ENDED_MESSAGE =
  'We could not end your membership billing just now, so your account has not been deleted and nothing has changed. Please try again in a few minutes, or contact support if it keeps happening.';

export type BillingEnd = {
  /** A subscription was live at Stripe and has been cancelled by this call. */
  subscriptionCancelled: boolean;
  /** A payout account held, or may hold, money, and staff have been told. */
  payoutBalanceFlagged: boolean;
};

/**
 * Tells staff that a payout account was about to be unlinked while it held
 * money, or while that could not be checked. Never throws: the member's right
 * to erasure is not held hostage to a balance check, but it is not carried out
 * quietly either.
 */
async function flagPayoutAccount(userId: string, accountId: string): Promise<boolean> {
  let held: 'money' | 'unknown' | 'none' = 'unknown';

  if (isStripeConfigured()) {
    try {
      const balance = await getStripe().balance.retrieve({ stripeAccount: accountId });
      const nonZero = [...(balance.available ?? []), ...(balance.pending ?? [])].some((entry) => entry.amount !== 0);
      held = nonZero ? 'money' : 'none';
    } catch (error) {
      logger.warn('Could not read a payout balance ahead of erasure', {
        userId,
        accountId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (held === 'none') return false;

  // The account id is a Stripe handle, not a fact about the member, and it is
  // exactly what staff need to find the money once her row no longer names it.
  logger.warn('A member with a payout account has been erased; staff must settle it', {
    userId,
    accountId,
    balance: held,
  });
  await notifyAdmins({
    title: 'A deleted account had a payout account to settle',
    message:
      held === 'money'
        ? `Stripe account ${accountId} still held money when its member's account was erased. The link to it has been removed from our records, so settle it in the Stripe dashboard.`
        : `Stripe account ${accountId} was unlinked when its member's account was erased, and its balance could not be checked. Look it up in the Stripe dashboard and settle anything it holds.`,
    link: '/admin',
    data: { stripeConnectAccountId: accountId, balance: held },
  });
  return true;
}

export type EndBillingOptions = {
  /**
   * Whether the caller is about to clear the link to her payout account, which is
   * what makes staff need to be told about money still sitting in it. An erasure
   * does. A staff soft delete only suspends the account and keeps the link, so
   * telling staff the link "has been removed" would be untrue, and the money is
   * still reachable from the row.
   */
  unlinksPayoutAccount?: boolean;
};

/**
 * Ends the billing and flags the payout account for a member about to be
 * erased. Throws ApiError(409) when billing could not be ended; everything the
 * caller has not yet written is then still intact.
 */
export async function endBillingBeforeErasure(userId: string, options: EndBillingOptions = {}): Promise<BillingEnd> {
  const { unlinksPayoutAccount = true } = options;
  const [subscription, account] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { id: true, stripeSubscriptionId: true, status: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { stripeConnectAccountId: true } }),
  ]);

  let subscriptionCancelled = false;
  if (subscription?.stripeSubscriptionId && subscription.status !== 'CANCELED') {
    try {
      // The same cancel staff use, ended now and not at the end of the period:
      // she has asked to leave, and a cancel-at-period-end would bill her once
      // more for a membership she can no longer open. It treats "already ended
      // at Stripe" as done, so a retry of an erasure that failed further on is
      // not refused here instead, and it writes the ended state to her row.
      await cancelMembershipAtStripe(subscription.id, 'now');
      subscriptionCancelled = true;
    } catch (error) {
      // Whatever the reason (Stripe down, no key on this deployment, a refusal),
      // she is never left erased and still billed: nothing has been written.
      logger.error('Could not end a membership ahead of erasure', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ApiError(409, BILLING_NOT_ENDED_MESSAGE);
    }
  }

  const payoutBalanceFlagged =
    unlinksPayoutAccount && account?.stripeConnectAccountId
      ? await flagPayoutAccount(userId, account.stripeConnectAccountId)
      : false;

  return { subscriptionCancelled, payoutBalanceFlagged };
}
