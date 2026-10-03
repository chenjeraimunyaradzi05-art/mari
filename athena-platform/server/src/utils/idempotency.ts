/**
 * The minute a request falls in, for an idempotency key on a Stripe call that
 * has no row of its own to key from.
 *
 * Stripe keeps the first answer it gave under a key for about a day, errors
 * included, so a key built from a row id alone would hand a buyer the same
 * refusal for a day after whatever caused it had been put right (a seller's
 * account not yet able to take transfers, say). Inside one minute two identical
 * requests from the same member are a double-tap or a retry after a timeout,
 * not two intentions, and Stripe collapses them into one object; a minute
 * later the same request is a new one. The payout route has keyed on this
 * window since it was keyed at all; this is that arithmetic in one place, with
 * the clock as a parameter so a test can hold it still.
 *
 * Its own module, apart from utils/stripe, because the suites that stand in
 * for the Stripe client replace that module whole, and a helper that lived
 * there would vanish under every one of them.
 */
export function idempotencyWindow(now: number = Date.now()): number {
  return Math.floor(now / 60_000);
}
