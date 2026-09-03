/**
 * Data Retention & Purge Jobs
 * Automated cleanup of data according to retention policies
 * Phase 4: GDPR Compliance - Automated Purge Jobs
 */

import { DataCategory, LegalBasis, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { queueAnalyticsEvent } from '../utils/queue';
import { logger } from '../utils/logger';

// Default retention periods (in days)
const DEFAULT_RETENTION_PERIODS: Record<string, number> = {
  messages: 1095,           // 3 years
  audit_logs: 2555,         // 7 years (legal requirement)
  payment_records: 2555,    // 7 years (legal requirement)
  marketing_data: 730,      // 2 years
  analytics_events: 395,    // 13 months
  session_data: 30,         // 30 days
  verification_tokens: 1,   // 1 day
  password_reset_tokens: 1, // 1 day
  soft_deleted_users: 30,   // 30 days after deletion request
  inactive_accounts: 730,   // 2 years of inactivity
};

interface PurgeResult {
  dataType: string;
  recordsPurged: number;
  errors: string[];
  executedAt: Date;
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

function normalizeDataType(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isHeld(scope: LegalHoldScope, ...aliases: string[]): boolean {
  if (scope.holdsEverything) return true;
  return aliases.some((alias) => scope.dataTypes.has(normalizeDataType(alias)));
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
    const now = new Date();
    const activeHolds = await prisma.legalHold.findMany({
      // A hold with a past endDate has lapsed even if nobody flipped isActive,
      // and one with no endDate runs until it is released.
      where: {
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
    });

    const scope: LegalHoldScope = {
      userIds: new Set<string>(),
      dataTypes: new Set<string>(),
      holdsEverything: false,
    };

    for (const hold of activeHolds) {
      hold.affectedUserIds.forEach((id) => scope.userIds.add(id));
      for (const type of hold.affectedDataTypes) {
        const normalized = normalizeDataType(type);
        if (normalized === '*' || normalized === 'all') {
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
    if (isHeld(holds, 'verification_tokens', 'credentials')) {
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
    if (isHeld(holds, 'sessions', 'session_data')) {
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
    if (isHeld(holds, 'messages', 'user_messages', 'direct_messages')) {
      return heldResult('messages');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_RETENTION_PERIODS.messages);

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
   * Purge old analytics events
   */
  async purgeOldAnalyticsEvents(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, 'analytics', 'analytics_events')) {
      return heldResult('analytics_events');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_RETENTION_PERIODS.analytics_events);

    try {
      await queueAnalyticsEvent({
        eventType: 'analytics.purge.requested',
        properties: {
          cutoffDate: cutoffDate.toISOString(),
          reason: 'retention_policy',
        },
        timestamp: new Date(),
      });

      return {
        dataType: 'analytics_events',
        recordsPurged: 0,
        errors: [],
        executedAt: new Date(),
      };
    } catch (error: any) {
      return {
        dataType: 'analytics_events',
        recordsPurged: 0,
        errors: [`Failed to enqueue analytics purge: ${error?.message || 'unknown error'}`],
        executedAt: new Date(),
      };
    }
  }

  /**
   * Permanently delete users who requested deletion 30+ days ago
   */
  async purgeSoftDeletedUsers(holds: LegalHoldScope = EMPTY_HOLD_SCOPE): Promise<PurgeResult> {
    if (isHeld(holds, 'users', 'accounts')) {
      return heldResult('soft_deleted_users');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_RETENTION_PERIODS.soft_deleted_users);

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
    if (isHeld(holds, 'dsar_exports', 'dsar')) {
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

    // In production, also delete the actual files from S3/storage

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
    if (isHeld(holds, 'notifications')) {
      return heldResult('notifications');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days

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
    if (isHeld(holds, 'audit_logs', 'audit')) {
      return heldResult('audit_logs_anonymized');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365); // Anonymize after 1 year, keep 7 years total

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

  /**
   * Get retention policies for transparency
   */
  async getRetentionPolicies() {
    return prisma.retentionPolicy.findMany({
      orderBy: { dataType: 'asc' },
    });
  }

  /**
   * Initialize default retention policies
   */
  async initializeRetentionPolicies(): Promise<void> {
    const policies = [
      {
        dataType: 'user_messages',
        description: 'Direct messages between users',
        dataCategory: DataCategory.UGC,
        retentionDays: 1095,
        retentionReason: 'Business requirement for dispute resolution',
        legalBasis: LegalBasis.LEGITIMATE_INTERESTS,
        automatedPurge: true,
        purgeJobName: 'purgeOldMessages',
      },
      {
        dataType: 'audit_logs',
        description: 'System and admin audit logs',
        dataCategory: DataCategory.TECHNICAL,
        retentionDays: 2555,
        retentionReason: 'Legal compliance requirement',
        legalBasis: LegalBasis.LEGAL_OBLIGATION,
        automatedPurge: false,
        purgeJobName: 'anonymizeOldAuditLogs',
      },
      {
        dataType: 'payment_records',
        description: 'Payment and billing records',
        dataCategory: DataCategory.FINANCIAL,
        retentionDays: 2555,
        retentionReason: 'Tax and financial compliance',
        legalBasis: LegalBasis.LEGAL_OBLIGATION,
        automatedPurge: false,
      },
      {
        dataType: 'session_data',
        description: 'User login sessions',
        dataCategory: DataCategory.TECHNICAL,
        retentionDays: 30,
        retentionReason: 'Security and authentication',
        legalBasis: LegalBasis.CONTRACT,
        automatedPurge: true,
        purgeJobName: 'purgeExpiredSessions',
      },
      {
        dataType: 'notifications',
        description: 'User notifications',
        dataCategory: DataCategory.UGC,
        retentionDays: 90,
        retentionReason: 'User experience',
        legalBasis: LegalBasis.LEGITIMATE_INTERESTS,
        automatedPurge: true,
        purgeJobName: 'purgeOldNotifications',
      },
    ];

    for (const policy of policies) {
      await prisma.retentionPolicy.upsert({
        where: { dataType: policy.dataType },
        update: policy,
        create: policy,
      });
    }
  }
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
