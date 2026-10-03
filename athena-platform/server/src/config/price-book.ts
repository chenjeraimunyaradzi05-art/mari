/**
 * The price book: every number about what ATHENA charges, keeps and promises
 * that is not a Stripe price.
 *
 * What a membership costs is read from Stripe (see getSubscriptionPlanPrices),
 * because that is the number checkout charges. Everything else lived in a
 * different file for each consumer, and the copies had drifted: the trial was
 * 14 days in two places kept equal by a comment, the mentoring fee was 20 per
 * cent in the service and again in the mentor agreement, the creator share was
 * 70 to 85 per cent in the code and 70 to 80 per cent in the Terms, a gift
 * point was worth 0.01 in four files, and the pricing page promised a 30-day
 * money-back guarantee that the Terms did not offer.
 *
 * They are held here once. Server code imports them from this module. The web
 * app cannot import from the server package, so client/src/lib/pricing.ts holds
 * the few it needs for static pages (the Terms, the mentor agreement and the
 * pricing FAQ), and src/config/__tests__/price-book.test.ts and the client's
 * lib/pricing test read both files and fail when they disagree. GET
 * /api/subscriptions/plans serves the same numbers to any page that can ask.
 *
 * Nothing here imports anything. The file has to stay loadable from a test, a
 * script or the webhook without pulling in a database or a Stripe client.
 */

/** The only currency ATHENA charges or pays out in outside memberships. */
export const PRICE_CURRENCY = 'AUD' as const;

// ==========================================
// MEMBERSHIP POLICY
// ==========================================

/**
 * Days of paid membership before the first charge. The card is collected when
 * the trial starts and charged on the day it ends unless she has cancelled.
 */
export const TRIAL_DAYS = 14;

/**
 * Days a first-time subscriber has to ask for her first payment back. Refunds
 * are made by a person from the Stripe dashboard; nothing in the code issues
 * one on its own.
 */
export const REFUND_DAYS = 30;

/**
 * Days a member keeps her paid plan after a renewal payment fails, while Stripe
 * tries the card again. Counted from the day the failed period began. A card that
 * is declined once is usually an expired card or a bank that wanted a second try,
 * and taking her tools away that minute, while the email says we are retrying,
 * punished the member for the card. After this long without a payment the paid
 * tools pause until it goes through. Set Stripe's retry schedule to finish inside
 * it (Settings, Billing, Subscriptions and emails), or the subscription stays
 * past due after her tools have paused.
 */
export const PAST_DUE_GRACE_DAYS = 7;

// ==========================================
// FEES AND SHARES
// ==========================================

/** The share of a mentoring session that ATHENA keeps, as a fraction. */
export const MENTOR_PLATFORM_FEE_RATE = 0.2;

/**
 * The share of an escrow-held payment that ATHENA keeps when the caller does not
 * name a different one. Marketplace service orders use it.
 */
export const ESCROW_DEFAULT_FEE_PERCENT = 15;

/**
 * What a creator keeps of the value of a gift, by tier. The tier names and the
 * follower thresholds that choose between them live with the tier benefits in
 * creator.service; the money belongs here.
 */
export const CREATOR_REVENUE_SHARE_PERCENT = {
  Emerging: 70,
  Rising: 75,
  Established: 80,
  Partner: 85,
} as const;

const creatorShares = Object.values(CREATOR_REVENUE_SHARE_PERCENT);

/** The lowest and highest share a creator can keep, for copy that quotes a range. */
export const CREATOR_SHARE_RANGE_PERCENT = {
  min: Math.min(...creatorShares),
  max: Math.max(...creatorShares),
} as const;

/** The smallest creator payout ATHENA sends, in Australian dollars. */
export const MINIMUM_PAYOUT_AUD = 50;

/**
 * What ATHENA keeps of an automotive sale, job or report, in per cent. A private
 * seller carries the higher commission and a dealer, with obligations of their
 * own, the lower. The cars screens and the public fees page read these; the
 * automotive service re-exports them under the names its routes already use.
 */
export const AUTOMOTIVE_FEE_PERCENT = {
  privateSale: 6,
  dealerSale: 4,
  workshopJob: 12,
  inspection: 15,
} as const;

/**
 * Card processing is not a second charge. Stripe's cost of taking the card comes
 * out of ATHENA's own share, so nothing is deducted from what a mentor, a seller
 * or a creator keeps, and nothing is added to what a buyer pays. The one sentence
 * every page that quotes a fee uses, so the Terms and the fees page cannot say
 * two things about it.
 */
export const PROCESSING_FEE_STATEMENT =
  'Card processing is covered by ATHENA’s share. No separate processing fee is taken from what you keep or added to what a buyer pays.';

/**
 * Splits an amount held in cents into ATHENA's share and the rest, rounding once.
 *
 * Every flow that takes a percentage used to work in dollars as a float, round
 * the fee and the payout separately, and store the results. A 45-minute session
 * at 33.33 an hour became 24.9975 charged as 25.00, with a fee of 4.9995 stored
 * beside a fee of 5.00 sent to Stripe, and the figures on a member's earnings
 * statement did not add up to what her card was charged. Here the fee is rounded
 * to a whole cent exactly once, and the payout is what is left, so
 * `feeCents + payoutCents === amountCents` always, whatever the percentage.
 *
 * `percent` is in per cent (20, not 0.2). A negative or non-finite amount or a
 * percentage outside 0 to 100 is a bug in the caller, not something to round.
 */
export function splitFee(amountCents: number, percent: number): { feeCents: number; payoutCents: number } {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new RangeError('A fee is split from a whole number of cents, zero or more');
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError('A fee percentage is between 0 and 100');
  }
  const feeCents = Math.round((amountCents * percent) / 100);
  return { feeCents, payoutCents: amountCents - feeCents };
}

// ==========================================
// WHEN SOMETHING PAID FOR GOES WRONG
// ==========================================

/**
 * How long a mentee has, after her mentor says a session was given, to say it
 * was not before her card is charged. The mentor closing a session used to take
 * the money that minute. A session the mentee confirms herself is charged at
 * once, and so is one whose card hold is too close to lapsing to wait.
 */
export const SESSION_CONFIRMATION_HOURS = 24;

/**
 * How long after a paid session was charged the mentee can still tell ATHENA it
 * was not given. After that the payment stands, and she can still write to
 * support: this bounds the self-service button, not her rights under the
 * Australian Consumer Law.
 */
export const DISPUTE_WINDOW_DAYS = 14;

// ==========================================
// GIFT POINTS
// ==========================================

/**
 * What one gift point is worth, in cents of Australian dollars.
 *
 * Points are bought and cashed out in Australian dollars only. They were once
 * bought in whichever of twelve currencies the member had chosen and cashed out
 * one for one by a creator in hers, at a hundredth of a unit of each, so
 * buying in a weak currency and withdrawing in a strong one turned a few
 * dollars into hundreds, paid from ATHENA's balance.
 *
 * Held in whole cents because 0.29 / 0.01 is 28.999999999999996 in floating
 * point and a purchase that floors that credits a point too few.
 */
export const GIFT_POINT_CENTS = 1;

/** The same value in dollars, for display and for the columns that store dollars. */
export const GIFT_POINT_VALUE_AUD = GIFT_POINT_CENTS / 100;

/** Whole points that a payment of this many cents buys. */
export function giftPointsForCents(cents: number): number {
  return Math.floor(cents / GIFT_POINT_CENTS);
}

/** The cents a balance of this many points is worth when it is paid out. */
export function centsForGiftPoints(points: number): number {
  return Math.round(points * GIFT_POINT_CENTS);
}

// ==========================================
// BUSINESS FORMATION
// ==========================================

/**
 * What the formation service charges, in cents of Australian dollars, by
 * business type. Charged in AUD only: a payment in any other currency is a
 * mismatch, not something to convert.
 */
export const FORMATION_FEES_CENTS = {
  SOLE_TRADER: 4900,
  PARTNERSHIP: 9900,
  COMPANY: 49900,
  TRUST: 69900,
} as const;

/**
 * What the formation fee is for, in the words a page prints beside the price.
 *
 * Each sentence says only what the code does. A person on staff reviews a paid
 * registration, asks for what is missing, and records the ABN or ACN when it is
 * approved (services/formation.service adminAdvanceRegistration); a registration
 * that is refused is refunded in full before the refusal is recorded; staff can
 * refund a fee on request. What it does not say, because nobody has decided it:
 * who lodges with ASIC or the ABR, what a government register charges, and how
 * long review takes. No figure for any of those is written here, and a page must
 * not add one. When the owner decides them, this is the one place to say so, and
 * every page that prints the fee follows.
 */
export const FORMATION_FEE_TERMS = {
  covers: [
    'A person at ATHENA goes through the details you send and tells you here if anything is missing.',
    'When the registration is approved, its ABN or ACN is recorded on your registration.',
  ],
  notCovered: [
    'Anything a government register charges for a registration is separate from this fee, and is not included in it.',
  ],
  refund: [
    'If ATHENA cannot approve the registration, the fee is refunded in full to the card it was paid with.',
    'If you change your mind, ask support through the Help centre. Staff can refund a fee.',
  ],
  timing:
    'How long it takes depends on your details and on how busy review is. Every step shows on your registration as it happens.',
} as const;

// ==========================================
// GST
// ==========================================

export interface GstPosition {
  /** Whether ATHENA is registered for GST today. */
  registered: boolean;
  /** One plain sentence, the same one wherever a price is shown. */
  statement: string;
}

/**
 * What a price page may say about GST.
 *
 * Whether ATHENA is registered is not decided here. invoice.service reads it
 * from ATHENA_ABN and ATHENA_GST_REGISTERED_FROM and files "Tax invoice" or
 * "Invoice" on that basis, and isGstRegistered() there is the one answer both
 * the invoice and this sentence use, so a price and the invoice for it cannot
 * disagree. Whether ATHENA ought to be registered, and from when, is the
 * owner's decision with an accountant; this only reports what has been decided.
 */
export function gstPositionFor(registered: boolean): GstPosition {
  return {
    registered,
    statement: registered
      ? 'Prices are in Australian dollars (AUD) and include GST.'
      : 'Prices are in Australian dollars (AUD). ATHENA is not registered for GST, so none is added.',
  };
}

// ==========================================
// WHAT THE PUBLIC ENDPOINT SERVES
// ==========================================

/**
 * The book as a page can read it. Public, because the pricing page is and
 * because every figure here is already printed in the Terms or the mentor
 * agreement.
 */
export function publicPriceBook(gstRegistered: boolean) {
  return {
    currency: PRICE_CURRENCY,
    trialDays: TRIAL_DAYS,
    refundDays: REFUND_DAYS,
    gst: gstPositionFor(gstRegistered),
    fees: {
      mentoringPlatformPercent: Math.round(MENTOR_PLATFORM_FEE_RATE * 100),
      marketplacePlatformPercent: ESCROW_DEFAULT_FEE_PERCENT,
      creatorSharePercent: { ...CREATOR_REVENUE_SHARE_PERCENT },
      giftPointValueAud: GIFT_POINT_VALUE_AUD,
      minimumPayoutAud: MINIMUM_PAYOUT_AUD,
    },
  };
}

/**
 * Every fee ATHENA takes, for the public fees page: the whole of what
 * publicPriceBook says about fees, plus the automotive rates and what is and is
 * not charged on top. What each creator tier keeps by follower count lives with
 * the tier benefits in creator.service, so the route that serves this adds it.
 */
export function publicFeeSchedule(gstRegistered: boolean) {
  const book = publicPriceBook(gstRegistered);
  return {
    currency: book.currency,
    gst: book.gst,
    mentoring: { platformPercent: book.fees.mentoringPlatformPercent },
    marketplace: { platformPercent: book.fees.marketplacePlatformPercent },
    creatorGifts: {
      sharePercent: book.fees.creatorSharePercent,
      giftPointValueAud: book.fees.giftPointValueAud,
      minimumPayoutAud: book.fees.minimumPayoutAud,
    },
    automotive: { ...AUTOMOTIVE_FEE_PERCENT },
    processing: PROCESSING_FEE_STATEMENT,
  };
}

/**
 * The formation fees as a page can read them: the amount for each structure,
 * what the fee is for, and the GST sentence every price page prints. Public,
 * because the formation landing page is and because the figure is the one the
 * payment step charges.
 */
export function publicFormationFees(gstRegistered: boolean) {
  return {
    currency: PRICE_CURRENCY,
    fees: (Object.keys(FORMATION_FEES_CENTS) as Array<keyof typeof FORMATION_FEES_CENTS>).map((type) => ({
      type,
      amountCents: FORMATION_FEES_CENTS[type],
      amount: FORMATION_FEES_CENTS[type] / 100,
    })),
    gst: gstPositionFor(gstRegistered),
    terms: FORMATION_FEE_TERMS,
  };
}
