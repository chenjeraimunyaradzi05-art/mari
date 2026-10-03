/**
 * When a hold on a card stops being money ATHENA can take.
 *
 * A card authorisation does not last for ever: with a live processor it lapses
 * after about a week, and the bank puts the money back on the card. "About a
 * week" was assumed, in four places, as the row's creation date plus seven days.
 * Stripe knows the real deadline for each authorisation (`capture_before` on the
 * charge) and it is not always seven days, so it is written onto the hold when
 * the card is authorised (see escrow-renewal.service) and read from here first.
 * Without one the old figure stands, which is right for most cards and is the
 * only thing there is for a hold made before this was recorded.
 *
 * No imports from the database or Stripe on purpose, so that the expiry sweep,
 * the holds screens and the renewal flow can all use it without a cycle.
 */

/** How long a card authorisation is assumed to last when Stripe has not said. */
export const HOLD_LIFETIME_DAYS = 7;

/**
 * How close to the end of a hold the buyer is asked to renew it, and how close
 * she is allowed to. Earlier than this the hold is good and asking again would
 * only put a second hold on her card for no reason.
 */
export const RENEWAL_WINDOW_DAYS = 2;

const DAY = 24 * 60 * 60 * 1000;

/** The key under which the real deadline is kept in a hold's own metadata. */
export const CAPTURE_BEFORE_KEY = 'captureBefore';

type HoldTimes = { createdAt: Date; metadata?: unknown };

/** The deadline Stripe reported for this hold, when one was recorded and is believable. */
export function recordedDeadlineOf(hold: HoldTimes): Date | null {
  const metadata = hold.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>)[CAPTURE_BEFORE_KEY];
  if (typeof raw !== 'string') return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  // An authorisation is never shorter than a day or longer than a month, even
  // with extended authorisation; anything else is not a deadline we recorded.
  const lived = at.getTime() - hold.createdAt.getTime();
  if (lived < DAY || lived > 31 * DAY) return null;
  return at;
}

/** When the hold stops being collectable: Stripe's own deadline, or the seven-day assumption. */
export function holdDeadlineOf(hold: HoldTimes): Date {
  return recordedDeadlineOf(hold) ?? new Date(hold.createdAt.getTime() + HOLD_LIFETIME_DAYS * DAY);
}

/** Whether the deadline is within the renewal window (or already gone). */
export function isInRenewalWindow(hold: HoldTimes, now = new Date()): boolean {
  return holdDeadlineOf(hold).getTime() - now.getTime() <= RENEWAL_WINDOW_DAYS * DAY;
}

/**
 * How long after a mentoring session starts its mentor still has to mark it
 * complete, in days, before the hold on the mentee's card is allowed to run out.
 *
 * A session is paid for when it is marked complete, which can only happen once
 * its hour is over. A session booked for the last moment of the hold's life
 * would be over after the money could no longer be taken, and the mentor would
 * have given the hour for nothing. One day is room for the hour itself and for
 * a mentor who marks it done the next morning.
 */
export const MENTOR_COMPLETION_MARGIN_DAYS = 1;

/**
 * How far ahead a paid mentoring session may be booked, in days.
 *
 * A mentoring session books a hold on the mentee's card the moment it is
 * requested, and nothing renews it (an order's hold can be renewed by its buyer,
 * see escrow-renewal.service; a session's cannot). Booked for three weeks away,
 * the hold ran out in the first week, the capture at completion then failed, and
 * the mentor was told that a payment "needed attention" for an hour she had
 * given. A session is only offered, and only accepted, inside the life of the
 * hold it will be paid from.
 */
export const MENTOR_BOOKING_HORIZON_DAYS = HOLD_LIFETIME_DAYS - MENTOR_COMPLETION_MARGIN_DAYS;

/**
 * The latest a paid mentoring session may start, given the hold behind it: the
 * hold's own deadline less the time its mentor needs to mark it complete. For a
 * hold made now this is MENTOR_BOOKING_HORIZON_DAYS from now, and for one made
 * earlier (a session being moved) it is earlier by as much as the hold has
 * already used.
 */
export function latestMentorSessionStart(hold: HoldTimes): Date {
  return new Date(holdDeadlineOf(hold).getTime() - MENTOR_COMPLETION_MARGIN_DAYS * DAY);
}
