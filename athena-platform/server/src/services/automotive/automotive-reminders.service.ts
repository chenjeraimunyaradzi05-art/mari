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
import { captureEscrowPayment } from '../stripe-connect.service';
import { markSent, shouldSend, vehicleReminders } from './garage.service';
import { runExclusively } from '../../utils/redis';

const DAY = 86400000;

async function notify(userId: string, title: string, message: string, link: string, data: Record<string, unknown>): Promise<void> {
  await prisma.notification.create({ data: { userId, type: 'SYSTEM', title, message, link, data: data as Prisma.InputJsonValue } }).catch(() => null);
}

async function alreadyNotified(userId: string, kind: string, id: string): Promise<boolean> {
  const existing = await prisma.notification.findFirst({ where: { userId, data: { path: ['kind'], equals: kind }, AND: [{ data: { path: ['id'], equals: id } }] }, select: { id: true } }).catch(() => null);
  return Boolean(existing);
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
    if (changed) await prisma.vehicle.update({ where: { id: v.id }, data: { lastReminderKeys: keys as Prisma.InputJsonValue } }).catch(() => null);
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
        if (p.listing.status !== 'SOLD') await prisma.vehicleListing.update({ where: { id: p.listing.id }, data: { status: 'SOLD', soldAt: now } }).catch(() => null);
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
