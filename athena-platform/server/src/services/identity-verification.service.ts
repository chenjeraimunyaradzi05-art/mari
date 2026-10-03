/**
 * Everything ATHENA does with a Stripe Identity session once Stripe has one.
 *
 * Both identity checks on the platform — the ordinary verified badge and the
 * women-only gate — run the same hosted document-and-selfie page and are told
 * apart only by `metadata.purpose` on the VerificationBadge row. That shared
 * shape is why this module exists. The code that records a passed check used
 * to sit in routes/user.routes.ts, where the Stripe webhook could not reach it
 * without importing one route file from another, so the webhook treated every
 * session as the ordinary badge: a document check taken for the women-only
 * gate was approved on the spot, handed out the Verified mark with no reviewer,
 * and never wrote the evidence the reviewer's queue is built on.
 *
 * ATHENA never receives the document or the selfie. Stripe holds them; what
 * comes back is the legal name, the document type and, when it is on the
 * document, the date of birth. Redaction, below, is how those leave Stripe once
 * a person has made the decision they were collected for.
 */

import { prisma } from '../utils/prisma';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { bestEffort } from '../utils/best-effort';
import { logger } from '../utils/logger';
import { holdCoversIdentityChecks } from '../utils/identity-hold';
import {
  WOMAN_GATE_PURPOSE,
  isPlausibleDateOfBirth,
  meetsMinimumAge,
} from '../middleware/account-gates';

export type StripeVerifiedOutputs = {
  first_name?: string | null;
  last_name?: string | null;
  dob?: { day?: number | null; month?: number | null; year?: number | null } | null;
  id_number_type?: string | null;
} | null;

export type DocumentAgeFlag = 'BELOW_MINIMUM_AGE' | 'IMPLAUSIBLE_DATE';

function metadataObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The Stripe session a badge is waiting on, if its metadata still names one. */
export function sessionIdOf(metadata: unknown): string | null {
  return text(metadataObject(metadata).sessionId);
}

/** When the document check on this badge was recorded as passed, if it has been. */
export function documentCheckPassedAtOf(metadata: unknown): string | null {
  return text(metadataObject(metadata).documentCheckPassedAt);
}

// ------------------------------------------------------- recording a passed check

export type WomanGateDocumentOutcome = {
  /** False when the result had already been written, so nothing was touched. */
  applied: boolean;
  ageFlag: DocumentAgeFlag | null;
};

/**
 * Writes a passed document check onto the member's record: the evidence the
 * reviewer will read, and the date of birth the platform has never had.
 *
 * The date of birth is the part worth having twice over. A member who
 * completes this check has proved her age against a government document, so
 * `ageVerifiedAt` is stamped alongside it and the account stops relying on
 * what she typed at sign-up. An account that already carries a date of birth
 * keeps it unless the document disagrees; the document wins, because it is the
 * better evidence.
 *
 * Only a date that clears the age check is believed that way. A document that
 * says she is under the platform minimum, or gives a date no adult could have,
 * stamps nothing on the account and leaves a flag in the evidence instead: it
 * is the reviewer's call, and the reviewer is stopped from approving the first
 * kind (routes/verification.routes.ts). Writing a child's document date onto
 * the account as "age verified" would have said the opposite of what it found.
 *
 * Safe to call twice, and safe to call twice at the same moment. The webhook and
 * the member's return from Stripe both land here, and they normally land
 * together: Stripe sends the event as the member is sent back to the site. So
 * the three writes (the evidence, the date of birth, the notice) are one
 * transaction, and the first of them is a claim in the database itself: it
 * writes only onto a badge that has not recorded a result yet, and only onto the
 * session this caller read. Whichever caller gets there second changes no row,
 * writes nothing else and announces nothing. Without that, each of the two read
 * "not recorded yet", each wrote, and she was told twice; and with the writes
 * loose, a failure after the first left the evidence recorded but her date of
 * birth never stamped and no notice sent, and the "already recorded" check above
 * then refused to finish the job on the retry.
 */
export async function applyWomanGateDocumentResult(
  userId: string,
  badgeId: string,
  metadata: unknown,
  outputs: StripeVerifiedOutputs
): Promise<WomanGateDocumentOutcome> {
  const base = metadataObject(metadata);
  if (documentCheckPassedAtOf(base)) {
    return { applied: false, ageFlag: ageFlagOf(base) };
  }

  const name = [outputs?.first_name, outputs?.last_name].filter(Boolean).join(' ').trim();
  const dob = outputs?.dob;
  const documentDateOfBirth =
    dob && dob.year && dob.month && dob.day ? new Date(Date.UTC(dob.year, dob.month - 1, dob.day)) : null;

  let ageFlag: DocumentAgeFlag | null = null;
  if (documentDateOfBirth && !meetsMinimumAge(documentDateOfBirth)) {
    ageFlag = isPlausibleDateOfBirth(documentDateOfBirth) ? 'BELOW_MINIMUM_AGE' : 'IMPLAUSIBLE_DATE';
  }

  // Only what this check adds. It is merged into the metadata in the database,
  // so whatever else is on the badge (a redaction stamp, say) is never written
  // over with a copy read earlier.
  const patch = {
    purpose: WOMAN_GATE_PURPOSE,
    provider: 'stripe_identity',
    documentCheckPassedAt: new Date().toISOString(),
    ...(name ? { documentName: name } : {}),
    ...(outputs?.id_number_type ? { documentType: outputs.id_number_type } : {}),
    ...(ageFlag ? { documentAgeFlag: ageFlag } : {}),
  };
  const readSessionId = sessionIdOf(base);

  return prisma.$transaction(async (tx) => {
    // The claim. A badge that already holds a result, or that has been pointed
    // at a different session since it was read (she started again), matches
    // nothing, and this call stops here. Raw SQL because whether a JSON key is
    // absent cannot be said in Prisma's JSON filter.
    const claimed = await tx.$executeRaw`
      UPDATE "VerificationBadge"
      SET "metadata" = COALESCE("metadata", '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
      WHERE "id" = ${badgeId}
        AND ("metadata" ->> 'documentCheckPassedAt') IS NULL
        AND ("metadata" ->> 'sessionId') IS NOT DISTINCT FROM ${readSessionId}::text
    `;
    if (claimed === 0) {
      return { applied: false, ageFlag };
    }

    if (documentDateOfBirth && !ageFlag) {
      await tx.user.update({
        where: { id: userId },
        data: { dateOfBirth: documentDateOfBirth, ageVerifiedAt: new Date() },
      });
    }

    await tx.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Your document check is with a reviewer',
        message: 'Thank you. Your women-only verification is now with a reviewer, and you will hear from us shortly.',
        link: '/dashboard/settings/profile',
      },
    });

    return { applied: true, ageFlag };
  });
}

export type WomanGateDocumentCheck =
  | { outcome: 'recorded' | 'already_recorded'; ageFlag: DocumentAgeFlag | null }
  /** Stripe has not finished, or the member has to go again. `documentCheck` is Stripe's own status word. */
  | { outcome: 'not_ready'; documentCheck: string; reason: string | null };

/**
 * Asks Stripe for the session and, if it passed, records the result.
 *
 * `verified_outputs` carries the document's own fields and is only returned
 * when asked for by name, and the webhook's event payload does not carry it, so
 * the retrieve is what makes either caller worth calling. Both the member's
 * return from the hosted page and the webhook come through here, which is what
 * lets the evidence be written whichever of the two arrives first.
 */
export async function recordWomanGateDocumentCheck(
  userId: string,
  badge: { id: string; metadata: unknown },
  sessionId: string
): Promise<WomanGateDocumentCheck> {
  if (documentCheckPassedAtOf(badge.metadata)) {
    return { outcome: 'already_recorded', ageFlag: ageFlagOf(badge.metadata) };
  }

  const session = await getStripe().identity.verificationSessions.retrieve(sessionId, {
    expand: ['verified_outputs'],
  });

  if (session.status !== 'verified') {
    return {
      outcome: 'not_ready',
      documentCheck: session.status,
      reason: session.last_error?.reason ?? null,
    };
  }

  const result = await applyWomanGateDocumentResult(
    userId,
    badge.id,
    badge.metadata,
    (session.verified_outputs ?? null) as StripeVerifiedOutputs
  );
  return { outcome: result.applied ? 'recorded' : 'already_recorded', ageFlag: result.ageFlag };
}

function ageFlagOf(metadata: unknown): DocumentAgeFlag | null {
  const flag = metadataObject(metadata).documentAgeFlag;
  return flag === 'BELOW_MINIMUM_AGE' || flag === 'IMPLAUSIBLE_DATE' ? flag : null;
}

// ------------------------------------------------------------------ redaction

/**
 * Asks Stripe to erase what it collected for a session, once a person has made
 * the decision the check was collected for, and notes on the badge that it did.
 *
 * Without this Stripe keeps the document images, the selfie and the extracted
 * fields for as long as its own terms allow, which is far longer than the 90
 * days the retention schedule promises for a verification document. Redaction
 * is irreversible, and Stripe says it can take up to four days to finish, so
 * `redactedAt` records that ATHENA asked and the retention sweep
 * (scripts/data-retention.ts) asks again for any decision it finds without one.
 *
 * Never throws and never fails the decision: a refused redaction is logged
 * through bestEffort and picked up by the sweep. Stripe only redacts a session
 * that is `verified` or `requires_input`, so a cancelled or still-processing one
 * answers with an error here and is simply tried again later.
 *
 * A member named in an active legal hold is left alone, and so is everyone's
 * identity check while a hold names identity verification (or everything): the
 * same scope the sweep applies to its rows, because destroying a record
 * somebody is legally required to keep cannot be undone. When the hold lookup
 * itself fails the answer is also to leave it, because the sweep will ask again
 * and a redaction cannot be taken back. The sweep has already applied the full
 * hold scope to its rows and passes `holdsChecked` so each is not looked up
 * twice.
 *
 * Returns whether the badge now records a redaction.
 */
export async function redactIdentitySession(
  badge: { id: string; userId: string; metadata: unknown },
  options: { holdsChecked?: boolean } = {}
): Promise<boolean> {
  const sessionId = sessionIdOf(badge.metadata);
  if (!sessionId) return false;
  if (text(metadataObject(badge.metadata).redactedAt)) return true;
  if (!isStripeConfigured()) return false;

  if (!options.holdsChecked) {
    // `null` means the lookup worked and nothing holds this check. Anything
    // else, including a lookup that failed, leaves the session where it is.
    const held = await bestEffort(
      `legal hold lookup for identity badge ${badge.id}`,
      async () => {
        const holds = await prisma.legalHold.findMany({
          where: { isActive: true },
          select: { affectedUserIds: true, affectedDataTypes: true },
        });
        return holds.some((hold) => holdCoversIdentityChecks(hold, badge.userId));
      },
      true
    );
    if (held) return false;
  }

  const redacted = await bestEffort(
    `identity session redaction ${sessionId}`,
    async () => {
      await getStripe().identity.verificationSessions.redact(sessionId);
      return true;
    },
    false
  );
  if (!redacted) return false;

  await bestEffort(`identity badge ${badge.id} redaction stamp`, () =>
    prisma.verificationBadge.update({
      where: { id: badge.id },
      data: { metadata: { ...metadataObject(badge.metadata), redactedAt: new Date().toISOString() } },
    })
  );
  logger.info('Identity verification session redacted at Stripe', { badgeId: badge.id });
  return true;
}

/**
 * Asks Stripe to erase every photo ID check a member started, ahead of erasing
 * her account.
 *
 * ATHENA's erasure deletes her badges, and the session id on each is the only
 * handle there is to what Stripe holds. Deleting the badge first would leave
 * the document and the selfie at Stripe, for as long as its own terms allow,
 * with nothing left here that could ever find them, which is not an erasure of
 * the thing she was most careful about. So the request goes to Stripe before the
 * rows go. It is for the checks nobody decided as much as for the ones that
 * were: a decided check was asked about already, and this skips it.
 *
 * Never throws and never holds the erasure up: a session Stripe refuses (one
 * still processing, one cancelled) is logged and the erasure goes on. Holds are
 * applied exactly as at a decision, though the erasure itself has already been
 * refused for a member who is named in one.
 */
export async function redactIdentityChecksBeforeErasure(userId: string): Promise<void> {
  const badges = await bestEffort(
    'identity checks to redact before erasure',
    () =>
      prisma.verificationBadge.findMany({
        where: { userId, type: 'IDENTITY' },
        select: { id: true, userId: true, metadata: true },
      }),
    [] as Array<{ id: string; userId: string; metadata: unknown }>
  );

  for (const badge of badges) {
    await redactIdentitySession(badge);
  }
}
