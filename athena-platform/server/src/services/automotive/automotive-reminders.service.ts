/**
 * The automotive sweep, a few times a day: the reminders a car in the
 * garage is due (service by time or kilometres, registration, insurance,
 * the warranty running out), each sent once a month at most; the buyer
 * protection window, nudged two days out and released when it passes
 * without a dispute; trade-in requests and pre-approvals that have run
 * their time; and featured flags that have expired.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { bestEffort, labelSegment } from '../../utils/best-effort';
import { captureEscrowPayment } from '../stripe-connect.service';
import { markSent, shouldSend, vehicleReminders } from './garage.service';
import { runExclusively } from '../../utils/redis';

const DAY = 86400000;

/** The kind a caller passed — CAR_SERVICE_DUE — as the words a log line wants: car-service-due. */

async function notify(userId: string, title: string, message: string, link: string, data: Record<string, unknown>): Promise<void> {
  // One reminder failing is no reason to abandon the sweep half-way through
  // the garage, which is why this never rethrows. It used to go further than
  // that: `.catch(() => null)` threw the reason away as well, so a member who
  // was never told her rego was due left no trace anywhere, while the sweep's
  // own tally counted the reminder as sent. That tally is deliberately left as
  // it was — what is new is that the failure behind it now reaches the log.
  // Every caller puts a `kind` in `data`, so the label says which reminder
  // went missing rather than just "a notification".
  await bestEffort(`notification.${labelSegment(data.kind)}`, () => prisma.notification.create({ data: { userId, type: 'SYSTEM', title, message, link, data: data as Prisma.InputJsonValue } }), null);
}

async function alreadyNotified(userId: string, kind: string, id: string): Promise<boolean> {
  // Fails CLOSED, on purpose: a lookup that breaks answers "yes, she has
  // already been told", so the nudge is skipped this round instead of sent.
  // That is a deliberate change. It used to fail OPEN by accident —
  // `.catch(() => null)` fed `Boolean(null)`, so every sweep that could not
  // read the notification table concluded she had never been told and sent the
  // nudge again, turning one database wobble into the same "two days left on
  // your inspection period" arriving every six hours until it cleared.
  //
  // Skipping is the safer side here because of the margins, not because the
  // reminders are unimportant — one of them is the last warning before her
  // money goes to the seller. Both callers re-check a window far wider than
  // the sweep interval: the inspection-period nudge is due for the whole two
  // days before the window closes and the pre-approval nudge for the whole
  // seven days before it lapses, against a sweep that runs every six hours. A
  // skipped round is retried about eight times over in the tightest case, with
  // the better part of two days still on the clock to raise a dispute. And
  // unlike before, the failure is now in the log rather than invisible.
  return bestEffort(`notification.duplicate-check.${labelSegment(kind)}`, async () => Boolean(await prisma.notification.findFirst({ where: { userId, data: { path: ['kind'], equals: kind }, AND: [{ data: { path: ['id'], equals: id } }] }, select: { id: true } })), true);
}

export async function sweepGarage(now = new Date()): Promise<{ due: number; sent: number }> {
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true, OR: [{ nextServiceDueAt: { not: null } }, { nextServiceDueKm: { not: null } }, { regoDueAt: { not: null } }, { insuranceRenewsAt: { not: null } }, { warrantyEndsAt: { not: null } }, { warrantyEndsKm: { not: null } }] },
    take: 2000,
  });
  let due = 0;
  let sent = 0;
  for (const v of vehicles) {
    const reminders = vehicleReminders(v, now);
    due += reminders.length;
    let keys = v.lastReminderKeys;
    let changed = false;
    for (const r of reminders) {
      if (!shouldSend(keys, r.key, now)) continue;
      await notify(v.userId, r.title, r.body, r.action.href, { kind: `CAR_${r.kind}`, id: v.id, vehicleId: v.id });
      keys = markSent(keys, r.key, now);
      changed = true;
      sent += 1;
    }
    // The keys are the only record that these reminders have gone out, so a
    // write that fails means the same service or rego reminder is sent again on
    // the next sweep. Losing it quietly, as `.catch(() => null)` did, made that
    // duplicate look like a bug in the reminder rules rather than a failed
    // write; the sweep still moves on to the next car, because one car's
    // bookkeeping is not worth the rest of the garage.
    if (changed) await bestEffort('automotive.garage-reminder-keys', () => prisma.vehicle.update({ where: { id: v.id }, data: { lastReminderKeys: keys as Prisma.InputJsonValue } }), null);
  }
  return { due, sent };
}

export async function sweepPurchases(now = new Date()): Promise<{ released: number; nudged: number }> {
  let released = 0;
  let nudged = 0;
  const open = await prisma.vehiclePurchase.findMany({ where: { status: 'HANDED_OVER', inspectionEndsAt: { not: null } }, include: { escrow: true, listing: { select: { id: true, title: true, status: true } } }, take: 500 });
  for (const p of open) {
    const ends = p.inspectionEndsAt!.getTime();
    if (ends <= now.getTime()) {
      try {
        if (p.escrow?.paymentIntentId && (p.escrow.status === 'PENDING' || p.escrow.status === 'AUTHORIZED')) {
          await captureEscrowPayment(p.escrow.paymentIntentId, { id: p.buyerId });
        }
        await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: 'RELEASED', releasedAt: now } });
        // Kept out of the try's own failure path deliberately: by this line the
        // escrow has been captured and the purchase already says RELEASED, so
        // letting a failed listing update fall into the catch below would log
        // the release as "could not be released" and skip the two notifications
        // that follow, for a listing flag. What it must not do is disappear —
        // `.catch(() => null)` left a sold car sitting on the marketplace as
        // though it were still for sale with nothing to say why.
        if (p.listing.status !== 'SOLD') await bestEffort('automotive.listing-marked-sold', () => prisma.vehicleListing.update({ where: { id: p.listing.id }, data: { status: 'SOLD', soldAt: now } }), null);
        await notify(p.sellerId, 'The payment has been released to you', `The inspection period on "${p.listing.title}" ended without a dispute. The money is on its way to your payout account.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PURCHASE_RELEASED', id: p.id });
        await notify(p.buyerId, 'Your purchase is complete', `The inspection period on "${p.listing.title}" has ended and the seller has been paid. Enjoy the car, and leave a word for the next buyer.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PURCHASE_COMPLETE', id: p.id });
        released += 1;
      } catch (err) {
        logger.warn('A vehicle purchase could not be released automatically', { purchaseId: p.id, error: (err as Error).message });
      }
    } else if (ends - now.getTime() <= 2 * DAY) {
      if (await alreadyNotified(p.buyerId, 'CAR_PURCHASE_WINDOW', p.id)) continue;
      await notify(p.buyerId, 'Two days left on your inspection period', `The money for "${p.listing.title}" is released to the seller when the period ends. If something is not as described, open a dispute before then.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PURCHASE_WINDOW', id: p.id });
      nudged += 1;
    }
  }
  return { released, nudged };
}

export async function sweepExpiries(now = new Date()): Promise<{ tradeIns: number; approvals: number; nudged: number; featured: number }> {
  const tradeIns = await prisma.tradeInRequest.updateMany({ where: { status: { in: ['OPEN', 'QUOTED'] }, expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
  const approvals = await prisma.carFinanceApplication.updateMany({ where: { status: 'PRE_APPROVED', expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
  let nudged = 0;
  const closing = await prisma.carFinanceApplication.findMany({ where: { status: 'PRE_APPROVED', expiresAt: { gte: now, lte: new Date(now.getTime() + 7 * DAY) } }, select: { id: true, userId: true, expiresAt: true, amount: true }, take: 500 });
  for (const a of closing) {
    if (await alreadyNotified(a.userId, 'CAR_FINANCE_EXPIRING', a.id)) continue;
    await notify(a.userId, 'Your pre-approval expires within a week', `The pre-approval for $${a.amount.toLocaleString('en-AU')} lapses on ${a.expiresAt!.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}. Buy before then, or ask for it to be refreshed.`, '/dashboard/cars/finance', { kind: 'CAR_FINANCE_EXPIRING', id: a.id });
    nudged += 1;
  }
  const f1 = await prisma.mechanic.updateMany({ where: { isFeatured: true, featuredUntil: { lt: now } }, data: { isFeatured: false } });
  const f2 = await prisma.dealership.updateMany({ where: { isFeatured: true, featuredUntil: { lt: now } }, data: { isFeatured: false } });
  const f3 = await prisma.vehicleListing.updateMany({ where: { isFeatured: true, featuredUntil: { lt: now } }, data: { isFeatured: false } });
  return { tradeIns: tradeIns.count, approvals: approvals.count, nudged, featured: f1.count + f2.count + f3.count };
}

export async function runAutomotiveSweep(now = new Date()) {
  const garage = await sweepGarage(now);
  const purchases = await sweepPurchases(now);
  const expiries = await sweepExpiries(now);
  return { garage, purchases, expiries };
}

let timer: NodeJS.Timeout | null = null;

export function startAutomotiveSweeper(intervalMs = 6 * 60 * 60 * 1000): void {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = () => runExclusively('automotive', () => runAutomotiveSweep()).then((r) => { if (r && (r.garage.sent || r.purchases.released || r.purchases.nudged || r.expiries.nudged)) logger.info('Automotive sweep', r); }).catch((err) => logger.warn('Automotive sweep failed', { error: (err as Error).message }));
  setTimeout(run, 120_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopAutomotiveSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
