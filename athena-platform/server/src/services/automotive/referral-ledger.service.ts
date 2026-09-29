/**
 * The referral ledger's money: what partners have actually paid ATHENA, as
 * against what ATHENA says they owe.
 *
 * A CarReferral used to move from PENDING to CONFIRMED to PAID by an admin
 * choosing a status in a dropdown. Nothing recorded a payment: no amount, no
 * date it arrived, no bank or Stripe reference, and nothing to compare with the
 * bank statement. The "paid" total on the admin page was therefore the sum of
 * clicks, a record of ATHENA's claims rather than of its revenue, and it would
 * have drifted from the bank account the moment there were more than a handful.
 *
 * Now a fee is paid when money is recorded against it, and only then:
 *
 * - A payment is recorded with its amount, the day it arrived, how it came
 *   (bank transfer, Stripe, cheque) and the reference that identifies it on
 *   ATHENA's statement or in Stripe. A Stripe payment is checked with Stripe
 *   when it is recorded; a bank payment is matched later against the bank
 *   statement the team exports from the bank (planReconciliation below).
 * - The status follows the money. A fee becomes PAID when its recorded
 *   payments cover it, drops back to CONFIRMED if one of them is reversed, and
 *   a partner's payment against a fee nobody has confirmed yet confirms it.
 *   Nobody can set PAID by hand any more.
 * - A payment entered in error is reversed with a reason, never deleted, so
 *   the ledger reads the same tomorrow as it did the day it was written.
 * - The totals the admin page shows are sums of recorded payments. A fee that
 *   was marked PAID by the old dropdown, with no payment behind it, is shown as
 *   exactly that, and not counted as money in.
 *
 * Where the entries live. There is no payment table for referrals, and this
 * code cannot add one. Each entry is an AuditLog row instead — the same
 * staff-action rows the automotive router already writes for every admin
 * change, under ADMIN_CONTENT_UPDATE with the verb in metadata.adminAction —
 * written in the same transaction as the change to the referral it moves. That
 * is a better fit than it sounds: the audit trail is append-only, it is kept for
 * seven years (gdpr.service detaches the member link and keeps the row), and it
 * already records who did what and when, which is the other half of what the
 * ledger was missing. Everything that reads or writes an entry goes through this
 * module and the routes that call it, so moving the entries to a table of their
 * own later changes those two places and nothing else.
 */

import { z } from 'zod';
import { ApiError } from '../../middleware/errorHandler';
import { getStripe, isStripeConfigured } from '../../utils/stripe';
import { csvCell, parseCsv } from './catalogue-admin.service';
import type { ReferralStatus } from './referrals.service';

// ---------------------------------------------------------------- recording

export const PAYMENT_METHODS = ['BANK_TRANSFER', 'STRIPE', 'CHEQUE', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** What each method is called, and what its reference is, in the words the admin form uses. */
export const PAYMENT_METHOD_WORDS: Record<PaymentMethod, { label: string; reference: string }> = {
  BANK_TRANSFER: { label: 'Bank transfer', reference: 'The reference or description on ATHENA\'s bank statement line' },
  STRIPE: { label: 'Stripe', reference: 'The Stripe payment, charge or invoice id: pi_, ch_, py_ or in_ and the rest of it' },
  CHEQUE: { label: 'Cheque', reference: 'The cheque number' },
  OTHER: { label: 'Other', reference: 'Whatever identifies the payment on ATHENA\'s statement' },
};

/** The ids Stripe gives a payment ATHENA can look up: a PaymentIntent, a Charge (ch_ or py_) or an Invoice. */
export const STRIPE_PAYMENT_ID = /^(pi|ch|py|in)_[A-Za-z0-9]{8,}$/;

/**
 * Today where ATHENA is. Queensland keeps no daylight saving, so it is UTC+10
 * all year, and a payment that arrived this morning in Brisbane is not "in the
 * future" just because it is still yesterday in UTC.
 */
export function brisbaneDay(now = new Date()): string {
  return new Date(now.getTime() + 10 * 3_600_000).toISOString().slice(0, 10);
}

/** The start of a Brisbane day, for the one column (CarReferral.paidAt) that holds a timestamp. */
export const brisbaneMidnight = (day: string): Date => new Date(`${day}T00:00:00+10:00`);

const realDay = (s: string): boolean => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** Dollars as whole cents. Every sum on the ledger is taken in cents, so no total is ever off by a fraction of one. */
export const toCents = (dollars: number): number => Math.round(dollars * 100);
const toDollars = (cents: number): number => cents / 100;

/** A reference as it is compared: upper case, letters and digits only, so "INV-0042" on the form finds "inv 0042" on the bank line. */
export const referenceKey = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function receiptSchema(now = new Date()) {
  return z.object({
    amount: z.coerce.number({ invalid_type_error: 'the amount received, in dollars' }).positive('more than nothing').max(5_000_000)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'dollars and cents, no finer'),
    receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'the day it arrived, as YYYY-MM-DD').refine(realDay, 'a real day')
      .refine((d) => d >= '2020-01-01', 'a day since 2020').refine((d) => d <= brisbaneDay(now), 'a day that has already happened'),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().min(3, 'the reference on the statement or in Stripe').max(120),
    note: z.string().trim().max(500).optional(),
  }).superRefine((v, ctx) => {
    if (v.method === 'STRIPE' && !STRIPE_PAYMENT_ID.test(v.reference)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reference'], message: PAYMENT_METHOD_WORDS.STRIPE.reference });
    }
  });
}

export const reversalSchema = z.object({ reason: z.string().trim().min(5, 'say why it is being reversed').max(500) });

// ------------------------------------------------------------------ reading

export type StripeObject = 'payment_intent' | 'charge' | 'invoice';
export type StripeChecked = { checked: true; object: StripeObject; id: string; amountCents: number; currency: string; status: string; paid: boolean };
export type StripeRecord = { checked: false; reason: string } | StripeChecked;
export type BankLineRecord = { date: string; amountCents: number; description: string };
export type Person = { id: string | null; name: string | null };

export type Receipt = {
  paymentId: string;
  referralId: string;
  amountCents: number;
  receivedOn: string;
  method: PaymentMethod;
  reference: string;
  referenceKey: string;
  note: string | null;
  recordedAt: Date;
  recordedBy: Person;
  stripe: StripeRecord | null;
  reversal: { at: Date; by: Person; reason: string } | null;
  reconciliation: { at: Date; by: Person; reconciliationId: string; statement: string | null; bankLine: BankLineRecord | null; stripe: StripeChecked | null } | null;
};

export type Confirmation = { at: Date; by: Person; how: 'ADMIN' | 'PAYMENT' };

export type Ledger = {
  receipts: Map<string, Receipt[]>;
  byPayment: Map<string, Receipt>;
  confirmations: Map<string, Confirmation>;
  /** Entries that name a payment but could not be read. Only this module writes them, so this should always be 0; if it is not, the page says so. */
  unreadable: number;
};

export type LedgerAuditRow = {
  createdAt: Date;
  actorUserId: string | null;
  metadata: unknown;
  actorUser?: { firstName: string | null; lastName: string | null; displayName: string | null } | null;
};

export const LEDGER_VERBS = { recorded: 'CAR_REFERRAL_PAYMENT_RECORDED', reversed: 'CAR_REFERRAL_PAYMENT_REVERSED', reconciled: 'CAR_REFERRAL_PAYMENT_RECONCILED' } as const;

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const cents = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);

function personOf(row: LedgerAuditRow): Person {
  const u = row.actorUser;
  const name = u ? (u.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || null) : null;
  return { id: row.actorUserId, name };
}

function stripeOf(v: unknown): StripeRecord | null {
  if (!isObject(v)) return null;
  if (v.checked === false) return { checked: false, reason: str(v.reason) ?? 'Not checked with Stripe' };
  const object = str(v.object);
  const id = str(v.id);
  const amountCents = cents(v.amountCents);
  if (v.checked !== true || !object || !['payment_intent', 'charge', 'invoice'].includes(object) || !id || amountCents === null) return null;
  return { checked: true, object: object as StripeObject, id, amountCents, currency: str(v.currency) ?? '', status: str(v.status) ?? '', paid: v.paid === true };
}

function bankLineOf(v: unknown): BankLineRecord | null {
  if (!isObject(v)) return null;
  const date = str(v.date);
  const amountCents = cents(v.amountCents);
  if (!date || amountCents === null) return null;
  return { date, amountCents, description: str(v.description) ?? '' };
}

/**
 * The ledger from its audit rows, in any order. Rows are sorted oldest first
 * here, so a reversal always lands on a payment recorded before it and the
 * newest confirmation is the one kept. A row about something else — a fee
 * rewritten, a listing taken down — is passed over.
 */
export function readLedger(rows: LedgerAuditRow[]): Ledger {
  const ledger: Ledger = { receipts: new Map(), byPayment: new Map(), confirmations: new Map(), unreadable: 0 };
  const about = rows.filter((row) => isObject(row.metadata) && row.metadata.resourceType === 'CarReferral' && typeof row.metadata.resourceId === 'string');
  for (const row of about.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const m = row.metadata as Record<string, unknown>;
    const referralId = m.resourceId as string;
    const by = personOf(row);
    const verb = m.adminAction;

    if (verb === LEDGER_VERBS.recorded) {
      const paymentId = str(m.paymentId);
      const amountCents = cents(m.amountCents);
      const receivedOn = str(m.receivedOn);
      const method = str(m.method);
      const reference = str(m.reference);
      if (!paymentId || amountCents === null || amountCents <= 0 || !receivedOn || !method || !(PAYMENT_METHODS as readonly string[]).includes(method) || !reference) { ledger.unreadable += 1; continue; }
      // The same payment written twice would be counted twice; the first one stands.
      if (ledger.byPayment.has(paymentId)) continue;
      const receipt: Receipt = {
        paymentId, referralId, amountCents, receivedOn, method: method as PaymentMethod, reference, referenceKey: referenceKey(reference), note: str(m.note),
        recordedAt: row.createdAt, recordedBy: by, stripe: stripeOf(m.stripe), reversal: null, reconciliation: null,
      };
      ledger.byPayment.set(paymentId, receipt);
      ledger.receipts.set(referralId, [...(ledger.receipts.get(referralId) ?? []), receipt]);
      if (m.confirmedByPayment === true) ledger.confirmations.set(referralId, { at: row.createdAt, by, how: 'PAYMENT' });
      continue;
    }

    if (verb === LEDGER_VERBS.reversed || verb === LEDGER_VERBS.reconciled) {
      const receipt = ledger.byPayment.get(str(m.paymentId) ?? '');
      if (!receipt || receipt.referralId !== referralId) { ledger.unreadable += 1; continue; }
      if (verb === LEDGER_VERBS.reversed) {
        if (!receipt.reversal) receipt.reversal = { at: row.createdAt, by, reason: str(m.reason) ?? '' };
      } else if (!receipt.reconciliation) {
        const stripe = stripeOf(m.stripe);
        receipt.reconciliation = { at: row.createdAt, by, reconciliationId: str(m.reconciliationId) ?? '', statement: str(m.statement), bankLine: bankLineOf(m.bankLine), stripe: stripe && stripe.checked ? stripe : null };
      }
      continue;
    }

    // Who confirmed a fee with the partner: an admin moving it to CONFIRMED,
    // or adding it already confirmed. Rows written before the ledger kept
    // payments carry the same shape, so older confirmations are found too.
    const status = m.status;
    const toConfirmed = (verb === 'CAR_REFERRAL_UPDATED' && isObject(status) && status.to === 'CONFIRMED') || (verb === 'CAR_REFERRAL_CREATED' && status === 'CONFIRMED');
    if (toConfirmed) ledger.confirmations.set(referralId, { at: row.createdAt, by, how: 'ADMIN' });
  }
  return ledger;
}

export const liveReceipts = (receipts: Receipt[]): Receipt[] => receipts.filter((r) => !r.reversal);

/** Checked against something outside ATHENA: a line on the bank statement, or Stripe's own record of the payment. */
export const isReconciled = (r: Receipt): boolean => Boolean(r.reconciliation) || r.stripe?.checked === true;

// ---------------------------------------------------------------- positions

export type PayState = 'UNPAID' | 'PART_PAID' | 'PAID' | 'OVERPAID';

export type LedgerPosition = {
  feeCents: number;
  receivedCents: number;
  outstandingCents: number;
  overpaidCents: number;
  reconciledCents: number;
  state: PayState;
  /** The day the payments first covered the fee, in the order the money arrived. */
  paidOn: string | null;
};

const byArrival = (a: Receipt, b: Receipt) => a.receivedOn.localeCompare(b.receivedOn) || a.recordedAt.getTime() - b.recordedAt.getTime();

/** Where one fee stands against the payments recorded for it. The fee is whole dollars, as CarReferral holds it. */
export function ledgerPosition(fee: number, receipts: Receipt[]): LedgerPosition {
  const feeCents = Math.max(0, Math.round(fee)) * 100;
  const live = liveReceipts(receipts).sort(byArrival);
  const receivedCents = live.reduce((s, r) => s + r.amountCents, 0);
  let running = 0;
  let paidOn: string | null = null;
  if (feeCents > 0) {
    for (const r of live) {
      running += r.amountCents;
      if (running >= feeCents) { paidOn = r.receivedOn; break; }
    }
  }
  const state: PayState = receivedCents === 0 ? 'UNPAID' : receivedCents < feeCents ? 'PART_PAID' : receivedCents === feeCents ? 'PAID' : 'OVERPAID';
  return {
    feeCents, receivedCents, outstandingCents: Math.max(0, feeCents - receivedCents), overpaidCents: Math.max(0, receivedCents - feeCents),
    reconciledCents: live.filter(isReconciled).reduce((s, r) => s + r.amountCents, 0), state, paidOn,
  };
}

/**
 * The status the money says a fee has.
 *
 * A void fee stays void; money against one is raised, not hidden (see
 * ledgerAttention). A fee nobody has ever recorded a payment against keeps
 * whatever an admin set, which is how a fee marked PAID by the old dropdown
 * keeps its status while being shown as having no payment behind it. A fee
 * that was paid by payments and has had every one of them reversed is owed
 * again. Otherwise it is PAID when the live payments cover it and CONFIRMED
 * when they do not — a partner paying is the firmest confirmation there is.
 */
export function statusAfterPayments(current: ReferralStatus, fee: number, receipts: Receipt[]): ReferralStatus {
  if (current === 'VOID' || receipts.length === 0) return current;
  if (liveReceipts(receipts).length === 0) return current === 'PAID' ? 'CONFIRMED' : current;
  const p = ledgerPosition(fee, receipts);
  return p.feeCents > 0 && p.receivedCents >= p.feeCents ? 'PAID' : 'CONFIRMED';
}

/** The CarReferral columns that follow the payments: status, when it was confirmed, and the day it was paid. */
export function referralColumnsAfter(current: { status: ReferralStatus; fee: number; confirmedAt: Date | null }, receipts: Receipt[], now = new Date()): { status: ReferralStatus; confirmedAt: Date | null; paidAt: Date | null } {
  const status = statusAfterPayments(current.status, current.fee, receipts);
  const p = ledgerPosition(current.fee, receipts);
  return {
    status,
    confirmedAt: current.confirmedAt ?? (status === 'CONFIRMED' || status === 'PAID' ? now : null),
    paidAt: status === 'PAID' && p.paidOn ? brisbaneMidnight(p.paidOn) : null,
  };
}

export type LedgerAttention = { referralId: string; key: 'MARKED_PAID_NO_PAYMENT' | 'MONEY_ON_VOID' | 'OVERPAID' | 'STRIPE_UNCHECKED'; words: string };

type ReferralLike = { id: string; status: string; fee: number; partner?: string | null; paidAt?: Date | null };

/** Cents as a dollar figure for a sentence: $180, or $180.50 when there are cents. */
export const dollarWords = (c: number): string => `$${toDollars(c).toLocaleString('en-AU', { minimumFractionDigits: c % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

/** What a person needs to look at on one fee, most pressing first. */
export function ledgerAttention(r: ReferralLike, receipts: Receipt[]): LedgerAttention[] {
  const out: LedgerAttention[] = [];
  const p = ledgerPosition(r.fee, receipts);
  const who = r.partner ? ` from ${r.partner}` : '';
  if (r.status === 'VOID' && p.receivedCents > 0) out.push({ referralId: r.id, key: 'MONEY_ON_VOID', words: `${dollarWords(p.receivedCents)} is recorded as received${who} against a fee that is void. Either the fee was real and should be restored, or the money has to go back.` });
  if (r.status === 'PAID' && p.receivedCents === 0) out.push({ referralId: r.id, key: 'MARKED_PAID_NO_PAYMENT', words: `Marked paid${r.paidAt ? ` on ${r.paidAt.toISOString().slice(0, 10)}` : ''} before payments were recorded, and no payment is on file. Find it on the statement and record it; until then it is not counted as money in.` });
  if (r.status !== 'VOID' && p.overpaidCents > 0) out.push({ referralId: r.id, key: 'OVERPAID', words: `${dollarWords(p.overpaidCents)} more than the fee has been recorded${who}. Check the fee, or whether a payment was recorded twice.` });
  const unchecked = liveReceipts(receipts).filter((x) => x.method === 'STRIPE' && x.stripe?.checked !== true && !x.reconciliation);
  if (unchecked.length) out.push({ referralId: r.id, key: 'STRIPE_UNCHECKED', words: `${unchecked.length === 1 ? 'A Stripe payment has' : `${unchecked.length} Stripe payments have`} not been checked with Stripe yet.` });
  return out;
}

// ------------------------------------------------------------------- totals

export type LedgerTotals = {
  /** Fees waiting to be confirmed with the partner, in dollars. */
  pending: number;
  /** Confirmed and still owed: each confirmed fee less what has been paid against it. */
  confirmed: number;
  /** Money recorded as received, whatever the fee's status, less anything reversed. */
  paid: number;
  reconciled: number;
  unreconciled: number;
  overpaid: number;
  /** Received against fees that are void: a refund owed, or a fee to restore. */
  heldOnVoid: number;
  partPaid: number;
  /** Fees the old dropdown marked PAID with no payment recorded; not counted in `paid`. */
  markedPaidUnrecorded: { count: number; fee: number };
  byKind: Record<string, { count: number; fee: number; paid: number }>;
  unreadable: number;
};

/** The ledger's totals, summed in cents and handed back in dollars, over every fee whatever its status. */
export function summariseLedger(rows: Array<{ id: string; kind: string; status: string; fee: number }>, ledger: Ledger): LedgerTotals {
  let pending = 0; let confirmed = 0; let paid = 0; let reconciled = 0; let overpaid = 0; let heldOnVoid = 0; let partPaid = 0;
  const markedPaidUnrecorded = { count: 0, fee: 0 };
  const kinds = new Map<string, { count: number; fee: number; paidCents: number }>();
  for (const r of rows) {
    const p = ledgerPosition(r.fee, ledger.receipts.get(r.id) ?? []);
    paid += p.receivedCents;
    reconciled += p.reconciledCents;
    if (r.status === 'VOID') { heldOnVoid += p.receivedCents; continue; }
    overpaid += p.overpaidCents;
    if (r.status === 'PENDING') pending += p.feeCents;
    if (r.status === 'CONFIRMED') {
      confirmed += p.outstandingCents;
      if (p.receivedCents > 0) partPaid += 1;
    }
    if (r.status === 'PAID' && p.receivedCents === 0) {
      markedPaidUnrecorded.count += 1;
      markedPaidUnrecorded.fee += r.fee;
    }
    const k = kinds.get(r.kind) ?? { count: 0, fee: 0, paidCents: 0 };
    k.count += 1;
    k.fee += r.fee;
    k.paidCents += p.receivedCents;
    kinds.set(r.kind, k);
  }
  const byKind: LedgerTotals['byKind'] = {};
  for (const [kind, k] of kinds) byKind[kind] = { count: k.count, fee: k.fee, paid: toDollars(k.paidCents) };
  return {
    pending: toDollars(pending), confirmed: toDollars(confirmed), paid: toDollars(paid), reconciled: toDollars(reconciled), unreconciled: toDollars(paid - reconciled),
    overpaid: toDollars(overpaid), heldOnVoid: toDollars(heldOnVoid), partPaid, markedPaidUnrecorded, byKind, unreadable: ledger.unreadable,
  };
}

// ------------------------------------------------------------------- stripe

/**
 * What Stripe says about a payment, read and never changed.
 *
 * With no key configured the payment is recorded as not checked, and the page
 * says so beside it; with a key, an id Stripe does not know is refused, and a
 * Stripe that cannot be reached refuses the whole request rather than letting
 * a payment be recorded as checked when it was not.
 */
export async function checkStripePayment(id: string): Promise<StripeRecord> {
  if (!isStripeConfigured()) return { checked: false, reason: 'No Stripe key is configured on this server, so the payment was not checked with Stripe' };
  const stripe = getStripe();
  try {
    if (id.startsWith('pi_')) {
      const pi = await stripe.paymentIntents.retrieve(id);
      return { checked: true, object: 'payment_intent', id, amountCents: pi.amount_received, currency: pi.currency, status: pi.status, paid: pi.status === 'succeeded' };
    }
    if (id.startsWith('in_')) {
      const inv = await stripe.invoices.retrieve(id);
      return { checked: true, object: 'invoice', id, amountCents: inv.amount_paid, currency: inv.currency, status: inv.status ?? 'unknown', paid: inv.status === 'paid' };
    }
    const ch = await stripe.charges.retrieve(id);
    return { checked: true, object: 'charge', id, amountCents: ch.amount_captured - ch.amount_refunded, currency: ch.currency, status: ch.refunded ? 'refunded' : ch.status, paid: ch.paid && ch.status === 'succeeded' && !ch.refunded };
  } catch (error) {
    const e = error as { code?: string; statusCode?: number };
    if (e.code === 'resource_missing' || e.statusCode === 404) throw new ApiError(400, `Stripe has no payment ${id} on ATHENA's account. Check the id, and that it is from ATHENA's own Stripe account.`);
    // 503 rather than 502 because it is the one 5xx the error handler passes
    // through in our own words: the admin needs to know nothing was written.
    throw new ApiError(503, 'Stripe could not be reached to check this payment, so nothing was recorded. Try again in a minute.');
  }
}

/**
 * Whether a Stripe payment can carry another amount recorded against it.
 * One Stripe payment may settle several fees (a partner paying a statement),
 * so the rule is on the sum: what is recorded against the id, this payment
 * included, cannot be more than Stripe says arrived.
 */
export function stripeProblem(check: StripeChecked, alreadyCents: number, amountCents: number): string | null {
  if (!check.paid) return `Stripe says ${check.id} is ${check.status.replace(/_/g, ' ')}, not paid, so it cannot be recorded as money in.`;
  if (check.currency.toLowerCase() !== 'aud') return `${check.id} was paid in ${check.currency.toUpperCase()}; the ledger is in Australian dollars.`;
  if (alreadyCents + amountCents > check.amountCents) {
    return `Stripe received ${dollarWords(check.amountCents)} for ${check.id}${alreadyCents ? `, and ${dollarWords(alreadyCents)} of it is already recorded against other fees` : ''}, so no more than ${dollarWords(Math.max(0, check.amountCents - alreadyCents))} can be recorded against it.`;
  }
  return null;
}

/** What is already recorded, and not reversed, against one reference across the whole ledger. */
export function recordedAgainst(ledger: Ledger, key: string, except?: string): number {
  let sum = 0;
  for (const r of ledger.byPayment.values()) if (!r.reversal && r.referenceKey === key && r.paymentId !== except) sum += r.amountCents;
  return sum;
}

// --------------------------------------------------------- bank statements

export type BankLine = { line: number; date: string; amountCents: number; description: string };
export type ColumnMap = { date: number; amount: number | null; credit: number | null; description: number[] };
export type StatementProblem = { line: number; message: string };
export type StatementRead = { lines: BankLine[]; header: string[] | null; map: ColumnMap | null; columns: number; sample: string[][]; skipped: number; errors: StatementProblem[] };

export const columnMapSchema = z.object({
  date: z.number().int().min(0).max(50),
  amount: z.number().int().min(0).max(50).nullable(),
  credit: z.number().int().min(0).max(50).nullable(),
  description: z.array(z.number().int().min(0).max(50)).min(1).max(4),
}).refine((m) => (m.amount === null) !== (m.credit === null), 'choose the amount column or the credit column, not both');

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * A date as Australian banks write them in an export: 03/10/2026 (day
 * first, never month first), 3-10-26, 2026-10-03 and 03 Oct 2026. Answers the
 * ISO day, or null for anything else.
 */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim();
  let y: number; let m: number; let d: number;
  let hit = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (hit) { [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])]; }
  else if ((hit = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) { [d, m, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])]; }
  else if ((hit = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]+(\d{2}|\d{4})$/.exec(s))) {
    const word = hit[2].toLowerCase();
    const month = MONTHS[word.slice(0, 3)];
    // "Oct", "October" and "Sept" are months; "Octopus" is not.
    if (!month || !(word.length === 3 || word === 'sept' || MONTH_NAMES.includes(word))) return null;
    [d, m, y] = [Number(hit[1]), month, Number(hit[3])];
  } else return null;
  if (y < 100) y += 2000;
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return realDay(iso) ? iso : null;
}

/** An amount as a bank writes it: $1,234.56, -12.00, (12.00), 12.00 CR, +500. Answers cents, or null. */
export function parseBankAmount(raw: string): number | null {
  let s = raw.trim().replace(/aud/gi, '').replace(/[$,\s]/g, '');
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (/cr$/i.test(s)) s = s.slice(0, -2);
  else if (/dr$/i.test(s)) { sign = -sign; s = s.slice(0, -2); }
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(s)) return null;
  return sign * Math.round(Number(s) * 100);
}

const HEADER_WORDS = {
  date: ['date', 'transaction date', 'posted date', 'posting date', 'effective date', 'value date', 'date posted'],
  amount: ['amount', 'transaction amount', 'amount (aud)', 'amount aud', 'value'],
  credit: ['credit', 'credit amount', 'credits', 'deposit', 'deposits', 'money in', 'paid in'],
  description: ['description', 'narrative', 'transaction details', 'details', 'reference', 'particulars', 'memo', 'transaction description', 'payee', 'merchant name', 'transaction type'],
};

/** The columns a statement's header names, when it has one a bank would write. */
export function detectColumns(header: string[]): ColumnMap | null {
  const names = header.map((h) => h.trim().toLowerCase());
  const find = (words: string[]) => names.findIndex((n) => words.includes(n));
  const date = find(HEADER_WORDS.date);
  const amount = find(HEADER_WORDS.amount);
  const credit = find(HEADER_WORDS.credit);
  const description = names.map((n, i) => (HEADER_WORDS.description.includes(n) ? i : -1)).filter((i) => i >= 0).slice(0, 4);
  if (date < 0 || (amount < 0 && credit < 0) || description.length === 0) return null;
  return { date, amount: amount >= 0 ? amount : null, credit: amount >= 0 ? null : credit, description };
}

/** The most lines one statement may carry: a year of a business account, with room. */
export const MAX_STATEMENT_LINES = 20_000;

/**
 * A bank statement exported as CSV, read into credit lines. A header the
 * bank writes is recognised; a headerless export (CommBank and ANZ write
 * date, amount, description) is recognised by its first row; anything else
 * comes back with a sample and no map, so the admin can say which column is
 * which. Debits are dropped: money going out is not a partner paying.
 */
export function readStatement(csv: string, given?: ColumnMap | null): StatementRead {
  const read: StatementRead = { lines: [], header: null, map: null, columns: 0, sample: [], skipped: 0, errors: [] };
  const parsed = parseCsv(csv);
  if (parsed.error) { read.errors.push({ line: 1, message: parsed.error }); return read; }
  const records = parsed.records;
  if (!records.length) { read.errors.push({ line: 1, message: 'The file is empty' }); return read; }
  read.columns = Math.max(...records.map((r) => r.cells.length));
  read.sample = records.slice(0, 6).map((r) => r.cells);
  if (records.length > MAX_STATEMENT_LINES) { read.errors.push({ line: 1, message: `${records.length} lines is more than one statement takes (${MAX_STATEMENT_LINES}); export a shorter period` }); return read; }

  let body = records;
  const detected = detectColumns(records[0].cells);
  if (detected || records[0].cells.every((c) => parseBankDate(c) === null && parseBankAmount(c) === null)) {
    read.header = records[0].cells;
    body = records.slice(1);
  }
  let map = given ?? detected;
  if (!map && !read.header && parseBankDate(records[0].cells[0] ?? '') && parseBankAmount(records[0].cells[1] ?? '') !== null && records[0].cells.length >= 3) {
    map = { date: 0, amount: 1, credit: null, description: [2] };
  }
  if (!map) return read;
  const outside = [map.date, map.amount, map.credit, ...map.description].filter((i): i is number => i !== null && i >= read.columns);
  if (outside.length) { read.errors.push({ line: 1, message: `The file has ${read.columns} columns; column ${outside[0] + 1} is not one of them` }); return read; }
  read.map = map;

  for (const record of body) {
    const cell = (i: number | null) => (i === null ? '' : record.cells[i] ?? '');
    const date = parseBankDate(cell(map.date));
    // A line with no date is a heading, a subtotal or the closing balance the
    // bank adds to the export, not a transaction.
    if (!date) { read.skipped += 1; continue; }
    const rawAmount = map.amount !== null ? cell(map.amount) : cell(map.credit);
    if (map.credit !== null && rawAmount.trim() === '') continue;
    const amountCents = parseBankAmount(rawAmount);
    if (amountCents === null) { read.errors.push({ line: record.line, message: `"${rawAmount}" is not an amount` }); continue; }
    if (amountCents <= 0) continue;
    read.lines.push({ line: record.line, date, amountCents, description: map.description.map((i) => cell(i).trim()).filter(Boolean).join(' ') });
  }
  return read;
}

export type MatchedReceipt = { paymentId: string; referralId: string; amountCents: number; reference: string; receivedOn: string };
export type LineMatch = BankLine & { receipts: MatchedReceipt[] };
export type ReconcilePlan = {
  from: string | null;
  to: string | null;
  credits: number;
  matches: LineMatch[];
  suggestions: LineMatch[];
  ambiguous: BankLine[];
  alreadyReconciled: BankLine[];
  unmatchedCredits: BankLine[];
  unmatchedReceipts: MatchedReceipt[];
};

/**
 * How far apart the day on the bank line and the day recorded on the payment
 * may be. They are usually the same day — the admin reads it off the
 * statement — but a transfer made on a Friday can be dated Monday, and a
 * public holiday can add a day.
 */
export const RECONCILE_TOLERANCE_DAYS = 5;

const dayNumber = (iso: string) => Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000);
const matched = (r: Receipt): MatchedReceipt => ({ paymentId: r.paymentId, referralId: r.referralId, amountCents: r.amountCents, reference: r.reference, receivedOn: r.receivedOn });
const sameLine = (a: BankLineRecord, b: BankLine) => a.date === b.date && a.amountCents === b.amountCents && referenceKey(a.description) === referenceKey(b.description);

/**
 * Which recorded payments each credit on the statement is.
 *
 * A match needs the payment's reference to appear on the bank line, the
 * amount to agree and the days to be within the tolerance. One transfer may
 * settle several fees under one reference, so the payments sharing a
 * reference are taken together when their sum is the line's amount. A line
 * two groups could explain is left alone as ambiguous; a person decides.
 *
 * What is left over goes to the admin in three lists. A credit whose amount
 * and day fit exactly one payment, with no reference to tie them, is a
 * suggestion she can accept. A credit that fits nothing is money in that is
 * not on the ledger — a partner paying without a fee recorded, or income that
 * is not a referral at all. And a payment recorded as received inside the
 * statement's dates with no line to show for it is the one that matters most:
 * the ledger says the money arrived and the bank does not.
 *
 * Stripe payments are not matched here. Stripe pays out in batches net of its
 * fees, so no one bank line is one Stripe payment; those are checked with
 * Stripe instead.
 */
export function planReconciliation(lines: BankLine[], receipts: Receipt[]): ReconcilePlan {
  const credits = lines.filter((l) => l.amountCents > 0).sort((a, b) => a.date.localeCompare(b.date) || a.line - b.line);
  const plan: ReconcilePlan = { from: credits[0]?.date ?? null, to: credits[credits.length - 1]?.date ?? null, credits: credits.length, matches: [], suggestions: [], ambiguous: [], alreadyReconciled: [], unmatchedCredits: [], unmatchedReceipts: [] };
  const live = liveReceipts(receipts);
  const done = live.filter((r) => r.reconciliation?.bankLine);
  const open = live.filter((r) => !r.reconciliation && r.method !== 'STRIPE');
  const taken = new Set<string>();
  const near = (line: BankLine) => open.filter((r) => !taken.has(r.paymentId) && Math.abs(dayNumber(r.receivedOn) - dayNumber(line.date)) <= RECONCILE_TOLERANCE_DAYS);
  const sum = (rs: Receipt[]) => rs.reduce((s, r) => s + r.amountCents, 0);

  const left: BankLine[] = [];
  for (const line of credits) {
    if (done.some((r) => r.reconciliation?.bankLine && sameLine(r.reconciliation.bankLine, line))) { plan.alreadyReconciled.push(line); continue; }
    const desc = referenceKey(line.description);
    const groups = new Map<string, Receipt[]>();
    for (const r of near(line)) if (r.referenceKey.length >= 4 && desc.includes(r.referenceKey)) groups.set(r.referenceKey, [...(groups.get(r.referenceKey) ?? []), r]);
    const fits: Receipt[][] = [];
    for (const group of groups.values()) {
      if (sum(group) === line.amountCents) fits.push(group);
      else {
        const single = group.filter((r) => r.amountCents === line.amountCents);
        if (single.length === 1) fits.push(single);
      }
    }
    if (fits.length === 1) {
      fits[0].forEach((r) => taken.add(r.paymentId));
      plan.matches.push({ ...line, receipts: fits[0].map(matched) });
    } else if (fits.length > 1) plan.ambiguous.push(line);
    else left.push(line);
  }

  // Second pass, once every line with a reference has had its pick: amount
  // and day alone. A payment two lines could both be is offered to neither.
  const wanted = new Map<string, BankLine[]>();
  const candidate = new Map<number, Receipt>();
  for (const line of left) {
    const same = near(line).filter((r) => r.amountCents === line.amountCents);
    if (same.length === 1) {
      candidate.set(line.line, same[0]);
      wanted.set(same[0].paymentId, [...(wanted.get(same[0].paymentId) ?? []), line]);
    }
  }
  for (const line of left) {
    const r = candidate.get(line.line);
    if (r && (wanted.get(r.paymentId)?.length ?? 0) === 1) {
      taken.add(r.paymentId);
      plan.suggestions.push({ ...line, receipts: [matched(r)] });
    } else plan.unmatchedCredits.push(line);
  }

  if (plan.from && plan.to) {
    const from = plan.from;
    const to = plan.to;
    plan.unmatchedReceipts = open.filter((r) => !taken.has(r.paymentId) && r.receivedOn >= from && r.receivedOn <= to).map(matched);
  }
  return plan;
}

// ---------------------------------------------------------------------- CSV

export const RECEIPT_CSV_COLUMNS = ['receivedOn', 'amount', 'method', 'reference', 'kind', 'partner', 'fee', 'feeStatus', 'recordedAt', 'recordedBy', 'checkedWithStripe', 'reconciledOn', 'bankLine', 'reversedAt', 'reversalReason', 'note', 'paymentId', 'referralId'] as const;

export type ReceiptExportRow = Receipt & { kind: string; partner: string | null; fee: number; feeStatus: string };

/** Every payment ever recorded, reversals included, for the accountant and for checking against the bank by hand. */
export function receiptsToCsv(rows: ReceiptExportRow[]): string {
  const lines = [RECEIPT_CSV_COLUMNS.join(',')];
  for (const r of [...rows].sort(byArrival)) {
    const stripe = r.reconciliation?.stripe ?? (r.stripe?.checked ? r.stripe : null);
    const bank = r.reconciliation?.bankLine;
    lines.push([
      r.receivedOn, (r.amountCents / 100).toFixed(2), PAYMENT_METHOD_WORDS[r.method].label, r.reference, r.kind, r.partner ?? '', r.fee, r.feeStatus,
      r.recordedAt.toISOString(), r.recordedBy.name ?? r.recordedBy.id ?? '', stripe ? `yes, ${stripe.status}` : r.method === 'STRIPE' ? 'no' : '',
      r.reconciliation ? r.reconciliation.at.toISOString().slice(0, 10) : '', bank ? `${bank.date} ${(bank.amountCents / 100).toFixed(2)} ${bank.description}` : '',
      r.reversal ? r.reversal.at.toISOString() : '', r.reversal?.reason ?? '', r.note ?? '', r.paymentId, r.referralId,
    ].map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
