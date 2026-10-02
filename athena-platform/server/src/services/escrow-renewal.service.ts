/**
 * Paying again for a marketplace order whose hold on the buyer's card has run
 * out, or is about to.
 *
 * A package order holds the buyer's money on her card from the day she orders
 * until she approves the delivered work, and a card hold lasts about a week
 * with a live processor, while a package can promise up to a year of delivery
 * time. Nothing watched the gap: the provider could accept, do the work and
 * deliver, and then find the hold gone, with the buyer's approval failing at
 * Stripe and the money on nobody's side of the table. The same gap in car
 * purchases is handled by asking the buyer to "pay once more" (see
 * automotive/purchase-escrow.service); this is the same idea for orders.
 *
 *   - Inside the last two days of a hold, or once it has gone, the buyer can
 *     start a fresh hold for the same amount (startOrderReauthorisation). It is
 *     a second authorisation, not a second charge: nothing is taken, and the
 *     first hold is released when the second is real.
 *   - When the new hold is authorised (payment_intent.amount_capturable_updated,
 *     see settleOrderRenewal) the order is pointed at it in one conditional
 *     write and the old hold is cancelled. Only then. Until the new hold is
 *     real, the old one is left exactly as it was.
 *   - The order's provider is not asked to deliver against a hold that is not
 *     there (see the deliver route), which is what keeps a lapse from becoming
 *     work done for nothing.
 *
 * The new hold is its own EscrowPayment row, created with the same buyer,
 * seller, amount and platform fee, and carries the order and the hold it renews
 * in its metadata so the webhook can recognise it. Its creation date is the new
 * authorisation's, which is what the expiry sweep measures from.
 */

import type Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';
import { recordFailure } from '../utils/ops-metrics';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { createEscrowPayment } from './stripe-connect.service';
import {
  CAPTURE_BEFORE_KEY,
  RENEWAL_WINDOW_DAYS,
  holdDeadlineOf,
  isInRenewalWindow,
  recordedDeadlineOf,
} from './escrow-deadline';

/** Order statuses in which the work is still to be done or approved, so the money still matters. */
export const LIVE_ORDER_STATUSES: readonly string[] = ['PENDING', 'ACCEPTED', 'REVISION_REQUESTED', 'DELIVERED'];

const RENEWS_ESCROW = 'renewsEscrowId';
const RENEWS_ORDER = 'renewsOrderId';

type HoldForRenewal = { status: string; createdAt: Date; metadata?: unknown; paymentIntentId?: string | null };

function isMockIntent(paymentIntentId: string | null | undefined): boolean {
  return Boolean(paymentIntentId) && (paymentIntentId as string).startsWith('pi_mock_');
}

/**
 * What the buyer can do about the hold behind an order, for the order page.
 *
 *   lapsesAt   when the hold stops being collectable, while it is still held
 *   canRenew   whether she can start a fresh hold now
 *   lapsed     the hold has ended (ran out, was declined, or was released) and
 *              the order is still live, so nothing is held for the work
 */
export function describeOrderHold(
  escrow: HoldForRenewal | null | undefined,
  orderStatus: string,
  now = new Date()
): { lapsesAt: string | null; canRenew: boolean; lapsed: boolean } {
  if (!escrow || isMockIntent(escrow.paymentIntentId) || !LIVE_ORDER_STATUSES.includes(orderStatus)) {
    return { lapsesAt: null, canRenew: false, lapsed: false };
  }

  if (escrow.status === 'AUTHORIZED') {
    // A row read without its creation date has no deadline to work out.
    if (!(escrow.createdAt instanceof Date)) return { lapsesAt: null, canRenew: false, lapsed: false };
    return {
      lapsesAt: holdDeadlineOf(escrow).toISOString(),
      canRenew: isInRenewalWindow(escrow, now),
      lapsed: false,
    };
  }

  // The card step was never finished, or the card was declined: that is the
  // payment button's job, not a renewal, so it is not offered as one.
  if (escrow.status === 'PENDING') return { lapsesAt: null, canRenew: false, lapsed: false };

  if (escrow.status === 'CANCELED' || escrow.status === 'FAILED') {
    return { lapsesAt: null, canRenew: true, lapsed: true };
  }

  return { lapsesAt: null, canRenew: false, lapsed: false };
}

type Authorisation = {
  escrowId: string;
  paymentIntentId: string;
  clientSecret: string;
  /** In cents. */
  amount: number;
  platformFee: number;
  currency: string;
  /** True when this hands back a card step already begun rather than starting a new hold. */
  resumed: boolean;
};

/**
 * Starts a fresh hold for an order, or hands back the one already started.
 * Buyer only; 404 for anybody else, as the order routes do.
 */
export async function startOrderReauthorisation(orderId: string, actorId: string, now = new Date()): Promise<Authorisation> {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      clientId: true,
      service: { select: { id: true, title: true, providerId: true } },
      escrow: {
        select: {
          id: true,
          status: true,
          amount: true,
          platformFee: true,
          currency: true,
          description: true,
          paymentIntentId: true,
          createdAt: true,
          metadata: true,
          buyerId: true,
          sellerId: true,
        },
      },
    },
  });

  if (!order || (order.clientId !== actorId && order.service.providerId !== actorId)) {
    throw new ApiError(404, 'Order not found');
  }
  if (order.clientId !== actorId) {
    throw new ApiError(403, 'Only the buyer can pay for an order');
  }
  if (order.status === 'DISPUTED') {
    throw new ApiError(409, 'This order is in dispute. ATHENA’s team will decide it, and nothing needs paying again meanwhile.');
  }
  if (!LIVE_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(409, 'This order is finished, so there is nothing to pay for.');
  }

  const escrow = order.escrow;
  if (!escrow) {
    throw new ApiError(409, 'This order has no payment attached, so there is nothing to renew.');
  }
  if (isMockIntent(escrow.paymentIntentId) || !isStripeConfigured()) {
    throw new ApiError(409, 'Payments are not switched on for real money here, so there is nothing to renew.');
  }
  if (escrow.status === 'CAPTURED' || escrow.status === 'REFUNDED') {
    throw new ApiError(409, 'This order has already been paid.');
  }

  if (escrow.status === 'AUTHORIZED' && !isInRenewalWindow(escrow, now)) {
    const lapses = holdDeadlineOf(escrow).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Brisbane',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    throw new ApiError(
      409,
      `The hold on your card is still good until ${lapses}. We will ask you to renew it in the last ${RENEWAL_WINDOW_DAYS} days, if the work is not finished by then.`
    );
  }

  // A card step that was begun and never finished, or a card that was declined
  // and can be tried again, is not a renewal: the same payment is picked up.
  if (escrow.status === 'PENDING' || escrow.status === 'FAILED') {
    const resumed = await resumableIntent(escrow.paymentIntentId);
    if (resumed) {
      return {
        escrowId: escrow.id,
        paymentIntentId: escrow.paymentIntentId as string,
        clientSecret: resumed,
        amount: escrow.amount,
        platformFee: escrow.platformFee,
        currency: escrow.currency,
        resumed: true,
      };
    }
  }

  // A renewal the buyer began and did not finish: she is handed the same one, so
  // pressing the button twice does not stack two holds on her card.
  const earlier = await prisma.escrowPayment.findMany({
    where: { buyerId: order.clientId, metadata: { path: [RENEWS_ESCROW], equals: escrow.id } },
    select: { id: true, status: true, paymentIntentId: true, amount: true, platformFee: true, currency: true },
    orderBy: { createdAt: 'desc' },
  });
  const pending = earlier.find((row) => row.status === 'PENDING' || row.status === 'FAILED');
  if (pending) {
    const resumed = await resumableIntent(pending.paymentIntentId);
    if (resumed) {
      return {
        escrowId: pending.id,
        paymentIntentId: pending.paymentIntentId as string,
        clientSecret: resumed,
        amount: pending.amount,
        platformFee: pending.platformFee,
        currency: pending.currency,
        resumed: true,
      };
    }
  }

  const original = (escrow.metadata && typeof escrow.metadata === 'object' && !Array.isArray(escrow.metadata)
    ? escrow.metadata
    : {}) as Record<string, unknown>;
  const carried: Record<string, string> = {};
  for (const key of ['serviceId', 'packageIndex']) {
    if (typeof original[key] === 'string') carried[key] = original[key] as string;
  }

  const hold = await createEscrowPayment({
    buyerId: order.clientId,
    sellerId: escrow.sellerId,
    amount: escrow.amount,
    currency: escrow.currency.toLowerCase(),
    description: escrow.description || order.service.title,
    sessionType: 'service_order',
    // The fee the order already carries, so the order and the new hold cannot
    // disagree about what the provider is paid.
    platformFeeAmount: escrow.platformFee,
    metadata: { ...carried, [RENEWS_ESCROW]: escrow.id, [RENEWS_ORDER]: order.id },
    // One key per attempt: a double tap makes one hold, and a hold that was
    // cancelled is not handed back to the next attempt.
    idempotencyKey: `order-renew-${escrow.id}-${earlier.length}`,
  });

  logger.info('A fresh hold was started for a marketplace order', {
    orderId: order.id,
    renews: escrow.id,
    escrowId: hold.escrowId,
  });

  return { ...hold, currency: escrow.currency, resumed: false };
}

/** The client secret of an intent the buyer can still put a card behind, or null when it is finished with. */
async function resumableIntent(paymentIntentId: string | null | undefined): Promise<string | null> {
  if (!paymentIntentId || isMockIntent(paymentIntentId) || !isStripeConfigured()) return null;
  const intent = await bestEffort('escrow-renewal.resume', () => getStripe().paymentIntents.retrieve(paymentIntentId), null);
  if (!intent) return null;
  const open = ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(intent.status);
  return open ? intent.client_secret ?? null : null;
}

// ---------------------------------------------------------------------------
// Asking the buyer
// ---------------------------------------------------------------------------

export const RENEW_TITLE = 'Your payment hold needs renewing';
const RENEW_AGAIN_AFTER_MS = 24 * 60 * 60 * 1000;

type OrderToAskAbout = { id: string; clientId: string; packageName: string | null; service: { title: string; providerId?: string } };

/**
 * Asks the buyer to renew the hold behind an order, at most once a day for the
 * same order so that a provider pressing deliver three times, or a sweep that
 * runs four times a day, does not become a pile of identical notices. Returns
 * whether a notice was written. Never throws: it is a nudge on the way to
 * something else.
 *
 *   lapsing           the hold is within two days of running out
 *   lapsed            it has already ended
 *   provider_waiting  it has ended and the provider is ready to hand the work over
 */
export async function askBuyerToRenew(
  order: OrderToAskAbout,
  why: 'lapsing' | 'lapsed' | 'provider_waiting',
  deadline?: Date
): Promise<boolean> {
  return bestEffort(
    'notification.escrow-renew-buyer',
    async () => {
      const recent = await prisma.notification.findFirst({
        where: {
          userId: order.clientId,
          title: RENEW_TITLE,
          createdAt: { gte: new Date(Date.now() - RENEW_AGAIN_AFTER_MS) },
          data: { path: ['orderId'], equals: order.id },
        },
        select: { id: true },
      });
      if (recent) return false;

      const what = `${order.packageName ? `${order.packageName} · ` : ''}${order.service.title}`;
      const when = deadline
        ? deadline.toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'long', day: 'numeric', month: 'long' })
        : null;
      const message =
        why === 'lapsing'
          ? `${what}: the hold on your card runs out${when ? ` on ${when}` : ' soon'}, and the work is not finished yet. Please renew it from the order page before then so the provider can be paid when it is done. Nothing is taken by renewing; it is still only taken when you approve the finished work.`
          : why === 'provider_waiting'
            ? `${what}: the provider is ready to hand the work over, but the hold on your card has ended. Please renew it from the order page so they can. Nothing is taken until you approve the finished work.`
            : `${what}: the hold on your card has ended, so nothing is held for this work now. Please renew it from the order page. Nothing is taken until you approve the finished work.`;

      await prisma.notification.create({
        data: {
          userId: order.clientId,
          type: 'SYSTEM',
          title: RENEW_TITLE,
          message,
          link: `/skills-marketplace/orders/${order.id}`,
          data: { kind: 'ESCROW_RENEW_REQUEST', orderId: order.id, why } as never,
        },
      });
      return true;
    },
    false
  );
}

/**
 * A hold that Stripe let run out. Called from the payment_intent.canceled
 * webhook, which is how most lapses are first learned of: the row is marked
 * cancelled there, and the expiry sweep only looks at rows still held, so
 * without this nobody was told. The buyer is asked to renew and the provider is
 * asked to wait, but only for an order that is still live and only for a hold
 * that ran out, not one somebody cancelled.
 */
export async function noteLapsedOrderHold(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  await bestEffort(
    'escrow-renewal.lapsed-order-hold',
    async () => {
      if (paymentIntent.cancellation_reason !== 'automatic') return;
      const order = await prisma.serviceOrder.findFirst({
        where: { escrow: { paymentIntentId: paymentIntent.id } },
        select: { id: true, status: true, clientId: true, packageName: true, service: { select: { title: true, providerId: true } } },
      });
      if (!order || !LIVE_ORDER_STATUSES.includes(order.status)) return;

      await askBuyerToRenew(order, 'lapsed');
      await prisma.notification.create({
        data: {
          userId: order.service.providerId,
          type: 'SYSTEM',
          title: 'The payment hold for an order has ended',
          message: `${order.packageName ? `${order.packageName} · ` : ''}${order.service.title}: the hold on the buyer's card has run out. We have asked the buyer to renew it. Please wait for that before you hand the work over, so you are sure to be paid.`,
          link: `/skills-marketplace/orders/${order.id}`,
        },
      });
    },
    undefined
  );
}

export type RenewalOutcome = 'not_a_renewal' | 'not_held' | 'renewed' | 'already_renewed' | 'order_closed' | 'mismatch';

/**
 * A new hold has been authorised. If it is a renewal of an order's hold, point
 * the order at it and release the old one.
 *
 * Called from the payment_intent.amount_capturable_updated webhook after the
 * new hold's own row has been moved to AUTHORIZED, and safe to call any number
 * of times: the swap is a conditional write on the hold the order still points
 * at, so only the first call changes anything.
 */
export async function settleOrderRenewal(paymentIntent: Stripe.PaymentIntent): Promise<RenewalOutcome> {
  const metadata = (paymentIntent.metadata ?? {}) as Record<string, unknown>;
  const oldEscrowId = typeof metadata[RENEWS_ESCROW] === 'string' ? (metadata[RENEWS_ESCROW] as string) : null;
  const orderId = typeof metadata[RENEWS_ORDER] === 'string' ? (metadata[RENEWS_ORDER] as string) : null;
  if (!oldEscrowId || !orderId) return 'not_a_renewal';

  const next = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId: paymentIntent.id },
    select: { id: true, status: true, buyerId: true, sellerId: true, amount: true },
  });
  if (!next || next.status !== 'AUTHORIZED') return 'not_held';

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      clientId: true,
      escrowPaymentId: true,
      packageName: true,
      service: { select: { title: true, providerId: true } },
    },
  });

  // The metadata is a note we wrote, so it is checked against the order rather
  // than believed: the hold has to be the order's own buyer paying its own
  // provider, and the order has to be pointing at the hold it says it renews.
  if (
    !order ||
    order.clientId !== next.buyerId ||
    order.service.providerId !== next.sellerId ||
    (order.escrowPaymentId !== oldEscrowId && order.escrowPaymentId !== next.id)
  ) {
    logger.error('A renewal hold does not fit the order it names and was left alone', {
      paymentIntentId: paymentIntent.id,
      orderId,
      oldEscrowId,
    });
    recordFailure('escrow_renewal.mismatch', new Error(`Renewal ${paymentIntent.id} does not fit order ${orderId}`));
    return 'mismatch';
  }

  if (order.escrowPaymentId === next.id) return 'already_renewed';

  // The order finished or was cancelled while she was renewing. The new hold
  // is money on her card for nothing, so it is given back.
  if (!LIVE_ORDER_STATUSES.includes(order.status)) {
    await releaseHold(paymentIntent.id, next.id, 'The order was closed before this hold was needed');
    return 'order_closed';
  }

  const old = await prisma.escrowPayment.findUnique({
    where: { id: oldEscrowId },
    select: { id: true, status: true, paymentIntentId: true, amount: true },
  });

  // A renewal holds the same amount as the hold it replaces; it is made from it.
  // A hold for less that names an order as the one it renews would otherwise
  // leave the provider's work secured by a smaller sum than the buyer agreed to.
  if (old && typeof old.amount === 'number' && typeof next.amount === 'number' && old.amount !== next.amount) {
    logger.error('A renewal hold is for a different amount than the hold it names and was left alone', {
      paymentIntentId: paymentIntent.id,
      orderId,
      oldEscrowId,
    });
    recordFailure('escrow_renewal.mismatch', new Error(`Renewal ${paymentIntent.id} is not for the amount of ${oldEscrowId}`));
    return 'mismatch';
  }

  const swapped = await prisma.serviceOrder.updateMany({
    where: { id: order.id, escrowPaymentId: oldEscrowId },
    data: { escrowPaymentId: next.id },
  });
  if (swapped.count === 0) return 'already_renewed';

  // The old hold goes only now that the new one is real. If it cannot be
  // released it is counted and logged, because until it runs out the buyer's
  // card carries both.
  if (old && old.paymentIntentId && (old.status === 'PENDING' || old.status === 'AUTHORIZED')) {
    await releaseHold(old.paymentIntentId, old.id, 'Replaced by a fresh hold');
  }

  const what = `${order.packageName ? `${order.packageName} · ` : ''}${order.service.title}`;
  await Promise.all([
    bestEffort(
      'notification.escrow-renewed-provider',
      () =>
        prisma.notification.create({
          data: {
            userId: order.service.providerId,
            type: 'SYSTEM',
            title: 'The payment for an order is held again',
            message: `${what}: the buyer has renewed the hold on their card, so the payment is secured again and you can carry on.`,
            link: `/skills-marketplace/orders/${order.id}`,
          },
        }),
      null
    ),
    bestEffort(
      'notification.escrow-renewed-buyer',
      () =>
        prisma.notification.create({
          data: {
            userId: order.clientId,
            type: 'SYSTEM',
            title: 'Your payment hold is renewed',
            message: `${what}: thank you. The hold on your card is renewed and the old one released. Nothing has been taken; it is still only taken when you approve the finished work.`,
            link: `/skills-marketplace/orders/${order.id}`,
          },
        }),
      null
    ),
  ]);

  logger.info('A marketplace order was moved onto a renewed hold', {
    orderId: order.id,
    from: oldEscrowId,
    to: next.id,
  });
  return 'renewed';
}

/**
 * Cancels an uncaptured hold at Stripe and marks its row, never touching one
 * that has been taken. Cancelling an intent that has already been captured is
 * refused by Stripe, which is exactly the protection wanted here: this must
 * never turn into a refund of a sale.
 */
async function releaseHold(paymentIntentId: string, escrowId: string, reason: string): Promise<void> {
  try {
    await getStripe().paymentIntents.cancel(paymentIntentId);
  } catch (error) {
    // Already cancelled (it ran out) is the outcome wanted. Anything else is
    // left on the card and counted, so a person can look at it.
    const live = await bestEffort('escrow-renewal.release-lookup', () => getStripe().paymentIntents.retrieve(paymentIntentId), null);
    if (live?.status !== 'canceled') {
      recordFailure('escrow_renewal.release', error);
      logger.error('A replaced hold could not be released and is still on the buyer’s card', {
        paymentIntentId,
        escrowId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  await prisma.escrowPayment.updateMany({
    where: { id: escrowId, status: { in: ['PENDING', 'AUTHORIZED'] } },
    data: { status: 'CANCELED', canceledAt: new Date(), cancelReason: reason },
  });
}

/**
 * Writes Stripe's own deadline for an authorisation onto its hold, so that every
 * later question about when it runs out is answered with Stripe's date and not
 * with a guess. Best effort and never throws: it runs inside the webhook, after
 * the hold has already been marked authorised, and a deadline we could not read
 * only means the seven-day assumption stands for that hold.
 */
export async function recordCaptureDeadline(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const charge =
      typeof paymentIntent.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id;
    if (!charge || isMockIntent(paymentIntent.id) || !isStripeConfigured()) return;

    const row = await prisma.escrowPayment.findUnique({
      where: { paymentIntentId: paymentIntent.id },
      select: { id: true, createdAt: true, metadata: true },
    });
    if (!row || recordedDeadlineOf(row)) return;

    const full = await getStripe().charges.retrieve(charge);
    const before = full.payment_method_details?.card?.capture_before;
    if (typeof before !== 'number') return;

    const deadline = new Date(before * 1000);
    const base = (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {}) as Record<string, unknown>;
    const merged = { ...base, [CAPTURE_BEFORE_KEY]: deadline.toISOString() };
    // Only kept when it is believable; see recordedDeadlineOf.
    if (!recordedDeadlineOf({ createdAt: row.createdAt, metadata: merged })) return;

    await prisma.escrowPayment.update({ where: { id: row.id }, data: { metadata: merged as never } });
  } catch (error) {
    logger.warn('Could not record when a card hold runs out; the seven-day assumption stands for it', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
