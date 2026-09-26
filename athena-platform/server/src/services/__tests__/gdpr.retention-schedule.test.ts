/**
 * The published retention schedule, held to the purge that carries it out.
 *
 * GET /api/gdpr/retention-policies used to read a table nothing wrote, so it
 * published [] everywhere, and the purge ran on its own constants in
 * scripts/data-retention.ts — so even a populated table would have described a
 * policy nobody executed. The route now publishes EXECUTED_RETENTION_SCHEDULE.
 * These tests run each purge job against a mock and read back the cut-off it
 * actually used, so a change to either side that is not made to the other
 * fails here instead of quietly putting a false promise in front of members.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    message: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    notification: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    session: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    verificationToken: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    dSARRequest: {
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    $executeRaw: jest.fn(async () => 0),
  },
}));

jest.mock('../../utils/queue', () => ({
  queueAnalyticsEvent: jest.fn(async () => undefined),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { dataRetentionService } from '../../scripts/data-retention';
import { EXECUTED_RETENTION_SCHEDULE } from '../gdpr.service';

const prisma: any = prismaTyped;
const DAY_MS = 24 * 60 * 60 * 1000;

function published(dataType: string) {
  const policy = EXECUTED_RETENTION_SCHEDULE.find((entry) => entry.dataType === dataType);
  if (!policy) throw new Error(`${dataType} is not in the published schedule`);
  return policy;
}

/** Whole days between now and a cut-off the purge computed. */
function daysBefore(cutoff: Date, now: number): number {
  return Math.round((now - cutoff.getTime()) / DAY_MS);
}

describe('The published retention schedule is the one the purge runs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('direct messages: the purge deletes at the age the schedule publishes', async () => {
    const now = Date.now();
    await dataRetentionService.purgeOldMessages();

    const cutoff = prisma.message.deleteMany.mock.calls[0][0].where.createdAt.lt as Date;
    expect(daysBefore(cutoff, now)).toBe(published('direct_messages').retentionDays);
  });

  it('read notifications: the purge deletes read ones only, at the published age', async () => {
    const now = Date.now();
    await dataRetentionService.purgeOldNotifications();

    const where = prisma.notification.deleteMany.mock.calls[0][0].where;
    expect(where.isRead).toBe(true);
    expect(daysBefore(where.createdAt.lt as Date, now)).toBe(published('read_notifications').retentionDays);
  });

  it('audit logs: anonymised, not deleted, at the published age', async () => {
    const now = Date.now();
    await dataRetentionService.anonymizeOldAuditLogs();

    // A tagged template: the interpolated values follow the strings array.
    const values = prisma.$executeRaw.mock.calls[0].slice(1) as unknown[];
    const cutoff = values.find((value): value is Date => value instanceof Date);
    expect(cutoff).toBeDefined();
    expect(daysBefore(cutoff!, now)).toBe(published('audit_logs').retentionDays);
    expect(published('audit_logs').anonymizeInstead).toBe(true);
  });

  it('erased accounts: the remainder goes the published number of days after the erasure completed', async () => {
    const now = Date.now();
    await dataRetentionService.purgeSoftDeletedUsers();

    const where = prisma.dSARRequest.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ type: 'DELETION', status: 'COMPLETED' });
    expect(daysBefore(where.completedAt.lt as Date, now)).toBe(published('erased_accounts').retentionDays);
  });

  it('expiry-based lines are removed on expiry, which is what the schedule says', async () => {
    await dataRetentionService.purgeExpiredSessions();
    await dataRetentionService.purgeExpiredVerificationTokens();
    await dataRetentionService.purgeExpiredDSARExports();

    expect(prisma.session.deleteMany.mock.calls[0][0].where.expiresAt.lt).toBeInstanceOf(Date);
    expect(prisma.verificationToken.deleteMany.mock.calls[0][0].where.expiresAt.lt).toBeInstanceOf(Date);
    expect(prisma.dSARRequest.updateMany.mock.calls[0][0].where.exportExpiresAt.lt).toBeInstanceOf(Date);

    for (const dataType of ['sessions', 'verification_links', 'data_export_links']) {
      expect(published(dataType)).toMatchObject({ trigger: 'expiry', retentionDays: 0 });
    }
  });

  it('publishes nothing the purge does not do', () => {
    // Every line above has a test tying it to a job. A line added without one
    // is a promise nothing checks, so the list is pinned.
    expect(EXECUTED_RETENTION_SCHEDULE.map((entry) => entry.dataType).sort()).toEqual(
      [
        'audit_logs',
        'data_export_links',
        'direct_messages',
        'erased_accounts',
        'read_notifications',
        'sessions',
        'verification_links',
      ].sort()
    );
  });
});
