/**
 * Whether a membership row buys paid features today.
 *
 * Three places decided this for themselves (the plan gates in middleware/auth,
 * the one in middleware/subscription and the AI router's own), and each admitted
 * only ACTIVE and TRIALING. A card that Stripe could not charge on the renewal
 * date moves the subscription to PAST_DUE at once, so a member lost her tools the
 * minute a bank declined a payment, while the email we sent her said Stripe would
 * try again for days. This is the one rule, with a grace for exactly that case, so
 * the three gates and the page that tells her where she stands cannot disagree.
 *
 * Nothing here reads the database or Stripe: it is given the row, so it can be
 * called from a gate, a route or a test with no setup.
 */

import { PAST_DUE_GRACE_DAYS } from '../config/price-book';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SubscriptionStanding {
  tier: string;
  status: string;
  /**
   * When the period that is being paid for began. For a membership that went past
   * due on a renewal that is the renewal date, which is what the grace is counted
   * from. Absent on a row that has never been told, and then there is no grace.
   */
  currentPeriodStart?: Date | string | null;
}

/** The statuses that mean a subscription is still being billed, whether or not it is paid up. */
export const BILLING_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const;

/**
 * The day a past-due membership's grace ends, or null when it is not past due or
 * there is no period start to count from.
 */
export function pastDueGraceEndsAt(subscription: Pick<SubscriptionStanding, 'status' | 'currentPeriodStart'> | null | undefined): Date | null {
  if (!subscription || subscription.status !== 'PAST_DUE' || !subscription.currentPeriodStart) return null;
  const began = new Date(subscription.currentPeriodStart);
  if (Number.isNaN(began.getTime())) return null;
  return new Date(began.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS);
}

/**
 * Whether a subscription is live: paid up or trialling, or past due inside the
 * grace. Says nothing about the tier; see hasLiveEntitlement for a paid plan.
 */
export function isSubscriptionLive(
  subscription: Pick<SubscriptionStanding, 'status' | 'currentPeriodStart'>,
  now: Date = new Date()
): boolean {
  if (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') return true;
  const graceEndsAt = pastDueGraceEndsAt(subscription);
  return graceEndsAt !== null && now.getTime() < graceEndsAt.getTime();
}

/** A paid tier on a subscription that is live. A missing row is a free member. */
export function hasLiveEntitlement(subscription: SubscriptionStanding | null | undefined, now: Date = new Date()): boolean {
  return Boolean(subscription && subscription.tier !== 'FREE' && isSubscriptionLive(subscription, now));
}
