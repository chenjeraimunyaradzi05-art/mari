/**
 * Day arithmetic for the wellness engines. Everything here works on ISO
 * days ("2026-09-11") so a check-in logged at 23:50 in Brisbane and read
 * back in London stays on the day the member meant.
 */

const DAY_MS = 86400000;

export function isoDay(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** The day as a UTC date at midnight, which is what a Prisma @db.Date column wants. */
export function dayDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export function addDays(iso: string, n: number): string {
  return new Date(dayDate(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** b - a in whole days. */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayDate(b).getTime() - dayDate(a).getTime()) / DAY_MS);
}

/** The Monday that starts the week the day is in. */
export function weekStart(iso: string): string {
  const d = dayDate(iso);
  const dow = d.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(iso, -back);
}

export function weekdayOf(iso: string): number {
  return dayDate(iso).getUTCDay();
}

export interface LocalParts {
  day: string;
  hour: number;
  minute: number;
  weekday: number;
}

/** The wall-clock date and time an instant is, in a member's timezone. */
export function localParts(now: Date, timeZone: string): LocalParts {
  let dtf: Intl.DateTimeFormat;
  try {
    dtf = new Intl.DateTimeFormat('en-CA', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  } catch {
    dtf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  }
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(now)) parts[p.type] = p.value;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: Math.max(0, weekdays.indexOf(parts.weekday)),
  };
}

/** Minutes the zone is ahead of UTC at that instant. */
export function tzOffsetMinutes(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const asUtc = Date.UTC(Number(p.day.slice(0, 4)), Number(p.day.slice(5, 7)) - 1, Number(p.day.slice(8, 10)), p.hour, p.minute, 0);
  const truncated = Math.floor(at.getTime() / 60000) * 60000;
  return Math.round((asUtc - truncated) / 60000);
}

/** A wall-clock time on a day in a zone, as an instant. */
export function zonedToUtc(iso: string, time: string, timeZone: string): Date {
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), hh, mm, 0);
  const offset = tzOffsetMinutes(new Date(guess), timeZone);
  return new Date(guess - offset * 60000);
}

export function minutesOf(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function mean(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n))!;
  const my = mean(ys.slice(0, n))!;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}
