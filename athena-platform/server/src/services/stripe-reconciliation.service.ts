/**
 * ATHENA's money records, checked against Stripe's.
 *
 * Nothing ever compared the two. Every money path here writes to Stripe first
 * and to the database second, and each has learned, one incident at a time, to
 * repair its own row when it next touches it: a capture whose update failed is
 * fixed on the next release attempt, a lapsed hold is settled by the expiry
 * sweep, a creator payout whose transfer id was never stored is linked when the
 * webhook arrives. What none of them can do is notice a row that nobody touches
 * again — a webhook that never landed, a hold Stripe took with no row behind it,
 * a payment received with no Payment row and so no tax invoice, a membership
 * Stripe cancelled that ATHENA still treats as paid. Those were found, when
 * they were found at all, by the member they happened to.
 *
 * This runs every six hours and pages through what Stripe holds for the
 * window a hold can still be moving in, comparing it with EscrowPayment,
 * Payment, Invoice, CreatorPayout, Subscription and PaymentDispute. It sorts
 * what it finds in two:
 *
 *  - `repaired`: the row was simply behind Stripe, in a direction the webhook
 *    for that event would have moved it, and it has been moved. Nothing is
 *    decided here that a delivered webhook would not have decided.
 *  - `needs_attention`: the two disagree in a way that is a decision — money
 *    Stripe took with no row at all, a row saying money was returned that
 *    Stripe says was not, a membership whose status differs. Those are
 *    reported, with the ids a person needs, and left alone.
 *
 * The count needing attention is a gauge on /health/detailed, the admins are
 * told once a day while it is not zero, and the last report is kept for the
 * admin endpoint in payments.routes.ts.
 *
 * It never moves money. Every call to Stripe here is a read.
 */

import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { cacheGet, cacheSet, runExclusively } from '../utils/redis';
import { recordCondition, recordFailure, recordSuccess } from '../utils/ops-metrics';
import { bestEffort } from '../utils/best-effort';
import { FORMATION_PAYMENT_TYPE } from './formation.service';
import { ACCELERATOR_PAYMENT_TYPE } from './payments-orchestration.service';
import { createInvoiceForPayment } from './invoice.service';
import { settleCreatorPayout } from './creator.service';
import { minorUnitScale } from './stripe-connect.service';

/**
 * How far back each run looks. A card authorisation lives about seven days,
 * and a hold older than that has either been captured, been cancelled, or been
 * settled by the expiry sweep, so ten days covers every intent that can still
 * be moving with a margin for a sweep that was down.
 */
export const RECONCILE_LOOKBACK_DAYS = 10;

/**
 * How recent is too recent to judge. A row written a moment ago may be waiting
 * on a webhook that is on its way, and reporting it as missing would be a
 * false alarm every run.
 */
const SETTLE_MARGIN_MS = 60 * 60 * 1000;

/** Pages of 100 read from each Stripe list per run. A run that reaches it says so. */
const MAX_PAGES = 20;

/** Individual Stripe lookups per run, for the transfers checked one at a time. */
const MAX_SINGLE_LOOKUPS = 50;

/** Findings kept in the stored report. The counts are always complete. */
const MAX_FINDINGS_KEPT = 200;

/**
 * How far back disputes are read. A card dispute stays open for weeks and its
 * outcome arrives long after the charge, so it is looked at over a far longer
 * window than the payment intents it came from.
 */
export const DISPUTE_LOOKBACK_DAYS = 90;

/** One-off payments that should each have a Payment row, by the intent's metadata `type`. */
const PAYMENT_ROW_TYPES = new Set<string>([
  'gift_balance_purchase',
  'mentor_session',
  FORMATION_PAYMENT_TYPE,
  ACCELERATOR_PAYMENT_TYPE,
]);

const LAST_REPORT_KEY = 'stripe-reconciliation:last';

const ADMIN_TITLE = 'Payment records disagree with Stripe';

export type ReconciliationFindingKind =
  | 'ESCROW_ROW_MISSING'
  | 'ESCROW_ROW_BEHIND'
  | 'ESCROW_STATUS_CONFLICT'
  | 'PAYMENT_ROW_MISSING'
  | 'PAYMENT_ROW_BEHIND'
  | 'PAYMENT_STATUS_CONFLICT'
  | 'INVOICE_MISSING'
  | 'CREATOR_PAYOUT_UNSETTLED'
  | 'CREATOR_PAYOUT_REVERSED'
  | 'CREATOR_PAYOUT_NO_TRANSFER'
  | 'SUBSCRIPTION_STATUS_CONFLICT'
  | 'SUBSCRIPTION_MISSING_AT_STRIPE'
  | 'REFUND_AMOUNT_CONFLICT'
  | 'DISPUTE_MISSING'
  | 'DISPUTE_STATUS_CONFLICT';

export interface ReconciliationFinding {
  kind: ReconciliationFindingKind;
  outcome: 'repaired' | 'needs_attention';
  /** The Stripe object: a payment intent, transfer or subscription id. */
  stripeId: string | null;
  /** Our row, when there is one. */
  localId: string | null;
  detail: string;
}

export interface ReconciliationReport {
  ranAt: string;
  windowStart: string;
  windowEnd: string;
  checked: {
    paymentIntents: number;
    escrowRows: number;
    paymentRows: number;
    creatorPayouts: number;
    subscriptions: number;
    disputes: number;
  };
  repaired: number;
  needsAttention: number;
  findings: ReconciliationFinding[];
  /** Set when a Stripe list or the lookup quota was exhausted, so part of the window went unchecked. */
  incomplete: string[];
  /** Set, with nothing else, when there was no Stripe to compare against. */
  skipped?: string;
}

/** A Stripe list call, as the SDK exposes it, reduced to what paging needs. */
type ListPage<T> = { data: T[]; has_more: boolean };

/**
 * Reads a Stripe list to the end or to MAX_PAGES, whichever is first.
 * Returns whether it reached the end, so a truncated read is never mistaken
 * for "Stripe has nothing else".
 */
async function readAll<T extends { id: string }>(
  fetchPage: (startingAfter: string | undefined) => Promise<ListPage<T>>
): Promise<{ items: T[]; complete: boolean }> {
  const items: T[] = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await fetchPage(startingAfter);
    items.push(...result.data);
    if (!result.has_more || result.data.length === 0) return { items, complete: true };
    startingAfter = result.data[result.data.length - 1].id;
  }

  return { items, complete: false };
}

/** An amount in minor units as a person reads it, in the currency's own precision. */
function money(amount: number, currency: string): string {
  const scale = minorUnitScale(currency);
  const places = scale === 1 ? 0 : scale === 1000 ? 3 : 2;
  return `${(amount / scale).toFixed(places)} ${currency.toUpperCase()}`;
}

function metadataValue(metadata: Stripe.Metadata | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Whether the intent's charge has been refunded in full. `latest_charge` is expanded by the list call. */
function fullyRefunded(intent: Stripe.PaymentIntent): boolean {
  const charge = intent.latest_charge;
  return charge !== null && typeof charge === 'object' ? charge.refunded === true : false;
}

/**
 * How much of the charge Stripe says has been refunded so far, in minor units, or
 * null when the charge was not expanded or carries no figure. Cumulative, so it is
 * comparable with the figure the refund webhook keeps on our rows.
 */
function refundedCentsAtStripe(intent: Stripe.PaymentIntent): number | null {
  const charge = intent.latest_charge;
  if (charge === null || typeof charge !== 'object') return null;
  return typeof charge.amount_refunded === 'number' ? charge.amount_refunded : null;
}

/** What an escrow row should say for an intent in this state, or null when PENDING and FAILED are both fair. */
function expectedEscrowStatus(intent: Stripe.PaymentIntent): 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'CANCELED' | null {
  switch (intent.status) {
    case 'requires_capture':
      return 'AUTHORIZED';
    case 'succeeded':
      return fullyRefunded(intent) ? 'REFUNDED' : 'CAPTURED';
    case 'canceled':
      return 'CANCELED';
    default:
      return null;
  }
}

/**
 * Which moves of an escrow row are the row catching up with Stripe, in the
 * direction a delivered webhook would have taken it. Any other disagreement is
 * a conflict for a person.
 *
 * FAILED is on the left of AUTHORIZED and CAPTURED because a declined card can
 * be retried on the same intent: the payment_failed event marks the row FAILED
 * and the later success moves the money, so a FAILED row whose intent is now
 * held or captured is behind, not wrong.
 */
const CATCH_UP: Record<string, readonly string[]> = {
  AUTHORIZED: ['PENDING', 'FAILED'],
  CAPTURED: ['PENDING', 'AUTHORIZED', 'FAILED'],
  CANCELED: ['PENDING', 'AUTHORIZED', 'FAILED'],
  REFUNDED: ['PENDING', 'AUTHORIZED', 'CAPTURED'],
};

class Findings {
  readonly attention: ReconciliationFinding[] = [];
  readonly repaired: ReconciliationFinding[] = [];

  add(finding: ReconciliationFinding): void {
    (finding.outcome === 'repaired' ? this.repaired : this.attention).push(finding);
  }

  /**
   * What the stored report keeps: everything that needs a person first,
   * because that is what somebody opens the report to find, then the repairs,
   * up to MAX_FINDINGS_KEPT. The counts on the report are never capped.
   */
  kept(): ReconciliationFinding[] {
    return [...this.attention, ...this.repaired].slice(0, MAX_FINDINGS_KEPT);
  }
}

// ---------------------------------------------------------------------------
// Payment intents: escrow rows, Payment rows and their invoices
// ---------------------------------------------------------------------------

async function reconcileEscrowRows(
  intents: Stripe.PaymentIntent[],
  findings: Findings
): Promise<number> {
  // Every hold made by createEscrowPayment names both parties in its metadata,
  // which is what tells it apart from the other intents on the account.
  const escrowIntents = intents.filter(
    i => metadataValue(i.metadata, 'buyerId') && metadataValue(i.metadata, 'sellerId')
  );
  if (escrowIntents.length === 0) return 0;

  const rows = await prisma.escrowPayment.findMany({
    where: { paymentIntentId: { in: escrowIntents.map(i => i.id) } },
    select: { id: true, paymentIntentId: true, status: true, capturedAt: true, refundedAmount: true },
  });
  const byIntent = new Map(rows.map(r => [r.paymentIntentId, r]));

  for (const intent of escrowIntents) {
    const row = byIntent.get(intent.id);
    const expected = expectedEscrowStatus(intent);

    if (!row) {
      // A hold nothing here can see: no sweep will ever find it, and neither
      // party has a row to release or cancel it through. Only reported when
      // money is actually held or taken; an unpaid orphan holds nothing.
      if (intent.status === 'requires_capture' || intent.status === 'succeeded' || intent.status === 'processing') {
        findings.add({
          kind: 'ESCROW_ROW_MISSING',
          outcome: 'needs_attention',
          stripeId: intent.id,
          localId: null,
          detail: `Stripe ${intent.status === 'requires_capture' ? 'is holding' : 'has taken'} ${money(intent.amount, intent.currency)} for an escrow payment ATHENA has no row for (buyer ${metadataValue(intent.metadata, 'buyerId')}, seller ${metadataValue(intent.metadata, 'sellerId')}). Cancel or refund it in Stripe, or restore the row.`,
        });
      }
      continue;
    }

    // How much of the sale has gone back to the buyer. A part refund leaves the
    // row CAPTURED and records the figure beside it (the charge.refunded
    // webhook), so a row whose figure is behind Stripe's missed that event. Moved
    // up to Stripe's figure, in the one direction the webhook would have moved
    // it; a row that claims more than Stripe knows of is a conflict. A full
    // refund is the status check below.
    const stripeRefunded = refundedCentsAtStripe(intent);
    if (intent.status === 'succeeded' && expected !== 'REFUNDED' && stripeRefunded !== null) {
      const recorded = row.refundedAmount ?? 0;
      if (stripeRefunded > recorded) {
        const { count } = await prisma.escrowPayment.updateMany({
          where: { id: row.id, refundedAmount: { lt: stripeRefunded } },
          data: { refundedAmount: stripeRefunded },
        });
        if (count > 0) {
          findings.add({
            kind: 'REFUND_AMOUNT_CONFLICT',
            outcome: 'repaired',
            stripeId: intent.id,
            localId: row.id,
            detail: `Stripe has refunded ${money(stripeRefunded, intent.currency)} of this payment and the row said ${money(recorded, intent.currency)}; it now says what Stripe does.`,
          });
        }
      } else if (stripeRefunded < recorded) {
        findings.add({
          kind: 'REFUND_AMOUNT_CONFLICT',
          outcome: 'needs_attention',
          stripeId: intent.id,
          localId: row.id,
          detail: `ATHENA's row says ${money(recorded, intent.currency)} was refunded and Stripe says ${money(stripeRefunded, intent.currency)}. Decide which is right before the seller's statement is relied on.`,
        });
      }
    }

    if (expected === null) {
      // Nothing is held yet. PENDING and FAILED are both fair; a row that says
      // the money is held or has moved is not.
      if (row.status === 'AUTHORIZED' || row.status === 'CAPTURED') {
        findings.add({
          kind: 'ESCROW_STATUS_CONFLICT',
          outcome: 'needs_attention',
          stripeId: intent.id,
          localId: row.id,
          detail: `ATHENA's row says ${row.status} but Stripe says the payment is ${intent.status}: no money is held for it.`,
        });
      }
      continue;
    }

    if (row.status === expected) continue;

    if (CATCH_UP[expected]?.includes(row.status)) {
      const data: Prisma.EscrowPaymentUpdateManyMutationInput =
        expected === 'AUTHORIZED'
          ? { status: 'AUTHORIZED' }
          : expected === 'CAPTURED'
            ? { status: 'CAPTURED', capturedAt: row.capturedAt ?? new Date() }
            : expected === 'CANCELED'
              ? {
                  status: 'CANCELED',
                  canceledAt: intent.canceled_at ? new Date(intent.canceled_at * 1000) : new Date(),
                  cancelReason:
                    intent.cancellation_reason === 'automatic'
                      ? 'The card authorisation lapsed before the payment was released'
                      : `Cancelled at Stripe (${intent.cancellation_reason ?? 'no reason given'})`,
                }
              : {
                  status: 'REFUNDED',
                  canceledAt: new Date(),
                  // The figure goes with the status, or the amount check above
                  // would report this very row on the next run.
                  ...(stripeRefunded !== null ? { refundedAmount: stripeRefunded } : {}),
                };

      // Conditional on the status just read, so a release or cancellation
      // that lands at the same moment is not overwritten.
      const { count } = await prisma.escrowPayment.updateMany({
        where: { id: row.id, status: row.status },
        data,
      });
      if (count > 0) {
        findings.add({
          kind: 'ESCROW_ROW_BEHIND',
          outcome: 'repaired',
          stripeId: intent.id,
          localId: row.id,
          detail: `Moved from ${row.status} to ${expected}, as Stripe has it.`,
        });
      }
      continue;
    }

    findings.add({
      kind: 'ESCROW_STATUS_CONFLICT',
      outcome: 'needs_attention',
      stripeId: intent.id,
      localId: row.id,
      detail: `ATHENA's row says ${row.status} but Stripe says ${expected}. Decide which is right before either party acts on it.`,
    });
  }

  return escrowIntents.length;
}

async function reconcilePaymentRows(
  intents: Stripe.PaymentIntent[],
  findings: Findings,
  settledBefore: Date
): Promise<number> {
  const paymentIntents = intents.filter(i => {
    const type = metadataValue(i.metadata, 'type');
    return type !== null && PAYMENT_ROW_TYPES.has(type);
  });
  if (paymentIntents.length === 0) return 0;

  const rows = await prisma.payment.findMany({
    where: { stripePaymentIntentId: { in: paymentIntents.map(i => i.id) } },
    select: { id: true, stripePaymentIntentId: true, status: true, refundedAmount: true },
  });
  const byIntent = new Map(rows.map(r => [r.stripePaymentIntentId, r]));
  const completed: string[] = [];

  for (const intent of paymentIntents) {
    const row = byIntent.get(intent.id);

    if (intent.status !== 'succeeded') {
      if (row && row.status === 'COMPLETED') {
        findings.add({
          kind: 'PAYMENT_STATUS_CONFLICT',
          outcome: 'needs_attention',
          stripeId: intent.id,
          localId: row.id,
          detail: `The Payment row says COMPLETED but Stripe says the payment is ${intent.status}.`,
        });
      }
      continue;
    }

    const refunded = fullyRefunded(intent);

    if (!row) {
      // The webhook that writes this row did not land. The member has paid
      // and has no receipt, and whatever she paid for may not have been
      // applied either, so this is not repaired from here: replaying the event
      // runs the whole of that flow, which is what she is owed.
      if (new Date(intent.created * 1000) <= settledBefore) {
        findings.add({
          kind: 'PAYMENT_ROW_MISSING',
          outcome: 'needs_attention',
          stripeId: intent.id,
          localId: null,
          detail: `Stripe took ${money(intent.amount_received || intent.amount, intent.currency)} (${metadataValue(intent.metadata, 'type')}) and ATHENA has no Payment row for it. Resend the payment_intent.succeeded event for this intent from the Stripe dashboard.`,
        });
      }
      continue;
    }

    const expected = refunded ? 'REFUNDED' : 'COMPLETED';
    const stripeRefunded = refundedCentsAtStripe(intent);

    // The same check as for a hold, with one difference: it is reported and not
    // repaired. A refund also takes back gift points and credits the invoice, and
    // only the webhook for the refund does those, so the cure is to run it again.
    if (expected !== 'REFUNDED' && stripeRefunded !== null) {
      const scale = minorUnitScale(intent.currency);
      const recorded = Math.round(Number(row.refundedAmount ?? 0) * scale);
      if (stripeRefunded !== recorded) {
        findings.add({
          kind: 'REFUND_AMOUNT_CONFLICT',
          outcome: 'needs_attention',
          stripeId: intent.id,
          localId: row.id,
          detail: `Stripe has refunded ${money(stripeRefunded, intent.currency)} of this payment and ATHENA's Payment row says ${money(recorded, intent.currency)}. Resend the charge.refunded event for this payment from the Stripe dashboard so the row, the invoice and any gift points are brought into line.`,
        });
      }
    }

    if (row.status === expected) {
      if (expected === 'COMPLETED') completed.push(row.id);
      continue;
    }

    const behind =
      (expected === 'REFUNDED' && row.status === 'COMPLETED') ||
      (expected === 'COMPLETED' && ['PENDING', 'PROCESSING', 'FAILED'].includes(row.status));

    if (behind) {
      const { count } = await prisma.payment.updateMany({
        where: { id: row.id, status: row.status },
        data: {
          status: expected,
          // A full refund is the whole of the payment. The figure goes with the
          // status, in the row's own dollars, when Stripe gave one.
          ...(expected === 'REFUNDED' && stripeRefunded !== null
            ? { refundedAmount: new Prisma.Decimal(stripeRefunded).div(minorUnitScale(intent.currency)) }
            : {}),
        },
      });
      if (count > 0) {
        findings.add({
          kind: 'PAYMENT_ROW_BEHIND',
          outcome: 'repaired',
          stripeId: intent.id,
          localId: row.id,
          detail: `Moved from ${row.status} to ${expected}, as Stripe has it.`,
        });
        if (expected === 'COMPLETED') completed.push(row.id);
      }
      continue;
    }

    findings.add({
      kind: 'PAYMENT_STATUS_CONFLICT',
      outcome: 'needs_attention',
      stripeId: intent.id,
      localId: row.id,
      detail: `The Payment row says ${row.status} but Stripe says ${expected}.`,
    });
  }

  await reconcileInvoices(completed, findings);

  return paymentIntents.length;
}

/**
 * Every completed payment gets its tax invoice. The webhook files it best
 * effort and moves on, so an invoice that failed to file was missing for good
 * unless the member noticed and asked. createInvoiceForPayment is idempotent
 * on the payment, so filing it from here is the same act the webhook meant to
 * perform, performed later.
 */
async function reconcileInvoices(paymentIds: string[], findings: Findings): Promise<void> {
  if (paymentIds.length === 0) return;

  const invoiced = new Set(
    (
      await prisma.invoice.findMany({
        where: { paymentId: { in: paymentIds } },
        select: { paymentId: true },
      })
    )
      .map(i => i.paymentId)
      .filter((id): id is string => Boolean(id))
  );

  for (const paymentId of paymentIds) {
    if (invoiced.has(paymentId)) continue;

    try {
      const issued = await createInvoiceForPayment(paymentId);
      findings.add({
        kind: 'INVOICE_MISSING',
        outcome: 'repaired',
        stripeId: null,
        localId: paymentId,
        detail: `Filed invoice ${issued.invoiceNumber}, which the payment had never been given.`,
      });
    } catch (error) {
      findings.add({
        kind: 'INVOICE_MISSING',
        outcome: 'needs_attention',
        stripeId: null,
        localId: paymentId,
        detail: `This completed payment has no invoice and filing one failed: ${(error as Error).message}`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Creator payouts
// ---------------------------------------------------------------------------

/**
 * Creator payouts still open after the time a transfer takes to be created.
 *
 * The transfer.created webhook is what settles one, and it did nothing for a
 * row whose transfer id was never stored until lately; a missed webhook left a
 * payout PENDING for good, so the "paid to your bank" line of her earnings
 * statement stayed short. Here each is found at Stripe — by its stored transfer
 * id, or by the payoutId every creator transfer carries in its metadata — and
 * settled exactly as the webhook would. A payout Stripe has no transfer for at
 * all is the one case that cannot be settled: her points were taken for it and
 * nothing was sent, which is for a person to put right.
 */
async function reconcileCreatorPayouts(
  stripe: Stripe,
  now: Date,
  findings: Findings,
  incomplete: string[]
): Promise<number> {
  const open = await prisma.creatorPayout.findMany({
    where: {
      status: { in: ['PENDING', 'PROCESSING'] },
      createdAt: { lte: new Date(now.getTime() - SETTLE_MARGIN_MS) },
    },
    select: { id: true, stripeTransferId: true, createdAt: true, amount: true },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  if (open.length === 0) return 0;

  let lookups = 0;
  for (const payout of open.filter(p => p.stripeTransferId)) {
    if (lookups >= MAX_SINGLE_LOOKUPS) {
      incomplete.push('creator payouts: the per-run lookup limit was reached');
      break;
    }
    lookups += 1;
    const transferId = payout.stripeTransferId!;
    const transfer = await stripe.transfers.retrieve(transferId);

    if (transfer.reversed) {
      findings.add({
        kind: 'CREATOR_PAYOUT_REVERSED',
        outcome: 'needs_attention',
        stripeId: transfer.id,
        localId: payout.id,
        detail: `Stripe reversed this A$${payout.amount.toFixed(2)} payout and the row is still open, so the creator's balance has not been given back. Resend the transfer.reversed event from the Stripe dashboard.`,
      });
      continue;
    }

    if (await settleCreatorPayout(transferId, new Date(transfer.created * 1000))) {
      findings.add({
        kind: 'CREATOR_PAYOUT_UNSETTLED',
        outcome: 'repaired',
        stripeId: transfer.id,
        localId: payout.id,
        detail: 'The transfer exists at Stripe; the payout is now marked completed.',
      });
    }
  }

  const unlinked = open.filter(p => !p.stripeTransferId);
  if (unlinked.length > 0) {
    const since = Math.floor((unlinked[0].createdAt.getTime() - SETTLE_MARGIN_MS) / 1000);
    const { items: transfers, complete } = await readAll<Stripe.Transfer>(startingAfter =>
      stripe.transfers.list({
        created: { gte: since },
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
    );
    if (!complete) incomplete.push('creator payouts: the transfer list was longer than one run reads');

    const byPayoutId = new Map<string, Stripe.Transfer>();
    for (const transfer of transfers) {
      if (metadataValue(transfer.metadata, 'type') !== 'creator_payout') continue;
      const payoutId = metadataValue(transfer.metadata, 'payoutId');
      if (payoutId) byPayoutId.set(payoutId, transfer);
    }

    for (const payout of unlinked) {
      const transfer = byPayoutId.get(payout.id);

      if (transfer) {
        // Only a row with no transfer yet is claimed, the same guard the
        // webhook uses, so a row linked in the meantime is never re-pointed.
        const linked = await prisma.creatorPayout.updateMany({
          where: { id: payout.id, stripeTransferId: null },
          data: { stripeTransferId: transfer.id },
        });
        if (linked.count > 0 && !transfer.reversed && (await settleCreatorPayout(transfer.id, new Date(transfer.created * 1000)))) {
          findings.add({
            kind: 'CREATOR_PAYOUT_UNSETTLED',
            outcome: 'repaired',
            stripeId: transfer.id,
            localId: payout.id,
            detail: 'The payout never learned its transfer id; it is now linked and marked completed.',
          });
        }
        continue;
      }

      // Only once the whole list was read: a transfer beyond the pages this
      // run could read is not evidence that there is none.
      if (complete && payout.createdAt.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
        findings.add({
          kind: 'CREATOR_PAYOUT_NO_TRANSFER',
          outcome: 'needs_attention',
          stripeId: null,
          localId: payout.id,
          detail: `A$${payout.amount.toFixed(2)} was taken from a creator's balance for this payout and Stripe has no transfer for it. Restore her balance or send the transfer.`,
        });
      }
    }
  }

  return open.length;
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

/** The outcome a Stripe dispute status stands for; the same mapping the webhook writes. */
function disputeOutcomeFor(status: string): 'OPEN' | 'WON' | 'LOST' | 'CLOSED' {
  switch (status) {
    case 'won':
      return 'WON';
    case 'lost':
      return 'LOST';
    case 'warning_closed':
    case 'charge_refunded':
    case 'prevented':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
}

/**
 * Card disputes Stripe has that ATHENA has no record of, or has recorded at a
 * different stage.
 *
 * A dispute that never reached the webhook is the costly kind of silence: the
 * evidence deadline passes in Stripe and nobody here knew there was one. Reported
 * and not repaired, the way a missing Payment row is: recording it from here
 * would skip what the events do about a dispute (the membership, the gift points,
 * the pause on creators), and resending the event runs all of it.
 */
async function reconcileDisputes(
  stripe: Stripe,
  now: Date,
  findings: Findings,
  incomplete: string[]
): Promise<number> {
  const since = Math.floor((now.getTime() - DISPUTE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);

  let items: Stripe.Dispute[];
  let complete: boolean;
  try {
    ({ items, complete } = await readAll<Stripe.Dispute>(startingAfter =>
      stripe.disputes.list({
        created: { gte: since },
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
    ));
  } catch (error) {
    // A restricted key that cannot read disputes must not take the rest of the
    // run down with it. Said in the report, so it is not silent.
    incomplete.push(`disputes: Stripe would not list them (${(error as Error).message})`);
    return 0;
  }
  if (!complete) incomplete.push('disputes: Stripe has more than one run reads');
  if (items.length === 0) return 0;

  const rows = await prisma.paymentDispute.findMany({
    where: { stripeDisputeId: { in: items.map(d => d.id) } },
    select: { id: true, stripeDisputeId: true, outcome: true },
  });
  const byId = new Map(rows.map(r => [r.stripeDisputeId, r]));
  const settledBefore = now.getTime() - SETTLE_MARGIN_MS;

  for (const dispute of items) {
    const row = byId.get(dispute.id);
    const amount = money(dispute.amount, dispute.currency);

    if (!row) {
      // A dispute opened a moment ago may be waiting on its webhook.
      if (dispute.created * 1000 <= settledBefore) {
        findings.add({
          kind: 'DISPUTE_MISSING',
          outcome: 'needs_attention',
          stripeId: dispute.id,
          localId: null,
          detail: `Stripe has a ${dispute.status.replace(/_/g, ' ')} dispute of ${amount} (${dispute.reason}) that ATHENA has no record of. Resend the charge.dispute.created event for it from the Stripe dashboard, and respond before the evidence deadline.`,
        });
      }
      continue;
    }

    // A decided dispute stays decided here, as in the webhook, so only a row
    // that is behind is reported.
    const atStripe = disputeOutcomeFor(dispute.status);
    if (row.outcome === 'OPEN' && atStripe !== 'OPEN') {
      findings.add({
        kind: 'DISPUTE_STATUS_CONFLICT',
        outcome: 'needs_attention',
        stripeId: dispute.id,
        localId: row.id,
        detail: `ATHENA still has this ${amount} dispute open and Stripe says it was ${dispute.status}. Resend the charge.dispute.closed event for it from the Stripe dashboard.`,
      });
    }
  }

  return items.length;
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

function subscriptionStatusFor(status: Stripe.Subscription.Status): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING' {
  // The mapping the customer.subscription.updated webhook writes.
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
      return 'PAST_DUE';
    default:
      return 'CANCELED';
  }
}

/**
 * Memberships whose status here is not the one Stripe has.
 *
 * Reported rather than repaired. A membership status decides what a member can
 * use, and moving it from here — the premium tools switched off for a woman
 * whose card Stripe is still retrying, or on for one Stripe has cancelled — is
 * the decision the subscription webhooks make with the whole event in hand.
 * Resending the event from the Stripe dashboard makes it again.
 */
async function reconcileSubscriptions(
  stripe: Stripe,
  findings: Findings,
  incomplete: string[]
): Promise<number> {
  const local = await prisma.subscription.findMany({
    where: { stripeSubscriptionId: { not: null } },
    select: { id: true, userId: true, status: true, stripeSubscriptionId: true },
    take: 5000,
  });
  if (local.length === 0) return 0;

  const { items, complete } = await readAll<Stripe.Subscription>(startingAfter =>
    stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
  );
  if (!complete) incomplete.push('memberships: Stripe has more subscriptions than one run reads');

  const byId = new Map(items.map(s => [s.id, s]));

  for (const row of local) {
    const atStripe = byId.get(row.stripeSubscriptionId!);

    if (!atStripe) {
      if (complete && row.status !== 'CANCELED') {
        findings.add({
          kind: 'SUBSCRIPTION_MISSING_AT_STRIPE',
          outcome: 'needs_attention',
          stripeId: row.stripeSubscriptionId,
          localId: row.id,
          detail: `ATHENA treats this membership as ${row.status} and Stripe has no subscription with this id.`,
        });
      }
      continue;
    }

    const expected = subscriptionStatusFor(atStripe.status);
    if (row.status !== expected) {
      findings.add({
        kind: 'SUBSCRIPTION_STATUS_CONFLICT',
        outcome: 'needs_attention',
        stripeId: atStripe.id,
        localId: row.id,
        detail: `ATHENA says ${row.status} and Stripe says ${atStripe.status}. Resend the latest customer.subscription event for it from the Stripe dashboard.`,
      });
    }
  }

  return local.length;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

let lastReport: ReconciliationReport | null = null;

/**
 * Tells the admins, at most once a day, while anything needs a person. The
 * report itself carries the full list; the notice carries enough to start on.
 */
async function noteAdmins(report: ReconciliationReport, now: Date): Promise<void> {
  const admins = await bestEffort(
    'stripe-reconciliation.admin-lookup',
    () => prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 }),
    []
  );
  const repeatsAfter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const first = report.findings.filter(f => f.outcome === 'needs_attention').slice(0, 5);

  await Promise.all(
    admins.map(admin =>
      bestEffort(
        'notification.stripe-reconciliation-admins',
        async () => {
          const recent = await prisma.notification.findFirst({
            where: { userId: admin.id, type: 'SYSTEM', title: ADMIN_TITLE, createdAt: { gte: repeatsAfter } },
            select: { id: true },
          });
          if (recent) return null;

          return prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'SYSTEM',
              title: ADMIN_TITLE,
              message:
                `${report.needsAttention} payment record(s) disagree with Stripe in a way that needs a person. ` +
                first.map(f => `${f.kind}: ${f.detail}`).join(' ') +
                (report.needsAttention > first.length ? ' The full list is in the reconciliation report.' : ''),
              link: '/admin',
              data: {
                kind: 'STRIPE_RECONCILIATION',
                needsAttention: report.needsAttention,
                findings: report.findings
                  .filter(f => f.outcome === 'needs_attention')
                  .slice(0, 20)
                  .map(f => ({ kind: f.kind, stripeId: f.stripeId, localId: f.localId })),
              } as Prisma.InputJsonValue,
            },
          });
        },
        null
      )
    )
  );
}

export async function runStripeReconciliation(now = new Date()): Promise<ReconciliationReport> {
  const windowEnd = new Date(now.getTime() - SETTLE_MARGIN_MS);
  const windowStart = new Date(now.getTime() - RECONCILE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const report: ReconciliationReport = {
    ranAt: now.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    checked: { paymentIntents: 0, escrowRows: 0, paymentRows: 0, creatorPayouts: 0, subscriptions: 0, disputes: 0 },
    repaired: 0,
    needsAttention: 0,
    findings: [],
    incomplete: [],
  };

  if (!isStripeConfigured()) {
    report.skipped = 'Stripe is not configured on this deployment, so there is nothing to compare against.';
    return report;
  }

  const stripe = getStripe();
  const findings = new Findings();

  const { items: intents, complete } = await readAll<Stripe.PaymentIntent>(startingAfter =>
    stripe.paymentIntents.list({
      created: {
        gte: Math.floor(windowStart.getTime() / 1000),
        lte: Math.floor(windowEnd.getTime() / 1000),
      },
      limit: 100,
      expand: ['data.latest_charge'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
  );
  if (!complete) report.incomplete.push('payment intents: the window holds more than one run reads');

  report.checked.paymentIntents = intents.length;
  report.checked.escrowRows = await reconcileEscrowRows(intents, findings);
  report.checked.paymentRows = await reconcilePaymentRows(intents, findings, windowEnd);
  report.checked.creatorPayouts = await reconcileCreatorPayouts(stripe, now, findings, report.incomplete);
  report.checked.subscriptions = await reconcileSubscriptions(stripe, findings, report.incomplete);
  report.checked.disputes = await reconcileDisputes(stripe, now, findings, report.incomplete);

  report.findings = findings.kept();
  report.repaired = findings.repaired.length;
  report.needsAttention = findings.attention.length;

  // Every finding is logged, including the ones the stored report drops for
  // length: the log is the record that is never capped.
  for (const finding of findings.attention) logger.error('Stripe reconciliation: needs attention', finding);
  for (const finding of findings.repaired) logger.warn('Stripe reconciliation: repaired a row behind Stripe', finding);

  return report;
}

/** Stores a report where the admin endpoint reads it, in Redis when there is one and in memory regardless. */
async function keepReport(report: ReconciliationReport): Promise<void> {
  lastReport = report;
  await cacheSet(LAST_REPORT_KEY, report, { ttl: 7 * 24 * 60 * 60 });
}

/** The most recent report from any instance, or null when none has run since the cache was last cleared. */
export async function getLastReconciliationReport(): Promise<ReconciliationReport | null> {
  return (await cacheGet<ReconciliationReport>(LAST_REPORT_KEY)) ?? lastReport;
}

/**
 * One run under the shared lock, with its outcome recorded. Returns null when
 * another instance holds the lock, which is not a run of ours.
 */
export async function reconcileAndRecord(now = new Date()): Promise<ReconciliationReport | null> {
  try {
    const report = await runExclusively('stripe-reconciliation', () => runStripeReconciliation(now), 30 * 60 * 1000);
    if (!report) return null;

    await keepReport(report);

    if (!report.skipped) {
      recordSuccess('stripe_reconciliation.run');
      recordCondition(
        'stripe_reconciliation.needs_attention',
        report.needsAttention,
        report.needsAttention > 0
          ? 'Payment records disagree with Stripe in ways that need a decision. The reconciliation report lists each one with its ids.'
          : null
      );
      if (report.needsAttention > 0) await noteAdmins(report, now);
    }

    return report;
  } catch (error) {
    // A run that never finished leaves every disagreement unfound, which is
    // the silence this service exists to end.
    recordFailure('stripe_reconciliation.run', error);
    logger.error('Stripe reconciliation failed', { error: (error as Error).message });
    throw error;
  }
}

let timer: NodeJS.Timeout | null = null;

export function startStripeReconciler(intervalMs = 6 * 60 * 60 * 1000): void {
  if (timer || process.env.NODE_ENV === 'test') return;

  if (!isStripeConfigured()) {
    logger.info('Stripe reconciliation is not scheduled: STRIPE_SECRET_KEY is not set');
    return;
  }

  const run = () => {
    reconcileAndRecord().catch(() => {
      // Already recorded and logged inside.
    });
  };

  setTimeout(run, 10 * 60 * 1000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopStripeReconciler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
