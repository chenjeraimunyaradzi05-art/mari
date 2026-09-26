/**
 * Who hears about a job nobody has been assigned yet: a buyer's request for a
 * pre-purchase inspection, and a member's request for trade-in quotes.
 *
 * Both used to be a single `findMany(..., take: 10)` with no order. Past the
 * first ten rows Postgres happened to return, no workshop or dealership was
 * ever told, and which ten those were was an accident of the heap rather than
 * anything anybody chose. In a state with more than ten verified inspection
 * workshops the rest could sit through every request without hearing of one,
 * while the buyer waited on a queue that had only ever been shown to some of
 * the people who could take it.
 *
 * The rule now is the one the queues themselves already follow: everyone who
 * can see the job on their own page is told about it. A workshop sees the
 * open inspections in its state (GET /inspections/open), so every verified,
 * active inspection workshop in that state is told. A dealership sees an open
 * trade-in when it is addressed to it, or when it is addressed to nobody and
 * the make is one the dealership carries — or it carries no brands in
 * particular (GET /dealership/requests) — so exactly those are told. Reading
 * in pages keeps any one query small without putting a ceiling on who hears.
 */

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

const PAGE = 200;
/**
 * A runaway guard, not a cap anybody should meet: fifty pages is ten thousand
 * businesses in one state. If it is ever reached the log says so, rather than
 * the list being cut short in silence the way `take: 10` cut it.
 */
const MAX_PAGES = 50;

async function everyOwner(label: string, read: (skip: number) => Promise<Array<{ ownerUserId: string | null }>>): Promise<string[]> {
  const owners = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await read(page * PAGE);
    for (const r of rows) if (r.ownerUserId) owners.add(r.ownerUserId);
    if (rows.length < PAGE) return [...owners];
  }
  logger.warn('A broadcast reached its page limit; some businesses were not told', { label, told: owners.size });
  return [...owners];
}

/** The owners of every verified, active workshop that does inspections in the car's state. */
export function inspectionWorkshopOwners(state: string | null | undefined): Promise<string[]> {
  return everyOwner('automotive.inspection-broadcast', (skip) => prisma.mechanic.findMany({
    where: { isActive: true, isVerified: true, doesInspections: true, ownerUserId: { not: null }, ...(state ? { state } : {}) },
    select: { ownerUserId: true },
    orderBy: [{ id: 'asc' }],
    skip,
    take: PAGE,
  }));
}

/**
 * The owners of the dealerships that will see this trade-in on their own
 * requests page: the one it was addressed to, or — when it is open to anyone —
 * every verified, active dealership that carries the make or no brands in
 * particular.
 */
export function tradeInDealerOwners(input: { make: string; dealershipId?: string | null }): Promise<string[]> {
  const where = input.dealershipId
    ? { id: input.dealershipId, isActive: true, isVerified: true, ownerUserId: { not: null } }
    : { isActive: true, isVerified: true, ownerUserId: { not: null }, OR: [{ brands: { isEmpty: true } }, { brands: { has: input.make } }] };
  return everyOwner('automotive.trade-in-broadcast', (skip) => prisma.dealership.findMany({ where, select: { ownerUserId: true }, orderBy: [{ id: 'asc' }], skip, take: PAGE }));
}
