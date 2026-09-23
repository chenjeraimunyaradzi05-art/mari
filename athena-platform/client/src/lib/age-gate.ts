/**
 * The one age ATHENA asks for at sign-up, and the arithmetic that decides
 * whether a date of birth clears it.
 *
 * The number itself has been in the codebase for a long time — the Terms say
 * "You must be at least {{platform.minimumAge}} years old" and the Privacy
 * Policy says the platform verifies it — but nothing read it to make a
 * decision, and no date of birth was ever collected to compare against. This
 * is the client half of fixing that: the same rule the server applies, applied
 * in the form, so a woman is told before she submits rather than after.
 *
 * The server is still the authority. Everything here is so the form can be
 * honest early; none of it is a check anyone could not edit out of their own
 * browser.
 */

import { PLATFORM_MINIMUM_AGE } from '@/lib/contact';

export { PLATFORM_MINIMUM_AGE };

/** What the form says when the date of birth is missing, impossible or too recent. */
export const DATE_OF_BIRTH_REFUSAL = `You must be at least ${PLATFORM_MINIMUM_AGE} to join ATHENA`;

/**
 * Completed years between a date of birth and now, worked out on calendar
 * parts. Dividing milliseconds by 365.25 days puts a birthday on the wrong
 * side of the line on the day itself, and every year for anyone born on
 * 29 February.
 */
export function yearsSince(value: string | Date, now: Date = new Date()): number {
  const born = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(born.getTime())) return Number.NaN;

  let years = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
    years -= 1;
  }
  return years;
}

/** Whether this is a date a living person could have been born on. */
export function isPlausibleDateOfBirth(value: string | Date, now: Date = new Date()): boolean {
  const born = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(born.getTime())) return false;
  if (born.getTime() > now.getTime()) return false;
  return yearsSince(born, now) <= 120;
}

/** Whether this date of birth clears the platform minimum (Terms 2.1). */
export function meetsMinimumAge(value: string | Date, now: Date = new Date()): boolean {
  if (!value) return false;
  if (!isPlausibleDateOfBirth(value, now)) return false;
  return yearsSince(value, now) >= PLATFORM_MINIMUM_AGE;
}

/**
 * The most recent date of birth that still clears the minimum, as `yyyy-mm-dd`
 * for a date input's `max`. The browser's own picker then refuses the dates
 * the server would, which is friendlier than a red message after a submit.
 */
export function latestAdultBirthDate(now: Date = new Date()): string {
  const latest = new Date(now.getFullYear() - PLATFORM_MINIMUM_AGE, now.getMonth(), now.getDate());
  const month = `${latest.getMonth() + 1}`.padStart(2, '0');
  const day = `${latest.getDate()}`.padStart(2, '0');
  return `${latest.getFullYear()}-${month}-${day}`;
}
