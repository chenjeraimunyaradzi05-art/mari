/**
 * The rules a test-drive request is held to before it reaches a dealership.
 *
 * The dealership profile has always collected weekly opening hours, and the
 * request route never read them: the one check on a requested time was that
 * it was in the future. A member could ask for three in the morning on a
 * Sunday and be told "Requested. The dealership will confirm a time", as if
 * that were a time the dealership might confirm. Every other booking surface
 * in the vertical re-checks the chosen time on the server — a workshop
 * booking is refused unless it matches one of availableSlots() — so this is
 * the same idea at the grain a test drive has: not a slot, but a time the
 * showroom is open.
 *
 * Hours are read in the same shape the workshop availability uses (weekday
 * '0' for Sunday through '6', each a list of [from, to] in 24-hour time),
 * because the profile form saves them through the same normaliser.
 */

import { minutesOf, localParts } from '../wellness/wellness-dates';
import type { Availability } from '../wellness/practitioners.service';

/**
 * How long a test drive is taken to occupy the car, for deciding whether two
 * confirmed drives of the same car clash. It is a judgement about a drive
 * around the block and some questions, not a figure anybody measured; it only
 * decides when the second confirmation is refused, and the dealership can
 * always offer the member another time.
 */
export const TEST_DRIVE_MINUTES = 60;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Whether the showroom is open at that moment, in the dealership's own timezone. */
export function openAt(hours: Availability, at: Date, timeZone: string): boolean {
  const p = localParts(at, timeZone);
  const minute = p.hour * 60 + p.minute;
  return (hours[String(p.weekday)] ?? []).some(([from, to]) => minute >= minutesOf(from) && minute < minutesOf(to));
}

/** The week's hours in a line a member can read: "Mon 08:30–17:30; Sat 08:30–16:00". */
export function hoursWords(hours: Availability): string {
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => (hours[String(d)] ?? []).length > 0);
  if (days.length === 0) return 'no opening hours given';
  return days.map((d) => `${DAYS[d]} ${hours[String(d)].map(([a, b]) => `${a}–${b}`).join(', ')}`).join('; ');
}

/** Whether two drives of the same car, starting at these times, would have it in two places at once. */
export function drivesClash(a: Date, b: Date, minutes = TEST_DRIVE_MINUTES): boolean {
  return Math.abs(a.getTime() - b.getTime()) < minutes * 60000;
}
