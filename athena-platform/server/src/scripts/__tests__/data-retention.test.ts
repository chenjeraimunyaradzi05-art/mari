import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    legalHold: { findMany: jest.fn() },
    verificationToken: { deleteMany: jest.fn() },
    session: { deleteMany: jest.fn() },
    message: { deleteMany: jest.fn() },
    notification: { deleteMany: jest.fn() },
    dSARRequest: { findMany: jest.fn(), updateMany: jest.fn() },
    privacyAuditLog: { create: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock('../../utils/queue', () => ({
  queueAnalyticsEvent: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  dataRetentionService,
  isRecognisedHeldDataType,
  LEGAL_HOLD_DATA_TYPES,
  normalizeHeldDataType,
} from '../data-retention';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

const prismaAny: any = prisma;
const loggerAny: any = logger;

const ANONYMIZED_GUARD = '("metadata" -> \'anonymized\') IS DISTINCT FROM \'true\'::jsonb';

/** A hold row shaped the way prisma.legalHold.findMany returns it. */
function hold(overrides: Record<string, any> = {}) {
  return {
    id: 'hold-1',
    affectedUserIds: [],
    affectedDataTypes: [],
    isActive: true,
    endDate: null,
    ...overrides,
  };
}

/** Make every purge a no-op so a test can assert on one job in isolation. */
function stubEmptyDatabase() {
  prismaAny.legalHold.findMany.mockResolvedValue([]);
  prismaAny.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
  prismaAny.session.deleteMany.mockResolvedValue({ count: 0 });
  prismaAny.message.deleteMany.mockResolvedValue({ count: 0 });
  prismaAny.notification.deleteMany.mockResolvedValue({ count: 0 });
  prismaAny.dSARRequest.findMany.mockResolvedValue([]);
  prismaAny.dSARRequest.updateMany.mockResolvedValue({ count: 0 });
  prismaAny.privacyAuditLog.create.mockResolvedValue({ id: 'privacy-log-1' });
  prismaAny.$executeRaw.mockResolvedValue(0);
  prismaAny.$transaction.mockImplementation(async (fn: any) =>
    fn({
      comment: { deleteMany: jest.fn() },
      like: { deleteMany: jest.fn() },
      post: { deleteMany: jest.fn() },
      message: { deleteMany: jest.fn() },
      follow: { deleteMany: jest.fn() },
      notification: { deleteMany: jest.fn() },
      groupMember: { deleteMany: jest.fn() },
      eventRegistration: { deleteMany: jest.fn() },
      jobApplication: { deleteMany: jest.fn() },
      savedJob: { deleteMany: jest.fn() },
      courseEnrollment: { deleteMany: jest.fn() },
      consentRecord: { deleteMany: jest.fn() },
      dSARRequest: { deleteMany: jest.fn() },
      session: { deleteMany: jest.fn() },
      verificationToken: { deleteMany: jest.fn() },
      profile: { deleteMany: jest.fn() },
      subscription: { deleteMany: jest.fn() },
      user: { delete: jest.fn() },
    })
  );
}

describe('DataRetentionService.runAllPurgeJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubEmptyDatabase();
  });

  it('records a compliance summary with a per-type breakdown of what it purged', async () => {
    prismaAny.session.deleteMany.mockResolvedValue({ count: 7 });
    prismaAny.notification.deleteMany.mockResolvedValue({ count: 3 });

    const summary = await dataRetentionService.runAllPurgeJobs();

    expect(summary.skipped).toBe(false);
    expect(summary.totalPurged).toBe(10);

    const logged = prismaAny.privacyAuditLog.create.mock.calls[0][0].data;
    expect(logged.systemProcess).toBe('DATA_RETENTION_JOB');
    expect(logged.action).toBe('AUTOMATED_PURGE');
    expect(logged.details.totalPurged).toBe(10);
    expect(logged.details.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ dataType: 'sessions', recordsPurged: 7 })])
    );

    const completion = loggerAny.info.mock.calls.find(
      (call: any[]) => call[0] === '[DataRetention] Completed'
    );
    expect(completion?.[1].purgedByType).toMatchObject({ sessions: 7, notifications: 3 });
  });

  it('skips a data type named by an active legal hold', async () => {
    prismaAny.legalHold.findMany.mockResolvedValue([hold({ affectedDataTypes: ['Messages'] })]);

    const summary = await dataRetentionService.runAllPurgeJobs();

    expect(prismaAny.message.deleteMany).not.toHaveBeenCalled();
    expect(summary.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dataType: 'messages', errors: ['Skipped: Legal hold active'] }),
      ])
    );
  });

  it('treats a wildcard hold as freezing every purge', async () => {
    prismaAny.legalHold.findMany.mockResolvedValue([hold({ affectedDataTypes: ['*'] })]);

    const summary = await dataRetentionService.runAllPurgeJobs();

    expect(prismaAny.session.deleteMany).not.toHaveBeenCalled();
    expect(prismaAny.notification.deleteMany).not.toHaveBeenCalled();
    expect(prismaAny.$executeRaw).not.toHaveBeenCalled();
    expect(summary.totalPurged).toBe(0);
    expect(
      summary.results.every((result: any) => result.errors.includes('Skipped: Legal hold active'))
    ).toBe(true);
  });

  it('excludes users under hold from per-user deletes and from both sides of a thread', async () => {
    prismaAny.legalHold.findMany.mockResolvedValue([hold({ affectedUserIds: ['held-user'] })]);

    await dataRetentionService.runAllPurgeJobs();

    expect(prismaAny.notification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: { notIn: ['held-user'] } }),
      })
    );
    expect(prismaAny.message.deleteMany.mock.calls[0][0].where.AND).toEqual([
      { senderId: { notIn: ['held-user'] } },
      { receiverId: { notIn: ['held-user'] } },
    ]);
  });

  it('keeps honouring a hold past its end date until somebody releases it', async () => {
    // This used to read a past end date as the hold lapsing, so the night after
    // an unrevisited end date the purge deleted what the erasure path and the
    // console still said was held.
    prismaAny.legalHold.findMany.mockResolvedValue([
      hold({ affectedDataTypes: ['messages'], endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) }),
    ]);

    await dataRetentionService.runAllPurgeJobs();

    expect(prismaAny.legalHold.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(prismaAny.message.deleteMany).not.toHaveBeenCalled();
  });

  it('honours every spelling the console offers, so a hold is never reported as matching nothing', async () => {
    prismaAny.legalHold.findMany.mockResolvedValue([
      hold({ affectedDataTypes: ['Direct Messages', 'notifications', 'session-data'] }),
    ]);

    await dataRetentionService.runAllPurgeJobs();

    expect(prismaAny.message.deleteMany).not.toHaveBeenCalled();
    expect(prismaAny.notification.deleteMany).not.toHaveBeenCalled();
    expect(prismaAny.session.deleteMany).not.toHaveBeenCalled();
    for (const type of LEGAL_HOLD_DATA_TYPES) {
      expect(isRecognisedHeldDataType(type.value)).toBe(true);
      expect(type.aliases).toContain(normalizeHeldDataType(type.value));
    }
    expect(isRecognisedHeldDataType('All')).toBe(true);
    expect(isRecognisedHeldDataType('photos')).toBe(false);
  });

  it('hard-deletes a user once even when they filed several deletion requests', async () => {
    prismaAny.dSARRequest.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);

    const summary = await dataRetentionService.runAllPurgeJobs();

    expect(prismaAny.$transaction).toHaveBeenCalledTimes(2);
    const result = summary.results.find((entry: any) => entry.dataType === 'soft_deleted_users');
    expect(result?.recordsPurged).toBe(2);
    expect(result?.errors).toEqual([]);
  });

  it('only anonymizes audit logs that are not already marked, so a repeat run is a no-op', async () => {
    await dataRetentionService.runAllPurgeJobs();

    const [fragments] = prismaAny.$executeRaw.mock.calls[0];
    const sql = fragments.join(' ');
    expect(sql).toContain('UPDATE "AuditLog"');
    expect(sql).toContain(ANONYMIZED_GUARD);
    // PII columns go too - a record that still carries the actor's IP is not anonymized.
    expect(sql).toContain('"ipAddress" = NULL');
    expect(sql).toContain('"userAgent" = NULL');
  });

  it('collects a failing job into errors instead of abandoning the rest of the sweep', async () => {
    prismaAny.session.deleteMany.mockRejectedValue(new Error('session table locked'));
    prismaAny.notification.deleteMany.mockResolvedValue({ count: 4 });

    const summary = await dataRetentionService.runAllPurgeJobs();

    expect(summary.errors).toContain('session table locked');
    expect(summary.totalPurged).toBe(4);
    expect(prismaAny.privacyAuditLog.create).toHaveBeenCalled();
  });

  it('refuses to start a second overlapping sweep in the same process', async () => {
    let releaseHolds: (value: any) => void = () => undefined;
    prismaAny.legalHold.findMany.mockReturnValue(
      new Promise((resolve) => {
        releaseHolds = resolve;
      })
    );

    const first = dataRetentionService.runAllPurgeJobs();
    const second = await dataRetentionService.runAllPurgeJobs();

    expect(second.skipped).toBe(true);
    expect(second.results).toEqual([]);

    releaseHolds([]);
    await expect(first).resolves.toMatchObject({ skipped: false });
  });
});

describe('The analytics line of the retention report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubEmptyDatabase();
  });

  it('says there is nothing to purge rather than reporting a purge of a store that does not exist', async () => {
    const { queueAnalyticsEvent } = jest.requireMock('../../utils/queue') as { queueAnalyticsEvent: jest.Mock };

    const summary = await dataRetentionService.runAllPurgeJobs();
    const analytics = summary.results.find((result: any) => result.dataType === 'analytics_events');

    // It used to enqueue analytics.purge.requested for a worker with no store
    // behind it, and the report read as though a purge had run.
    expect(queueAnalyticsEvent).not.toHaveBeenCalled();
    expect(analytics).toMatchObject({ recordsPurged: 0, errors: [] });
    expect(analytics?.skipped).toMatch(/no analytics events are stored/i);
  });
});
