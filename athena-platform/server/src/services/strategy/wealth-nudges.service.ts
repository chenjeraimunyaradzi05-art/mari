/**
 * The two nudges the blueprint asks for and a page cannot give: an annual
 * review of insurance, and a rebalancing suggestion when the holdings have
 * drifted from the mix a member chose. Both are notifications, sent by a
 * daily sweep, each once per window so nobody is nagged.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { assessNetWorth, type RiskProfile } from './investment-plan.service';
import { runExclusively } from '../../utils/redis';

const DAY = 86400000;
const REVIEW_AFTER_DAYS = 335;
const REVIEW_REPEAT_DAYS = 300;
const REBALANCE_DRIFT_POINTS = 10;
const REBALANCE_REPEAT_DAYS = 80;
const REBALANCE_MEMBER_CHUNK = 200;
const HOLDINGS_PAGE = 1000;
const NUDGE_HISTORY_CHUNK = 500;
const NUDGE_HISTORY_PAGE = 1000;
const MIX_REF = 'mix';

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

/** How a nudge is deduplicated: one per member per thing being nudged about. */
function nudgeKey(userId: string, ref: string): string {
  return `${userId}:${ref}`;
}

/**
 * Of the nudges about to be sent, the ones whose member has already had that
 * same nudge inside the repeat window.
 *
 * This was a single findMany over every SYSTEM notification of the kind in the
 * window, platform-wide and with no take, so a sweep about to nudge a handful
 * of members still pulled months of everybody else's notification history into
 * memory on a daily timer. It now asks only about the members under
 * consideration, a chunk of them per query, and keeps only the keys matching a
 * nudge that was going to be sent, so what is held is bounded by the candidate
 * list rather than by how long the platform has been running. A bare take
 * would not have been enough on its own: history that stops short reads as
 * "never nudged", and nagging someone twice is the one thing this function
 * exists to prevent, so each chunk is paged on the primary key until its rows
 * run out.
 */
async function alreadySent(
  kind: string,
  withinDays: number,
  now: Date,
  candidates: Array<{ userId: string; ref: string }>
): Promise<Set<string>> {
  const wanted = new Set(candidates.map((c) => nudgeKey(c.userId, c.ref)));
  if (wanted.size === 0) return new Set();
  const userIds = [...new Set(candidates.map((c) => c.userId))];
  const since = new Date(now.getTime() - withinDays * DAY);
  const sent = new Set<string>();

  for (let start = 0; start < userIds.length; start += NUDGE_HISTORY_CHUNK) {
    const chunk = userIds.slice(start, start + NUDGE_HISTORY_CHUNK);
    let cursor: string | undefined;
    for (;;) {
      const page = await prisma.notification.findMany({
        where: { userId: { in: chunk }, type: 'SYSTEM', createdAt: { gte: since }, data: { path: ['kind'], equals: kind } },
        select: { id: true, userId: true, data: true },
        orderBy: { id: 'asc' },
        take: NUDGE_HISTORY_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const row of page) {
        const key = nudgeKey(row.userId, (row.data as { ref?: string } | null)?.ref ?? '');
        if (wanted.has(key)) sent.add(key);
      }
      if (page.length < NUDGE_HISTORY_PAGE) break;
      cursor = page[page.length - 1].id;
    }
  }
  return sent;
}

export async function sendInsuranceReviews(now = new Date()): Promise<number> {
  const covers = await prisma.insuranceApplication.findMany({
    where: { status: { in: ['APPROVED', 'ACTIVE'] } },
    select: { id: true, userId: true, status: true, startDate: true, approvedAt: true, createdAt: true, product: { select: { name: true, type: true } } },
    take: 5000,
  });
  const due = coversDueForReview(covers, now);
  if (due.length === 0) return 0;
  const sent = await alreadySent(
    'INSURANCE_REVIEW',
    REVIEW_REPEAT_DAYS,
    now,
    due.map((c) => ({ userId: c.userId, ref: c.id }))
  );
  // One insert for the sweep. This was a create inside the loop, so an
  // anniversary that fell due for two hundred members meant two hundred round
  // trips on a daily timer, growing with every cover ever written.
  const notices: Prisma.NotificationCreateManyInput[] = due
    .filter((c) => !sent.has(nudgeKey(c.userId, c.id)))
    .map((c) => ({
      userId: c.userId, type: 'SYSTEM', title: 'A year on: check the cover',
      message: `It is about a year since ${c.product?.name ?? 'your cover'} started. Income, debts and who depends on you may have moved; size the cover again and compare what is on offer.`,
      link: '/dashboard/finance/insurance', data: { kind: 'INSURANCE_REVIEW', ref: c.id },
    }));
  if (notices.length === 0) return 0;
  // The count the database reports, not the length of the list we meant to
  // write, so the log line cannot claim nudges that were never inserted.
  const created = await prisma.notification.createMany({ data: notices });
  return created.count;
}

const HOLDING_SELECT = { id: true, userId: true, name: true, kind: true, category: true, value: true } as const;
type HoldingRow = Prisma.PortfolioHoldingGetPayload<{ select: typeof HOLDING_SELECT }>;

export async function sendRebalanceNudges(now = new Date()): Promise<number> {
  const plans = await prisma.strategyPlan.findMany({ where: { area: 'INVESTMENT' }, select: { userId: true, result: true }, take: 2000 });
  // A plan that names no profile cannot produce a nudge, so it is dropped
  // before anything else is queried on that member's behalf — including the
  // dedupe read below, which is now asked about named members rather than the
  // whole platform.
  const withProfile: Array<{ userId: string; profile: RiskProfile }> = [];
  for (const plan of plans) {
    const profile = (plan.result as { profile?: string } | null)?.profile as RiskProfile | undefined;
    if (!profile) continue;
    withProfile.push({ userId: plan.userId, profile });
  }
  if (withProfile.length === 0) return 0;

  const sent = await alreadySent(
    'REBALANCE',
    REBALANCE_REPEAT_DAYS,
    now,
    withProfile.map((c) => ({ userId: c.userId, ref: MIX_REF }))
  );
  // Someone already nudged this window is dropped here rather than after her
  // holdings are read, because reading them would be work done to reach a
  // notice that will not be sent.
  const candidates = withProfile.filter((c) => !sent.has(nudgeKey(c.userId, MIX_REF)));
  if (candidates.length === 0) return 0;

  // Holdings come back in one query per chunk of members rather than one
  // findMany per plan, which is what made this sweep cost a round trip per
  // investing member. Batched that way the read had no bound of its own, so a
  // platform with a lot of holdings pulled every one of them into memory on a
  // daily timer. A bare take would have bounded that by cutting somebody's
  // portfolio short, and a portfolio read half way through does not give a
  // smaller drift, it gives a wrong one: the nudge would name a move the member
  // does not need. So the members are taken a chunk at a time and each chunk's
  // holdings are paged on the primary key until they run out. That bounds what
  // any one query returns, every candidate is still looked at, and each is
  // looked at with all of her holdings.
  const notices: Prisma.NotificationCreateManyInput[] = [];
  for (let start = 0; start < candidates.length; start += REBALANCE_MEMBER_CHUNK) {
    const chunk = candidates.slice(start, start + REBALANCE_MEMBER_CHUNK);
    const userIds = chunk.map((c) => c.userId);
    const byUser = new Map<string, HoldingRow[]>();
    let cursor: string | undefined;
    for (;;) {
      const page = await prisma.portfolioHolding.findMany({
        where: { userId: { in: userIds }, kind: 'ASSET' },
        select: HOLDING_SELECT,
        orderBy: { id: 'asc' },
        take: HOLDINGS_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const holding of page) {
        const list = byUser.get(holding.userId) ?? [];
        list.push(holding);
        byUser.set(holding.userId, list);
      }
      if (page.length < HOLDINGS_PAGE) break;
      cursor = page[page.length - 1].id;
    }

    for (const candidate of chunk) {
      const mine = byUser.get(candidate.userId);
      if (!mine || mine.length === 0) continue;
      const nw = assessNetWorth({ holdings: mine.map((h) => ({ ...h, value: Number(h.value) })), profile: candidate.profile });
      const fix = rebalanceNeeded(nw.allocation);
      if (!fix) continue;
      notices.push({
        userId: candidate.userId, type: 'SYSTEM', title: 'Your mix has drifted',
        message: `${fix.over} is ${Math.round(fix.drift)} points over your target. Moving about $${Math.round(fix.move).toLocaleString('en-AU')} toward ${fix.under.toLowerCase()}, or sending new money there, brings it back.`,
        link: '/dashboard/finance/invest#net-worth', data: { kind: 'REBALANCE', ref: MIX_REF },
      });
    }
  }
  if (notices.length === 0) return 0;
  const created = await prisma.notification.createMany({ data: notices });
  return created.count;
}

export async function sendWealthNudges(now = new Date()): Promise<{ insuranceReviews: number; rebalances: number }> {
  const insuranceReviews = await sendInsuranceReviews(now);
  const rebalances = await sendRebalanceNudges(now);
  return { insuranceReviews, rebalances };
}

let timer: NodeJS.Timeout | null = null;

export function startWealthNudgeSweeper(intervalMs = DAY): void {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = () => runExclusively('wealth-nudges', () => sendWealthNudges()).then((r) => { if (r && r.insuranceReviews + r.rebalances > 0) logger.info('Wealth nudges sent', r); }).catch((err) => logger.warn('Wealth nudge sweep failed', { error: (err as Error).message }));
  setTimeout(run, 120_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}

export function stopWealthNudgeSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
