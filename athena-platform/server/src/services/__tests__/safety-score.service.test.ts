/**
 * The safety score, and the two things that are supposed to happen when it
 * falls.
 *
 * `recordSafetyIncident` read the member's previous score *after*
 * `updateSafetyScore` had already written the new one over it, so both of its
 * comparisons were between a number and itself. The drop was always zero, so
 * the "Account Standing Update" notification was never sent to anybody, and
 * `newScore < 25 && oldScore >= 25` was never true, so the SAFETY_CRITICAL
 * AdminFlag — the row that puts an account in front of the staff safety queue
 * — was never raised by a report or a block. Every reported member and every
 * blocked member on the platform came through this function.
 *
 * These tests pin the ordering: the old score is read before the incident is
 * written, and both thresholds fire on a real fall.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    safetyIncident: { create: jest.fn(async () => ({})), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    mentorSession: { count: jest.fn(async () => 0) },
    adminFlag: { create: jest.fn(async () => ({ id: 'flag-1' })) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/admin-notify.service', () => ({
  notifyAdmins: jest.fn(async () => 1),
}));

const notify = jest.fn(async (_input: unknown) => undefined);
jest.mock('../../services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ notify })),
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { notifyAdmins } from '../admin-notify.service';
import { calculateSafetyScore, getSafetyStatus, handleUserBlock, recordSafetyIncident } from '../safety-score.service';

const prisma: any = prismaTyped;
const adminNotice = notifyAdmins as unknown as jest.Mock;

const DAY = 24 * 60 * 60 * 1000;

/**
 * A member the scorer can read. `storedScore` is the column — what she scored
 * last time, which is the number the fall is measured from — and the rest is
 * what the recalculation is computed out of.
 */
function member(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    createdAt: new Date(Date.now() - 30 * DAY),
    safetyScore: 75,
    safetyScoreUpdatedAt: new Date(),
    profile: null,
    verificationBadges: [],
    _count: { posts: 0, comments: 0, likes: 0 },
    ...overrides,
  };
}

/** A verified report is -25 before decay; enough of them drive any account into the floor. */
function verifiedReports(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    id: `inc-${index}`,
    type: 'REPORT',
    verified: true,
    reason: 'harassment',
    createdAt: new Date(),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  notify.mockClear();
  prisma.user.update.mockResolvedValue({});
  prisma.safetyIncident.create.mockResolvedValue({});
  prisma.safetyIncident.count.mockResolvedValue(0);
  prisma.mentorSession.count.mockResolvedValue(0);
  prisma.adminFlag.create.mockResolvedValue({ id: 'flag-1' });
});

describe('calculateSafetyScore', () => {
  it('starts a clean recent account well clear of every restriction', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue([]);

    const breakdown = await calculateSafetyScore('member-1');

    expect(breakdown.score).toBeGreaterThanOrEqual(70);
    expect(breakdown.riskLevel).toBe('LOW');
    expect(breakdown.restrictions).toEqual([]);
  });

  it('weighs a verified report far heavier than an unverified one', async () => {
    prisma.user.findUnique.mockResolvedValue(member());

    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'i1', type: 'REPORT', verified: false, reason: 'spam', createdAt: new Date() },
    ]);
    const unverified = await calculateSafetyScore('member-1');

    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'i1', type: 'REPORT', verified: true, reason: 'spam', createdAt: new Date() },
    ]);
    const verified = await calculateSafetyScore('member-1');

    expect(verified.score).toBeLessThan(unverified.score);
  });

  it('stops counting a report a moderator has dismissed, and says why in the breakdown', async () => {
    prisma.user.findUnique.mockResolvedValue(member());

    prisma.safetyIncident.findMany.mockResolvedValue([]);
    const clean = await calculateSafetyScore('member-1');

    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'i1', type: 'REPORT', verified: false, resolvedAt: new Date(), reason: 'spam', createdAt: new Date() },
    ]);
    const dismissed = await calculateSafetyScore('member-1');

    expect(dismissed.score).toBe(clean.score);
    expect(dismissed.factors.find((factor) => factor.category === 'incident')).toMatchObject({
      impact: 0,
      details: expect.stringContaining('dismissed by a moderator'),
    });
  });

  it('lets an old incident weigh less than the same incident today', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ createdAt: new Date(Date.now() - 400 * DAY) }));

    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'i1', type: 'REPORT', verified: true, reason: 'harassment', createdAt: new Date() },
    ]);
    const today = await calculateSafetyScore('member-1');

    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'i1', type: 'REPORT', verified: true, reason: 'harassment', createdAt: new Date(Date.now() - 400 * DAY) },
    ]);
    const longAgo = await calculateSafetyScore('member-1');

    expect(longAgo.score).toBeGreaterThan(today.score);
  });

  it('restricts an account that has fallen into critical territory', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue(verifiedReports(6));

    const breakdown = await calculateSafetyScore('member-1');

    expect(breakdown.riskLevel).toBe('CRITICAL');
    expect(breakdown.restrictions).toContain('cannot_message');
    expect(breakdown.restrictions).toContain('review_required');
  });

  it('never returns a score outside 0-100, whatever the incident history', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue(verifiedReports(40));

    const breakdown = await calculateSafetyScore('member-1');

    expect(breakdown.score).toBe(0);
  });

  it('refuses to score a member who is not there rather than inventing a number', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const breakdown = await calculateSafetyScore('ghost');

    expect(breakdown.score).toBe(0);
    expect(breakdown.riskLevel).toBe('CRITICAL');
  });
});

describe('recordSafetyIncident: the fall has to be measured before the write', () => {
  it('reads the stored score before the recalculation overwrites it', async () => {
    const order: string[] = [];
    prisma.user.findUnique.mockImplementation(async ({ include }: any) => {
      order.push(include ? 'recalculate' : 'read-previous');
      return member({ safetyScore: 80 });
    });
    prisma.user.update.mockImplementation(async () => {
      order.push('write');
      return {};
    });
    prisma.safetyIncident.findMany.mockResolvedValue([]);

    await recordSafetyIncident({
      userId: 'member-1',
      type: 'REPORT',
      severity: 'MEDIUM',
      reason: 'harassment',
      verified: false,
    });

    // The previous score must be read first. When it was read last it was the
    // new score under another name, and nothing below ever fired.
    expect(order[0]).toBe('read-previous');
    expect(order.indexOf('write')).toBeGreaterThan(0);
  });

  it('tells the member when her standing has dropped by 15 or more', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ safetyScore: 95 }));
    prisma.safetyIncident.findMany.mockResolvedValue(verifiedReports(2));

    await recordSafetyIncident({
      userId: 'member-1',
      type: 'REPORT',
      severity: 'HIGH',
      reason: 'harassment',
      verified: true,
    });

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'member-1', title: 'Account Standing Update' }));
    // The message asks her to read the guidelines, and the link has to open
    // them: it used to go to /settings/safety, which has never existed.
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ link: '/help/community-guidelines' }));
  });

  it('says nothing to a member whose standing barely moved', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ safetyScore: 80 }));
    prisma.safetyIncident.findMany.mockResolvedValue([]);

    await recordSafetyIncident({
      userId: 'member-1',
      type: 'BLOCK',
      severity: 'LOW',
      reason: 'Blocked by another user',
      verified: true,
    });

    expect(notify).not.toHaveBeenCalled();
  });

  it('raises the staff safety flag the first time an account crosses below 25', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ safetyScore: 60 }));
    prisma.safetyIncident.findMany.mockResolvedValue(verifiedReports(6));

    await recordSafetyIncident({
      userId: 'member-1',
      type: 'REPORT',
      severity: 'CRITICAL',
      reason: 'threats',
      verified: true,
    });

    expect(prisma.adminFlag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'member-1', type: 'SAFETY_CRITICAL', severity: 'HIGH' }),
      })
    );
    // Staff are told the queue has something in it, and the notice names no
    // member — the account it is about stays behind the staff role.
    expect(adminNotice).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(adminNotice.mock.calls[0][0])).not.toContain('member-1');
  });

  it('does not raise a second flag for an account that was already below 25', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ safetyScore: 10 }));
    prisma.safetyIncident.findMany.mockResolvedValue(verifiedReports(6));

    await recordSafetyIncident({
      userId: 'member-1',
      type: 'REPORT',
      severity: 'CRITICAL',
      reason: 'threats',
      verified: true,
    });

    expect(prisma.adminFlag.create).not.toHaveBeenCalled();
  });

  it('treats a stored zero as a measurement, not as a missing value', async () => {
    // `||` read a genuine 0 as absent and substituted the 75 default, which was
    // the one case where the dead comparison accidentally fired.
    prisma.user.findUnique.mockResolvedValue(member({ safetyScore: 0 }));
    prisma.safetyIncident.findMany.mockResolvedValue(verifiedReports(6));

    await recordSafetyIncident({
      userId: 'member-1',
      type: 'REPORT',
      severity: 'CRITICAL',
      reason: 'threats',
      verified: true,
    });

    expect(prisma.adminFlag.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('handleUserBlock', () => {
  it('raises the severity as the blocks against one account pile up in a week', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue([]);

    for (const [recent, severity] of [[0, 'LOW'], [3, 'MEDIUM'], [7, 'HIGH']] as const) {
      jest.clearAllMocks();
      prisma.user.findUnique.mockResolvedValue(member());
      prisma.safetyIncident.findMany.mockResolvedValue([]);
      prisma.safetyIncident.count.mockResolvedValue(recent);

      await handleUserBlock('member-1', 'blocker-1');

      expect(prisma.safetyIncident.create.mock.calls[0][0].data).toMatchObject({
        type: 'BLOCK',
        severity,
        verified: true,
      });
    }
  });
});

describe('getSafetyStatus', () => {
  it('says when the score was last worked out, so a caller cannot print a default as a finding', async () => {
    prisma.user.findUnique.mockResolvedValue({ safetyScore: 50, safetyScoreUpdatedAt: null, verificationBadges: [] });

    const status = await getSafetyStatus('member-1');

    expect(status.assessedAt).toBeNull();
  });

  it('lists only the badges that are still active', async () => {
    prisma.user.findUnique.mockResolvedValue({
      safetyScore: 90,
      safetyScoreUpdatedAt: new Date(),
      verificationBadges: [
        { type: 'IDENTITY', isActive: true },
        { type: 'EMPLOYER', isActive: false },
      ],
    });

    const status = await getSafetyStatus('member-1');

    expect(status.level).toBe('TRUSTED');
    expect(status.badges).toEqual(['IDENTITY']);
  });
});
