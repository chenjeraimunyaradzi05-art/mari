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

const captureEnabled = (): boolean => process.env.ESCROW_CAPTURE_BEFORE_EXPIRY === 'true';

export interface EscrowExpirySweep {
  checked: number;
  expiringSoon: number;
  captured: number;
  failed: number;
  alreadyLapsed: number;
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
async function noteAdmins(title: string, message: string, data: Record<string, unknown>): Promise<void> {
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
        () =>
          prisma.notification.create({
            data: {
              userId: a.id,
              type: 'SYSTEM',
              title,
              message,
              link: '/admin',
              data: data as Prisma.InputJsonValue,
            },
          }),
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
      createdAt: true,
      description: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const result: EscrowExpirySweep = {
    checked: held.length,
    expiringSoon: 0,
    captured: 0,
    failed: 0,
    alreadyLapsed: 0,
  };

  for (const escrow of held) {
    const lapsed = escrow.createdAt <= lapsesAt;

    if (lapsed) {
      result.alreadyLapsed += 1;
      // Counted after the loop as a condition rather than here as a failure.
      // Nothing below moves a lapsed hold out of HELD_STATUSES, so the query
      // above finds the same ones on every sweep; recording a failure per hold
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

  if (result.alreadyLapsed || result.failed) {
    await noteAdmins(
      'Escrow holds need attention',
      `${result.alreadyLapsed} hold(s) have outlived their card authorisation and ${result.failed} could not be captured. Funds may no longer be collectable.`,
      { kind: 'ESCROW_EXPIRY', lapsed: result.alreadyLapsed, failed: result.failed }
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
