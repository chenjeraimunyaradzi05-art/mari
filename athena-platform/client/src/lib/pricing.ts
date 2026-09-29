/**
 * Membership policy constants: how long the trial runs and how long a first
 * payment can be refunded.
 *
 * Prices are not held here. This file used to call itself the single source of
 * truth for prices and carried A$29 a month, A$290 a year and A$99 for an
 * Enterprise tier, with helpers that turned those into "Save 16%" and "2 months
 * free" — for a yearly price that did not exist in Stripe and a tier checkout
 * refused. What a plan costs now comes only from GET /api/subscriptions/plans,
 * which reads the Stripe price checkout will charge; see
 * client/src/app/pricing/plan-prices.ts. A page with no live price shows none.
 */

/**
 * Days of Pro before the first charge. The server starts the Stripe trial with
 * its own TRIAL_DAYS in server/src/routes/subscription.routes.ts and returns it
 * from /subscriptions/plans; the two must stay equal, because the pricing page
 * and the help page promise this number in their FAQ copy.
 */
export const TRIAL_DAYS = 14;

/** Days a first-time subscriber has to ask for her first payment back. */
export const REFUND_DAYS = 30;
