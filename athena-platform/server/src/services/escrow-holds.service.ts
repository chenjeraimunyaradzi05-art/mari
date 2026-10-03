/**
 * Escrow holds as the people behind them see them: the buyer whose card is
 * held, and the admins who can release a hold nobody else will.
 *
 * Every flow that holds money — mentor sessions, marketplace orders, car
 * purchases, workshop jobs, inspections — has its own screen where the buyer
 * releases or cancels, and its own rules about when she may. A hold made
 * through the generic POST /api/connect/escrow route had neither: no screen, so
 * the expiry sweep could not ask its buyer to release it, and the generic
 * capture and cancel routes would move any hold at all, including one a flow
 * owned, behind that flow's back. This module says which is which, lists a
 * buyer's holds with where each one is released from, and lets a member act
 * directly only on the holds no flow owns.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { holdDeadlineOf } from './escrow-deadline';

/**
 * The session types a flow of its own creates and releases. A hold carrying one
 * of these is moved by that flow's screens and rules; any other type is a
 * generic hold its buyer releases from GENERIC_HOLDS_SCREEN.
 */
export const FLOW_OWNED_SESSION_TYPES: readonly string[] = [
  'mentor_session',
  'service_order',
  // An hour booked on a listing, and a proposal the buyer accepted on a brief.
  // Each is released by its own screen, so the generic route must not move them.
  'service_booking',
  'custom_request',
  'vehicle_purchase',
  'car_service',
  'vehicle_inspection',
];

/** The session types the generic route may create. */
export const GENERIC_SESSION_TYPES: readonly string[] = ['course_purchase', 'creator_content'];

/** Where a buyer releases or cancels a hold that no flow owns. */
export const GENERIC_HOLDS_SCREEN = '/dashboard/finance/holds';

/** How far back settled holds are still listed, so she can see what became of one. */
const SETTLED_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

const HELD_STATUSES = ['PENDING', 'AUTHORIZED'];

const KIND_LABELS: Record<string, string> = {
  mentor_session: 'Mentor session',
  service_order: 'Marketplace order',
  service_booking: 'Marketplace booking',
  custom_request: 'Marketplace request',
  vehicle_purchase: 'Car purchase',
  car_service: 'Workshop job',
  vehicle_inspection: 'Vehicle inspection',
  course_purchase: 'Course',
  creator_content: 'Creator content',
};

type HoldRecord = {
  id: string;
  paymentIntentId: string | null;
  sessionType: string | null;
  serviceOrder: { id: string } | null;
  serviceBooking: { id: string } | null;
  serviceProposal: { id: string } | null;
  vehiclePurchase: { id: string } | null;
  vehicleInspection: { id: string; listingId: string } | null;
  mechanicBooking: { id: string } | null;
};

const HOLD_RECORD_SELECT = {
  id: true,
  paymentIntentId: true,
  sessionType: true,
  serviceOrder: { select: { id: true } },
  serviceBooking: { select: { id: true } },
  serviceProposal: { select: { id: true } },
  vehiclePurchase: { select: { id: true } },
  vehicleInspection: { select: { id: true, listingId: true } },
  mechanicBooking: { select: { id: true } },
} as const;

/**
 * Who owns a hold.
 *
 * - `flow`: an order, booking, purchase, inspection or session holds it, and
 *   that flow's screen at `href` is where it is released or cancelled.
 * - `generic`: nothing owns it; the buyer releases or cancels it herself.
 * - `orphaned`: its type names a flow but the flow's record is not there. It
 *   can be given back to the buyer, which harms nobody, but never released to
 *   a seller on nobody's say-so.
 */
export type HoldOwner =
  | { kind: 'flow'; flow: string; href: string; label: string }
  | { kind: 'generic' }
  | { kind: 'orphaned' };

async function ownerOf(hold: HoldRecord, sessionsByIntent?: Map<string, string>): Promise<HoldOwner> {
  if (hold.serviceOrder) {
    return { kind: 'flow', flow: 'service_order', href: `/skills-marketplace/orders/${hold.serviceOrder.id}`, label: 'Open the order' };
  }
  if (hold.serviceBooking) {
    return { kind: 'flow', flow: 'service_booking', href: '/skills-marketplace/bookings', label: 'Open your bookings' };
  }
  if (hold.serviceProposal) {
    // The web app has no page for a brief yet, so this points at the marketplace
    // rather than at an address that would not open.
    return { kind: 'flow', flow: 'custom_request', href: '/skills-marketplace', label: 'Open the marketplace' };
  }
  if (hold.vehiclePurchase) {
    return { kind: 'flow', flow: 'vehicle_purchase', href: `/dashboard/cars/purchases/${hold.vehiclePurchase.id}`, label: 'Open the purchase' };
  }
  if (hold.vehicleInspection) {
    return { kind: 'flow', flow: 'vehicle_inspection', href: `/cars/preloved/${hold.vehicleInspection.listingId}`, label: 'Open the listing' };
  }
  if (hold.mechanicBooking) {
    return { kind: 'flow', flow: 'car_service', href: '/dashboard/cars/bookings', label: 'Open your bookings' };
  }

  if (hold.paymentIntentId) {
    const sessionId = sessionsByIntent
      ? sessionsByIntent.get(hold.paymentIntentId) ?? null
      : (
          await prisma.mentorSession.findUnique({
            where: { stripePaymentIntentId: hold.paymentIntentId },
            select: { id: true },
          })
        )?.id ?? null;
    if (sessionId) {
      return { kind: 'flow', flow: 'mentor_session', href: `/dashboard/mentors/sessions?session=${sessionId}`, label: 'Open the session' };
    }
  }

  return hold.sessionType && FLOW_OWNED_SESSION_TYPES.includes(hold.sessionType)
    ? { kind: 'orphaned' }
    : { kind: 'generic' };
}

/** Mentor sessions behind a set of holds, looked up in one query. */
async function sessionsFor(holds: HoldRecord[]): Promise<Map<string, string>> {
  const intentIds = holds
    .filter(
      h =>
        !h.serviceOrder &&
        !h.serviceBooking &&
        !h.serviceProposal &&
        !h.vehiclePurchase &&
        !h.vehicleInspection &&
        !h.mechanicBooking
    )
    .map(h => h.paymentIntentId)
    .filter((id): id is string => Boolean(id));
  if (intentIds.length === 0) return new Map();

  const sessions = await prisma.mentorSession.findMany({
    where: { stripePaymentIntentId: { in: intentIds } },
    select: { id: true, stripePaymentIntentId: true },
  });
  return new Map(
    sessions
      .filter((s): s is { id: string; stripePaymentIntentId: string } => Boolean(s.stripePaymentIntentId))
      .map(s => [s.stripePaymentIntentId, s.id])
  );
}

export interface BuyerHold {
  id: string;
  paymentIntentId: string | null;
  description: string;
  kind: string;
  /** In minor units of `currency`. */
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  /** When the hold on her card runs out, while it is still held. */
  lapsesAt: string | null;
  /** Who the money goes to when it is released. */
  payee: string;
  owner: HoldOwner;
  /** Whether she can release it from the holds screen: a generic hold with a card behind it. */
  canRelease: boolean;
  /** Whether she can give it back to herself from the holds screen. */
  canCancel: boolean;
}

function displayName(user: { displayName: string | null; firstName: string; lastName: string } | null): string {
  if (!user) return 'A member';
  if (user.displayName?.trim()) return user.displayName.trim();
  const initial = user.lastName?.trim() ? ` ${user.lastName.trim().charAt(0)}.` : '';
  return `${user.firstName}${initial}`.trim() || 'A member';
}

/**
 * The holds on a buyer's card, and the ones settled in the last ninety days,
 * newest first. Each says where it is released from: this screen for a hold no
 * flow owns, the flow's own page for the rest.
 */
export async function listBuyerHolds(userId: string, now = new Date()): Promise<BuyerHold[]> {
  const rows = await prisma.escrowPayment.findMany({
    where: {
      buyerId: userId,
      OR: [
        { status: { in: HELD_STATUSES } },
        { updatedAt: { gte: new Date(now.getTime() - SETTLED_LOOKBACK_MS) } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      ...HOLD_RECORD_SELECT,
      amount: true,
      currency: true,
      status: true,
      description: true,
      createdAt: true,
      // Where Stripe's own deadline for the hold is kept; see escrow-deadline.
      metadata: true,
      seller: { select: { displayName: true, firstName: true, lastName: true } },
    },
  });

  const sessions = await sessionsFor(rows);

  return Promise.all(
    rows.map(async row => {
      const owner = await ownerOf(row, sessions);
      const held = HELD_STATUSES.includes(row.status);
      return {
        id: row.id,
        paymentIntentId: row.paymentIntentId,
        description: row.description || KIND_LABELS[row.sessionType ?? ''] || 'Payment',
        kind: KIND_LABELS[row.sessionType ?? ''] ?? 'Payment',
        amount: row.amount,
        currency: row.currency.toUpperCase(),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        lapsesAt: held && row.status === 'AUTHORIZED' ? holdDeadlineOf(row).toISOString() : null,
        payee: displayName(row.seller),
        owner,
        canRelease: held && row.status === 'AUTHORIZED' && owner.kind === 'generic' && Boolean(row.paymentIntentId),
        canCancel: held && owner.kind !== 'flow' && Boolean(row.paymentIntentId),
      };
    })
  );
}

/**
 * Refuses a member who tries to move, through the generic capture or cancel
 * route, a hold that a flow owns.
 *
 * Those routes accepted any hold, so a buyer could release a car purchase's
 * money outside the purchase flow, which then still read "paid, held" with the
 * seller already paid, and either party could cancel a hold on a marketplace
 * order that the order's own page still showed as held. The flows' routes check
 * their own state before they move money; these routes cannot. Admins keep
 * both routes for every hold, because they are how a hold nobody else will move
 * gets moved. An orphaned hold may be cancelled — the money goes back to the
 * buyer — and never released.
 */
export async function assertMemberMayMoveHold(
  paymentIntentId: string,
  actor: { id: string; role?: string },
  action: 'release' | 'cancel'
): Promise<void> {
  if (actor.role === 'ADMIN') return;

  const hold = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
    select: { ...HOLD_RECORD_SELECT, buyerId: true, sellerId: true },
  });

  // The escrow service gives a stranger the same 404 as an unknown id; this
  // check must not become the oracle that one avoids.
  if (!hold || (hold.buyerId !== actor.id && hold.sellerId !== actor.id)) {
    throw new ApiError(404, 'Escrow payment not found');
  }

  const owner = await ownerOf(hold);

  if (owner.kind === 'flow') {
    throw new ApiError(
      409,
      `This payment belongs to a ${KIND_LABELS[owner.flow]?.toLowerCase() ?? 'booking'}, so it is released or cancelled from there.`
    );
  }

  if (owner.kind === 'orphaned' && action === 'release') {
    throw new ApiError(
      409,
      'Nothing is attached to this payment any more, so it cannot be released to anybody. You can cancel it to have the hold on your card removed.'
    );
  }
}

export interface EscrowFlowSummary {
  /** The flow's name: service_order, mentor_session, vehicle_purchase, and so on. */
  flow: string;
  /** What the staff reading a card dispute would call it. */
  label: string;
  id: string;
  /** Where that flow has got to, in its own words. */
  status: string;
}

/**
 * What each of a set of escrow rows is paying for, for the people who read a card
 * dispute and need to know which order, booking, purchase or session the bank is
 * asking about. A row no flow claims (a generic hold) is left out of the answer.
 * One query for the escrow rows and one more for the sessions, whatever the count.
 */
export async function summariseEscrowFlows(escrowIds: string[]): Promise<Map<string, EscrowFlowSummary>> {
  const found = new Map<string, EscrowFlowSummary>();
  if (escrowIds.length === 0) return found;

  const rows = await prisma.escrowPayment.findMany({
    where: { id: { in: escrowIds } },
    select: {
      id: true,
      paymentIntentId: true,
      serviceOrder: { select: { id: true, status: true } },
      serviceBooking: { select: { id: true, status: true } },
      serviceProposal: { select: { id: true, status: true } },
      vehiclePurchase: { select: { id: true, status: true } },
      vehicleInspection: { select: { id: true, status: true } },
      mechanicBooking: { select: { id: true, status: true } },
    },
  });

  const claimed = (
    row: (typeof rows)[number]
  ): { flow: string; id: string; status: string } | null => {
    if (row.serviceOrder) return { flow: 'service_order', ...row.serviceOrder };
    if (row.serviceBooking) return { flow: 'service_booking', ...row.serviceBooking };
    if (row.serviceProposal) return { flow: 'custom_request', ...row.serviceProposal };
    if (row.vehiclePurchase) return { flow: 'vehicle_purchase', ...row.vehiclePurchase };
    if (row.vehicleInspection) return { flow: 'vehicle_inspection', ...row.vehicleInspection };
    if (row.mechanicBooking) return { flow: 'car_service', ...row.mechanicBooking };
    return null;
  };

  const unclaimedIntents: string[] = [];
  for (const row of rows) {
    const flow = claimed(row);
    if (flow) found.set(row.id, { ...flow, label: KIND_LABELS[flow.flow] ?? 'Payment' });
    else if (row.paymentIntentId) unclaimedIntents.push(row.paymentIntentId);
  }

  if (unclaimedIntents.length > 0) {
    const sessions = await prisma.mentorSession.findMany({
      where: { stripePaymentIntentId: { in: unclaimedIntents } },
      select: { id: true, status: true, stripePaymentIntentId: true },
    });
    const bySession = new Map(sessions.map((s) => [s.stripePaymentIntentId, s]));
    for (const row of rows) {
      const session = row.paymentIntentId ? bySession.get(row.paymentIntentId) : undefined;
      if (session && !found.has(row.id)) {
        found.set(row.id, { flow: 'mentor_session', label: KIND_LABELS.mentor_session, id: session.id, status: session.status });
      }
    }
  }

  return found;
}

export interface AdminHeldEscrow {
  id: string;
  paymentIntentId: string | null;
  buyerId: string;
  sellerId: string;
  kind: string;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  lapsesAt: string;
  owner: HoldOwner;
}

/**
 * Every hold still held, oldest first — the ones closest to lapsing at the top —
 * for the admins who release or cancel a hold nobody else will.
 */
export async function listHeldEscrowForAdmin(
  query: { cursor?: string; limit?: number } = {}
): Promise<{ holds: AdminHeldEscrow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 50), 1), 200);

  const rows = await prisma.escrowPayment.findMany({
    where: { status: { in: HELD_STATUSES } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      ...HOLD_RECORD_SELECT,
      buyerId: true,
      sellerId: true,
      amount: true,
      currency: true,
      status: true,
      description: true,
      createdAt: true,
      metadata: true,
    },
  });

  const page = rows.slice(0, limit);
  const sessions = await sessionsFor(page);

  return {
    holds: await Promise.all(
      page.map(async row => ({
        id: row.id,
        paymentIntentId: row.paymentIntentId,
        buyerId: row.buyerId,
        sellerId: row.sellerId,
        kind: KIND_LABELS[row.sessionType ?? ''] ?? 'Payment',
        description: row.description,
        amount: row.amount,
        currency: row.currency.toUpperCase(),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        lapsesAt: holdDeadlineOf(row).toISOString(),
        owner: await ownerOf(row, sessions),
      }))
    ),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}
