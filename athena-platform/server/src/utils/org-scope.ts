/**
 * Membership, for everything that is kept per organisation.
 *
 * The rule these two functions exist to enforce: scope is derived from the
 * caller, never from the query string. An organizationId off the wire may
 * narrow a scope the caller already has — it may never grant one. That was not
 * true of the ledger, the BAS worksheet or the stock lists, each of which took
 * the id on trust, and organisation ids are not secret: the public directory
 * hands them out.
 */

import { prisma } from './prisma';
import { ApiError } from '../middleware/errorHandler';

/** Throws 403 unless the caller is a member of this organisation. */
export async function assertOrgMembership(organizationId: string, userId: string): Promise<void> {
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (!membership) {
    throw new ApiError(403, 'Access denied');
  }
}

/** Every organisation the caller belongs to, for listing across all of them at once. */
export async function memberOrganizationIds(userId: string): Promise<string[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  return memberships.map((membership) => membership.organizationId);
}
