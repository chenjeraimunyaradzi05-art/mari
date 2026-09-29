/**
 * Money, percentages and days, written the way the web app writes them, so a
 * figure a member sees on her phone reads the same as it does on the web.
 *
 * Prisma's Decimal columns (a savings target, a super balance) arrive over
 * JSON as strings, and a figure the server could not work out arrives as
 * null. `toNumber` turns either into a number or null, so a screen never does
 * arithmetic on "1200.00" or prints "NaN".
 */

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** "$12,345", whole dollars. A missing figure is a dash, never "$0". */
export function aud(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return '–';
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Math.round(n));
  } catch {
    return `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-AU')}`;
  }
}

/** "12.5%". The server sends rates as percentages already (32.5, not 0.325). */
export function pct(value: unknown, digits = 0): string {
  const n = toNumber(value);
  if (n === null) return '–';
  return `${n.toFixed(digits)}%`;
}

/** A whole number with thousands separators: "82,000 km" is written by the caller. */
export function whole(value: unknown): string {
  const n = toNumber(value);
  return n === null ? '–' : Math.round(n).toLocaleString('en-AU');
}

/** Today on this phone, YYYY-MM-DD. The server files a check-in on the day she meant, not the day it is in UTC. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Tue 3 Sep" for a YYYY-MM-DD or an ISO timestamp; empty for nothing. */
export function shortDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  if (!iso) return '';
  // A bare day is read at midday, so no timezone can move it to the day before.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', opts);
}

/** "3 September 2026". */
export function longDate(iso: string | null | undefined): string {
  return shortDate(iso, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "RELEASED" or "PAID_HELD" as "Released" or "Paid held". */
export function words(value: string | null | undefined): string {
  if (!value) return '';
  const text = value.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
