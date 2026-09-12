/**
 * The two nudges the blueprint asks for and a page cannot give: an annual
 * review of insurance, and a rebalancing suggestion when the holdings have
 * drifted from the mix a member chose. Both are notifications, sent by a
 * daily sweep, each once per window so nobody is nagged.
 */

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { assessNetWorth, type RiskProfile } from './investment-plan.service';

const DAY = 86400000;
const REVIEW_AFTER_DAYS = 335;
const REVIEW_REPEAT_DAYS = 300;
const REBALANCE_DRIFT_POINTS = 10;
const REBALANCE_REPEAT_DAYS = 80;

export interface CoverLike {
  id: string;
  userId: string;
  status: string;
  startDate?: Date | string | null;
  approvedAt?: Date | string | null;
  createdAt: Date | string;
  product?: { name?: string | null; type?: string | null } | null;
}

/** Covers whose anniversary has come round. */
export function coversDueForReview(covers: CoverLike[], now = new Date()): CoverLike[] {
  return covers.filter((c) => {
    if (c.status !== 'APPROVED' && c.status !== 'ACTIVE') return false;
    const since = new Date(c.startDate ?? c.approvedAt ?? c.createdAt).getTime();
    return now.getTime() - since >= REVIEW_AFTER_DAYS * DAY;
  });
}

/** The largest drift, and the move that fixes it, or null when within tolerance. */
export function rebalanceNeeded(allocation: Array<{ label: string; drift: number; move: number }>): { over: string; under: string; move: number; drift: number } | null {
  const over = [...allocation].sort((a, b) => b.drift - a.drift)[0];
  const under = [...allocation].sort((a, b) => a.drift - b.drift)[0];
  if (!over || !under || over.drift < REBALANCE_DRIFT_POINTS) return null;
  return { over: over.label, under: under.label, move: Math.abs(under.move), drift: over.drift };
}

async function alreadySent(kind: string, withinDays: number, now: Date): Promise<Set<string>> {
  const rows = await prisma.notification.findMany({
    where: { type: 'SYSTEM', createdAt: { gte: new Date(now.getTime() - withinDays * DAY) }, data: { path: ['kind'], equals: kind } },
    select: { userId: true, data: true },
  });
  return new Set(rows.map((r) => `${r.userId}:${(r.data as { ref?: string } | null)?.ref ?? ''}`));
}

export async function sendInsuranceReviews(now = new Date()): Promise<number> {
  const covers = await prisma.insuranceApplication.findMany({
    where: { status: { in: ['APPROVED', 'ACTIVE'] } },
    select: { id: true, userId: true, status: true, startDate: true, approvedAt: true, createdAt: true, product: { select: { name: true, type: true } } },
    take: 5000,
  });
  const due = coversDueForReview(covers, now);
  if (due.length === 0) return 0;
  const sent = await alreadySent('INSURANCE_REVIEW', REVIEW_REPEAT_DAYS, now);
  let count = 0;
  for (const c of due) {
    if (sent.has(`${c.userId}:${c.id}`)) continue;
    await prisma.notification.create({
      data: {
        userId: c.userId, type: 'SYSTEM', title: 'A year on: check the cover',
        message: `It is about a year since ${c.product?.name ?? 'your cover'} started. Income, debts and who depends on you may have moved; size the cover again and compare what is on offer.`,
        link: '/dashboard/finance/insurance', data: { kind: 'INSURANCE_REVIEW', ref: c.id },
      },
    });
    count += 1;
  }
  return count;
}

export async function sendRebalanceNudges(now = new Date()): Promise<number> {
  const plans = await prisma.strategyPlan.findMany({ where: { area: 'INVESTMENT' }, select: { userId: true, result: true }, take: 2000 });
  const sent = await alreadySent('REBALANCE', REBALANCE_REPEAT_DAYS, now);
  let count = 0;
  for (const plan of plans) {
    const profile = (plan.result as { profile?: string } | null)?.profile as RiskProfile | undefined;
    if (!profile || sent.has(`${plan.userId}:mix`)) continue;
    const holdings = await prisma.portfolioHolding.findMany({ where: { userId: plan.userId, kind: 'ASSET' }, select: { name: true, kind: true, category: true, value: true } });
    if (holdings.length === 0) continue;
    const nw = assessNetWorth({ holdings: holdings.map((h) => ({ ...h, value: Number(h.value) })), profile });
    const fix = rebalanceNeeded(nw.allocation);
    if (!fix) continue;
    await prisma.notification.create({
      data: {
        userId: plan.userId, type: 'SYSTEM', title: 'Your mix has drifted',
        message: `${fix.over} is ${Math.round(fix.drift)} points over your target. Moving about $${Math.round(fix.move).toLocaleString('en-AU')} toward ${fix.under.toLowerCase()}, or sending new money there, brings it back.`,
        link: '/dashboard/finance/invest#net-worth', data: { kind: 'REBALANCE', ref: 'mix' },
      },
    });
    count += 1;
  }
  return count;
}

export async function sendWealthNudges(now = new Date()): Promise<{ insuranceReviews: number; rebalances: number }> {
  const insuranceReviews = await sendInsuranceReviews(now);
  const rebalances = await sendRebalanceNudges(now);
  return { insuranceReviews, rebalances };
}

let timer: NodeJS.Timeout | null = null;

export function startWealthNudgeSweeper(intervalMs = DAY): void {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = () => sendWealthNudges().then((r) => { if (r.insuranceReviews + r.rebalances > 0) logger.info('Wealth nudges sent', r); }).catch((err) => logger.warn('Wealth nudge sweep failed', { error: (err as Error).message }));
  setTimeout(run, 120_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopWealthNudgeSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
