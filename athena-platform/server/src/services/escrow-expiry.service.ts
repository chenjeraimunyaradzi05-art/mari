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

async function noteAdmins(title: string, message: string, data: Record<string, unknown>): Promise<void> {
  const admins = await prisma.user
    .findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 })
    .catch(() => []);

  await Promise.all(
    admins.map(a =>
      prisma.notification
        .create({
          data: {
            userId: a.id,
            type: 'SYSTEM',
            title,
            message,
            link: '/admin',
            data: data as Prisma.InputJsonValue,
          },
        })
        .catch(() => null)
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
      logger.info('Captured an escrow hold before its authorisation lapsed', {
        escrowId: escrow.id,
        amount: escrow.amount,
        currency: escrow.currency,
      });
    } catch (error) {
      result.failed += 1;
      logger.error('Could not capture an escrow hold before expiry', {
        escrowId: escrow.id,
        error: (error as Error).message,
      });
    }
  }

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
        if (r && (r.expiringSoon || r.alreadyLapsed || r.captured || r.failed)) {
          logger.info('Escrow expiry sweep', r);
        }
      })
      .catch(err => logger.warn('Escrow expiry sweep failed', { error: (err as Error).message }));

  setTimeout(run, 180_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopEscrowExpirySweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
