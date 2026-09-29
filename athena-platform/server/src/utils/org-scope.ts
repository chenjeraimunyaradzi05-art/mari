/**
 * Membership, for everything that is kept per organisation.
 *
 * The rule these two functions exist to enforce: scope is derived from the
 * caller, never from the query string. An organizationId off the wire may
 * narrow a scope the caller already has — it may never grant one. That was not
 * true of the ledger, the BAS worksheet or the stock lists, each of which took
 * the id on trust, and organisation ids are not secret: the public directory
 * hands them out.
 *
 * A member is someone who has accepted. An OrganizationMember row is written
 * when she is invited, before she has said yes, and both functions used to
 * count that row, so an invitation nobody had answered opened the
 * organisation's ledger, its BAS worksheet and its stock lists to whoever it
 * was addressed to. The filter is the one services/hiring-access.service
 * names ACCEPTED_MEMBER_WHERE, written out here so this file keeps depending
 * on nothing above utils.
 */

import { prisma } from './prisma';
import { ApiError } from '../middleware/errorHandler';

const ACCEPTED = { acceptedAt: { not: null } } as const;

/** Throws 403 unless the caller is an accepted member of this organisation. */
export async function assertOrgMembership(organizationId: string, userId: string): Promise<void> {
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId, ...ACCEPTED },
    select: { id: true },
  });
  if (!membership) {
    throw new ApiError(403, 'Access denied');
  }
}

/** Every organisation the caller has accepted membership of, for listing across all of them at once. */
export async function memberOrganizationIds(userId: string): Promise<string[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, ...ACCEPTED },
    select: { organizationId: true },
  });
  return memberships.map((membership) => membership.organizationId);
}
