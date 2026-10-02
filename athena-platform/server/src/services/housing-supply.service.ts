/**
 * Where housing on ATHENA comes from, and how long a DV-safe listing may wait
 * for a person to check it.
 *
 * The housing routes were careful about everything except supply. The only
 * way a listing entered the system was a member typing one in, so a woman
 * following the safety page's "Safe housing" link reached an empty search; and
 * a member's DV-safe listing, correctly held until staff had looked at it,
 * waited in a queue with no promise on it, no order beyond "oldest created"
 * and nothing that ever reminded anyone it was there.
 *
 * This module is the supply side:
 *
 * - Staff can put a housing partner's places on the platform, one at a time
 *   or as a spreadsheet, each attached to a member account that answers the
 *   women who ask about it (the partner's own, or the member of staff's). A
 *   listing with no one behind it would take inquiries into silence.
 * - Every DV-safe listing that is waiting for its check carries the moment it
 *   started waiting and a due time SAFETY_CHECK_SLA_HOURS later. The queue is
 *   ordered by that moment, shows what is overdue, and alertOverdueSafetyChecks
 *   tells every admin when anything has passed its due time.
 *
 * What it cannot do is invent the partners. No housing provider has signed
 * with ATHENA in this codebase, and a seeded "partner" listing would put a
 * made-up address in front of a woman who needs a real one. The owner has to
 * bring the providers; this is what lets staff load their stock once they do.
 *
 * The moment a check was asked for rides in `features` under a prefix, like
 * the lister's DV-safe note beside it, because HousingListing has no column
 * for either. Both are stripped from every member-facing response. A listing
 * held before the prefix existed is read as waiting since it was created.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { recordFailure } from '../utils/ops-metrics';
import { parseCsv } from './automotive/catalogue-admin.service';

export const LISTING_TYPES = ['RENTAL', 'SHARE', 'EMERGENCY', 'TRANSITIONAL'] as const;

/**
 * The types that are confidential whether or not the lister ticks DV-safe. A
 * place offered as emergency or transitional accommodation is offered to a
 * woman leaving a bad situation, which is exactly the offer a bad actor would
 * make, so these are held for the same staff check as a DV-safe claim.
 */
export const CONFIDENTIAL_LISTING_TYPES = ['EMERGENCY', 'TRANSITIONAL'] as const;

/** Whether a listing is confidential, and so held for a staff check before it is shown. */
export const isConfidentialListing = (l: { dvSafe?: boolean | null; type?: string | null }): boolean =>
  Boolean(l.dvSafe) || (CONFIDENTIAL_LISTING_TYPES as readonly string[]).includes(String(l.type));

export const AU_STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

/**
 * How long a DV-safe listing may wait for its check before every admin is
 * told it is late. Two days: long enough to phone the lister and look at the
 * place properly, short enough that a woman's safe room is not sitting unseen
 * for a week. This is a promise staff make to each other, not to members —
 * the lister is told staff will look before it goes live, and nothing more.
 */
export const SAFETY_CHECK_SLA_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;

// ------------------------------------------------------------- the features

export const DV_SAFE_NOTE_PREFIX = 'dv-safe-note:';
export const CHECK_REQUESTED_PREFIX = 'dv-safe-check-requested:';
/**
 * Marks a listing that staff took down: an administrator withdrew it, or a
 * moderator removed it on a report. A listing's status alone cannot say so,
 * because its lister may withdraw it too, and a lister can move her own listing
 * back to ACTIVE; without this a take-down of an ordinary listing lasted only
 * until its lister pressed "Available" again. While it is on a listing, only
 * staff put the listing back (the admin route clears it).
 */
export const STAFF_TAKEDOWN_PREFIX = 'staff-takedown:';
const INTERNAL_PREFIXES = [DV_SAFE_NOTE_PREFIX, CHECK_REQUESTED_PREFIX, STAFF_TAKEDOWN_PREFIX];

const isInternal = (feature: string) => INTERNAL_PREFIXES.some((prefix) => feature.startsWith(prefix));
const isTakedownTag = (feature: unknown): feature is string => typeof feature === 'string' && feature.startsWith(STAFF_TAKEDOWN_PREFIX);

/** The features a member may see: strings only, and none of the internal tags. */
export function publicFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  return features.filter((f): f is string => typeof f === 'string' && !isInternal(f));
}

/** Whether staff took this listing down, and nobody but staff has put it back. */
export const takenDownByStaff = (features: unknown): boolean => Array.isArray(features) && features.some(isTakedownTag);

/** The take-down tag if there is one, so the helpers that rebuild a listing's features carry it over rather than drop it. */
const takedownTagOf = (features: unknown): string[] => (Array.isArray(features) ? features.filter(isTakedownTag).slice(0, 1) : []);

/** The features of a listing staff have just taken down: everything it had, plus when. */
export function withStaffTakedown(features: unknown, at: Date = new Date()): string[] {
  const kept = Array.isArray(features) ? features.filter((f): f is string => typeof f === 'string' && !isTakedownTag(f)) : [];
  return [...kept, `${STAFF_TAKEDOWN_PREFIX}${at.toISOString()}`];
}

/** The features of a listing staff have put back: everything it had, minus the take-down. */
export const withoutStaffTakedown = (features: unknown): string[] =>
  Array.isArray(features) ? features.filter((f): f is string => typeof f === 'string' && !isTakedownTag(f)) : [];

/** The lister's note on why the place is DV-safe. */
export function dvSafeNoteOf(features: string[] | null | undefined): string | null {
  const tagged = (features ?? []).find((f) => typeof f === 'string' && f.startsWith(DV_SAFE_NOTE_PREFIX));
  return tagged ? tagged.slice(DV_SAFE_NOTE_PREFIX.length) : null;
}

/**
 * The features of a listing that has just asked for a DV-safe check: its
 * public features, the lister's note, and when the asking happened. A second
 * request replaces the first rather than stacking beside it.
 */
export function withSafetyCheckRequest(features: unknown, note: string, at: Date = new Date()): string[] {
  // An emergency or transitional listing asks for the check without claiming
  // DV-safe, so it may have no note; an empty one is not written as a tag.
  return [
    ...publicFeatures(features),
    ...(note ? [`${DV_SAFE_NOTE_PREFIX}${note}`] : []),
    `${CHECK_REQUESTED_PREFIX}${at.toISOString()}`,
    ...takedownTagOf(features),
  ];
}

/** The features of a listing that no longer claims to be DV-safe: the note and the request go with the claim. */
export const withoutSafetyCheckRequest = (features: unknown): string[] => [...publicFeatures(features), ...takedownTagOf(features)];

/** The features of a listing staff have checked at creation: the note stays for the record; nothing is waiting. */
export function withCheckedNote(features: unknown, note: string): string[] {
  return [...publicFeatures(features), ...(note ? [`${DV_SAFE_NOTE_PREFIX}${note}`] : []), ...takedownTagOf(features)];
}

// ------------------------------------------------------------- the clock

type ClockSource = { features?: string[] | null; createdAt?: Date | string | null };

/** When this listing started waiting for its check. */
export function checkRequestedAt(listing: ClockSource): Date | null {
  const tagged = (listing.features ?? []).find((f) => typeof f === 'string' && f.startsWith(CHECK_REQUESTED_PREFIX));
  if (tagged) {
    const at = new Date(tagged.slice(CHECK_REQUESTED_PREFIX.length));
    if (!Number.isNaN(at.getTime())) return at;
  }
  if (listing.createdAt) {
    const created = new Date(listing.createdAt);
    if (!Number.isNaN(created.getTime())) return created;
  }
  return null;
}

export interface SafetyCheckClock {
  requestedAt: string | null;
  dueAt: string | null;
  overdue: boolean;
  hoursWaiting: number | null;
}

export function safetyCheckClock(listing: ClockSource, now: Date = new Date()): SafetyCheckClock {
  const requested = checkRequestedAt(listing);
  if (!requested) return { requestedAt: null, dueAt: null, overdue: false, hoursWaiting: null };
  const due = new Date(requested.getTime() + SAFETY_CHECK_SLA_HOURS * HOUR_MS);
  return {
    requestedAt: requested.toISOString(),
    dueAt: due.toISOString(),
    overdue: now.getTime() > due.getTime(),
    hoursWaiting: Math.max(0, Math.floor((now.getTime() - requested.getTime()) / HOUR_MS)),
  };
}

/**
 * The listings waiting for a check: DV-safe ones, and emergency and
 * transitional ones, which are confidential on their own. A listing staff took
 * down, or one its lister has since let or withdrawn, is no longer waiting for
 * anything: the queue used to keep a taken-down listing in it for ever, because
 * taking it down left it DV-safe and unchecked.
 */
export const SAFETY_CHECK_QUEUE_WHERE: Prisma.HousingListingWhereInput = {
  OR: [{ dvSafe: true }, { type: { in: [...CONFIDENTIAL_LISTING_TYPES] } }],
  safetyVerified: false,
  status: { notIn: ['WITHDRAWN', 'LEASED'] },
};

/** How many waiting listings the queue and the sweep read. Far more than a team works in a day. */
export const SAFETY_CHECK_WINDOW = 500;

/** Oldest request first, whatever order the rows came back in. */
export function byWaitingLongest<T extends ClockSource>(rows: T[]): T[] {
  const at = (row: T) => checkRequestedAt(row)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...rows].sort((a, b) => at(a) - at(b));
}

// ------------------------------------------------------------- telling staff

/** The admins to tell. Every active one, to a ceiling no real team reaches. */
export async function adminRecipients(): Promise<Array<{ id: string }>> {
  return prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, take: 50 });
}

const brisbaneTime = (at: Date) => at.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Brisbane' });

/** The line staff read when a check is asked for, with when it is due. */
export function checkDueLine(at: Date = new Date()): string {
  return `The check is due by ${brisbaneTime(new Date(at.getTime() + SAFETY_CHECK_SLA_HOURS * HOUR_MS))} (Brisbane time).`;
}

/**
 * Tell every admin that DV-safe listings have waited past their due time.
 *
 * Built to run on the scheduled-tasks worker, like the overdue-report sweep.
 * It never throws: the counts it returns are the truth either way, and a
 * failed send, or a platform with no admin to tell, is put on the operations
 * screen rather than lost.
 */
export async function alertOverdueSafetyChecks(now: Date = new Date()): Promise<{ waiting: number; overdue: number; notified: number }> {
  let waiting: Array<{ id: string; title: string; city: string | null; features: string[]; createdAt: Date }>;
  try {
    waiting = await prisma.housingListing.findMany({
      where: SAFETY_CHECK_QUEUE_WHERE,
      select: { id: true, title: true, city: true, features: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: SAFETY_CHECK_WINDOW,
    });
  } catch (error) {
    logger.error('The safe-housing check queue could not be read for the overdue sweep', {
      error: error instanceof Error ? error.message : String(error),
    });
    recordFailure('housing.safety-check-overdue', error);
    return { waiting: 0, overdue: 0, notified: 0 };
  }

  const late = byWaitingLongest(waiting).filter((listing) => safetyCheckClock(listing, now).overdue);
  if (late.length === 0) return { waiting: waiting.length, overdue: 0, notified: 0 };

  const oldest = late[0];
  const oldestClock = safetyCheckClock(oldest, now);
  const title = late.length === 1 ? 'A safe-housing check is overdue' : `${late.length} safe-housing checks are overdue`;
  const message =
    `The longest waiting, "${oldest.title}"${oldest.city ? ` in ${oldest.city}` : ''}, has waited ${oldestClock.hoursWaiting} hours ` +
    `against the ${SAFETY_CHECK_SLA_HOURS} staff aim for. It stays off the list until someone checks it.`;

  try {
    const admins = await adminRecipients();
    if (admins.length === 0) {
      logger.error('Safe-housing checks are overdue and there is no admin account to tell', { overdue: late.length });
      recordFailure('housing.safety-check-overdue', new Error(`${late.length} overdue, no admin to tell`));
      return { waiting: waiting.length, overdue: late.length, notified: 0 };
    }
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'SYSTEM' as const,
        title,
        message,
        link: '/admin/housing',
        data: { kind: 'HOUSING_SAFETY_CHECK_OVERDUE', overdue: late.length, listingIds: late.slice(0, 10).map((l) => l.id) },
      })),
    });
    return { waiting: waiting.length, overdue: late.length, notified: admins.length };
  } catch (error) {
    logger.error('Admins could not be told about overdue safe-housing checks', {
      overdue: late.length,
      error: error instanceof Error ? error.message : String(error),
    });
    recordFailure('housing.safety-check-overdue', error);
    return { waiting: waiting.length, overdue: late.length, notified: 0 };
  }
}

// ------------------------------------------------------------- staff input

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(max).optional());

const optionalCount = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce
      .number({ invalid_type_error: 'is a whole number' })
      .int('is a whole number')
      .min(0, 'cannot be negative')
      .max(max, `is at most ${max}`)
      .optional()
  );

/** Dollars, as a spreadsheet might write them: "$1,200" reads as 1200. */
const optionalMoney = z.preprocess(
  (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.replace(/[$,\s]/g, '')) : v ?? undefined),
  z.coerce
    .number({ invalid_type_error: 'is an amount in dollars' })
    .finite('is an amount in dollars')
    .min(0, 'cannot be negative')
    .max(100_000, 'is more than any weekly rent or bond')
    .optional()
);

const flag = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === 'no' || s === 'false' || s === '0' || s === 'n') return false;
  if (s === 'yes' || s === 'true' || s === '1' || s === 'y') return true;
  return v;
}, z.boolean({ invalid_type_error: 'is yes or no' }));

const optionalDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.date({ errorMap: () => ({ message: 'is a date like 2026-10-01' }) }).optional()
);

/**
 * One listing as staff enter it, whether through the form or a spreadsheet
 * row. The same rules as a member's listing, plus the ones a member's form
 * never needed to state because it only offered valid choices: a known state,
 * a four-digit postcode, counts that are counts.
 */
export const staffListingSchema = z
  .object({
    title: z.string({ required_error: 'is required' }).trim().min(1, 'is required').max(200),
    description: z.string({ required_error: 'is required' }).trim().min(1, 'is required').max(5000),
    type: z.enum(LISTING_TYPES, { errorMap: () => ({ message: `is one of ${LISTING_TYPES.join(', ')}` }) }),
    address: optionalText(200),
    suburb: optionalText(100),
    city: optionalText(100),
    state: z.preprocess(
      (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim().toUpperCase()) : v),
      z.enum(AU_STATES, { errorMap: () => ({ message: `is one of ${AU_STATES.join(', ')}` }) }).optional()
    ),
    postcode: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'number' ? String(v) : v),
      z.string().trim().regex(/^\d{4}$/, 'is four digits').optional()
    ),
    rentWeekly: optionalMoney,
    bondAmount: optionalMoney,
    bedrooms: optionalCount(20),
    bathrooms: optionalCount(20),
    parking: optionalCount(20),
    features: z.preprocess(
      (v) => (typeof v === 'string' ? v.split(/[|;]/).map((f) => f.trim()).filter(Boolean) : v ?? []),
      z.array(z.string().trim().min(1).max(60)).max(30)
    ),
    dvSafe: flag,
    dvSafeNote: optionalText(1000),
    petFriendly: flag,
    accessibleUnit: flag,
    flexibleLease: flag,
    availableFrom: optionalDate,
    minLeaseTerm: optionalCount(120),
  })
  .superRefine((row, ctx) => {
    if (row.dvSafe && !row.dvSafeNote) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dvSafeNote'], message: 'says in a sentence why the place is safe for a woman leaving violence' });
    }
  });

export type StaffListingInput = z.infer<typeof staffListingSchema>;

/**
 * What a listing staff enter is written as. A confidential listing (DV-safe,
 * emergency or transitional) staff have checked goes live checked; one they have
 * not is held in the queue like a member's, with its clock started; anything
 * else is live at once.
 */
export function staffListingData(
  input: StaffListingInput,
  listerId: string,
  check: { safetyVerified: boolean; now?: Date }
): Prisma.HousingListingUncheckedCreateInput {
  const now = check.now ?? new Date();
  const confidential = isConfidentialListing(input);
  const checked = confidential && check.safetyVerified;
  // A partner's sheet cannot write one of the internal tags, the take-down
  // among them, into a listing it is creating.
  const given = publicFeatures(input.features);
  const features = confidential
    ? checked
      ? withCheckedNote(given, input.dvSafeNote ?? '')
      : withSafetyCheckRequest(given, input.dvSafeNote ?? '', now)
    : given;
  return {
    agentId: listerId,
    title: input.title,
    description: input.description,
    type: input.type,
    address: input.address ?? null,
    suburb: input.suburb ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postcode: input.postcode ?? null,
    country: 'Australia',
    rentWeekly: input.rentWeekly ?? null,
    bondAmount: input.bondAmount ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    parking: input.parking ?? null,
    features,
    dvSafe: input.dvSafe,
    safetyVerified: checked,
    petFriendly: input.petFriendly,
    accessibleUnit: input.accessibleUnit,
    flexibleLease: input.flexibleLease,
    availableFrom: input.availableFrom ?? null,
    minLeaseTerm: input.minLeaseTerm ?? null,
    status: confidential && !checked ? 'PENDING' : 'ACTIVE',
  };
}

// ------------------------------------------------------------- spreadsheets

/** The columns a housing import understands, in the order the template lists them. */
export const HOUSING_CSV_COLUMNS = [
  'title',
  'description',
  'type',
  'address',
  'suburb',
  'city',
  'state',
  'postcode',
  'rentWeekly',
  'bondAmount',
  'bedrooms',
  'bathrooms',
  'parking',
  'features',
  'dvSafe',
  'dvSafeNote',
  'petFriendly',
  'accessibleUnit',
  'flexibleLease',
  'availableFrom',
  'minLeaseTerm',
] as const;

const REQUIRED_COLUMNS = ['title', 'description', 'type'] as const;

/** One import is one partner's stock, not a whole state's. */
export const MAX_IMPORT_ROWS = 200;

export interface HousingImportError {
  line: number;
  title: string | null;
  message: string;
}

export interface HousingImportPlan {
  columns: string[];
  rows: Array<{ line: number; input: StaffListingInput }>;
  errors: HousingImportError[];
}

/**
 * Read a partner's spreadsheet into listings, or say exactly what is wrong
 * with it. Nothing is written here; the route writes every row or none, so a
 * half-imported sheet never leaves staff guessing which places made it.
 */
export function planHousingImport(csv: string): HousingImportPlan {
  const plan: HousingImportPlan = { columns: [], rows: [], errors: [] };
  const parsed = parseCsv(csv);
  if (parsed.error) {
    plan.errors.push({ line: 1, title: null, message: parsed.error });
    return plan;
  }
  const [header, ...body] = parsed.records;
  if (!header) {
    plan.errors.push({ line: 1, title: null, message: 'The file is empty' });
    return plan;
  }

  const columns = header.cells.map((c) => c.trim());
  plan.columns = columns;
  const known: ReadonlySet<string> = new Set(HOUSING_CSV_COLUMNS);
  const unknown = columns.filter((c) => !known.has(c));
  if (unknown.length) {
    plan.errors.push({ line: header.line, title: null, message: `Not housing columns: ${unknown.join(', ')}. The columns are ${HOUSING_CSV_COLUMNS.join(', ')}.` });
  }
  const repeated = columns.filter((c, i) => columns.indexOf(c) !== i);
  if (repeated.length) plan.errors.push({ line: header.line, title: null, message: `A column appears twice: ${[...new Set(repeated)].join(', ')}` });
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) plan.errors.push({ line: header.line, title: null, message: `Required columns missing: ${missing.join(', ')}` });
  if (body.length === 0) plan.errors.push({ line: header.line, title: null, message: 'There are no rows under the header' });
  if (body.length > MAX_IMPORT_ROWS) {
    plan.errors.push({ line: header.line, title: null, message: `${body.length} rows is more than one import takes (${MAX_IMPORT_ROWS}); split the sheet` });
  }
  if (plan.errors.length) return plan;

  for (const record of body) {
    const raw: Record<string, string> = {};
    columns.forEach((c, i) => {
      raw[c] = record.cells[i] ?? '';
    });
    const title = raw.title?.trim() || null;
    if (record.cells.length !== columns.length) {
      plan.errors.push({
        line: record.line,
        title,
        message: `${record.cells.length} cells where the header has ${columns.length}; a comma inside a cell needs the cell in double quotes`,
      });
      continue;
    }
    const result = staffListingSchema.safeParse(raw);
    if (!result.success) {
      const issue = result.error.issues[0];
      plan.errors.push({ line: record.line, title, message: `${issue.path.join('.') || 'row'} ${issue.message}` });
      continue;
    }
    plan.rows.push({ line: record.line, input: result.data });
  }
  return plan;
}
