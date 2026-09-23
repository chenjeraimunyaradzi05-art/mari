/**
 * Whether the money behind a car purchase is really there, and the one place
 * that is allowed to say so.
 *
 * POST /purchases/:id/pay used to do three things in a row: create the payment
 * intent, write PAID_HELD with a paidAt, and tell the seller "the buyer has
 * paid; the money is held". All of it ran before the response carrying the
 * client secret had even reached the browser, so before the buyer had seen a
 * card field. A woman who closed the form, or whose card was declined, was
 * left with a purchase that said her money was held, a seller who had been
 * told the same, and no Pay button to come back to — the only way out was to
 * cancel the deal and start again. Worse, if the seller acted on that
 * notification and handed the car over, the release later tried to capture an
 * intent nobody had ever authorised: she had given away a car against money
 * that never existed.
 *
 * So the purchase now stays ACCEPTED until the hold is real, and this module
 * decides what "real" means. It reads the escrow row first and asks the
 * processor second, because the row only moves when the
 * payment_intent.amount_capturable_updated webhook arrives and a deployment
 * may have none wired up. Both doors — the buyer's browser confirming the card
 * it has just authorised, and the webhook — come through `settlePurchaseHold`,
 * which promotes the purchase with a conditional update. That is what makes
 * the seller's notification true when it is sent, and sent only once.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { ApiError } from '../../middleware/errorHandler';
import { bestEffort, labelSegment } from '../../utils/best-effort';
import { getStripe, isStripeConfigured } from '../../utils/stripe';

/**
 * What a purchase's card step has actually come to.
 *
 * HELD          the money is authorised on the card and ATHENA can capture it.
 * AWAITING_CARD an intent exists that nobody has authorised yet — she closed
 *               the form, or the card was declined and can be tried again.
 * GONE          there is nothing left to authorise; paying means starting a
 *               fresh hold.
 */
export type HoldState = 'HELD' | 'AWAITING_CARD' | 'GONE';

/**
 * Escrow statuses that are real money, and the ones that are the end of the
 * road. FAILED is deliberately in neither list: a declined card leaves the
 * intent at `requires_payment_method`, which the buyer can still satisfy from
 * the same form, so the processor — not the row — gets the last word on it.
 */
const HOLD_IS_REAL: readonly string[] = ['AUTHORIZED', 'CAPTURED'];
const HOLD_IS_OVER: readonly string[] = ['CANCELED', 'REFUNDED'];

/**
 * The seller's notification, and the buyer's, are worth a log line when they
 * fail but never worth failing the payment over: by the time either is sent
 * the money is held and the purchase has moved.
 */
async function note(userId: string, title: string, message: string, link: string, data: Record<string, unknown>): Promise<void> {
  await bestEffort(`notification.${labelSegment(data.kind)}`, () => prisma.notification.create({ data: { userId, type: 'SYSTEM', title, message, link, data: data as Prisma.InputJsonValue } }), null);
}

/**
 * What the hold behind a purchase has come to, asking the processor whenever
 * the row alone cannot answer.
 */
export async function readHoldState(escrow: { paymentIntentId: string | null; status: string }): Promise<HoldState> {
  if (HOLD_IS_REAL.includes(escrow.status)) return 'HELD';
  if (HOLD_IS_OVER.includes(escrow.status)) return 'GONE';
  if (!escrow.paymentIntentId) return 'GONE';

  // A mock hold has no card step and no webhook behind it: the development
  // processor records the hold the moment it is created, and the page says
  // plainly that nothing has left a card, so there is no later authorisation
  // to wait for. The same answer is right for a deployment with no key at all,
  // because that is the only way such a row can exist — createEscrowPayment
  // refuses with a 503 in production rather than mocking.
  if (escrow.paymentIntentId.startsWith('pi_mock_') || !isStripeConfigured()) return 'HELD';

  // The row says PENDING, which means only that no webhook has moved it yet.
  // The lookup goes through bestEffort because a processor that cannot be
  // reached must never be read as "the money is there": an undefined answer
  // falls through to AWAITING_CARD, so the buyer is asked to try again in a
  // moment instead of the seller being told she has been paid.
  const intent = await bestEffort('automotive.purchase-hold-lookup', () => getStripe().paymentIntents.retrieve(escrow.paymentIntentId as string));
  if (!intent) return 'AWAITING_CARD';
  if (intent.status === 'requires_capture' || intent.status === 'succeeded') return 'HELD';
  if (intent.status === 'canceled') return 'GONE';
  return 'AWAITING_CARD';
}

/**
 * Move a purchase to PAID_HELD, but only once the hold behind it is real, and
 * only once however many times this is called.
 *
 * Both doors call it: the buyer's browser, the moment the card form reports
 * the authorisation, and the webhook when Stripe says the amount is
 * capturable. They race by design — a webhook can land while the browser's
 * request is still in flight — so the promotion is a conditional update
 * against the status the caller read, and the seller's notification hangs off
 * the one that won it.
 *
 * It answers with what it found rather than throwing, because "the card has
 * not been authorised yet" is not an error the buyer caused; the caller
 * decides what to say about it.
 */
export async function settlePurchaseHold(purchaseId: string, now = new Date()): Promise<{ state: HoldState; status: string }> {
  const p = await prisma.vehiclePurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true, status: true, sellerId: true, offerAmount: true, agreedAmount: true,
      escrow: { select: { id: true, status: true, paymentIntentId: true } },
      listing: { select: { title: true } },
    },
  });
  if (!p) throw new ApiError(404, 'Purchase not found');
  if (!p.escrow) return { state: 'GONE', status: p.status };

  const state = await readHoldState(p.escrow);
  if (state !== 'HELD') return { state, status: p.status };

  // Normally the webhook is what moves the escrow row off PENDING. Where the
  // processor has been asked directly instead — no webhook configured, or one
  // that has not landed yet — the row is brought into line here, so that the
  // release, the sweep and the detail page all read the same answer this did.
  // The condition on the update is what keeps a webhook that lands a moment
  // later from overwriting a capture that has already happened.
  if (!HOLD_IS_REAL.includes(p.escrow.status)) {
    await prisma.escrowPayment.updateMany({ where: { id: p.escrow.id, status: { notIn: [...HOLD_IS_REAL, ...HOLD_IS_OVER] } }, data: { status: 'AUTHORIZED' } });
  }

  if (p.status !== 'ACCEPTED') return { state, status: p.status };

  const promoted = await prisma.vehiclePurchase.updateMany({ where: { id: p.id, status: 'ACCEPTED' }, data: { status: 'PAID_HELD', paidAt: now } });
  if (promoted.count === 0) {
    // The other door got there first. Say what the row now holds rather than
    // what it held when this call started, and send nothing: the seller has
    // already been told by whoever won.
    const fresh = await prisma.vehiclePurchase.findUnique({ where: { id: p.id }, select: { status: true } });
    return { state, status: fresh?.status ?? p.status };
  }

  const amount = p.agreedAmount ?? p.offerAmount;
  await note(
    p.sellerId,
    'The buyer has paid; the money is held',
    `$${amount.toLocaleString('en-AU')} for "${p.listing.title}" is held by ATHENA. Arrange the handover with the papers; it is released to you after the buyer's inspection period.`,
    `/dashboard/cars/purchases/${p.id}`,
    { kind: 'CAR_PAID', id: p.id },
  );
  return { state, status: 'PAID_HELD' };
}

/**
 * The same promotion, reached from the Stripe webhook, which knows the payment
 * intent and not the purchase behind it.
 *
 * It answers false for an intent that belongs to something else — an
 * inspection fee, a workshop job, a mentor session all use the same escrow —
 * so the webhook can call it for every hold that authorises without first
 * having to know which vertical the money came from.
 */
export async function settlePurchaseHoldByIntent(paymentIntentId: string, now = new Date()): Promise<boolean> {
  const p = await prisma.vehiclePurchase.findFirst({ where: { escrow: { paymentIntentId } }, select: { id: true } });
  if (!p) return false;
  const settled = await settlePurchaseHold(p.id, now);
  return settled.status === 'PAID_HELD';
}
