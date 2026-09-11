/**
 * The practitioner directory's working parts: the slots a practitioner
 * has free on a day from her weekly hours and what is already booked,
 * the rating recomputed from verified visits, and the vocabulary the
 * filters use.
 */

import { addDays, isoDay, minutesOf, weekdayOf, zonedToUtc } from './wellness-dates';

/** Weekly hours: weekday (0 Sunday to 6 Saturday) to a list of [from, to] in "HH:MM". */
export type Availability = Record<string, Array<[string, string]>>;

export const DEFAULT_AVAILABILITY: Availability = {
  '1': [['09:00', '17:00']], '2': [['09:00', '17:00']], '3': [['09:00', '17:00']], '4': [['09:00', '17:00']], '5': [['09:00', '17:00']],
};

export const DEFAULT_TIMEZONE = 'Australia/Brisbane';

export interface SlotInput {
  availability: Availability | null | undefined;
  slotMinutes: number;
  timezone?: string;
  day: string;
  booked: Array<{ scheduledAt: Date | string; durationMinutes: number }>;
  now?: Date;
  leadMinutes?: number;
}

export interface Slot {
  start: string;
  end: string;
  label: string;
}

export function normaliseAvailability(value: unknown): Availability {
  const out: Availability = {};
  if (!value || typeof value !== 'object') return out;
  for (const [day, ranges] of Object.entries(value as Record<string, unknown>)) {
    const d = String(Number(day));
    if (Number.isNaN(Number(day)) || Number(day) < 0 || Number(day) > 6 || !Array.isArray(ranges)) continue;
    const clean: Array<[string, string]> = [];
    for (const r of ranges) {
      if (!Array.isArray(r) || r.length !== 2) continue;
      const [a, b] = r.map((x) => String(x));
      if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b) || minutesOf(a) >= minutesOf(b)) continue;
      clean.push([a, b]);
    }
    if (clean.length) out[d] = clean;
  }
  return out;
}

/** Free slots on a day, in the practitioner's zone, with anything booked and anything too soon removed. */
export function availableSlots(input: SlotInput): Slot[] {
  const tz = input.timezone || DEFAULT_TIMEZONE;
  const day = isoDay(input.day);
  const now = input.now ?? new Date();
  const lead = (input.leadMinutes ?? 120) * 60000;
  const ranges = (input.availability ?? DEFAULT_AVAILABILITY)[String(weekdayOf(day))] ?? [];
  const step = Math.max(10, Math.min(180, input.slotMinutes || 50));
  const busy = input.booked.map((b) => { const s = new Date(b.scheduledAt).getTime(); return [s, s + b.durationMinutes * 60000] as [number, number]; });
  const slots: Slot[] = [];
  for (const [from, to] of ranges) {
    for (let m = minutesOf(from); m + step <= minutesOf(to); m += step) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const start = zonedToUtc(day, `${hh}:${mm}`, tz);
      const end = new Date(start.getTime() + step * 60000);
      if (start.getTime() < now.getTime() + lead) continue;
      if (busy.some(([bs, be]) => start.getTime() < be && end.getTime() > bs)) continue;
      slots.push({ start: start.toISOString(), end: end.toISOString(), label: `${hh}:${mm}` });
    }
  }
  return slots;
}

/** The next few days that have any slot at all, so the page can offer them without a calendar. */
export function nextAvailableDays(input: Omit<SlotInput, 'day'> & { from: string; days?: number }): Array<{ day: string; slots: number }> {
  const out: Array<{ day: string; slots: number }> = [];
  for (let i = 0; i < (input.days ?? 14); i += 1) {
    const day = addDays(isoDay(input.from), i);
    const slots = availableSlots({ ...input, day });
    if (slots.length) out.push({ day, slots: slots.length });
  }
  return out;
}

export function recomputeRating(reviews: Array<{ rating: number; isHidden?: boolean }>): { ratingAvg: number; ratingCount: number } {
  const shown = reviews.filter((r) => !r.isHidden);
  if (shown.length === 0) return { ratingAvg: 0, ratingCount: 0 };
  return { ratingAvg: Math.round((shown.reduce((a, r) => a + r.rating, 0) / shown.length) * 10) / 10, ratingCount: shown.length };
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'practitioner';
}

/** A booking can be cancelled by the member up to twenty-four hours before. */
export function canCancel(scheduledAt: Date | string, now = new Date()): boolean {
  return new Date(scheduledAt).getTime() - now.getTime() > 24 * 3600000;
}
