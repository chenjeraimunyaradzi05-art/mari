/**
 * The numbers the static pages print about what ATHENA charges, keeps and
 * promises: the trial, the refund window, the mentoring fee, what a creator
 * keeps of a gift, what a gift point is worth, and the smallest payout.
 *
 * Prices are not held here. This file used to call itself the single source of
 * truth for prices and carried A$29 a month, A$290 a year and A$99 for an
 * Enterprise tier, with helpers that turned those into "Save 16%" and "2 months
 * free" — for a yearly price that did not exist in Stripe and a tier checkout
 * refused. What a plan costs now comes only from GET /api/subscriptions/plans,
 * which reads the Stripe price checkout will charge; see
 * client/src/app/pricing/plan-prices.ts. A page with no live price shows none.
 *
 * ## One price book
 *
 * Every figure below is held once, on the server, in
 * server/src/config/price-book.ts, and that is where the code that moves money
 * reads it. The web app cannot import from the server package, so the static
 * pages (the Terms, the mentor agreement, the creator dashboard and the pricing
 * FAQ) read this copy. A test in each package reads the other's file and fails
 * when a number differs, so the copy cannot drift: change the price book, and
 * this file, in the same commit. Pages that can ask the server for the book
 * (GET /api/subscriptions/plans) should prefer the answer they are given.
 */

/**
 * Days of Pro before the first charge. The card is collected when the trial
 * starts and charged on the day it ends unless she has cancelled first.
 */
export const TRIAL_DAYS = 14;

/**
 * Days a first-time subscriber has to ask for her first payment back. Refunds
 * are made by a person from the Stripe dashboard; nothing issues one on its own.
 */
export const REFUND_DAYS = 30;

/** The share of a mentoring session that ATHENA keeps, in per cent. */
export const MENTOR_PLATFORM_FEE_PERCENT = 20;

/** The share of a marketplace order or hourly booking that ATHENA keeps, in per cent. */
export const MARKETPLACE_PLATFORM_FEE_PERCENT = 15;

/**
 * Hours a mentee has, after her mentor marks a session complete, to say it did
 * not happen before her card is charged. A session she confirms herself is
 * charged at once.
 */
export const SESSION_CONFIRMATION_HOURS = 24;

/**
 * Days after a paid session was charged in which the mentee can still tell ATHENA
 * it was not given from her sessions page. After that she writes to support.
 */
export const DISPUTE_WINDOW_DAYS = 14;

/** What a creator keeps of the value of a gift, in per cent, by tier. */
export const CREATOR_SHARE_PERCENT = {
  Emerging: 70,
  Rising: 75,
  Established: 80,
  Partner: 85,
} as const;

/** The lowest and highest share a creator can keep, for copy that quotes a range. */
export const CREATOR_SHARE_RANGE_PERCENT = {
  min: Math.min(...Object.values(CREATOR_SHARE_PERCENT)),
  max: Math.max(...Object.values(CREATOR_SHARE_PERCENT)),
} as const;

/** What one gift point is worth, in Australian dollars. Points are bought and paid out in AUD only. */
export const GIFT_POINT_VALUE_AUD = 0.01;

/** The smallest creator payout, in Australian dollars. */
export const MINIMUM_PAYOUT_AUD = 50;
