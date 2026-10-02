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

const DAY = 86_400_000;

/**
 * How long a hold on a card lasts with the live processor, in days.
 *
 * Stripe lets an uncaptured authorisation on an online card payment go after
 * about seven days, and the bank puts the money back on the card. The buyer's
 * inspection period is fourteen days from the handover, and the hold starts
 * earlier than that, at payment, so with a live processor the hold always runs
 * out before the period does unless the buyer releases the money first.
 *
 * BUYER_PROTECTION used to answer that with "ATHENA asks the buyer to
 * re-authorise rather than releasing early". Nothing did: the hold ran out in
 * silence, the release at the end of the period failed, and the first anyone
 * heard of it was three days of failed captures later, with the car long gone.
 * What happens now is what the note says and nothing more — the buyer, the
 * seller and ATHENA's team are warned two days before (warnLapsingHolds in
 * automotive-reminders.service), a hold that runs out before the handover is
 * paid again before the car changes hands (settlePurchaseHold below takes the
 * second hold), and one that runs out during the inspection period goes to a
 * person. Nothing is ever captured early to beat the clock: that would pay the
 * seller before the buyer has had her fourteen days.
 */
export const CARD_HOLD_DAYS = 7;

/**
 * A second hold on a purchase already marked paid is recognised by its intent
 * being created after the purchase was marked paid. The margin keeps the one
 * case where the two are close together — the old pay route created the intent
 * and wrote paidAt in the same request — from ever reading as a second hold; a
 * real one comes days later, after the first has run out.
 */
const SECOND_HOLD_MARGIN = 60 * 60 * 1000;

/** Whether this is a production deployment, where nothing is ever mocked. */
function inProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Whether an intent is the live processor's, which is the only kind whose hold runs out.
 *
 * In production an intent that is not a mock is the live processor's whether or
 * not a key is in the environment this minute. Asking the key made a real hold
 * read as "not live" on a deployment that had lost it, so its lapse was never
 * warned about.
 */
function isLiveIntent(paymentIntentId: string | null | undefined): paymentIntentId is string {
  return (
    Boolean(paymentIntentId) &&
    !(paymentIntentId as string).startsWith('pi_mock_') &&
    (isStripeConfigured() || inProduction())
  );
}

/**
 * About when the hold behind a purchase stops being money ATHENA can take, or
 * null when there is no live, uncaptured authorisation to run out: nothing
 * paid yet, the money already captured, the hold already over, or the
 * development processor, whose holds never expire.
 *
 * paidAt is when ATHENA saw the authorisation, which on the buyer's own
 * confirmation is seconds after it. Where a sweep noticed it later, the real
 * lapse is earlier than this says, which is why the warnings go out two days
 * ahead rather than on the day.
 */
export function holdLapsesAt(p: { paidAt: Date | null; escrow: { status: string; paymentIntentId: string | null } | null }): Date | null {
  if (!p.paidAt || !p.escrow || p.escrow.status !== 'AUTHORIZED' || !isLiveIntent(p.escrow.paymentIntentId)) return null;
  return new Date(p.paidAt.getTime() + CARD_HOLD_DAYS * DAY);
}

/**
 * Whether the row says the hold behind a purchase has ended without being
 * taken: run out, released at the processor, or never gone through. The
 * webhook writes CANCELED when a hold runs out; recheckLiveHold below writes
 * it where no webhook is wired up.
 */
export function holdHasEnded(escrow: { status: string } | null | undefined): boolean {
  return Boolean(escrow) && (escrow!.status === 'CANCELED' || escrow!.status === 'FAILED');
}

/**
 * Ask the processor whether a hold the row still calls AUTHORIZED is really
 * still there, and bring the row into line when it is not.
 *
 * The row only moves off AUTHORIZED when the payment_intent.canceled webhook
 * lands, and a deployment may have none. Without this, a hold that ran out
 * went on reading as "the money is held" on both sides' purchase page, and
 * the pay route handed the buyer back a hold that no longer existed instead of
 * letting her pay again. An unreachable processor answers null — unknown — and
 * never GONE, so a network wobble cannot tell a seller her money has vanished.
 */
export async function recheckLiveHold(escrow: { id: string; status: string; paymentIntentId: string | null }): Promise<'HELD' | 'GONE' | null> {
  if (escrow.status !== 'AUTHORIZED' || !isLiveIntent(escrow.paymentIntentId)) return null;
  const intentId = escrow.paymentIntentId;
  const intent = await bestEffort('automotive.purchase-hold-recheck', () => getStripe().paymentIntents.retrieve(intentId));
  if (!intent) return null;
  if (intent.status === 'requires_capture' || intent.status === 'succeeded') return 'HELD';
  if (intent.status !== 'canceled') return null;
  await prisma.escrowPayment.updateMany({
    where: { id: escrow.id, status: 'AUTHORIZED' },
    data: { status: 'CANCELED', canceledAt: new Date(), cancelReason: intent.cancellation_reason === 'automatic' ? 'The hold on the card ran out' : 'Released at the card processor' },
  });
  return 'GONE';
}

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
  // to wait for. The same answer is right for a development deployment with no
  // key at all, because that is the only way such a row can exist —
  // createEscrowPayment refuses with a 503 in production rather than mocking.
  //
  // Not in production. There, a hold nobody can ask the processor about is not
  // money held: a real pi_ purchase on a deployment that had lost its key read as
  // HELD, and the seller was told the money was held and to hand the car over,
  // against a card nobody could confirm was authorised. And a mock id cannot
  // legitimately exist there, so it is not read as money either. Both wait on the
  // card step, which is true: the hold is not known to be there.
  if (escrow.paymentIntentId.startsWith('pi_mock_') || !isStripeConfigured()) {
    return inProduction() ? 'AWAITING_CARD' : 'HELD';
  }

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
      id: true, status: true, sellerId: true, offerAmount: true, agreedAmount: true, paidAt: true,
      escrow: { select: { id: true, status: true, paymentIntentId: true, createdAt: true } },
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

  const amount = p.agreedAmount ?? p.offerAmount;

  // A purchase already marked paid, now with a hold newer than that: the first
  // hold ran out before the handover and the buyer has paid once more, which
  // the pay route allows from PAID_HELD for exactly this. Without this branch
  // the second hold was taken and nothing else happened — paidAt kept the date
  // of the first, so the clock on the new hold read as already run out, and
  // the seller, who had been told not to hand the car over until the money was
  // held again, was never told that it was. The conditional update is what
  // keeps the two doors from both telling her.
  if (p.status === 'PAID_HELD' && p.paidAt && Number(p.escrow.createdAt) > p.paidAt.getTime() + SECOND_HOLD_MARGIN) {
    const renewed = await prisma.vehiclePurchase.updateMany({ where: { id: p.id, status: 'PAID_HELD', paidAt: p.paidAt }, data: { paidAt: now } });
    if (renewed.count > 0) {
      await note(
        p.sellerId,
        'The buyer has paid again; the money is held',
        `The hold on the buyer's card for "${p.listing.title}" had run out, and she has paid once more: $${amount.toLocaleString('en-AU')} is held by ATHENA again. You can arrange the handover with the papers.`,
        `/dashboard/cars/purchases/${p.id}`,
        { kind: 'CAR_PAID_AGAIN', id: p.id },
      );
    }
    return { state, status: p.status };
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

  // "Released to you after the buyer's inspection period" used to be the whole
  // of this message, and with the live processor it was a promise the hold
  // could not keep: the hold runs out about a week after payment, before the
  // period does. The seller is the one who hands a car over on the strength of
  // it, so she is told how long the hold lasts and what happens if it runs out
  // first.
  const lapse = isLiveIntent(p.escrow.paymentIntentId)
    ? ` A hold on a card lasts about ${CARD_HOLD_DAYS} days, which is shorter than the inspection period. If it is going to run out before the money is released, you and the buyer are both warned two days beforehand, and ATHENA's team settles it with you.`
    : '';
  await note(
    p.sellerId,
    'The buyer has paid; the money is held',
    `$${amount.toLocaleString('en-AU')} for "${p.listing.title}" is held by ATHENA. Arrange the handover with the papers. It reaches you when the buyer releases it or her inspection period ends.${lapse}`,
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
