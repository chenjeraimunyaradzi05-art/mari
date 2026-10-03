/**
 * Data Retention & Purge Jobs
 * Automated cleanup of data according to retention policies
 * Phase 4: GDPR Compliance - Automated Purge Jobs
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { EXECUTED_RETENTION_SCHEDULE } from '../services/gdpr.service';
import { redactIdentitySession } from '../services/identity-verification.service';
import { IDENTITY_HOLD_ALIASES } from '../utils/identity-hold';

/**
 * How many days a line of the published schedule keeps its data.
 *
 * The cut-offs used to live here twice over — in a DEFAULT_RETENTION_PERIODS
 * table that listed ten periods the job mostly did not use, and as literals
 * typed into the jobs themselves — while members were shown a third copy in
 * gdpr.service. Three copies of one promise is how they drift. The published
 * schedule is now the only place a period is written, and every job reads its
 * cut-off from it, so changing what is published changes what is done.
 *
 * Read at call time rather than at module load, so the order in which the two
 * modules are first imported can never leave a job without its number.
 */
function publishedRetentionDays(dataType: string): number {
  const policy = EXECUTED_RETENTION_SCHEDULE.find((entry) => entry.dataType === dataType);
  if (!policy) {
    // Refusing is the safe answer: a purge that guessed its own period would
    // be deleting on a promise nobody made.
    throw new Error(`The published retention schedule has no line for ${dataType}`);
  }
  return policy.retentionDays;
}

function cutoffFor(dataType: string): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - publishedRetentionDays(dataType));
  return cutoff;
}

interface PurgeResult {
  dataType: string;
  recordsPurged: number;
  errors: string[];
  executedAt: Date;
  /**
   * Why the job did nothing, when it did nothing by design rather than because
   * there was nothing old enough. The compliance record says so in words, so a
   * zero is never read as a purge that ran and found nothing.
   */
  skipped?: string;
}

interface PurgeJobSummary {
  startedAt: Date;
  completedAt: Date;
  results: PurgeResult[];
  totalPurged: number;
  errors: string[];
  /** True when a run was already in flight and this call did nothing. */
  skipped: boolean;
}

/**
 * The scope a set of active legal holds carves out of the purge.
 *
 * Holds are authored by humans, so `affectedDataTypes` arrives as free text.
 * Failing to match a hold means destroying evidence someone is legally required
 * to keep, so matching is deliberately generous: types are normalised and every
 * plausible spelling an admin might type is treated as the same hold.
 */
interface LegalHoldScope {
  userIds: Set<string>;
  dataTypes: Set<string>;
  /** A hold scoped to "*"/"all" freezes every automated purge. */
  holdsEverything: boolean;
}

const EMPTY_HOLD_SCOPE: LegalHoldScope = {
  userIds: new Set(),
  dataTypes: new Set(),
  holdsEverything: false,
};

/** How a typed data type is compared: case, spaces and hyphens do not matter. */
export function normalizeHeldDataType(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** One kind of record a legal hold can keep out of the automated purges. */
export interface LegalHoldDataType {
  /** What the console stores when this is ticked. */
  value: string;
  label: string;
  /** What the purge would otherwise do to it, in words the person placing the hold reads. */
  purge: string;
  /** Every spelling the purge answers to, already normalised. */
  aliases: readonly string[];
}

/**
 * What a legal hold can name, and every spelling each purge answers to.
 *
 * The console used to check a typed data type against a list of two, messages
 * and analytics, while the purges below answered to more than a dozen
 * spellings across seven jobs. A hold on "notifications" or "direct messages"
 * was therefore reported to the person placing it as covering nothing, when it
 * did hold. One list now serves both sides: each purge tests holds against its
 * own entry here, and the console offers and checks the same entries.
 *
 * Analytics is not offered. Nothing on the platform stores analytics events, so
 * a hold on them would keep nothing; its purge still honours the word, so a
 * hold typed that way is recorded and simply has nothing to protect.
 */
export const LEGAL_HOLD_DATA_TYPES: readonly LegalHoldDataType[] = [
  {
    value: 'messages',
    label: 'Direct messages',
    purge: 'Direct messages past the retention period are deleted',
    aliases: ['messages', 'user_messages', 'direct_messages'],
  },
  {
    value: 'notifications',
    label: 'Notifications',
    purge: 'Old notifications are deleted',
    aliases: ['notifications'],
  },
  {
    value: 'sessions',
    label: 'Sign-in sessions',
    purge: 'Expired sessions, with the device and address each was used from, are deleted',
    aliases: ['sessions', 'session_data'],
  },
  {
    value: 'verification_tokens',
    label: 'Verification and reset tokens',
    purge: 'Expired email-verification and password-reset tokens are deleted',
    aliases: ['verification_tokens', 'credentials'],
  },
  {
    value: 'users',
    label: 'Accounts awaiting final erasure',
    purge: 'Accounts whose owners asked to be erased are deleted for good once the grace period ends',
    aliases: ['users', 'accounts'],
  },
  {
    value: 'dsar_exports',
    label: 'Data export links',
    purge: 'Expired download links to members’ data exports are withdrawn',
    aliases: ['dsar_exports', 'dsar'],
  },
  {
    value: 'audit_logs',
    label: 'Audit logs',
    purge: 'Old audit rows have the network address and device stripped from them',
    aliases: ['audit_logs', 'audit'],
  },
  {
    value: 'identity_verification',
    label: 'Identity verification details',
    purge:
      'Photo ID checks held at Stripe are erased once decided, and the name and document type kept for the reviewer are scrubbed 90 days after the decision',
    // One list, shared with the redaction that runs at the moment of a decision,
    // so a hold that stops this sweep stops that too.
    aliases: IDENTITY_HOLD_ALIASES,
  },
];

/** The words that make one hold freeze every purge. */
export const HOLD_EVERYTHING_VALUES: readonly string[] = ['*', 'all'];

/** True when some purge answers to this data type, or it holds everything. */
export function isRecognisedHeldDataType(value: string): boolean {
  const normalized = normalizeHeldDataType(value);
  return (
    HOLD_EVERYTHING_VALUES.includes(normalized) ||
    LEGAL_HOLD_DATA_TYPES.some((type) => type.aliases.includes(normalized))
  );
}

function aliasesOf(value: string): readonly string[] {
  const entry = LEGAL_HOLD_DATA_TYPES.find((type) => type.value === value);
  if (!entry) {
    // A purge naming a type the catalogue does not have would be a purge no
    // hold could ever stop, so it refuses to run rather than guess.
    throw new Error(`No legal hold data type is defined for ${value}`);
  }
  return entry.aliases;
}

function isHeld(scope: LegalHoldScope, ...aliases: readonly string[]): boolean {
  if (scope.holdsEverything) return true;
  return aliases.some((alias) => scope.dataTypes.has(normalizeHeldDataType(alias)));
}

function heldResult(dataType: string): PurgeResult {
  return {
    dataType,
    recordsPurged: 0,
    errors: ['Skipped: Legal hold active'],
    executedAt: new Date(),
  };
}

export class DataRetentionService {
  /**
   * Guards against a manual/admin trigger overlapping the scheduled run inside
   * the same process. Cross-process overlap is prevented upstream: BullMQ hands
   * each scheduled occurrence to exactly one worker, and the scheduled-tasks
   * worker holds a lock long enough that a slow sweep is not declared stalled
   * and redelivered. Every purge below is written to be safe even so.
   */
  private running = false;

  /**
   * Run all scheduled purge jobs.
   *
   * Idempotent by construction: every job derives its cutoff from the clock and
   * filters on state it then changes, so a repeat run finds nothing left to do
   * rather than double-deleting or re-stamping rows.
   */
  async runAllPurgeJobs(): Promise<PurgeJobSummary> {
    if (this.running) {
      const now = new Date();
      logger.warn('[DataRetention] Purge already in progress; skipping this trigger');
      return { startedAt: now, completedAt: now, results: [], totalPurged: 0, errors: [], skipped: true };
    }

    this.running = true;
    const startedAt = new Date();
    const results: PurgeResult[] = [];
    const errors: string[] = [];

    logger.info('[DataRetention] Starting purge jobs...');

    try {
      const holds = await this.loadActiveHolds();

      // Hard-deleting users sits before the per-table sweeps so those sweeps
      // have fewer rows to scan; otherwise the order is independent and one
      // job throwing does not stop the rest.
      const jobs = [
        () => this.purgeExpiredVerificationTokens(holds),
        () => this.purgeExpiredSessions(holds),
        () => this.purgeOldMessages(holds),
        () => this.purgeOldAnalyticsEvents(holds),
        () => this.purgeSoftDeletedUsers(holds),
        () => this.purgeExpiredDSARExports(holds),
        () => this.purgeOldNotifications(holds),
        () => this.anonymizeOldAuditLogs(holds),
        () => this.purgeIdentityVerificationDetails(holds),
      ];

      for (const job of jobs) {
        try {
          const result = await job();
          results.push(result);
        } catch (error: any) {
          errors.push(error.message);
          logger.error('[DataRetention] Job failed', { error });
        }
      }

      const completedAt = new Date();
      const totalPurged = results.reduce((sum, r) => sum + r.recordsPurged, 0);
      const summary: PurgeJobSummary = {
        startedAt,
        completedAt,
        results,
        totalPurged,
        errors,
        skipped: false,
      };

      // Written before the info log so a crash between the two still leaves the
      // compliance record of what was destroyed.
      await this.logPurgeSummary(summary);

      // Named counts, not just a total: proving a retention promise was kept
      // means being able to say which category was purged and which was held.
      logger.info('[DataRetention] Completed', {
        totalPurged,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        purgedByType: results.reduce<Record<string, number>>((acc, result) => {
          acc[result.dataType] = result.recordsPurged;
          return acc;
        }, {}),
        heldDataTypes: results.filter((r) => r.errors.includes('Skipped: Legal hold active')).map((r) => r.dataType),
        errors,
      });

      return summary;
    } finally {
      this.running = false;
    }
  }

  /**
   * Collapse every active hold into one scope the purge jobs can consult.
   */
  private async loadActiveHolds(): Promise<LegalHoldScope> {
    // A hold stands until somebody releases it, whatever its end date says.
    // This used to treat a hold past its end date as lapsed, while the erasure
    // path went on refusing deletions under the same hold and the console told
    // admins that "lifting a hold is a decision, not a timeout" — so on the
    // night after an end date nobody had revisited, the purge began deleting
    // the messages a court had asked to be kept while the rest of the platform
    // still said they were held. Destroying evidence cannot be undone; keeping
    // it a few days longer can. The end date is a date to review the hold by,
    // and the console lists holds past it first so somebody does.
    const activeHolds = await prisma.legalHold.findMany({
      where: { isActive: true },
    });

    const scope: LegalHoldScope = {
      userIds: new Set<string>(),
      dataTypes: new Set<string>(),
      holdsEverything: false,
    };

    for (const hold of activeHolds) {
      hold.affectedUserIds.forEach((id) => scope.userIds.add(id));
      for (const type of hold.affectedDataTypes) {
        const normalized = normalizeHeldDataType(type);
        if (HOLD_EVERYTHING_VALUES.includes(normalized)) {
          scope.holdsEverything = true;
        }
        scope.dataTypes.add(normalized);
      }
    }

    if (activeHolds.length > 0) {
      logger.info('[DataRetention] Active legal holds applied', {
        holdCount: activeHolds.length,
        heldUserCount: scope.userIds.size,
        heldDataTypes: Array.from(scope.dataTypes),
        holdsEverything: scope.holdsEverything,
      });
    }

    return scope;
  }

  /**
   * Purge expired verification tokens
   */
  async purgeExpiredVerificationTokens(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, ...aliasesOf('verification_tokens'))) {
      return heldResult('verification_tokens');
    }

    const result = await prisma.verificationToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        ...this.excludeHeldUsers(holds),
      },
    });

    return {
      dataType: 'verification_tokens',
      recordsPurged: result.count,
      errors: [],
      executedAt: new Date(),
    };
  }

  /**
   * Prisma clause excluding users under hold from a per-user delete.
   *
   * `notIn: []` is a no-op in Prisma but still costs a clause, so an empty hold
   * set returns nothing at all and leaves the query as it was.
   */
  private excludeHeldUsers(holds: LegalHoldScope, field: string = 'userId'): Record<string, any> {
    if (holds.userIds.size === 0) return {};
    return { [field]: { notIn: Array.from(holds.userIds) } };
  }

  /**
   * Purge expired sessions
   */
  async purgeExpiredSessions(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, ...aliasesOf('sessions'))) {
      return heldResult('sessions');
    }

    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        ...this.excludeHeldUsers(holds),
      },
    });

    return {
      dataType: 'sessions',
      recordsPurged: result.count,
      errors: [],
      executedAt: new Date(),
    };
  }

  /**
   * Purge old messages beyond retention period
   */
  async purgeOldMessages(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, ...aliasesOf('messages'))) {
      return heldResult('messages');
    }

    const cutoffDate = cutoffFor('direct_messages');

    const whereClause: any = {
      createdAt: { lt: cutoffDate },
    };

    // Both sides of the thread are checked: a held user's messages are evidence
    // whether they sent or received them.
    if (holds.userIds.size > 0) {
      const heldIds = Array.from(holds.userIds);
      whereClause.AND = [
        { senderId: { notIn: heldIds } },
        { receiverId: { notIn: heldIds } },
      ];
    }

    const result = await prisma.message.deleteMany({ where: whereClause });

    return {
      dataType: 'messages',
      recordsPurged: result.count,
      errors: [],
      executedAt: new Date(),
    };
  }

  /**
   * Analytics events: there is nothing to purge.
   *
   * This used to enqueue an 'analytics.purge.requested' job and report the
   * analytics purge as done. Nothing on the platform stores analytics events —
   * no table, no provider — and the worker that received the request says as
   * much, so the retention record described a purge of a store that does not
   * exist. The line stays in the report so its absence is not mistaken for a
   * forgotten job, and it says in words that nothing was purged and why.
   */
  async purgeOldAnalyticsEvents(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    // Reported as held under a hold that covers it, like every other line, so
    // the record of which categories a hold froze stays complete.
    if (isHeld(holds, 'analytics', 'analytics_events')) {
      return heldResult('analytics_events');
    }

    return {
      dataType: 'analytics_events',
      recordsPurged: 0,
      errors: [],
      skipped: 'No analytics events are stored on this platform, so there is nothing to purge.',
      executedAt: new Date(),
    };
  }

  /**
   * Permanently delete users who requested deletion 30+ days ago
   */
  async purgeSoftDeletedUsers(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, ...aliasesOf('users'))) {
      return heldResult('soft_deleted_users');
    }

    const cutoffDate = cutoffFor('erased_accounts');

    // Find completed deletion DSARs older than retention period
    const pendingDeletions = await prisma.dSARRequest.findMany({
      where: {
        type: 'DELETION',
        status: 'COMPLETED',
        completedAt: { lt: cutoffDate },
        ...this.excludeHeldUsers(holds),
      },
      select: { userId: true },
    });

    // A user who filed more than one deletion request appears once per request.
    // Without the dedupe the second pass hard-deletes an already-deleted user
    // and reports a spurious failure.
    const userIds = Array.from(new Set(pendingDeletions.map((deletion) => deletion.userId)));

    let purgedCount = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        // Hard delete user and all related data
        await this.hardDeleteUser(userId);
        purgedCount++;
      } catch (error: any) {
        errors.push(`Failed to delete user ${userId}: ${error.message}`);
      }
    }

    return {
      dataType: 'soft_deleted_users',
      recordsPurged: purgedCount,
      errors,
      executedAt: new Date(),
    };
  }

  /**
   * Hard delete user and all associated data
   */
  private async hardDeleteUser(userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Delete in order of dependencies
      await tx.comment.deleteMany({ where: { authorId: userId } });
      await tx.like.deleteMany({ where: { userId } });
      await tx.post.deleteMany({ where: { authorId: userId } });
      await tx.message.deleteMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      });
      await tx.follow.deleteMany({
        where: { OR: [{ followerId: userId }, { followingId: userId }] },
      });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.groupMember.deleteMany({ where: { userId } });
      await tx.eventRegistration.deleteMany({ where: { userId } });
      await tx.jobApplication.deleteMany({ where: { userId } });
      await tx.savedJob.deleteMany({ where: { userId } });
      await tx.courseEnrollment.deleteMany({ where: { userId } });
      await tx.consentRecord.deleteMany({ where: { userId } });
      await tx.dSARRequest.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.verificationToken.deleteMany({ where: { userId } });
      await tx.profile.deleteMany({ where: { userId } });
      await tx.subscription.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  }

  /**
   * Purge expired DSAR export files
   */
  async purgeExpiredDSARExports(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, ...aliasesOf('dsar_exports'))) {
      return heldResult('dsar_exports');
    }

    const result = await prisma.dSARRequest.updateMany({
      // `exportUrl: { not: null }` is what makes this idempotent: once blanked a
      // row can never match again, so a repeat run reports zero rather than
      // re-counting every historic export.
      where: {
        type: 'EXPORT',
        status: 'COMPLETED',
        exportExpiresAt: { lt: new Date() },
        exportUrl: { not: null },
        ...this.excludeHeldUsers(holds),
      },
      data: {
        exportUrl: null,
      },
    });

    // Nothing else is left to delete: an export is assembled afresh from the
    // database each time its link is opened and is never written to storage,
    // so withdrawing the link is the whole of the purge.

    return {
      dataType: 'dsar_exports',
      recordsPurged: result.count,
      errors: [],
      executedAt: new Date(),
    };
  }

  /**
   * Purge old notifications
   */
  async purgeOldNotifications(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, ...aliasesOf('notifications'))) {
      return heldResult('notifications');
    }

    const cutoffDate = cutoffFor('read_notifications');

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
        ...this.excludeHeldUsers(holds),
      },
    });

    return {
      dataType: 'notifications',
      recordsPurged: result.count,
      errors: [],
      executedAt: new Date(),
    };
  }

  /**
   * Anonymize audit logs older than active retention (keep for compliance but remove PII)
   *
   * Raw SQL rather than `updateMany`, because the "not already anonymized"
   * condition cannot be expressed in Prisma's JSON filter: `path` + `equals`
   * compares the value at a key, and for rows where the key is absent the
   * comparison is SQL NULL, so neither the positive nor the negated form
   * selects them. The previous `equals: undefined` was silently dropped from
   * the query altogether, which made this the one non-idempotent job in the
   * sweep - it re-stamped every log older than a year on every single run and
   * reported the whole table as freshly anonymized each night. `IS DISTINCT
   * FROM` treats the absent key as "not anonymized" and the marker converges
   * after one pass.
   */
  async anonymizeOldAuditLogs(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, ...aliasesOf('audit_logs'))) {
      return heldResult('audit_logs_anonymized');
    }

    const cutoffDate = cutoffFor('audit_logs');

    const marker = JSON.stringify({ anonymized: true, anonymizedAt: new Date().toISOString() });

    // An audit log under hold keeps its actor, IP and user agent - that is the
    // part a regulator or court would actually ask for.
    const heldIds = Array.from(holds.userIds);
    const heldUserFilter = heldIds.length
      ? Prisma.sql`AND ("actorUserId" IS NULL OR "actorUserId" NOT IN (${Prisma.join(heldIds)}))
                   AND ("targetUserId" IS NULL OR "targetUserId" NOT IN (${Prisma.join(heldIds)}))`
      : Prisma.empty;

    // ipAddress and userAgent are cleared alongside metadata: an "anonymized"
    // record that still carries the actor's IP is not anonymized.
    const count = await prisma.$executeRaw`
      UPDATE "AuditLog"
      SET "metadata" = ${marker}::jsonb,
          "ipAddress" = NULL,
          "userAgent" = NULL
      WHERE "createdAt" < ${cutoffDate}
        AND ("metadata" -> 'anonymized') IS DISTINCT FROM 'true'::jsonb
        ${heldUserFilter}
    `;

    return {
      dataType: 'audit_logs_anonymized',
      recordsPurged: count,
      errors: [],
      executedAt: new Date(),
    };
  }

  /**
   * What a photo ID check leaves behind, in the two places it leaves it.
   *
   * ATHENA never receives the document or the selfie; Stripe holds them. So the
   * first half asks Stripe to erase the session behind every decision that has
   * been made but not yet redacted - the retry for the ones the decision itself
   * could not redact (Stripe unreachable, a session still processing). The
   * second half scrubs what ATHENA kept for the reviewer, the legal name and the
   * document type on the badge, 90 days after the decision, which is the figure
   * the retention schedule publishes. The opaque session id goes with them once
   * Stripe has confirmed the redaction; until then it stays, because it is the
   * only handle left for trying again.
   *
   * Idempotent: a redacted session is never asked about twice, and a scrubbed
   * badge has nothing left that the scrub looks for (and carries
   * `detailsScrubbedAt`, the date it first happened), so a repeat run finds
   * nothing. The member's date of birth is not touched; it belongs to the
   * account and is what the age gate reads.
   *
   * Raw SQL for the same reason as the audit-log job: whether a JSON key is
   * absent cannot be expressed in Prisma's JSON filter.
   */
  async purgeIdentityVerificationDetails(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, ...aliasesOf('identity_verification'))) {
      return heldResult('identity_verification_details');
    }

    const cutoffDate = cutoffFor('identity_verification_details');
    const errors: string[] = [];
    const heldIds = Array.from(holds.userIds);
    const heldUserFilter = heldIds.length
      ? Prisma.sql`AND "userId" NOT IN (${Prisma.join(heldIds)})`
      : Prisma.empty;

    // Oldest decisions first and a cap per night, so a backlog drains in order
    // without one run making hundreds of calls to Stripe.
    const unredacted = await prisma.$queryRaw<Array<{ id: string; userId: string; metadata: unknown }>>`
      SELECT "id", "userId", "metadata"
      FROM "VerificationBadge"
      WHERE "type" = 'IDENTITY'::"VerificationBadgeType"
        AND "status" IN ('APPROVED'::"VerificationStatus", 'REJECTED'::"VerificationStatus")
        AND ("metadata" ->> 'sessionId') IS NOT NULL
        AND ("metadata" ->> 'redactedAt') IS NULL
        ${heldUserFilter}
      ORDER BY "reviewedAt" ASC NULLS FIRST
      LIMIT 200
    `;

    let redacted = 0;
    for (const badge of unredacted) {
      if (await redactIdentitySession(badge, { holdsChecked: true })) redacted++;
    }
    if (redacted < unredacted.length) {
      errors.push(
        `${unredacted.length - redacted} identity check(s) could not be redacted at Stripe yet and will be tried again`
      );
    }

    // The marker goes on the left of `||`, where the right-hand side wins, so a
    // badge scrubbed before keeps the date it was first scrubbed.
    //
    // A row is picked while anything is left on it to remove: the name, the
    // document type, or a session id whose redaction has been recorded. A
    // session id that is still waiting for its redaction is not removed and does
    // not make the row match, so the night the redaction finally lands is the
    // night the id goes. (Matching on "never scrubbed" instead left the id on
    // every badge whose redaction came in after its ninetieth day, for good.)
    const marker = JSON.stringify({ detailsScrubbedAt: new Date().toISOString() });
    const scrubbed = await prisma.$executeRaw`
      UPDATE "VerificationBadge"
      SET "metadata" = ${marker}::jsonb || (
            CASE WHEN ("metadata" ->> 'redactedAt') IS NOT NULL
                 THEN ("metadata" - 'documentName' - 'documentType' - 'sessionId')
                 ELSE ("metadata" - 'documentName' - 'documentType')
            END
          )
      WHERE "type" = 'IDENTITY'::"VerificationBadgeType"
        AND "status" IN ('APPROVED'::"VerificationStatus", 'REJECTED'::"VerificationStatus")
        AND "reviewedAt" < ${cutoffDate}
        AND (
          ("metadata" ->> 'documentName') IS NOT NULL
          OR ("metadata" ->> 'documentType') IS NOT NULL
          OR (("metadata" ->> 'sessionId') IS NOT NULL AND ("metadata" ->> 'redactedAt') IS NOT NULL)
        )
        ${heldUserFilter}
    `;

    return {
      dataType: 'identity_verification_details',
      recordsPurged: redacted + scrubbed,
      errors,
      executedAt: new Date(),
    };
  }

  /**
   * Log purge summary for compliance
   */
  private async logPurgeSummary(summary: PurgeJobSummary): Promise<void> {
    await prisma.privacyAuditLog.create({
      data: {
        systemProcess: 'DATA_RETENTION_JOB',
        action: 'AUTOMATED_PURGE',
        resourceType: 'System',
        details: JSON.parse(JSON.stringify({
          startedAt: summary.startedAt,
          completedAt: summary.completedAt,
          durationMs: summary.completedAt.getTime() - summary.startedAt.getTime(),
          totalPurged: summary.totalPurged,
          results: summary.results,
          errors: summary.errors,
        })),
      },
    });
  }

  // getRetentionPolicies and initializeRetentionPolicies used to live here. The
  // first read a RetentionPolicy table and the second was the only thing that
  // ever wrote one — with its own third set of periods — and nothing called
  // it, so the table was empty everywhere and the reader returned nothing. The
  // schedule members are shown is gdprService.getRetentionPolicies, which
  // publishes EXECUTED_RETENTION_SCHEDULE: the same list these jobs take their
  // cut-offs from.
}

export const dataRetentionService = new DataRetentionService();

// CLI entry point for one-off/manual runs. The scheduled run does not go
// through here - it is a BullMQ job on the scheduled-tasks queue, registered by
// registerRecurringJobs() and executed by the scheduled-tasks worker.
if (require.main === module) {
  dataRetentionService.runAllPurgeJobs()
    .then((summary) => {
      logger.info('Purge job completed', { summary });
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Purge job failed', { error });
      process.exit(1);
    });
}
