/**
 * Escrow holds that are about to lapse.
 *
 * A card authorisation lives about seven days with a live processor. Several
 * flows here hold funds longer than that on purpose: a car purchase gives the
 * buyer a fourteen-day inspection period, and a marketplace order can sit open
 * while work is delivered. Nothing watched the gap, so a hold could quietly
 * expire and the platform would discover at release time that there was no
 * longer any money to capture, with the seller already out of pocket.
 *
 * This sweep finds those holds before they lapse and says so. It does not
 * capture by default. Capturing early takes real money off a member's card
 * sooner than she agreed to, which is a decision for the operator rather than
 * for a background job, so the capture path is behind
 * ESCROW_CAPTURE_BEFORE_EXPIRY and is off unless it is deliberately turned on.
 *
 * With capture off, the person whose action actually releases the money is
 * the buyer, so she is the one asked, while there is still time: once per hold,
 * inside the warning window, with a link to the screen she releases it from.
 * And a hold that has outlived its authorisation is no longer left in PENDING
 * or AUTHORIZED for good. Stripe is asked what became of it and the row is
 * settled to the answer: captured after all (the seller was paid and only the
 * row was behind), or expired, in which case both parties are told and the
 * admins are given the order to decide.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { runExclusively } from '../utils/redis';
import { recordCondition, recordFailure, recordSuccess } from '../utils/ops-metrics';
import { bestEffort } from '../utils/best-effort';
import * as stripeConnect from './stripe-connect.service';

/** How long a card authorisation is assumed to last. */
const AUTHORISATION_LIFETIME_DAYS = 7;

/** How long before the lapse to start warning. */
const WARN_WINDOW_DAYS = 2;

/** Statuses where money is still merely held rather than taken or returned. */
const HELD_STATUSES = ['PENDING', 'AUTHORIZED'];

/**
 * How long before the same standing condition is raised with the admins again.
 *
 * The sweep runs every six hours. A hold still inside its authorisation, or one
 * past it that Stripe still reports held or could not be asked about, stays in
 * HELD_STATUSES, so the same holds come back on every run for as long as they
 * go unresolved. A day is long enough that a person who has already been told
 * is not told three more times before they have had a chance to act, and short
 * enough that the reminder still arrives while a hold in the two-day warning
 * window can be saved.
 */
const NOTIFY_AGAIN_AFTER_MS = 24 * 60 * 60 * 1000;

/** Raised while the money can still be collected. */
const EXPIRING_TITLE = 'Escrow holds are about to lapse';
/** Raised once it most likely cannot. */
const LAPSED_TITLE = 'Escrow holds need attention';
/** Raised for each batch of holds Stripe let lapse, which are now marked cancelled. */
const EXPIRED_TITLE = 'Escrow holds expired before release';

/** What the buyer is sent, once per hold, while she can still release it. */
const BUYER_CHASE_TITLE = 'A payment is waiting for you to release it';
const BUYER_EXPIRED_TITLE = 'A payment hold on your card has expired';
const SELLER_EXPIRED_TITLE = 'A payment for you expired before it was released';

const captureEnabled = (): boolean => process.env.ESCROW_CAPTURE_BEFORE_EXPIRY === 'true';

export interface EscrowExpirySweep {
  checked: number;
  expiringSoon: number;
  captured: number;
  failed: number;
  /** Past its authorisation and, as far as Stripe or this run can tell, still unresolved. */
  alreadyLapsed: number;
  /** Past its authorisation, but Stripe had captured it: the row was behind and is now CAPTURED. */
  repaired: number;
  /** Past its authorisation and cancelled at Stripe: the row is now CANCELED. */
  expired: number;
  /** Past its authorisation with no card ever put behind it, so no money was at stake. */
  neverPaid: number;
  /** Buyers asked to release a hold this run. */
  buyersReminded: number;
}

type HeldEscrow = {
  id: string;
  paymentIntentId: string | null;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  description: string | null;
  sessionType: string | null;
  metadata: Prisma.JsonValue;
  serviceOrder: { id: string } | null;
};

/** A hold's amount as a member would read it: A$250.00, not 25000. */
function formatHoldAmount(escrow: Pick<HeldEscrow, 'amount' | 'currency'>): string {
  const major = escrow.amount / stripeConnect.minorUnitScale(escrow.currency);
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: escrow.currency.toUpperCase(),
    }).format(major);
  } catch {
    return `${major} ${escrow.currency.toUpperCase()}`;
  }
}

/** The day a hold's authorisation runs out, in Queensland time. */
function formatLapseDate(createdAt: Date): string {
  const lapses = new Date(createdAt.getTime() + AUTHORISATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  return lapses.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Brisbane',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function metadataString(metadata: Prisma.JsonValue, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}

/**
 * The screen a buyer releases this hold from, or null when she does not
 * release it herself.
 *
 * Only the flows where the buyer's confirmation is what moves the money are
 * listed. A mentor session is released when the session is completed, not by
 * the buyer; a car purchase has its own release timer and reminders; and a hold
 * made through the generic Connect route has no release screen at all. Sending
 * any of those buyers a "please release this" with nowhere to do it would be a
 * request she cannot act on.
 */
function releaseScreenFor(escrow: HeldEscrow): string | null {
  switch (escrow.sessionType) {
    case 'service_order':
      return escrow.serviceOrder ? `/skills-marketplace/orders/${escrow.serviceOrder.id}` : null;
    case 'car_service':
      return '/dashboard/cars/bookings';
    case 'vehicle_inspection': {
      const listingId = metadataString(escrow.metadata, 'listingId');
      return listingId ? `/cars/preloved/${listingId}` : null;
    }
    default:
      return null;
  }
}

/**
 * Asks the buyer to release a hold before it lapses. Once per hold: the sweep
 * runs every six hours, and the check is on the hold's id in the notification's
 * data rather than on a time window, so she is asked once and not nagged.
 * Returns whether a notification was written.
 */
async function chaseBuyer(escrow: HeldEscrow, link: string): Promise<boolean> {
  return bestEffort(
    'notification.escrow-expiry-buyer',
    async () => {
      const already = await prisma.notification.findFirst({
        where: {
          userId: escrow.buyerId,
          title: BUYER_CHASE_TITLE,
          data: { path: ['escrowId'], equals: escrow.id },
        },
        select: { id: true },
      });
      if (already) return false;

      await prisma.notification.create({
        data: {
          userId: escrow.buyerId,
          type: 'SYSTEM',
          title: BUYER_CHASE_TITLE,
          message:
            `You paid ${formatHoldAmount(escrow)} for "${escrow.description ?? 'your order'}" and ATHENA is holding it until you confirm. ` +
            `If you have received what you paid for, please release it by ${formatLapseDate(escrow.createdAt)}. ` +
            'After that the hold on your card expires, the payment can no longer be released, and the seller is not paid.',
          link,
          data: { kind: 'ESCROW_RELEASE_REMINDER', escrowId: escrow.id } as Prisma.InputJsonValue,
        },
      });
      return true;
    },
    false
  );
}

/**
 * Tells both parties that a hold expired at Stripe. Each is written once,
 * because it is sent only from the sweep that moved the row out of the held
 * statuses, and that move happens once.
 */
async function tellPartiesHoldExpired(escrow: HeldEscrow): Promise<void> {
  const amount = formatHoldAmount(escrow);
  const what = escrow.description ?? 'an order';

  await Promise.all([
    bestEffort(
      'notification.escrow-expired-buyer',
      () =>
        prisma.notification.create({
          data: {
            userId: escrow.buyerId,
            type: 'SYSTEM',
            title: BUYER_EXPIRED_TITLE,
            message: `The hold of ${amount} on your card for "${what}" expired before it was released, so you have not been charged for it. ATHENA's team has been told about the order.`,
            link: releaseScreenFor(escrow),
            data: { kind: 'ESCROW_EXPIRED', escrowId: escrow.id } as Prisma.InputJsonValue,
          },
        }),
      null
    ),
    bestEffort(
      'notification.escrow-expired-seller',
      () =>
        prisma.notification.create({
          data: {
            userId: escrow.sellerId,
            type: 'SYSTEM',
            title: SELLER_EXPIRED_TITLE,
            message: `The buyer's card hold of ${amount} for "${what}" expired before it was released, so this payment has not reached you. ATHENA's team has been told about the order.`,
            data: { kind: 'ESCROW_EXPIRED', escrowId: escrow.id } as Prisma.InputJsonValue,
          },
        }),
      null
    ),
  ]);
}

/**
 * Tells the admins that holds need a human. Nothing in here may take the sweep
 * down with it: by the time this runs the sweep has already counted and logged
 * everything it found, and losing those counts to a failed notification would
 * throw away the one useful thing the run produced.
 *
 * Neither failure below is recorded through ops-metrics, and that is a choice
 * rather than an oversight. recordFailure writes into a twenty-deep ring that
 * also decides whether /health/detailed reads degraded, and a database that
 * cannot write notifications fails the lookup plus up to five rows on every
 * sweep — which would evict exactly the escrow_expiry.capture failures an
 * operator opened that endpoint to read. Both facts this message carries are
 * already in the snapshot without it: the lapsed holds as the
 * escrow_expiry.lapsed gauge and the failed captures as escrow_expiry.capture,
 * both written above whether or not the notification lands. So the log is the
 * right home for these two, and the health endpoint loses nothing.
 */
async function noteAdmins(
  title: string,
  message: string,
  data: Record<string, unknown>,
  now: Date,
  { standing = true }: { standing?: boolean } = {}
): Promise<void> {
  // An empty list on failure, exactly as the `.catch(() => [])` this replaces:
  // there is nobody to notify if we cannot find out who the admins are, and the
  // sweep still has to return. The bug was that the two situations looked
  // identical from outside — a lookup that failed and a platform with no admins
  // both produced silence — so a sweep could find lapsed holds, tell nobody,
  // and leave nothing behind saying it had tried.
  const admins = await bestEffort(
    'escrow-expiry.admin-lookup',
    () => prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 }),
    []
  );

  const repeatsAfter = new Date(now.getTime() - NOTIFY_AGAIN_AFTER_MS);

  // Wrapped per admin rather than around the Promise.all, which is what the old
  // per-row `.catch(() => null)` did too: one admin's row failing must not stop
  // the other four being written. The null fallback is kept as it was and
  // nothing reads it. This was the worst of the swallowed catches here, because
  // this notification is how a person first learns that money is about to stop
  // being collectable, and when it failed there was no record anywhere that it
  // had even been attempted.
  await Promise.all(
    admins.map(a =>
      bestEffort(
        'notification.escrow-expiry-admins',
        async () => {
          // A hold that is only close to lapsing, or still unresolved past it,
          // stays in HELD_STATUSES, so the sweep finds the same ones every six
          // hours. Without this check a single lapsed
          // hold sent every admin four identical notifications a day until
          // somebody dealt with it by hand — which is how a channel that only
          // ever carries "money is about to stop being collectable" becomes a
          // channel nobody reads. Matched on the title, because that is what
          // distinguishes the two conditions this sweep raises and it is a
          // literal on our side rather than anything a member can set.
          //
          // A one-off event (`standing: false`) skips the check: holds that
          // expired are moved out of HELD_STATUSES by the run that reports
          // them, so they are never found again, and suppressing the notice
          // would lose them rather than merely not repeat them.
          if (standing) {
            const recent = await prisma.notification.findFirst({
              where: { userId: a.id, type: 'SYSTEM', title, createdAt: { gte: repeatsAfter } },
              select: { id: true },
            });

            if (recent) return null;
          }

          return prisma.notification.create({
            data: {
              userId: a.id,
              type: 'SYSTEM',
              title,
              message,
              link: '/admin',
              data: data as Prisma.InputJsonValue,
            },
          });
        },
        null
      )
    )
  );
}

export async function runEscrowExpirySweep(now = new Date()): Promise<EscrowExpirySweep> {
  const lapsesAt = new Date(now.getTime() - AUTHORISATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  const warnFrom = new Date(lapsesAt.getTime() + WARN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const held = await prisma.escrowPayment.findMany({
    where: { status: { in: HELD_STATUSES }, createdAt: { lte: warnFrom } },
    select: {
      id: true,
      paymentIntentId: true,
      buyerId: true,
      sellerId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      description: true,
      sessionType: true,
      metadata: true,
      serviceOrder: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Mentor sessions booked before mentoring moved onto the shared escrow path
  // hold real money against a PaymentIntent with no EscrowPayment row behind
  // it, so the query above cannot see them: a session booked a fortnight out
  // had its authorisation lapse in silence and the mentor was never paid. New
  // bookings write a row and are already in `held`, so anything whose intent
  // appears there is skipped rather than counted twice.
  const heldIntentIds = new Set(held.map(h => h.paymentIntentId).filter((id): id is string => Boolean(id)));

  const unledgeredSessions = (
    await prisma.mentorSession.findMany({
      where: {
        paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
        status: { notIn: ['CANCELED', 'COMPLETED'] },
        stripePaymentIntentId: { not: null },
        createdAt: { lte: warnFrom },
      },
      select: {
        id: true,
        stripePaymentIntentId: true,
        sessionAmount: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
  ).filter(session => !heldIntentIds.has(session.stripePaymentIntentId!));

  const result: EscrowExpirySweep = {
    checked: held.length + unledgeredSessions.length,
    expiringSoon: 0,
    captured: 0,
    failed: 0,
    alreadyLapsed: 0,
    repaired: 0,
    expired: 0,
    neverPaid: 0,
    buyersReminded: 0,
  };

  const newlyExpired: HeldEscrow[] = [];

  for (const escrow of held) {
    const lapsed = escrow.createdAt <= lapsesAt;

    if (lapsed) {
      // Asked at Stripe first, because "lapsed" is a guess from the row's age
      // and Stripe knows. A failure to ask falls through to the old report, so
      // an outage costs nothing but a repeat of it on the next sweep.
      const paymentIntentId = escrow.paymentIntentId;
      const outcome = paymentIntentId
        ? await bestEffort(
            'escrow-expiry.resolve-lapsed',
            () => stripeConnect.resolveLapsedEscrowHold(paymentIntentId),
            null
          )
        : null;

      if (outcome?.state === 'captured') {
        // The seller was paid. This used to reach the admins as a hold whose
        // "funds may no longer be collectable", which was the opposite of true.
        result.repaired += 1;
        continue;
      }

      if (outcome?.state === 'expired') {
        result.expired += 1;
        if (outcome.changed) {
          newlyExpired.push(escrow);
          await tellPartiesHoldExpired(escrow);
        }
        logger.error('Escrow hold expired at Stripe before it was released', {
          escrowId: escrow.id,
          heldSince: escrow.createdAt,
          amount: escrow.amount,
          currency: escrow.currency,
        });
        continue;
      }

      if (outcome?.state === 'unpaid') {
        // No card was ever put behind it, so no money was held and none can
        // have been lost. Kept out of the lapsed count so that count means
        // what the admins are told it means.
        result.neverPaid += 1;
        logger.info('Escrow hold was never paid for', { escrowId: escrow.id, heldSince: escrow.createdAt });
        continue;
      }

      result.alreadyLapsed += 1;
      // Counted after the loop as a condition rather than here as a failure.
      // A hold that reaches this line is still in HELD_STATUSES, so the query
      // above finds it again on every sweep; recording a failure per hold
      // per sweep meant the count climbed by the same holds every six hours and
      // /health/detailed could never go back to healthy after a single lapse.
      // An error rather than a warning: by this point the money is most likely
      // not collectable and somebody has to decide what happens to the order.
      logger.error('Escrow hold has outlived its authorisation', {
        escrowId: escrow.id,
        heldSince: escrow.createdAt,
        amount: escrow.amount,
        currency: escrow.currency,
      });
      continue;
    }

    result.expiringSoon += 1;

    // Only a hold with a card behind it: asking a buyer to release a payment
    // she never completed would be asking her to do something impossible.
    const releaseScreen = escrow.status === 'AUTHORIZED' ? releaseScreenFor(escrow) : null;
    if (!captureEnabled() && releaseScreen && (await chaseBuyer(escrow, releaseScreen))) {
      result.buyersReminded += 1;
    }

    if (!captureEnabled() || !escrow.paymentIntentId) {
      logger.warn('Escrow hold is close to expiring', {
        escrowId: escrow.id,
        heldSince: escrow.createdAt,
        amount: escrow.amount,
        currency: escrow.currency,
        capturingEarly: false,
      });
      continue;
    }

    try {
      // Captured as the platform rather than as either party, because neither
      // has asked for this: it is being taken early only so the hold is not lost.
      await stripeConnect.captureEscrowPayment(escrow.paymentIntentId, { id: 'system', role: 'ADMIN' });
      result.captured += 1;
      recordSuccess('escrow_expiry.capture');
      logger.info('Captured an escrow hold before its authorisation lapsed', {
        escrowId: escrow.id,
        amount: escrow.amount,
        currency: escrow.currency,
      });
    } catch (error) {
      result.failed += 1;
      // The hold will lapse in under two days and this was the last chance to
      // save it, so the reason Stripe gave is worth keeping where an operator
      // will actually look.
      recordFailure('escrow_expiry.capture', error);
      logger.error('Could not capture an escrow hold before expiry', {
        escrowId: escrow.id,
        error: (error as Error).message,
      });
    }
  }

  for (const session of unledgeredSessions) {
    if (session.createdAt <= lapsesAt) {
      result.alreadyLapsed += 1;
      logger.error('Mentor session hold has outlived its authorisation', {
        sessionId: session.id,
        heldSince: session.createdAt,
        amount: Number(session.sessionAmount),
        currency: session.currency,
      });
      continue;
    }

    result.expiringSoon += 1;
    // Warned about, never captured early, even when ESCROW_CAPTURE_BEFORE_EXPIRY
    // is on. Capturing here would mean calling Stripe directly against a hold
    // the platform has no ledger row for, so nothing would record that the
    // money had been taken — the money would move and the session, the
    // statement and the earnings screen would all still say it had not.
    logger.warn('Mentor session hold is close to expiring', {
      sessionId: session.id,
      heldSince: session.createdAt,
      amount: Number(session.sessionAmount),
      currency: session.currency,
      capturingEarly: false,
    });
  }

  // A gauge, written on every sweep including the sweeps that find none, so the
  // number falls back to zero once an operator has dealt with them. A lapsed
  // hold is a standing condition that needs a human, not an event that happened
  // again just because the sweep looked again.
  recordCondition(
    'escrow_expiry.lapsed',
    result.alreadyLapsed,
    result.alreadyLapsed > 0
      ? 'Holds have outlived their card authorisation. The money is most likely no longer collectable and somebody has to decide what happens to each order.'
      : null
  );

  // A gauge for the holds that can still be saved, written on every sweep for
  // the same reason as the one above: it is a standing condition an operator
  // clears by acting on it, not an event.
  recordCondition(
    'escrow_expiry.expiring_soon',
    result.expiringSoon,
    result.expiringSoon > 0
      ? 'Holds are within two days of their card authorisation lapsing. Each one still needs a release or a cancellation while the money is collectable.'
      : null
  );

  if (result.alreadyLapsed || result.failed) {
    await noteAdmins(
      LAPSED_TITLE,
      `${result.alreadyLapsed} hold(s) have outlived their card authorisation and ${result.failed} could not be captured. Funds may no longer be collectable.`,
      { kind: 'ESCROW_EXPIRY', lapsed: result.alreadyLapsed, failed: result.failed },
      now
    );
  }

  // Holds that Stripe let lapse, now marked cancelled. Both parties have been
  // told; what happens to each order - a new payment, or closing it - is a
  // decision for a person, so the ids go with the notice. Sent every time
  // there are new ones rather than once a day, because these rows will not be
  // found again.
  if (newlyExpired.length) {
    await noteAdmins(
      EXPIRED_TITLE,
      `${newlyExpired.length} hold(s) expired at Stripe before they were released and are now marked cancelled. The buyers were not charged and the sellers were not paid; each order needs a decision.`,
      { kind: 'ESCROW_EXPIRED', escrowIds: newlyExpired.map(e => e.id) },
      now,
      { standing: false }
    );
  }

  // Raised while there is still something to be done about it.
  //
  // The only escalation this sweep had fired once a hold had already lapsed —
  // that is, once the seller had most likely lost the money for work she had
  // already delivered and the decision left to make was about compensation
  // rather than collection. The warning window exists precisely so somebody can
  // act inside it. The buyers whose confirmation releases a hold have been
  // asked above; this tells the people who can release any hold from /admin,
  // including the ones no buyer screen releases.
  if (result.expiringSoon) {
    await noteAdmins(
      EXPIRING_TITLE,
      `${result.expiringSoon} hold(s) are within ${WARN_WINDOW_DAYS} days of their card authorisation lapsing. Release or cancel each one while the money can still be collected.`,
      { kind: 'ESCROW_EXPIRING', expiringSoon: result.expiringSoon },
      now
    );
  }

  return result;
}

let timer: NodeJS.Timeout | null = null;

export function startEscrowExpirySweeper(intervalMs = 6 * 60 * 60 * 1000): void {
  if (timer || process.env.NODE_ENV === 'test') return;

  const run = () =>
    runExclusively('escrow-expiry', () => runEscrowExpirySweep())
      .then(r => {
        // runExclusively hands back null when another instance holds the lock,
        // which is not a run of ours and so is neither a success nor a failure.
        if (r) recordSuccess('escrow_expiry.sweep');
        if (r && (r.expiringSoon || r.alreadyLapsed || r.captured || r.failed)) {
          logger.info('Escrow expiry sweep', r);
        }
      })
      .catch(err => {
        // A sweep that never ran leaves every hold unwatched, which is the
        // original silent failure this service exists to end.
        recordFailure('escrow_expiry.sweep', err);
        logger.warn('Escrow expiry sweep failed', { error: (err as Error).message });
      });

  setTimeout(run, 180_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopEscrowExpirySweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
