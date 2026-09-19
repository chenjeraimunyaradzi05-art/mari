/**
 * The garage's working parts: the odometer projected from the last reading
 * and how far she drives, the reminders a car is due (service by time or
 * kilometres, registration, insurance, the warranty running out), when
 * each was last sent so nobody is nagged, the next service after a
 * service is logged, and the workshop side: quotes summed line by line,
 * the booking long enough for the work, and a workshop's own price for it.
 * Ratings are not here; the routes ask the database to average them.
 */

import { serviceKind } from './automotive-library';

const DAY = 86400000;
const YEAR = 365.25 * DAY;
const REMINDER_REPEAT_DAYS = 30;

export interface VehicleLike {
  id: string;
  nickname?: string | null;
  make: string;
  model: string;
  year: number;
  odometerKm?: number | null;
  odometerAt?: Date | string | null;
  kmPerYear?: number | null;
  nextServiceDueAt?: Date | string | null;
  nextServiceDueKm?: number | null;
  serviceIntervalMonths: number;
  serviceIntervalKm: number;
  regoDueAt?: Date | string | null;
  insuranceRenewsAt?: Date | string | null;
  warrantyEndsAt?: Date | string | null;
  warrantyEndsKm?: number | null;
  lastReminderKeys?: unknown;
}

export type ReminderKind = 'SERVICE' | 'REGO' | 'INSURANCE' | 'WARRANTY';

export interface Reminder {
  key: string;
  kind: ReminderKind;
  title: string;
  body: string;
  dueOn: string | null;
  daysAway: number | null;
  urgency: 'overdue' | 'soon' | 'upcoming';
  action: { label: string; href: string };
}

export const vehicleName = (v: Pick<VehicleLike, 'nickname' | 'make' | 'model' | 'year'>) => v.nickname?.trim() || `${v.year} ${v.make} ${v.model}`;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysUntil = (d: Date | string, now: Date) => Math.ceil((new Date(d).getTime() - now.getTime()) / DAY);

/** Where the odometer probably is today, from the last reading and the yearly distance. */
export function projectedOdometer(v: Pick<VehicleLike, 'odometerKm' | 'odometerAt' | 'kmPerYear'>, now = new Date()): number | null {
  if (v.odometerKm === null || v.odometerKm === undefined) return null;
  if (!v.odometerAt || !v.kmPerYear) return v.odometerKm;
  const years = Math.max(0, (now.getTime() - new Date(v.odometerAt).getTime()) / YEAR);
  return Math.round(v.odometerKm + years * v.kmPerYear);
}

/** When a service is due next, after one was done. */
export function nextServiceAfter(doneOn: Date, doneKm: number | null | undefined, intervalMonths: number, intervalKm: number): { dueAt: Date; dueKm: number | null } {
  const dueAt = new Date(doneOn);
  dueAt.setUTCMonth(dueAt.getUTCMonth() + Math.max(1, intervalMonths));
  return { dueAt, dueKm: doneKm !== null && doneKm !== undefined ? doneKm + Math.max(1000, intervalKm) : null };
}

export function vehicleReminders(v: VehicleLike, now = new Date()): Reminder[] {
  const out: Reminder[] = [];
  const name = vehicleName(v);
  const garage = `/dashboard/cars/garage/${v.id}`;
  const odo = projectedOdometer(v, now);
  const urgencyFor = (days: number): Reminder['urgency'] => (days < 0 ? 'overdue' : days <= 14 ? 'soon' : 'upcoming');

  // Service, by whichever comes first.
  let serviceDays: number | null = null;
  if (v.nextServiceDueAt) serviceDays = daysUntil(v.nextServiceDueAt, now);
  let kmLeft: number | null = null;
  if (v.nextServiceDueKm && odo !== null) {
    kmLeft = v.nextServiceDueKm - odo;
    if (v.kmPerYear && v.kmPerYear > 0) {
      const byKmDays = Math.round(kmLeft / v.kmPerYear * 365);
      serviceDays = serviceDays === null ? byKmDays : Math.min(serviceDays, byKmDays);
    }
  }
  if (serviceDays !== null && serviceDays <= 45) {
    const monthKey = new Date(now.getTime() + Math.max(serviceDays, 0) * DAY);
    out.push({
      key: `service:${isoDay(monthKey).slice(0, 7)}`, kind: 'SERVICE',
      title: serviceDays < 0 ? `${name} is overdue for a service` : `${name} is due for a service`,
      body: [v.nextServiceDueAt ? `Due ${new Date(v.nextServiceDueAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : null, kmLeft !== null ? (kmLeft <= 0 ? `${Math.abs(kmLeft).toLocaleString('en-AU')} km past the service kilometres` : `about ${kmLeft.toLocaleString('en-AU')} km to go`) : null].filter(Boolean).join(', ') + '. Book a workshop that shows its prices.',
      dueOn: v.nextServiceDueAt ? isoDay(new Date(v.nextServiceDueAt)) : null, daysAway: serviceDays, urgency: urgencyFor(serviceDays),
      action: { label: 'Find a mechanic', href: `/cars/mechanics?service=logbook&vehicle=${v.id}` },
    });
  }

  if (v.regoDueAt) {
    const d = daysUntil(v.regoDueAt, now);
    if (d <= 30) out.push({ key: `rego:${isoDay(new Date(v.regoDueAt))}`, kind: 'REGO', title: d < 0 ? `${name}'s registration has lapsed` : `${name}'s registration is due`, body: d < 0 ? 'Driving unregistered voids your insurance as well as the fine. Renew before the next drive.' : `Due in ${d} day${d === 1 ? '' : 's'}. Renew online with the state; it takes five minutes.`, dueOn: isoDay(new Date(v.regoDueAt)), daysAway: d, urgency: urgencyFor(d), action: { label: 'Open the garage', href: garage } });
  }

  if (v.insuranceRenewsAt) {
    const d = daysUntil(v.insuranceRenewsAt, now);
    if (d <= 30) out.push({ key: `insurance:${isoDay(new Date(v.insuranceRenewsAt))}`, kind: 'INSURANCE', title: d < 0 ? `${name}'s insurance may have lapsed` : `${name}'s insurance renews soon`, body: d < 0 ? 'Check the policy is still in force before you drive.' : `Renews in ${d} day${d === 1 ? '' : 's'}. Renewals creep up; three quotes before you pay usually saves more than an hour's pay.`, dueOn: isoDay(new Date(v.insuranceRenewsAt)), daysAway: d, urgency: urgencyFor(d), action: { label: 'Estimate a fair premium', href: `/cars/insurance?vehicle=${v.id}` } });
  }

  if (v.warrantyEndsAt || (v.warrantyEndsKm && odo !== null)) {
    const byDate = v.warrantyEndsAt ? daysUntil(v.warrantyEndsAt, now) : null;
    const byKm = v.warrantyEndsKm && odo !== null && v.kmPerYear ? Math.round((v.warrantyEndsKm - odo) / v.kmPerYear * 365) : null;
    const d = byDate !== null && byKm !== null ? Math.min(byDate, byKm) : byDate ?? byKm;
    if (d !== null && d <= 60 && d >= -7) out.push({ key: `warranty:${v.warrantyEndsAt ? isoDay(new Date(v.warrantyEndsAt)) : v.warrantyEndsKm}`, kind: 'WARRANTY', title: d < 0 ? `${name}'s warranty has just ended` : `${name}'s warranty ends soon`, body: d < 0 ? 'Anything that was already wrong may still be claimable; put it in writing to the dealer now.' : `About ${d} day${d === 1 ? '' : 's'} left. Book a service and have every rattle and warning light written on the job card before it ends; a fault recorded inside the warranty is covered after it.`, dueOn: v.warrantyEndsAt ? isoDay(new Date(v.warrantyEndsAt)) : null, daysAway: d, urgency: d < 0 ? 'overdue' : d <= 21 ? 'soon' : 'upcoming', action: { label: 'Book a service', href: `/cars/mechanics?service=logbook&vehicle=${v.id}` } });
  }

  return out;
}

/** True when this reminder has not gone in the last month. */
export function shouldSend(lastKeys: unknown, key: string, now = new Date(), repeatDays = REMINDER_REPEAT_DAYS): boolean {
  if (!lastKeys || typeof lastKeys !== 'object') return true;
  const at = (lastKeys as Record<string, unknown>)[key];
  if (typeof at !== 'string') return true;
  return now.getTime() - new Date(at).getTime() > repeatDays * DAY;
}

export function markSent(lastKeys: unknown, key: string, now = new Date()): Record<string, string> {
  const base = lastKeys && typeof lastKeys === 'object' ? { ...(lastKeys as Record<string, string>) } : {};
  base[key] = now.toISOString();
  // Keep it small: anything older than a year has no bearing on repeats.
  for (const [k, v] of Object.entries(base)) if (now.getTime() - new Date(v).getTime() > YEAR) delete base[k];
  return base;
}

// ---------------------------------------------------------------- workshop

export interface QuoteLine { label: string; amount: number; kind: 'PARTS' | 'LABOUR' | 'OTHER' }

export function normaliseQuoteLines(value: unknown): QuoteLine[] {
  if (!Array.isArray(value)) return [];
  const out: QuoteLine[] = [];
  for (const raw of value.slice(0, 40)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const label = String(r.label ?? '').trim().slice(0, 120);
    const amount = Number(r.amount);
    if (!label || !Number.isFinite(amount) || amount < 0) continue;
    out.push({ label, amount: Math.round(amount * 100) / 100, kind: r.kind === 'PARTS' ? 'PARTS' : r.kind === 'LABOUR' ? 'LABOUR' : 'OTHER' });
  }
  return out;
}

export function quoteTotal(lines: QuoteLine[]): { total: number; parts: number; labour: number; other: number } {
  const sum = (k: QuoteLine['kind']) => Math.round(lines.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const parts = sum('PARTS'); const labour = sum('LABOUR'); const other = sum('OTHER');
  return { total: Math.round((parts + labour + other) * 100) / 100, parts, labour, other };
}

export interface PartRequest { name: string; qty: number; note?: string }

export function normaliseParts(value: unknown): PartRequest[] {
  if (!Array.isArray(value)) return [];
  const out: PartRequest[] = [];
  for (const raw of value.slice(0, 20)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const name = String(r.name ?? '').trim().slice(0, 120);
    if (!name) continue;
    const qty = Math.max(1, Math.min(99, Math.round(Number(r.qty) || 1)));
    out.push({ name, qty, ...(r.note ? { note: String(r.note).slice(0, 300) } : {}) });
  }
  return out;
}

// recomputeMechanicRating and recomputeCarRating used to live here: they took
// every review row a route had loaded and averaged the visible ones in memory.
// The routes now ask the database for that average instead, so nothing could
// call them without first re-loading the rows the aggregate exists to avoid.
// Two copies of one averaging rule with nothing keeping them in step is how
// the mechanic card and the car card drift apart, so this copy is gone rather
// than kept as the "real" one.

/** The minutes a booking should hold, from the service kind or the workshop's slot. */
export function bookingMinutes(kind: string, slotMinutes: number): number {
  const k = serviceKind(kind);
  return Math.max(slotMinutes, k?.minutes ?? slotMinutes);
}

/** A workshop's price for a kind of work, from its own list, else the typical range. */
export function priceFor(priceList: unknown, kind: string): { from: number | null; to: number | null; note: string | null; own: boolean } {
  if (Array.isArray(priceList)) {
    const own = priceList.find((p) => p && typeof p === 'object' && (p as Record<string, unknown>).kind === kind) as Record<string, unknown> | undefined;
    if (own) return { from: Number(own.from) || null, to: Number(own.to) || null, note: own.note ? String(own.note) : null, own: true };
  }
  const k = serviceKind(kind);
  return { from: k?.from ?? null, to: k?.to ?? null, note: k ? 'Typical range; the workshop quotes before it starts' : null, own: false };
}

export function normalisePriceList(value: unknown): Array<{ kind: string; from: number; to: number | null; note: string | null }> {
  if (!Array.isArray(value)) return [];
  const out: Array<{ kind: string; from: number; to: number | null; note: string | null }> = [];
  for (const raw of value.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const kind = String(r.kind ?? '');
    if (!serviceKind(kind)) continue;
    const from = Number(r.from);
    if (!Number.isFinite(from) || from < 0) continue;
    const to = Number(r.to);
    out.push({ kind, from: Math.round(from), to: Number.isFinite(to) && to >= from ? Math.round(to) : null, note: r.note ? String(r.note).slice(0, 160) : null });
  }
  return out;
}
