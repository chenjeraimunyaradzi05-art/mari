/**
 * The automotive sweep, a few times a day: the reminders a car in the
 * garage is due (service by time or kilometres, registration, insurance,
 * the warranty running out), each sent once a month at most; the buyer
 * protection window, nudged two days out and released when it passes
 * without a dispute; inspection requests no workshop has taken, raised
 * with the buyer and the admins instead of left to sit; trade-in requests
 * that have run their time; featured flags that have expired; and the
 * retraction of the car finance "pre-approvals" ATHENA was never licensed
 * to issue.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { bestEffort, labelSegment } from '../../utils/best-effort';
import { cancelEscrowPayment, captureEscrowPayment } from '../stripe-connect.service';
import { markSent, shouldSend, vehicleReminders } from './garage.service';
import { readHoldState, settlePurchaseHold } from './purchase-escrow.service';
import { inspectionWorkshopOwners } from './broadcast.service';
import { runExclusively } from '../../utils/redis';

const DAY = 86400000;

/**
 * How long a release that will not go through is retried before ATHENA stops
 * trying and says so out loud.
 *
 * The sweep runs every six hours, so three days is about a dozen attempts:
 * long enough for a processor outage or an issuer's overnight wobble to clear,
 * short enough that a seller who has handed over a car is not left wondering
 * for a week. It used to be unbounded. The capture failed into a logger.warn
 * nobody reads, the purchase stayed HANDED_OVER, and the identical failure was
 * retried every six hours for as long as the row existed — the seller unpaid,
 * the buyer driving the car, and neither of them told anything at all.
 */
const RELEASE_GRACE = 3 * DAY;

/**
 * How long a purchase marked paid may sit with a hold nobody ever authorised
 * before the deal is let go and the car goes back on the market.
 *
 * Only purchases from before the hold and the status were tied together can
 * reach this — a purchase now stays ACCEPTED until the money is really held —
 * but those rows are real, and leaving them is what keeps a car "under offer"
 * against a payment that never happened. A week is deliberately generous: the
 * same window has to survive a buyer who is away, and cancelling is not
 * reversible.
 */
const ABANDONED_HOLD = 7 * DAY;

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
  // reminders are unimportant — the caller left is the last warning before her
  // money goes to the seller. It re-checks a window far wider than the sweep
  // interval: the inspection-period nudge is due for the whole two days before
  // the window closes, against a sweep that runs every six hours. A skipped
  // round is retried about eight times over, with the better part of two days
  // still on the clock to raise a dispute. And unlike before, the failure is
  // now in the log rather than invisible.
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

/** Everyone with an admin console, so a purchase nobody can fix automatically reaches a person. */
async function notifyAdmins(title: string, message: string, link: string, data: Record<string, unknown>): Promise<void> {
  const admins: { id: string }[] = await bestEffort('notification.admin-recipients', () => prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 }), []);
  await Promise.all(admins.map((a) => notify(a.id, title, message, link, data)));
}

type SweptPurchase = Prisma.VehiclePurchaseGetPayload<{ include: { escrow: true; listing: { select: { id: true; title: true; status: true } } } }>;

/**
 * Stop trying to release a purchase, and tell all three parties why.
 *
 * DISPUTED is the right resting place even though nobody has disputed
 * anything: it is the one state that means "a person at ATHENA has to decide
 * this", it takes the row out of the sweep's own query so the failure stops
 * repeating, and the admin console already has the release-or-refund controls
 * pointed at it. The purchase carries the reason in `disputeReason`, and the
 * status copy on the detail page no longer claims the buyer raised it.
 */
async function stopTryingToRelease(p: SweptPurchase, now: Date): Promise<void> {
  const neverAuthorised = !p.escrow || !['AUTHORIZED', 'CAPTURED'].includes(p.escrow.status);
  const why = neverAuthorised
    ? 'The buyer\'s card was never authorised for this purchase, so there is no money held to release.'
    : 'The money held for this purchase could not be taken from the card when the inspection period ended.';
  await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: 'DISPUTED', disputeOpenedAt: now, disputeReason: `Opened by ATHENA: ${why} Three days of automatic attempts did not clear it.` } });
  await notify(p.sellerId, 'The payment for your car could not be released', `${why} ATHENA has stopped trying and is looking at "${p.listing.title}" now. Do not hand anything else over, and reply here with anything that helps.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_RELEASE_FAILED', id: p.id });
  await notify(p.buyerId, 'There is a problem with the payment for your car', `${why} Nothing has been taken from your card. ATHENA is looking at "${p.listing.title}" and will be in touch; please do not pay the seller outside ATHENA.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_RELEASE_FAILED', id: p.id });
  await notifyAdmins('A car purchase could not be released', `"${p.listing.title}", $${(p.agreedAmount ?? p.offerAmount).toLocaleString('en-AU')}: ${why} The car has been handed over. Both sides have been told and it is waiting on a decision.`, '/dashboard/cars/admin', { kind: 'CAR_RELEASE_FAILED', id: p.id });
}

export async function sweepPurchases(now = new Date()): Promise<{ released: number; nudged: number; stuck: number; abandoned: number; unstarted: number }> {
  let released = 0;
  let nudged = 0;
  let stuck = 0;
  const open = await prisma.vehiclePurchase.findMany({ where: { status: 'HANDED_OVER', inspectionEndsAt: { not: null } }, include: { escrow: true, listing: { select: { id: true, title: true, status: true } } }, take: 500 });
  for (const p of open) {
    const ends = p.inspectionEndsAt!.getTime();
    if (ends > now.getTime()) {
      if (ends - now.getTime() > 2 * DAY) continue;
      if (await alreadyNotified(p.buyerId, 'CAR_PURCHASE_WINDOW', p.id)) continue;
      await notify(p.buyerId, 'Two days left on your inspection period', `The money for "${p.listing.title}" is released to the seller when the period ends. If something is not as described, open a dispute before then.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PURCHASE_WINDOW', id: p.id });
      nudged += 1;
      continue;
    }

    // The capture is the only step here that moves money, and it is the one
    // that used to disappear. `bestEffort` keeps the sweep going through the
    // rest of the queue and still writes the reason down, labelled with the
    // purchase — a money failure is no use in the log if the reader cannot
    // tell which sale it belongs to, which is why this label carries the id
    // where the others in this file carry only a kind.
    const mustCapture = Boolean(p.escrow?.paymentIntentId) && p.escrow!.status !== 'CAPTURED';
    if (mustCapture) {
      const captured = await bestEffort(`automotive.purchase-release.${p.id}`, () => captureEscrowPayment(p.escrow!.paymentIntentId as string, { id: p.buyerId }), null);
      if (!captured) {
        stuck += 1;
        // Every six hours for three days, and then never again: past the grace
        // the failure is not going to clear itself, and a silent retry loop is
        // how the seller ended up unpaid with nobody told.
        if (now.getTime() - ends >= RELEASE_GRACE) await stopTryingToRelease(p, now);
        continue;
      }
    }

    await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: 'RELEASED', releasedAt: now } });
    // Kept off the capture's own failure path deliberately: by this line the
    // escrow has been captured and the purchase already says RELEASED, so
    // letting a failed listing update count as "could not be released" would
    // skip the two notifications that follow, for a listing flag. What it must
    // not do is disappear — `.catch(() => null)` left a sold car sitting on the
    // marketplace as though it were still for sale with nothing to say why.
    if (p.listing.status !== 'SOLD') await bestEffort('automotive.listing-marked-sold', () => prisma.vehicleListing.update({ where: { id: p.listing.id }, data: { status: 'SOLD', soldAt: now } }), null);
    await notify(p.sellerId, 'The payment has been released to you', `The inspection period on "${p.listing.title}" ended without a dispute. The money is on its way to your payout account.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PURCHASE_RELEASED', id: p.id });
    await notify(p.buyerId, 'Your purchase is complete', `The inspection period on "${p.listing.title}" has ended and the seller has been paid. Enjoy the car, and leave a word for the next buyer.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PURCHASE_COMPLETE', id: p.id });
    released += 1;
  }
  return {
    released,
    nudged,
    stuck,
    abandoned: await sweepAbandonedHolds(now),
    unstarted: await releaseUnstartedHolds(now),
  };
}

/**
 * Purchases marked paid against a hold nobody ever authorised.
 *
 * A purchase can no longer get here on its own — it stays ACCEPTED until the
 * money is really held — so what this clears is the rows left by the old pay
 * route, each of them a car showing as under offer against a payment that
 * never happened, with a seller who was told she had been paid. The hold is
 * re-read from the processor rather than the row before anything is undone,
 * because a purchase whose webhook simply never landed is a real sale and
 * must be finished, not cancelled.
 */
async function sweepAbandonedHolds(now: Date): Promise<number> {
  const stale = await prisma.vehiclePurchase.findMany({ where: { status: 'PAID_HELD', paidAt: { lt: new Date(now.getTime() - ABANDONED_HOLD) }, escrow: { status: { notIn: ['AUTHORIZED', 'CAPTURED'] } } }, include: { escrow: true, listing: { select: { id: true, title: true, status: true } } }, take: 200 });
  let abandoned = 0;
  for (const p of stale) {
    if (!p.escrow) continue;
    const state = await readHoldState(p.escrow);
    if (state === 'HELD') {
      // The money was there all along and only the bookkeeping was behind.
      await bestEffort('automotive.late-hold-settled', () => settlePurchaseHold(p.id, now), null);
      continue;
    }
    if (state === 'AWAITING_CARD' && p.escrow.paymentIntentId) {
      // An intent left open at the processor for a week is not going to be
      // finished; releasing it costs nothing and stops it sitting against her
      // card's available balance.
      await bestEffort('automotive.abandoned-hold-cancelled', () => cancelEscrowPayment(p.escrow!.paymentIntentId as string, { id: p.buyerId }, 'The card was never authorised'), null);
    }
    await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: 'CANCELLED', cancelledAt: now, cancelReason: 'The card was never authorised, so no money was ever held.' } });
    const others = await prisma.vehiclePurchase.count({ where: { listingId: p.listingId, status: { in: ['ACCEPTED', 'PAID_HELD', 'HANDED_OVER', 'DISPUTED'] } } });
    if (others === 0 && p.listing.status === 'UNDER_OFFER') await bestEffort('automotive.listing-back-on-sale', () => prisma.vehicleListing.update({ where: { id: p.listing.id }, data: { status: 'ACTIVE' } }), null);
    await notify(p.buyerId, 'The purchase was cancelled — the payment never went through', `Nothing was taken from your card for "${p.listing.title}", so the purchase has been let go. The car may still be for sale; make a fresh offer if you still want it.`, `/cars/preloved/${p.listing.id}`, { kind: 'CAR_PURCHASE_CANCELLED', id: p.id });
    await notify(p.sellerId, 'A purchase was cancelled — the buyer\'s payment never went through', `The card behind the offer on "${p.listing.title}" was never authorised, so no money was ever held despite what you were told at the time. The listing is back on the market. Do not hand the car over.`, `/dashboard/cars/sell/${p.listing.id}`, { kind: 'CAR_PURCHASE_CANCELLED', id: p.id });
    abandoned += 1;
  }
  return abandoned;
}

/**
 * Card forms that were opened and never finished.
 *
 * Moving the PAID_HELD write behind a real authorisation fixed a buyer being
 * stranded and a seller being told she had been paid, but it moved these rows
 * out of sweepAbandonedHolds' reach: a purchase whose buyer closed the card
 * form now stays ACCEPTED, and the sweep above only looks at PAID_HELD. The
 * intent stays open at the processor, counting against her card's available
 * balance, for as long as the row exists.
 *
 * The purchase is deliberately left ACCEPTED rather than cancelled. The seller
 * accepted her offer and neither of them has done anything wrong; she can still
 * pay, and the pay route mints a fresh intent once this one is gone. Only the
 * abandoned authorisation is released.
 */
async function releaseUnstartedHolds(now: Date): Promise<number> {
  const stale = await prisma.vehiclePurchase.findMany({
    where: {
      status: 'ACCEPTED',
      escrowPaymentId: { not: null },
      updatedAt: { lt: new Date(now.getTime() - ABANDONED_HOLD) },
      escrow: { status: { notIn: ['AUTHORIZED', 'CAPTURED', 'CANCELLED', 'REFUNDED'] } },
    },
    include: { escrow: true },
    take: 200,
  });

  let released = 0;
  for (const p of stale) {
    if (!p.escrow?.paymentIntentId) continue;

    // Re-read before undoing anything, for the same reason the sweep above
    // does: an authorisation whose webhook never landed is real money held,
    // not an abandoned form.
    const state = await readHoldState(p.escrow);
    if (state === 'HELD') {
      await bestEffort('automotive.late-hold-settled', () => settlePurchaseHold(p.id, now), null);
      continue;
    }
    if (state === 'GONE') continue;

    const cancelled = await bestEffort(
      'automotive.unstarted-hold-released',
      () =>
        cancelEscrowPayment(
          p.escrow!.paymentIntentId as string,
          { id: p.buyerId },
          'The card form was never completed'
        ),
      null
    );
    if (cancelled !== null) released += 1;
  }

  return released;
}

/**
 * The retraction of the pre-approvals ATHENA was never entitled to issue.
 *
 * Until this change, an admin could move a car finance application to
 * PRE_APPROVED from a dropdown. The member was then told she was
 * pre-approved for an amount, at a rate, with "ATHENA finance desk" as the
 * lender, good for sixty days — and this same sweep wrote to her a week
 * before it lapsed to say so again. No lender had seen any of it, because
 * ATHENA has no lender, no credit-bureau check and no Australian Credit
 * Licence. A woman could have walked into a dealership on that reference
 * code believing her finance was arranged.
 *
 * The route can no longer write PRE_APPROVED, but the rows that were
 * written before it stopped are still in the database, and leaving them
 * there would leave the claim standing. So every one of them is closed,
 * stripped of the lender and the expiry, given a timeline entry that says
 * plainly what happened, and — because she may be acting on it right now —
 * she is told. Any referral fee booked against the introduction is voided
 * at the same time; there was no introduction to be paid for.
 *
 * The pass converges: once a row is WITHDRAWN it is no longer selected, so
 * after the first sweep that reaches them this does nothing at all. It is
 * written as a sweep rather than a migration because the data lives in a
 * database shared with another application, where hand-written SQL is the
 * thing the runbook tells us to avoid.
 */
const RETRACTION = 'Closed. This was shown as a pre-approval, which ATHENA is not licensed to give and no lender had seen. The affordability estimate stands; the approval never existed.';

export async function retractFinancePreApprovals(now = new Date()): Promise<{ retracted: number }> {
  const stale = await prisma.carFinanceApplication.findMany({ where: { status: { in: ['PRE_APPROVED', 'EXPIRED'] } }, select: { id: true, userId: true, referenceCode: true, timeline: true }, take: 500 });
  let retracted = 0;
  for (const a of stale) {
    const timeline = [...(Array.isArray(a.timeline) ? (a.timeline as unknown[]) : []), { at: now.toISOString(), status: 'WITHDRAWN', note: RETRACTION }];
    await prisma.carFinanceApplication.update({ where: { id: a.id }, data: { status: 'WITHDRAWN', lender: null, expiresAt: null, decisionAt: now, decisionNote: RETRACTION, timeline: timeline as unknown as Prisma.InputJsonValue } });
    await prisma.carReferral.updateMany({ where: { kind: 'FINANCE', referenceId: a.id, status: { in: ['PENDING', 'CONFIRMED'] } }, data: { status: 'VOID' } });
    await notify(a.userId, 'Correcting what we told you about your car finance', `${a.referenceCode} was shown to you as a pre-approval. It was not one. ATHENA is not a lender or a licensed credit broker, no lender ever saw your application, and nothing was approved. The affordability estimate on the page is still ours and still stands — take it to a lender or a broker, who are the only people who can pre-approve anything. We are sorry.`, '/dashboard/cars/finance', { kind: 'CAR_FINANCE_RETRACTED', id: a.id });
    retracted += 1;
  }
  return { retracted };
}

export async function sweepExpiries(now = new Date()): Promise<{ tradeIns: number; retracted: number; featured: number }> {
  const tradeIns = await prisma.tradeInRequest.updateMany({ where: { status: { in: ['OPEN', 'QUOTED'] }, expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
  const { retracted } = await retractFinancePreApprovals(now);
  const f1 = await prisma.mechanic.updateMany({ where: { isFeatured: true, featuredUntil: { lt: now } }, data: { isFeatured: false } });
  const f2 = await prisma.dealership.updateMany({ where: { isFeatured: true, featuredUntil: { lt: now } }, data: { isFeatured: false } });
  const f3 = await prisma.vehicleListing.updateMany({ where: { isFeatured: true, featuredUntil: { lt: now } }, data: { isFeatured: false } });
  return { tradeIns: tradeIns.count, retracted, featured: f1.count + f2.count + f3.count };
}

/**
 * How long an inspection request may sit with no workshop before somebody is
 * told. Three days is long enough for a workshop to see it between jobs, and
 * short enough that a buyer holding an offer open on a car is not left waiting
 * on a queue nobody is reading.
 */
export const UNTAKEN_INSPECTION_AFTER = 3 * DAY;

/**
 * The inspection requests nobody has taken.
 *
 * A request used to be announced once, to at most ten workshops, and then
 * nothing: no reminder, no escalation, so it could sit at REQUESTED for as
 * long as the listing lasted while the buyer waited to hear. Past three days
 * this does three things, once per request. It tells every workshop in the
 * state that can take it and has not been told — one verified since the
 * request was made, or one the old ten-row broadcast never reached. It tells
 * the buyer plainly that nobody has taken it yet and what she can do. And it
 * tells the admins, whose queue already lists it, that this one has gone
 * stale. The buyer's notification is the marker that the escalation has
 * happened, so a request is escalated once and not every six hours; the
 * lookup fails closed like every other duplicate check here.
 */
export async function sweepUntakenInspections(now = new Date()): Promise<{ untaken: number; reminded: number }> {
  const stale = await prisma.vehicleInspection.findMany({
    where: { status: 'REQUESTED', kind: { not: 'SELLER_PROVIDED' }, createdAt: { lt: new Date(now.getTime() - UNTAKEN_INSPECTION_AFTER) }, listing: { status: { in: ['ACTIVE', 'UNDER_OFFER'] } } },
    include: { listing: { select: { id: true, title: true, state: true, sellerId: true } } },
    orderBy: [{ createdAt: 'asc' }],
    take: 200,
  });
  let untaken = 0;
  let reminded = 0;
  for (const i of stale) {
    if (await alreadyNotified(i.requestedById, 'CAR_INSPECTION_UNTAKEN', i.id)) continue;
    const owners = (await inspectionWorkshopOwners(i.listing.state)).filter((o) => o !== i.listing.sellerId && o !== i.requestedById);
    for (const o of owners) {
      if (await alreadyNotified(o, 'CAR_INSPECTION_OPEN', i.id)) continue;
      await notify(o, 'A pre-purchase inspection is still wanted', `A buyer has been waiting since ${i.createdAt.toISOString().slice(0, 10)} for "${i.listing.title}" to be looked over in ${i.listing.state}. Accept it from your workshop page.`, '/dashboard/cars/workshop', { kind: 'CAR_INSPECTION_OPEN', id: i.id });
      reminded += 1;
    }
    const where = owners.length ? `The ${owners.length === 1 ? 'workshop' : `${owners.length} workshops`} in ${i.listing.state} that ${owners.length === 1 ? 'does' : 'do'} inspections ${owners.length === 1 ? 'has' : 'have'} been reminded` : `No verified workshop in ${i.listing.state} does inspections yet`;
    await notify(i.requestedById, 'No workshop has taken your inspection yet', `Nobody has taken on the inspection of "${i.listing.title}" so far. ${where}, and the ATHENA team has been told. Nothing has been charged. You can also ask a mechanic you trust to look at it independently.`, '/dashboard/cars/purchases', { kind: 'CAR_INSPECTION_UNTAKEN', id: i.id });
    await notifyAdmins('An inspection request has gone three days untaken', `"${i.listing.title}" in ${i.listing.state}, asked for on ${i.createdAt.toISOString().slice(0, 10)}. ${owners.length} workshop${owners.length === 1 ? '' : 's'} there can take it. Ring one, or tell the buyer what she can do instead.`, '/dashboard/cars/admin', { kind: 'CAR_INSPECTION_UNTAKEN', id: i.id });
    untaken += 1;
  }
  return { untaken, reminded };
}

export async function runAutomotiveSweep(now = new Date()) {
  const garage = await sweepGarage(now);
  const purchases = await sweepPurchases(now);
  const inspections = await sweepUntakenInspections(now);
  const expiries = await sweepExpiries(now);
  return { garage, purchases, inspections, expiries };
}

let timer: NodeJS.Timeout | null = null;

export function startAutomotiveSweeper(intervalMs = 6 * 60 * 60 * 1000): void {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = () => runExclusively('automotive', () => runAutomotiveSweep()).then((r) => { if (r && (r.garage.sent || r.purchases.released || r.purchases.nudged || r.purchases.stuck || r.purchases.abandoned || r.inspections.untaken || r.expiries.retracted)) logger.info('Automotive sweep', r); }).catch((err) => logger.warn('Automotive sweep failed', { error: (err as Error).message }));
  setTimeout(run, 120_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopAutomotiveSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
