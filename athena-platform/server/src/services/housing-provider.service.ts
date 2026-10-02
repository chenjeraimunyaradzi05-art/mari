/**
 * Who ATHENA has checked as a provider of confidential housing, and what that
 * check is worth once it is given.
 *
 * "Checked by ATHENA staff" on a DV-safe, emergency or transitional place is a
 * promise to a woman in a hard moment. Until this module the promise rested on
 * a look at the listing: a staff member read what the lister had written and
 * ticked a box, and nothing recorded who the lister was. Anyone with an account
 * could offer a "safe room", and the badge said ATHENA had checked it.
 *
 * Now the badge needs two things. The place is checked by a person who writes
 * down what they checked (the housing route), and the person offering it holds
 * a provider check that is approved and has not run out (this module). The
 * check is one row per member: the member says who they are and how they are
 * connected to the places they list, a member of staff decides it, and it ends
 * after a year unless staff renew it. When it ends, for any reason, the member's
 * badged listings come
 * off the list and go back to the queue (sweepProviderChecks).
 *
 * What this module does not do, and the code does not pretend to: it does not
 * run police or background checks. Those are sensitive information under the
 * Privacy Act 1988 (APP 3), need the person's informed consent, a collection
 * notice and a lawful basis, and are normally obtained through an accredited
 * police-check provider. None of that is built, so none is claimed anywhere in
 * the product. What staff can honestly record today is what they did: an ABN
 * looked up, references called, a partner agreement on file, an identity
 * sighted. docs/security/host-employer-checks.md says the same for hosts.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { recordFailure } from '../utils/ops-metrics';
import { bestEffort } from '../utils/best-effort';
import { ApiError } from '../middleware/errorHandler';
import { digitsOnly, formatAbn, isConfigured as abrConfigured, isValidAbn, lookupAbn } from './abr.service';
import { CONFIDENTIAL_LISTING_TYPES, dvSafeNoteOf, withSafetyCheckRequest } from './housing-supply.service';

export const PROVIDER_RELATIONSHIPS = ['OWNER', 'AGENT', 'SERVICE'] as const;
export type ProviderRelationship = (typeof PROVIDER_RELATIONSHIPS)[number];

export const PROVIDER_RELATIONSHIP_LABELS: Record<ProviderRelationship, string> = {
  OWNER: 'I own the places I list',
  AGENT: 'I am an agent or manager for the owner',
  SERVICE: 'I list places for a housing service or charity',
};

/** How long an approved provider check stands unless staff say otherwise. A year, as for practitioners. */
export const PROVIDER_CHECK_DEFAULT_DAYS = 365;
/** The longest staff may set one for. Past this it is not a check, it is trust. */
export const PROVIDER_CHECK_MAX_DAYS = 730;
/** Staff are shown checks that end within this many days, so a renewal is not left until the sweep takes listings down. */
export const PROVIDER_CHECK_RENEWAL_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sent when staff try to badge a place whose lister has no standing provider check. */
export const PROVIDER_CHECK_REQUIRED =
  'The person offering this place has not been checked by ATHENA yet, so it cannot be marked as checked. Review the provider check of whoever listed it first, under Provider checks.';

/** What the member is told when a listing is held because they have no standing provider check. */
export const PROVIDER_CHECK_HELD_NOTE =
  'ATHENA also checks the person offering a DV-safe, emergency or transitional place. Ask for that check under "Your provider check" and a member of staff will look at it.';

export type ProviderStanding = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

type StandingSource = { status: string; expiresAt?: Date | string | null };

/**
 * Where a provider check stands right now. An approved check with no end date,
 * or one whose end date has passed, is EXPIRED whatever the stored status says:
 * the hourly sweep writes the status, but the answer must not wait for it.
 */
export function providerStanding(row: StandingSource | null | undefined, now: Date = new Date()): ProviderStanding {
  if (!row) return 'NONE';
  if (row.status === 'APPROVED') {
    const ends = row.expiresAt ? new Date(row.expiresAt).getTime() : NaN;
    return Number.isFinite(ends) && ends > now.getTime() ? 'APPROVED' : 'EXPIRED';
  }
  if (row.status === 'PENDING' || row.status === 'REJECTED' || row.status === 'EXPIRED') return row.status;
  return 'NONE';
}

/** Whether this member's listings may carry the checked badge. Fails closed: a read that cannot be made is "no". */
export async function isProviderVerified(userId: string | null | undefined, now: Date = new Date()): Promise<boolean> {
  if (!userId) return false;
  const row = await prisma.housingProviderVerification.findUnique({
    where: { userId },
    select: { status: true, expiresAt: true },
  });
  return providerStanding(row, now) === 'APPROVED';
}

/** The standing of several members at once, for the admin queue. Members with no row are NONE. */
export async function providerStandings(userIds: string[], now: Date = new Date()): Promise<Map<string, { standing: ProviderStanding; expiresAt: string | null }>> {
  const out = new Map<string, { standing: ProviderStanding; expiresAt: string | null }>();
  const ids = [...new Set(userIds.filter(Boolean))];
  for (const id of ids) out.set(id, { standing: 'NONE', expiresAt: null });
  if (ids.length === 0) return out;
  const rows = await prisma.housingProviderVerification.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, status: true, expiresAt: true },
  });
  for (const row of rows) {
    out.set(row.userId, { standing: providerStanding(row, now), expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null });
  }
  return out;
}

// ------------------------------------------------------------- what a member says

const optionalAbn = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .refine((v) => isValidAbn(v), 'is not a valid ABN. It is 11 digits.')
    .optional()
);

/** The member's request to be checked as a provider. */
export const providerApplicationSchema = z.object({
  providerName: z.string({ required_error: 'is required' }).trim().min(2, 'is required').max(120, 'is at most 120 characters'),
  relationship: z.enum(PROVIDER_RELATIONSHIPS, { errorMap: () => ({ message: `is one of ${PROVIDER_RELATIONSHIPS.join(', ')}` }) }),
  abn: optionalAbn,
  statement: z
    .string({ required_error: 'is required' })
    .trim()
    .min(20, 'needs a sentence or two: what places you list and how you know them')
    .max(1000, 'is at most 1000 characters'),
});

export type ProviderApplication = z.infer<typeof providerApplicationSchema>;

/** A zod refusal as a 400 naming the field, the way the housing staff input does. */
export function parseProviderInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'request'} ${issue.message}` : 'Invalid request');
  }
  return parsed.data;
}

/** What a member may read of their own record. Staff's basis for an approval stays with staff; a refusal's reason is the member's to read. */
export function presentProviderCheck(
  row: {
    providerName: string;
    relationship: string;
    abn: string | null;
    statement: string | null;
    status: string;
    basis: string | null;
    reviewedAt: Date | null;
    expiresAt: Date | null;
    submittedAt: Date;
  } | null,
  now: Date = new Date()
) {
  const standing = providerStanding(row, now);
  if (!row) return { standing, canApply: true, renewable: false };
  const ends = row.expiresAt ? row.expiresAt.getTime() : null;
  const renewable = standing === 'APPROVED' && ends !== null && ends - now.getTime() <= PROVIDER_CHECK_RENEWAL_WINDOW_DAYS * DAY_MS;
  return {
    standing,
    // The member can (re)apply unless a check stands, or one is already waiting; a standing check due to end soon can be renewed.
    canApply: standing !== 'APPROVED' || renewable,
    renewable,
    providerName: row.providerName,
    relationship: row.relationship,
    abn: row.abn ? formatAbn(row.abn) : null,
    statement: row.statement,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    ...(standing === 'REJECTED' && row.basis ? { decisionNote: row.basis } : {}),
  };
}

/**
 * Take a member's request. One row each: a refused or lapsed member asks again
 * by rewriting it, a waiting one edits it in place, and one whose check stands
 * may ask again only when it is close to ending.
 *
 * A renewal keeps the old check standing while staff look at the new one. The
 * row is not reset to PENDING in that case; the new details are held in the
 * statement and staff renew through the decision route, which writes the new
 * end date. That is why a renewal is only taken inside the window: outside it
 * there is nothing to renew.
 */
export async function submitProviderCheck(userId: string, input: ProviderApplication, now: Date = new Date()) {
  const existing = await prisma.housingProviderVerification.findUnique({ where: { userId } });
  const standing = providerStanding(existing, now);

  if (standing === 'APPROVED') {
    const ends = existing!.expiresAt!.getTime();
    if (ends - now.getTime() > PROVIDER_CHECK_RENEWAL_WINDOW_DAYS * DAY_MS) {
      throw new ApiError(409, `Your provider check stands until ${existing!.expiresAt!.toLocaleDateString('en-AU', { dateStyle: 'long', timeZone: 'Australia/Brisbane' })}. You can ask for it to be renewed in the month before it ends.`);
    }
    // Close to ending: ask for a renewal without taking the standing check away.
    return prisma.housingProviderVerification.update({
      where: { userId },
      data: { providerName: input.providerName, relationship: input.relationship, abn: input.abn ? digitsOnly(input.abn) : null, statement: input.statement, submittedAt: now },
    });
  }

  const data = {
    providerName: input.providerName,
    relationship: input.relationship,
    abn: input.abn ? digitsOnly(input.abn) : null,
    statement: input.statement,
    status: 'PENDING' as const,
    submittedAt: now,
  };
  // A fresh request clears the last decision, so a refusal's reason is not
  // shown beside a request that has not been looked at.
  return prisma.housingProviderVerification.upsert({
    where: { userId },
    create: { userId, ...data },
    update: { ...data, basis: null, evidence: Prisma.DbNull, reviewedById: null, reviewedAt: null, expiresAt: null },
  });
}

// ------------------------------------------------------------- what staff decide

/** The checks staff say they ran. Free text carries the rest; these are the ones worth counting later. */
const evidenceChecks = z
  .object({
    abnChecked: z.boolean().optional(),
    referencesCalled: z.boolean().optional(),
    partnerAgreementOnFile: z.boolean().optional(),
    identitySighted: z.boolean().optional(),
  })
  .strict();

/** A staff decision on a provider's check. */
export const providerDecisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    // What staff checked, in their words (approve), or why not (reject, shown to the member).
    basis: z
      .string({ required_error: 'is required' })
      .trim()
      .min(10, 'needs at least a sentence: who you spoke to and what you checked, or why not'),
    checks: evidenceChecks.optional(),
    // Days the approved check stands. Defaults to a year.
    validForDays: z.coerce.number().int().min(1).max(PROVIDER_CHECK_MAX_DAYS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.basis.length > 1000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['basis'], message: 'is at most 1000 characters' });
  });

export type ProviderDecision = z.infer<typeof providerDecisionSchema>;

/**
 * What the ABR said about the ABN a provider gave, if a lookup is configured.
 * Only the entity name and the ABN's status are kept: that is what a reviewer
 * compares against the provider's name, and the rest of the record is the ABR's
 * to publish. A lookup that cannot be made is recorded as such rather than as a
 * pass.
 */
async function abnEvidence(abn: string | null | undefined, now: Date) {
  if (!abn) return null;
  if (!abrConfigured()) return { lookup: 'NOT_CONFIGURED' as const, abn: digitsOnly(abn), checkedAt: now.toISOString() };
  try {
    const entity = await lookupAbn(abn);
    if (!entity) return { lookup: 'NOT_FOUND' as const, abn: digitsOnly(abn), checkedAt: now.toISOString() };
    return { lookup: 'FOUND' as const, abn: digitsOnly(abn), entityName: entity.entityName, abnStatus: entity.abnStatus, checkedAt: now.toISOString() };
  } catch (error) {
    logger.warn('The ABR could not be asked about a housing provider', { error: error instanceof Error ? error.message : String(error) });
    return { lookup: 'UNAVAILABLE' as const, abn: digitsOnly(abn), checkedAt: now.toISOString() };
  }
}

/**
 * Write staff's decision on a member's provider check. Approving needs the
 * basis, and starts the end date; refusing needs the reason, which the member
 * is shown. The caller writes the audit row and tells the member.
 */
export async function decideProviderCheck(userId: string, decision: ProviderDecision, reviewerId: string, now: Date = new Date()) {
  const row = await prisma.housingProviderVerification.findUnique({ where: { userId } });
  if (!row) throw new ApiError(404, 'That member has not asked to be checked as a provider.');

  // A refusal stands until the member asks again, with whatever they have to
  // add. Staff can refuse at any time, a standing check included (that is how
  // one is withdrawn), but cannot turn a refusal into an approval nobody asked for.
  if (decision.decision === 'APPROVE' && row.status === 'REJECTED') {
    throw new ApiError(409, 'This check was refused. The member has to ask again before it can be approved.');
  }

  if (decision.decision === 'REJECT') {
    return {
      before: row,
      after: await prisma.housingProviderVerification.update({
        where: { userId },
        data: { status: 'REJECTED', basis: decision.basis, reviewedById: reviewerId, reviewedAt: now, expiresAt: null },
      }),
    };
  }

  const days = decision.validForDays ?? PROVIDER_CHECK_DEFAULT_DAYS;
  const abn = await abnEvidence(row.abn, now);
  const evidence = { ...(decision.checks ? { checks: decision.checks } : {}), ...(abn ? { abn } : {}) };
  return {
    before: row,
    after: await prisma.housingProviderVerification.update({
      where: { userId },
      data: {
        status: 'APPROVED',
        basis: decision.basis,
        evidence: Object.keys(evidence).length ? (evidence as Prisma.InputJsonValue) : Prisma.DbNull,
        reviewedById: reviewerId,
        reviewedAt: now,
        expiresAt: new Date(now.getTime() + days * DAY_MS),
      },
    }),
  };
}

// ------------------------------------------------------------- the sweep

const BADGED_CONFIDENTIAL_WHERE: Prisma.HousingListingWhereInput = {
  safetyVerified: true,
  status: { notIn: ['WITHDRAWN', 'LEASED'] },
  OR: [{ dvSafe: true }, { type: { in: [...CONFIDENTIAL_LISTING_TYPES] } }],
};

/** How many badged listings one sweep reads: every one there will be for a long time. */
const SWEEP_WINDOW = 1000;

export interface ProviderSweepResult {
  lapsed: number;
  listingsTakenDown: number;
  membersTold: number;
}

/**
 * Keep the badge honest: a confidential listing carries "checked" only while
 * its lister's provider check stands.
 *
 * Two steps. Checks whose end date has passed are marked EXPIRED. Then every
 * badged confidential listing is looked at, and any whose lister has no
 * standing check (expired, refused, asked again, or never recorded) loses the
 * badge, goes off the list as PENDING, and is put back in the queue with a new
 * clock so staff see it. The second step does not depend on the first having
 * run, which is the point: the invariant is "no badge without a standing
 * check", however the standing was lost.
 *
 * Built to run hourly on the scheduled-tasks worker beside the overdue sweep.
 * It never throws; a failure is logged and put on the operations screen, and
 * the next hour starts from the records again.
 */
export async function sweepProviderChecks(
  now: Date = new Date(),
  scope: { userId?: string; tell?: boolean } = {}
): Promise<ProviderSweepResult> {
  const result: ProviderSweepResult = { lapsed: 0, listingsTakenDown: 0, membersTold: 0 };

  // A decision that ends one member's check (staff refusing it, or withdrawing
  // one that stood) runs the second step for that member alone, straight away, so
  // their
  // badged listings do not stay up until the next hour.
  if (!scope.userId) {
    try {
      const lapsed = await prisma.housingProviderVerification.updateMany({
        where: { status: 'APPROVED', OR: [{ expiresAt: { lte: now } }, { expiresAt: null }] },
        data: { status: 'EXPIRED' },
      });
      result.lapsed = lapsed.count;
    } catch (error) {
      logger.error('Housing provider checks could not be marked as expired', { error: error instanceof Error ? error.message : String(error) });
      recordFailure('housing.provider-check-sweep', error);
      // Carry on: the second step reads standing from the dates, not the status.
    }
  }

  let badged: Array<{ id: string; agentId: string | null; title: string; features: string[] }>;
  try {
    badged = await prisma.housingListing.findMany({
      where: scope.userId ? { ...BADGED_CONFIDENTIAL_WHERE, agentId: scope.userId } : BADGED_CONFIDENTIAL_WHERE,
      select: { id: true, agentId: true, title: true, features: true },
      orderBy: { createdAt: 'asc' },
      take: SWEEP_WINDOW,
    });
  } catch (error) {
    logger.error('Badged housing listings could not be read for the provider sweep', { error: error instanceof Error ? error.message : String(error) });
    recordFailure('housing.provider-check-sweep', error);
    return result;
  }
  if (badged.length === 0) return result;

  let standings: Map<string, { standing: ProviderStanding; expiresAt: string | null }>;
  try {
    standings = await providerStandings(badged.map((l) => l.agentId ?? ''), now);
  } catch (error) {
    logger.error('Housing provider checks could not be read for the provider sweep', { error: error instanceof Error ? error.message : String(error) });
    recordFailure('housing.provider-check-sweep', error);
    return result;
  }

  // Per member: which of their places came down, and whether they have never had
  // a provider check on record. A place badged before provider checks existed
  // has no check to have "ended", and saying so would be untrue.
  const takenDownByMember = new Map<string, { titles: string[]; neverChecked: boolean }>();
  for (const listing of badged) {
    const standing = listing.agentId ? standings.get(listing.agentId)?.standing ?? 'NONE' : 'NONE';
    if (standing === 'APPROVED') continue;
    try {
      // Conditional, so a listing staff re-approved a moment ago (the provider
      // renewed in between) is not taken down on the strength of the read above.
      const { count } = await prisma.housingListing.updateMany({
        where: { id: listing.id, safetyVerified: true },
        data: {
          safetyVerified: false,
          status: 'PENDING',
          features: withSafetyCheckRequest(listing.features, dvSafeNoteOf(listing.features) ?? '', now),
        },
      });
      if (count === 0) continue;
      result.listingsTakenDown += 1;
      if (listing.agentId) {
        const before = takenDownByMember.get(listing.agentId);
        takenDownByMember.set(listing.agentId, { titles: [...(before?.titles ?? []), listing.title], neverChecked: standing === 'NONE' });
      }
    } catch (error) {
      logger.error('A housing listing without a standing provider check could not be taken down', {
        listingId: listing.id,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('housing.provider-check-sweep', error);
    }
  }

  // The caller has a message of its own for the member when it is the one that
  // ended the member's check, so the sweep does not say the same thing twice.
  if (scope.tell === false) return result;

  for (const [userId, { titles, neverChecked }] of takenDownByMember) {
    const shown = titles.slice(0, 3).map((t) => `"${t}"`).join(', ');
    const more = titles.length > 3 ? ` and ${titles.length - 3} more` : '';
    const subject = `${shown}${more} ${titles.length === 1 ? 'is' : 'are'} off the list and no longer show${titles.length === 1 ? 's' : ''} as checked`;
    const told = await bestEffort(
      'notification.housing-provider-check-ended',
      () =>
        prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM',
            title: neverChecked ? 'Your places need a provider check' : 'Your provider check has ended',
            message: neverChecked
              ? `${subject}. ATHENA now checks the person offering a DV-safe, emergency or transitional place as well as the place, and there is no provider check on record for you yet. Ask for one under "Your provider check" and a member of staff will look at it.`
              : `${subject}, because your provider check is no longer current. Ask for a new check under "Your provider check" and a member of staff will look at it.`,
            link: '/dashboard/housing#provider-check',
            data: { kind: neverChecked ? 'HOUSING_PROVIDER_CHECK_NEEDED' : 'HOUSING_PROVIDER_CHECK_ENDED', count: titles.length } as Prisma.InputJsonValue,
          },
        }),
      null
    );
    if (told) result.membersTold += 1;
  }

  return result;
}
