/**
 * What staff do to a member's paid membership, done at Stripe and not only on
 * ATHENA's own row.
 *
 * The admin screen used to edit the Subscription row and nothing else. Setting a
 * membership to CANCELED there left the Stripe subscription running: the next
 * customer.subscription.updated event overwrote the staff member's change, the
 * member went on being billed, and the reconciler reported the disagreement
 * (SUBSCRIPTION_STATUS_CONFLICT) without repairing it. The thirty-day refund the
 * pricing page and the Terms promise had no path at all: it was done by hand in
 * the Stripe dashboard, after which nothing here knew, so the member's tax
 * invoice still read paid.
 *
 * So both are done here, through Stripe first and the rows after. Neither is
 * done twice by pressing a button twice: a cancel is the same request each time,
 * and a refund carries a key derived from the invoice it refunds, so a second
 * press is the same refund, and Stripe's own refusal of one already made is read
 * as it having happened.
 */

import type Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getStripe, isStripeConfigured } from '../utils/stripe';

export type MembershipCancelMode = 'period_end' | 'now';

/** The columns the webhook writes when Stripe says a subscription has ended. */
const ENDED_MEMBERSHIP = {
  tier: 'FREE',
  status: 'CANCELED',
  stripeSubscriptionId: null,
  stripePriceId: null,
  cancelAtPeriodEnd: false,
  currentPeriodStart: null,
  currentPeriodEnd: null,
} as const;

const membershipSelect = {
  id: true,
  userId: true,
  tier: true,
  status: true,
  currency: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  cancelAtPeriodEnd: true,
  currentPeriodEnd: true,
} as const;

function needStripe(): void {
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Card payments are not configured on this deployment, so nothing can be changed at Stripe.');
  }
}

/** Stripe saying the thing we asked about is not there, or has already ended. */
function isGone(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === 'resource_missing' || (typeof message === 'string' && /canceled subscription/i.test(message));
}

function isAlreadyRefunded(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'charge_already_refunded';
}

async function loadMembership(id: string) {
  const row = await prisma.subscription.findUnique({ where: { id }, select: membershipSelect });
  if (!row) throw new ApiError(404, 'Subscription not found');
  return row;
}

export interface MembershipCancellation {
  subscriptionId: string;
  userId: string;
  mode: MembershipCancelMode;
  /** When the membership ends: the end of the paid period, or now. */
  endsAt: string | null;
  /** True when Stripe had no live subscription left, so only the row was brought into line. */
  alreadyEnded: boolean;
}

/**
 * Cancels a membership at Stripe, at the end of the period she has paid for or
 * straight away, and then writes what happened to the row.
 *
 * `period_end` is what the member's own cancel does and what the Terms (6.3)
 * promise. `now` ends it at once with no further charge and no proration; it is
 * for a membership staff are ending outright, such as after a refund. A
 * membership that is not billed through Stripe (one staff granted) has nothing
 * to cancel there, and is ended from the edit form.
 */
export async function cancelMembershipAtStripe(subscriptionId: string, mode: MembershipCancelMode): Promise<MembershipCancellation> {
  const row = await loadMembership(subscriptionId);

  if (!row.stripeSubscriptionId) {
    throw new ApiError(
      409,
      'This membership is not billed through Stripe, so there is nothing to cancel there. If staff granted it, end it with Edit.'
    );
  }
  needStripe();

  let endsAt: Date | null = null;
  let alreadyEnded = false;

  try {
    if (mode === 'period_end') {
      const updated: Stripe.Subscription = await getStripe().subscriptions.update(row.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      endsAt = typeof updated?.current_period_end === 'number' ? new Date(updated.current_period_end * 1000) : row.currentPeriodEnd;
    } else {
      // No final invoice and no credit for the unused time: ending it is not a
      // refund, which is its own action below.
      await getStripe().subscriptions.cancel(row.stripeSubscriptionId, { invoice_now: false, prorate: false });
      endsAt = new Date();
    }
  } catch (error) {
    if (!isGone(error)) {
      logger.error('Stripe would not cancel a membership', {
        subscriptionId,
        mode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ApiError(502, 'Stripe would not cancel this membership, so nothing was changed. Try again in a moment.');
    }
    // Nothing live left at Stripe, so the row is what is wrong: bring it into
    // line rather than leaving a membership that cannot be cancelled.
    logger.warn('A membership staff cancelled no longer exists at Stripe; bringing the row into line', { subscriptionId });
    alreadyEnded = true;
    endsAt = new Date();
  }

  if (mode === 'now' || alreadyEnded) {
    await prisma.subscription.update({ where: { id: row.id }, data: { ...ENDED_MEMBERSHIP } });
  } else {
    await prisma.subscription.update({
      where: { id: row.id },
      data: { cancelAtPeriodEnd: true, ...(endsAt ? { currentPeriodEnd: endsAt } : {}) },
    });
  }

  return {
    subscriptionId: row.id,
    userId: row.userId,
    mode,
    endsAt: endsAt ? endsAt.toISOString() : null,
    alreadyEnded,
  };
}

export interface MembershipRefund {
  subscriptionId: string;
  userId: string;
  status: 'refunded' | 'already_refunded';
  /** Dollars, in the invoice's currency. */
  amount: number;
  currency: string;
  stripeInvoiceId: string;
  refundId: string | null;
  /** The ATHENA tax invoice that was credited, when one was found. */
  invoiceNumber: string | null;
}

/**
 * Gives back the latest payment a member made for her membership, through
 * Stripe, and credits the ATHENA invoice for it.
 *
 * Always the whole payment: a part refund is a decision about an amount, and
 * is made in the Stripe dashboard where both figures are in front of staff.
 * Does not end the membership, because a refund does not always mean she is
 * leaving; the screen offers the cancel beside it.
 */
export async function refundLatestMembershipPayment(subscriptionId: string, reason: string): Promise<MembershipRefund> {
  const row = await loadMembership(subscriptionId);

  if (!row.stripeSubscriptionId && !row.stripeCustomerId) {
    throw new ApiError(409, 'This membership was never billed through Stripe, so there is no payment to refund.');
  }
  needStripe();

  const stripe = getStripe();
  const listed = await stripe.invoices.list({
    ...(row.stripeSubscriptionId ? { subscription: row.stripeSubscriptionId } : { customer: row.stripeCustomerId as string }),
    status: 'paid',
    limit: 1,
  });
  const invoice = listed.data[0];

  if (!invoice || !(invoice.amount_paid > 0)) {
    throw new ApiError(409, 'There is no payment to refund: nothing has been paid yet, or the only invoice was for nothing, as a trial is.');
  }

  const paymentIntentId = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id ?? null;
  if (!paymentIntentId) {
    throw new ApiError(409, 'That invoice was not paid by card through Stripe, so it cannot be refunded from here.');
  }

  let refundId: string | null = null;
  let status: MembershipRefund['status'] = 'refunded';

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata: { athenaSubscriptionId: row.id, athenaReason: reason.slice(0, 400) },
      },
      // Derived from the invoice, so two presses of the button inside Stripe's
      // window are one refund, and a refund for a different payment is a new one.
      { idempotencyKey: `membership-refund-${invoice.id}` }
    );
    refundId = refund.id;
  } catch (error) {
    if (!isAlreadyRefunded(error)) {
      logger.error('Stripe refused a membership refund', {
        subscriptionId,
        stripeInvoiceId: invoice.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ApiError(502, 'Stripe would not refund this payment, so nothing was changed.');
    }
    logger.warn('A membership payment was already refunded at Stripe; bringing the invoice into line', {
      subscriptionId,
      stripeInvoiceId: invoice.id,
    });
    status = 'already_refunded';
  }

  const amount = invoice.amount_paid / 100;
  const paidAtSeconds = invoice.status_transitions?.paid_at ?? invoice.created;

  // The ATHENA invoice for that payment is the one the webhook filed against the
  // moment Stripe says it was paid. A refund in full cancels it; one that is
  // already credited is left as it is, which is what makes this safe beside the
  // webhook that follows a refund.
  const filed = await prisma.invoice.findFirst({
    where: { subscriptionId: row.id, paidAt: new Date(paidAtSeconds * 1000) },
    select: { id: true, invoiceNumber: true },
  });
  if (filed) {
    await prisma.invoice.updateMany({
      where: { id: filed.id, status: 'PAID', creditedAmount: 0 },
      data: { status: 'CANCELLED', creditedAmount: amount, creditedAt: new Date() },
    });
  }

  return {
    subscriptionId: row.id,
    userId: row.userId,
    status,
    amount,
    currency: String(invoice.currency || 'aud').toUpperCase(),
    stripeInvoiceId: invoice.id,
    refundId,
    invoiceNumber: filed?.invoiceNumber ?? null,
  };
}
