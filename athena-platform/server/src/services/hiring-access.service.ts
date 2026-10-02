/**
 * Who, inside an organisation, may see the women who applied to it, and who may
 * write listings in its name.
 *
 * ## Why this is one module
 *
 * An applicant's row carries her full name, her email address, her cover letter,
 * her résumé link and whatever she answered on the form. She was told those go to
 * "the employer". The employer console worked out who that means —
 * owners, admins and recruiters of the organisation, plus anyone explicitly given
 * posting rights, and only once she has accepted her invitation — but it worked
 * it out privately, inside employer.routes.ts. Every sibling surface that shows
 * the same applicants asked a looser question of its own:
 *
 *   - the apprenticeship staff check accepted any OrganizationMember row of the
 *     RTO or host employer, VIEWER included, and an invitation she had never
 *     answered as well, so the applicant list (emails, cover letters, résumés,
 *     answers, unpaginated) was open to anyone an owner had typed an email for;
 *   - the job-scoped applicant list and status route checked only who had
 *     created the listing, a fact that never changes, so a recruiter removed from
 *     the company kept every candidate she had ever received;
 *   - referee feedback accepted any member row at all.
 *
 * One rule, read from one place, so the surfaces cannot drift apart again.
 *
 * ## The two questions
 *
 * `canViewApplicants` — may this person read and move applicants? An accepted
 * OWNER, ADMIN or RECRUITER, or an accepted member explicitly given posting
 * rights. VIEWER is the schema default and sees counts, not people.
 *
 * `canPostListings` — may this person create, edit or publish a listing in the
 * organisation's name? An accepted OWNER or ADMIN, or an accepted member with
 * posting rights. This is the rule POST /employer/organizations/:orgId/jobs has
 * always applied.
 *
 * In both, an invitation that has not been accepted is not a membership. The row
 * exists from the moment somebody types her email address; until she says yes it
 * grants nothing.
 */

import type { OrganizationMember, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

type MembershipFlags = Pick<OrganizationMember, 'role' | 'canPostJobs' | 'acceptedAt'>;

const HIRING_ROLES: ReadonlyArray<OrganizationMember['role']> = ['OWNER', 'ADMIN', 'RECRUITER'];
const POSTING_ROLES: ReadonlyArray<OrganizationMember['role']> = ['OWNER', 'ADMIN'];

/** The Prisma filter for "an accepted member who may see applicants". */
export const HIRING_MEMBER_WHERE: Prisma.OrganizationMemberWhereInput = {
  acceptedAt: { not: null },
  OR: [{ role: { in: [...HIRING_ROLES] } }, { canPostJobs: true }],
};

/** The Prisma filter for "an accepted member who may write listings". */
export const POSTING_MEMBER_WHERE: Prisma.OrganizationMemberWhereInput = {
  acceptedAt: { not: null },
  OR: [{ role: { in: [...POSTING_ROLES] } }, { canPostJobs: true }],
};

/** The Prisma filter for "an accepted member", whatever her role. */
export const ACCEPTED_MEMBER_WHERE: Prisma.OrganizationMemberWhereInput = {
  acceptedAt: { not: null },
};

export function canViewApplicants(membership: MembershipFlags | null | undefined): boolean {
  if (!membership || !membership.acceptedAt) return false;
  return HIRING_ROLES.includes(membership.role) || membership.canPostJobs;
}

export function canPostListings(membership: MembershipFlags | null | undefined): boolean {
  if (!membership || !membership.acceptedAt) return false;
  return POSTING_ROLES.includes(membership.role) || membership.canPostJobs;
}

export function assertCanViewApplicants(membership: MembershipFlags | null | undefined): void {
  if (!canViewApplicants(membership)) {
    throw new ApiError(403, 'You do not have permission to view applicants for this organisation');
  }
}

/** Whether this user is hiring staff of at least one of these organisations. */
export async function isHiringMemberOfAny(userId: string, organizationIds: string[]): Promise<boolean> {
  if (organizationIds.length === 0) return false;
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId: { in: organizationIds }, ...HIRING_MEMBER_WHERE },
    select: { id: true },
  });
  return Boolean(membership);
}

/**
 * The people who should be told that someone applied: the hiring staff of these
 * organisations. Capped, because an organisation with a very large team is not a
 * reason to send a very large number of notifications about one application.
 */
export async function hiringStaff(
  organizationIds: string[],
  limit = 25
): Promise<{ userId: string; organizationId: string }[]> {
  if (organizationIds.length === 0) return [];
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: { in: organizationIds }, ...HIRING_MEMBER_WHERE },
    select: { userId: true, organizationId: true },
    orderBy: { invitedAt: 'asc' },
    take: limit,
  });

  // One entry per person: someone on the hiring team of both the RTO and the
  // host employer is told once, from the first organisation found.
  const seen = new Set<string>();
  return members.filter((member) => {
    if (seen.has(member.userId)) return false;
    seen.add(member.userId);
    return true;
  });
}

export async function hiringStaffUserIds(organizationIds: string[], limit = 25): Promise<string[]> {
  return (await hiringStaff(organizationIds, limit)).map((member) => member.userId);
}

/**
 * Whether this user may see and move the applicants for one job.
 *
 * A job posted under an organisation belongs to that organisation's hiring team,
 * not to whoever happened to create the row: `postedById` never changes, so a
 * check on it alone is a permission that cannot be taken away. A job posted
 * outside any organisation has nobody else it could belong to, so there the
 * poster is the answer.
 *
 * Staff-wide exceptions (an ADMIN account) are the caller's to add: not every
 * route that asks this wants one.
 */
export async function canManageJobApplicants(
  job: { organizationId: string | null; postedById: string },
  userId: string
): Promise<boolean> {
  if (!job.organizationId) {
    return job.postedById === userId;
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: job.organizationId, userId } },
    select: { role: true, canPostJobs: true, acceptedAt: true },
  });

  return canViewApplicants(membership);
}

/**
 * A résumé on an application has to be a file this platform is holding for the
 * woman who applied.
 *
 * `resumeUrl` used to be validated as "any http(s) URL". Two things go wrong
 * with an arbitrary link. The employer's download button hands an off-platform
 * URL straight to the browser, which turns a hiring team's click into a request
 * to a server somebody else controls, with the referrer and the timing of every
 * shortlisting decision in it. And a link to someone else's upload key would
 * attach another member's résumé to an application in her name — the media
 * download route authorises the reader, not whose file it is.
 *
 * The upload endpoint writes `resumes/<userId>/<file>`, and both the S3 and the
 * local URL end with that path, so requiring the applicant's own id in it is the
 * whole check.
 */
export function assertOwnResumeUpload(resumeUrl: string | undefined | null, userId: string): void {
  if (!resumeUrl) return;

  const segments = resumeUrl.split(/[?#]/)[0].split('/');
  const fileName = segments.pop();
  const owner = segments.pop();
  const folder = segments.pop();

  if (folder !== 'resumes' || owner !== userId || !fileName) {
    throw new ApiError(
      400,
      'Attach a résumé by uploading it here rather than linking to one elsewhere.'
    );
  }
}

// ---------------------------------------------------------------------------
// Who may place apprentices
// ---------------------------------------------------------------------------
//
// An apprentice is often a young person in a first job, placed in a workplace
// ATHENA has never seen. Everything above decides who inside an organisation may
// act for it; none of it asked whether the organisation should be placing
// apprentices at all. A listing could be created already OPEN, published, applied
// to and accepted by an organisation nobody had looked at, because the only
// organisation check that existed (the verified badge) was not read by anything
// on the placement path.
//
// The rule, in one place: an organisation may place apprentices through ATHENA
// only while it is verified (Organization.isVerified) AND holds an approved host
// safety attestation that has not run out (host-safety.service). The routes that
// open a listing, take an application or confirm a placement all ask it.

/**
 * The organisation that hosts the apprentice, whose standing decides whether the
 * placement may go ahead: the host employer when one is named, and otherwise the
 * RTO, which is then the one an apprentice would be working under. A listing
 * that names neither has nobody to be checked, and so cannot be opened.
 */
export const placementOrganisationId = (listing: { hostEmployerId?: string | null; rtoId?: string | null }): string | null =>
  listing.hostEmployerId ?? listing.rtoId ?? null;

export interface HostStandingFlags {
  /** The organisation has been verified by staff (the badge review). */
  verified: boolean;
  /** It holds an approved host safety attestation that has not run out. */
  attested: boolean;
  /** Both: it may place apprentices through ATHENA. */
  mayPlace: boolean;
}

const NO_STANDING: HostStandingFlags = { verified: false, attested: false, mayPlace: false };

/**
 * What staff are told when they try to open a listing, or confirm a placement,
 * for an organisation that has not been checked.
 */
export const HOST_NOT_CHECKED_FOR_STAFF =
  'Before apprentices can be placed through ATHENA, your organisation has to be verified and its host safety attestation approved. You can do both from the apprenticeships page of your organisation.';

/** What an applicant is told when the host of a listing has not been checked. */
export const HOST_NOT_CHECKED_FOR_APPLICANT =
  'ATHENA has not safety-checked this host yet, so applications through ATHENA are not open for this apprenticeship. You can still read about it, and we will show it as checked once the host has been.';

/**
 * How each of these organisations stands, in one read. An unknown id is simply
 * absent from the answer, and every caller treats absent as "not checked": the
 * question is only ever asked in the direction where a missing answer means no.
 */
export async function hostStandings(
  organizationIds: Array<string | null | undefined>,
  now: Date = new Date()
): Promise<Map<string, HostStandingFlags>> {
  const ids = [...new Set(organizationIds.filter((id): id is string => Boolean(id)))];
  const out = new Map<string, HostStandingFlags>();
  if (ids.length === 0) return out;

  const orgs = await prisma.organization.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      isVerified: true,
      hostSafetyAttestations: {
        where: { status: 'APPROVED', expiresAt: { gt: now } },
        select: { id: true },
        take: 1,
      },
    },
  });

  for (const org of orgs) {
    const attested = (org.hostSafetyAttestations ?? []).length > 0;
    out.set(org.id, { verified: Boolean(org.isVerified), attested, mayPlace: Boolean(org.isVerified) && attested });
  }
  return out;
}

/** Whether this organisation may place apprentices through ATHENA right now. */
export async function hostMayPlaceApprentices(organizationId: string | null | undefined, now: Date = new Date()): Promise<boolean> {
  if (!organizationId) return false;
  return (await hostStandings([organizationId], now)).get(organizationId)?.mayPlace === true;
}

/**
 * Refuse with a 409 unless the listing's host may place apprentices. `audience`
 * picks the words: staff are told what to do about it, an applicant is told why
 * applying is not open yet.
 */
export async function assertHostMayPlaceApprentices(
  listing: { hostEmployerId?: string | null; rtoId?: string | null },
  audience: 'staff' | 'applicant',
  now: Date = new Date()
): Promise<void> {
  if (await hostMayPlaceApprentices(placementOrganisationId(listing), now)) return;
  throw new ApiError(409, audience === 'staff' ? HOST_NOT_CHECKED_FOR_STAFF : HOST_NOT_CHECKED_FOR_APPLICANT);
}

/**
 * Each listing with whether its host is verified and safety-checked, for the
 * list, the card and the detail page to say so honestly. A listing whose host has
 * not been checked is still shown, labelled, not hidden: the seeded catalogue
 * names training providers nobody here has checked, and an honest label serves a
 * visitor better than an empty page.
 */
export async function withHostStanding<T extends { hostEmployerId?: string | null; rtoId?: string | null }>(
  items: T[],
  now: Date = new Date()
): Promise<Array<T & { hostVerified: boolean; hostSafetyChecked: boolean; hostMayPlace: boolean }>> {
  const standings = await hostStandings(items.map(placementOrganisationId), now);
  return items.map((item) => {
    const id = placementOrganisationId(item);
    const s = (id && standings.get(id)) || NO_STANDING;
    return { ...item, hostVerified: s.verified, hostSafetyChecked: s.attested, hostMayPlace: s.mayPlace };
  });
}
