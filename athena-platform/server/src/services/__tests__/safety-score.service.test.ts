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
    safetyIncident: {
      create: jest.fn(async () => ({})),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      updateMany: jest.fn(async () => ({ count: 0 })),
      count: jest.fn(async () => 0),
    },
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
import {
  calculateSafetyScore,
  getSafetyStatus,
  handleUserBlock,
  handleUserReport,
  handleUserUnblock,
  recordSafetyIncident,
} from '../safety-score.service';

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

/** An unverified, undecided report from this reporter, as it sits in the table the day it is filed. */
function undecidedReport(reporterId: string, index = 0) {
  return { id: `rep-${reporterId}-${index}`, type: 'REPORT', verified: false, resolvedAt: null, reporterId, reason: 'harassment', createdAt: new Date() };
}

/** A block from this blocker, which the platform records as verified the moment it is made. */
function block(blockerId: string, overrides: Record<string, unknown> = {}) {
  return { id: `blk-${blockerId}`, type: 'BLOCK', verified: true, resolvedAt: null, reporterId: blockerId, reason: 'Blocked by another user', createdAt: new Date(), ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  notify.mockClear();
  prisma.user.update.mockResolvedValue({});
  prisma.safetyIncident.create.mockResolvedValue({});
  prisma.safetyIncident.count.mockResolvedValue(0);
  prisma.safetyIncident.findFirst.mockResolvedValue(null);
  prisma.safetyIncident.updateMany.mockResolvedValue({ count: 0 });
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

  // A report filed without an account used to count for nothing even after a
  // moderator upheld it. Undecided, it still counts for nothing: there is no
  // reporter to weigh, and one person signed out could file any number.
  it('counts an anonymous report only once a moderator has upheld it', async () => {
    prisma.user.findUnique.mockResolvedValue(member());

    prisma.safetyIncident.findMany.mockResolvedValue([]);
    const clean = await calculateSafetyScore('member-1');

    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'a1', type: 'USER_REPORT', verified: false, resolvedAt: null, reason: 'harassment', createdAt: new Date() },
    ]);
    const undecided = await calculateSafetyScore('member-1');

    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'a1', type: 'USER_REPORT', verified: true, resolvedAt: new Date(), reason: 'harassment', createdAt: new Date() },
    ]);
    const upheld = await calculateSafetyScore('member-1');

    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'r1', type: 'REPORT', verified: true, resolvedAt: new Date(), reason: 'harassment', createdAt: new Date() },
    ]);
    const namedAndUpheld = await calculateSafetyScore('member-1');

    expect(undecided.score).toBe(clean.score);
    expect(upheld.score).toBeLessThan(clean.score);
    expect(upheld.score).toBe(namedAndUpheld.score);
  });

  it('stops counting an anonymous report a moderator has dismissed', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'a1', type: 'USER_REPORT', verified: false, resolvedAt: new Date(), reason: 'spam', createdAt: new Date() },
    ]);

    const dismissed = await calculateSafetyScore('member-1');

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

/**
 * Reports and blocks nobody has checked are one account's word each, and the
 * score is what puts an account in front of staff and emails her that her
 * standing has changed. These hold that a few accounts cannot use them to make
 * somebody look like the risk (the DPIA's "a survivor is wrongly scored as the
 * aggressor"), while a report a moderator has upheld still counts in full.
 */
describe('calculateSafetyScore: what unchecked signals can and cannot do', () => {
  const scoreWith = async (incidents: unknown[]) => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue(incidents);
    return calculateSafetyScore('member-1');
  };

  it('counts twenty undecided reports from one account as one', async () => {
    const clean = await scoreWith([]);
    const one = await scoreWith([undecidedReport('troll')]);
    const twenty = await scoreWith(Array.from({ length: 20 }, (_v, index) => undecidedReport('troll', index)));

    expect(one.score).toBeLessThan(clean.score);
    expect(twenty.score).toBe(one.score);
    // Said in the breakdown, so a moderator reading it sees why it did not move.
    expect(twenty.factors.filter((factor) => factor.details.includes('already counted'))).toHaveLength(19);
  });

  it('stops undecided reports at three accounts worth, however many accounts there are', async () => {
    const clean = await scoreWith([]);
    const three = await scoreWith(['a', 'b', 'c'].map((id) => undecidedReport(id)));
    const thirty = await scoreWith(Array.from({ length: 30 }, (_v, index) => undecidedReport(`acct-${index}`)));

    expect(clean.score - three.score).toBe(30);
    expect(thirty.score).toBe(three.score);
  });

  it('counts a report a moderator has upheld in full, whatever the unchecked ones add up to', async () => {
    const clean = await scoreWith([]);
    const upheld = (index: number) => ({ id: `up-${index}`, type: 'REPORT', verified: true, resolvedAt: new Date(), reporterId: `r${index}`, reason: 'threats', createdAt: new Date() });

    const crowd = Array.from({ length: 10 }, (_v, index) => undecidedReport(`acct-${index}`));
    const withOneUpheld = await scoreWith([...crowd, upheld(1)]);
    const withTwoUpheld = await scoreWith([upheld(1), upheld(2)]);

    // -30 from the unchecked ten, capped, and -25 from the one a person checked.
    expect(clean.score - withOneUpheld.score).toBe(55);
    // Two upheld reports are -50: nothing caps what a person decided.
    expect(clean.score - withTwoUpheld.score).toBe(50);
  });

  it('counts a block once per blocker, and stops at three blockers', async () => {
    const clean = await scoreWith([]);
    const one = await scoreWith([block('a')]);
    const sameAgain = await scoreWith([block('a'), block('a', { id: 'blk-a-2' }), block('a', { id: 'blk-a-3' })]);
    const three = await scoreWith([block('a'), block('b'), block('c')]);
    const forty = await scoreWith(Array.from({ length: 40 }, (_v, index) => block(`acct-${index}`)));

    expect(clean.score - one.score).toBe(5);
    expect(sameAgain.score).toBe(one.score);
    expect(clean.score - three.score).toBe(15);
    expect(forty.score).toBe(three.score);
  });

  it('stops counting a block that was lifted', async () => {
    const clean = await scoreWith([]);
    const lifted = await scoreWith([block('a', { resolvedAt: new Date() })]);

    expect(lifted.score).toBe(clean.score);
    expect(lifted.factors.find((factor) => factor.category === 'incident')).toMatchObject({
      impact: 0,
      details: expect.stringContaining('lifted'),
    });
  });

  it('cannot take an account into the critical band with unchecked reports and blocks alone', async () => {
    const reports = Array.from({ length: 50 }, (_v, index) => undecidedReport(`reporter-${index}`));
    const blocks = Array.from({ length: 50 }, (_v, index) => block(`blocker-${index}`));

    const clean = await scoreWith([]);
    const worst = await scoreWith([...reports, ...blocks]);

    // The two ceilings (-30 and -15) leave the default well clear of the
    // critical line: a restriction on messaging at most, and no staff flag and
    // no standing email for the account.
    expect(clean.score - worst.score).toBe(45);
    expect(worst.score).toBeGreaterThanOrEqual(25);
    expect(worst.riskLevel).not.toBe('CRITICAL');
  });
});

describe('recordSafetyIncident: one open voice per person against another', () => {
  it('does not record a second open report from the same reporter, and does not recalculate', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue([]);
    prisma.safetyIncident.findFirst.mockResolvedValue({ id: 'earlier' });

    await recordSafetyIncident({ userId: 'member-1', type: 'REPORT', severity: 'MEDIUM', reason: 'harassment', reporterId: 'troll', verified: false });

    expect(prisma.safetyIncident.findFirst).toHaveBeenCalledWith({
      where: { userId: 'member-1', type: 'REPORT', reporterId: 'troll', resolvedAt: null },
      select: { id: true },
    });
    expect(prisma.safetyIncident.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('records the first report from a reporter, and a fresh one once the earlier has been decided', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue([]);
    // Decided reports have a resolvedAt, so the open-report search finds nothing.
    prisma.safetyIncident.findFirst.mockResolvedValue(null);

    await recordSafetyIncident({ userId: 'member-1', type: 'REPORT', severity: 'MEDIUM', reason: 'harassment', reporterId: 'her', verified: false });

    expect(prisma.safetyIncident.create).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe the incidents a moderator or the system records, which have no reporter to weigh', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue([]);

    await recordSafetyIncident({ userId: 'member-1', type: 'CONTENT_REMOVAL', severity: 'MEDIUM', reason: 'removed', reporterId: 'mod-1', verified: true });
    await recordSafetyIncident({ userId: 'member-1', type: 'SUSPENSION', severity: 'HIGH', reason: 'suspended', verified: true });

    expect(prisma.safetyIncident.findFirst).not.toHaveBeenCalled();
    expect(prisma.safetyIncident.create).toHaveBeenCalledTimes(2);
  });
});

describe('handleUserReport: who a report is about', () => {
  it('records a report for conduct', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue([]);

    await handleUserReport('member-1', 'her', 'harassment', 'post-1', 'post');

    expect(prisma.safetyIncident.create.mock.calls[0][0].data).toMatchObject({ type: 'REPORT', reporterId: 'her', reason: 'harassment' });
  });

  it('records nothing against a member who was reported because she may be at risk', async () => {
    // The report reaches the staff queue and its alert by its own route; a score
    // that fell because a woman wrote that she wanted to die would mark her as a
    // risk to others.
    await handleUserReport('member-1', 'her', 'self_harm', 'post-1', 'post');
    await handleUserReport('member-1', 'her', 'SELF_HARM', 'post-1', 'post');

    expect(prisma.safetyIncident.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('handleUserUnblock', () => {
  it('lifts the open block of that blocker against the member and works the score out again', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    prisma.safetyIncident.findMany.mockResolvedValue([]);
    prisma.safetyIncident.updateMany.mockResolvedValue({ count: 1 });

    await handleUserUnblock('member-1', 'blocker-1');

    expect(prisma.safetyIncident.updateMany).toHaveBeenCalledWith({
      where: { userId: 'member-1', type: 'BLOCK', reporterId: 'blocker-1', resolvedAt: null },
      data: { resolvedAt: expect.any(Date) },
    });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('does nothing more when there was no open block to lift', async () => {
    prisma.safetyIncident.updateMany.mockResolvedValue({ count: 0 });

    await handleUserUnblock('member-1', 'blocker-1');

    expect(prisma.user.update).not.toHaveBeenCalled();
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

  it('lists only the badges a reviewer has approved', async () => {
    // Rows as the table really has them: a status, and no isActive column. The
    // fixture used to invent that column, which is how a scorer that read it
    // went unnoticed.
    prisma.user.findUnique.mockResolvedValue({
      safetyScore: 90,
      safetyScoreUpdatedAt: new Date(),
      verificationBadges: [
        { id: 'b1', type: 'IDENTITY', status: 'APPROVED' },
        { id: 'b2', type: 'EMPLOYER', status: 'PENDING' },
        { id: 'b3', type: 'EDUCATOR', status: 'REJECTED' },
      ],
    });

    const status = await getSafetyStatus('member-1');

    expect(status.level).toBe('TRUSTED');
    expect(status.badges).toEqual(['IDENTITY']);
  });

  it('reads a member nobody has assessed yet at the baseline, not at the column default of 50', async () => {
    // The column defaults to 50 and the scorer starts every member at 75. A
    // member with no assessment is a member with nothing against her.
    prisma.user.findUnique.mockResolvedValue({ safetyScore: 50, safetyScoreUpdatedAt: null, verificationBadges: [] });

    const status = await getSafetyStatus('member-1');

    expect(status.score).toBe(75);
    expect(status.level).toBe('GOOD');
    expect(status.assessedAt).toBeNull();
  });

  it('reads a member who has been assessed at what was measured, however low', async () => {
    prisma.user.findUnique.mockResolvedValue({ safetyScore: 0, safetyScoreUpdatedAt: new Date(), verificationBadges: [] });

    const status = await getSafetyStatus('member-1');

    expect(status.score).toBe(0);
    expect(status.level).toBe('RESTRICTED');
  });
});

describe('what a verification badge is worth to the score', () => {
  // A fresh account, so the age bonus is small and the same in every case below.
  const withBadges = (badges: Array<{ type: string; status: string }>) =>
    member({ createdAt: new Date(Date.now() - 1 * DAY), verificationBadges: badges.map((b, i) => ({ id: `b${i}`, ...b })) });

  async function scoreWith(badges: Array<{ type: string; status: string }>) {
    prisma.user.findUnique.mockResolvedValue(withBadges(badges));
    prisma.safetyIncident.findMany.mockResolvedValue([]);
    return calculateSafetyScore('member-1');
  }

  it('adds 20 for an approved identity check and 15 for an approved employer check', async () => {
    const none = await scoreWith([]);
    const identity = await scoreWith([{ type: 'IDENTITY', status: 'APPROVED' }]);
    const employer = await scoreWith([{ type: 'EMPLOYER', status: 'APPROVED' }]);

    expect(identity.score - none.score).toBe(20);
    expect(employer.score - none.score).toBe(15);
    expect(identity.factors.some((f) => f.category === 'verification' && f.details === 'Identity verified')).toBe(true);
    expect(employer.factors.some((f) => f.category === 'verification' && f.details === 'Employer verified')).toBe(true);
  });

  it('adds nothing for a check still waiting, or one that was refused', async () => {
    const none = await scoreWith([]);
    const pending = await scoreWith([
      { type: 'IDENTITY', status: 'PENDING' },
      { type: 'EMPLOYER', status: 'PENDING' },
    ]);
    const rejected = await scoreWith([
      { type: 'IDENTITY', status: 'REJECTED' },
      { type: 'EMPLOYER', status: 'REJECTED' },
    ]);

    expect(pending.score).toBe(none.score);
    expect(rejected.score).toBe(none.score);
    expect(pending.factors.some((f) => f.category === 'verification')).toBe(false);
    expect(rejected.factors.some((f) => f.category === 'verification')).toBe(false);
  });

  it('adds nothing for an approved badge of a kind the score does not weigh', async () => {
    const none = await scoreWith([]);
    const mentor = await scoreWith([{ type: 'MENTOR', status: 'APPROVED' }]);

    expect(mentor.score).toBe(none.score);
  });
});

describe('recordSafetyIncident for a member nobody had assessed', () => {
  it('measures her first report as a fall from the baseline, so the notice that goes with a fall is sent', async () => {
    // Column default 50, never scored. One upheld report takes the recalculated
    // score to 75 - 25 + the small age bonus: a real fall from 75, which is
    // 15 or more, and which measured from 50 would have looked like a rise.
    prisma.user.findUnique.mockImplementation(async ({ include }: any) =>
      include
        ? member({ createdAt: new Date(Date.now() - 1 * DAY) })
        : { safetyScore: 50, safetyScoreUpdatedAt: null }
    );
    prisma.safetyIncident.findMany.mockResolvedValue([
      { id: 'inc-0', type: 'REPORT', verified: true, resolvedAt: null, reporterId: 'her', reason: 'harassment', createdAt: new Date() },
    ]);

    await recordSafetyIncident({ userId: 'member-1', type: 'REPORT', severity: 'MEDIUM', reason: 'harassment', reporterId: 'her', verified: true });

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Account Standing Update' }));
  });
});
