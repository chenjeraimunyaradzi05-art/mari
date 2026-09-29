import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The yearly re-check of a verified practitioner.
 *
 * Verification used to be a permanent switch, so a practitioner deregistered
 * after she was checked stayed "Verified and listed". The check is now good
 * for a year from the admin's approval (read from the audit row the verify
 * route writes); the admins are told when it falls due, and thirty days
 * after that, unchecked, the listing comes out of the directory and back
 * into the approval queue, with the practitioner told why.
 */

jest.mock('../../../utils/prisma', () => ({
  prisma: {
    auditLog: { findMany: jest.fn(async () => []), create: jest.fn(async () => ({})) },
    healthPractitioner: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 1 })) },
    notification: { create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 1 })) },
    user: { findMany: jest.fn(async () => [{ id: 'admin-1' }]) },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../../utils/prisma';
import {
  RECHECK_RULE_STARTED,
  lastVerificationChecks,
  recheckState,
  sweepPractitionerRechecks,
} from '../practitioner-recheck.service';

const prisma: any = prismaTyped;
const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2027-06-01T00:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

const approval = (id: string, at: Date, by = 'admin-7') => ({ createdAt: at, actorUserId: by, metadata: { resourceType: 'HealthPractitioner', resourceId: id } });
const practitioner = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Dr ${id}`,
  kind: 'PSYCHOLOGIST',
  ahpraNumber: 'PSY0001234567',
  ownerUserId: `owner-${id}`,
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditLog.findMany.mockResolvedValue([]);
  prisma.healthPractitioner.findMany.mockResolvedValue([]);
  prisma.healthPractitioner.updateMany.mockResolvedValue({ count: 1 });
});

describe('recheckState', () => {
  it('is current for a year from the approval, due for thirty days, then lapsed', () => {
    const created = new Date('2025-01-01T00:00:00Z');
    expect(recheckState({ checkedAt: daysAgo(100), checkedById: 'a' }, created, now).status).toBe('CURRENT');
    expect(recheckState({ checkedAt: daysAgo(370), checkedById: 'a' }, created, now).status).toBe('DUE');
    const lapsed = recheckState({ checkedAt: daysAgo(400), checkedById: 'a' }, created, now);
    expect(lapsed.status).toBe('LAPSED');
    expect(lapsed.checkedById).toBe('a');
    expect(lapsed.recordMissing).toBe(false);
  });

  it('runs from the profile’s creation when there is no record, but never falls due before the rule began', () => {
    const old = recheckState(undefined, new Date('2020-01-01T00:00:00Z'), new Date(RECHECK_RULE_STARTED.getTime() + DAY));
    expect(old.recordMissing).toBe(true);
    expect(old.checkedAt).toBeNull();
    expect(old.dueAt).toBe(RECHECK_RULE_STARTED.toISOString());
    expect(old.status).toBe('DUE');

    const recent = recheckState(undefined, new Date('2027-01-01T00:00:00Z'), now);
    expect(recent.status).toBe('CURRENT');
    expect(recent.dueAt).toBe(new Date(new Date('2027-01-01T00:00:00Z').getTime() + 365 * DAY).toISOString());
  });
});

describe('lastVerificationChecks', () => {
  it('reads the latest approval of each practitioner from the audit rows, and nothing for anyone else', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      approval('p1', daysAgo(10), 'admin-new'),
      approval('p1', daysAgo(400), 'admin-old'),
      approval('stranger', daysAgo(5)),
      { createdAt: daysAgo(3), actorUserId: 'x', metadata: null },
    ]);
    const checks = await lastVerificationChecks(['p1', 'p2']);

    expect(checks.get('p1')).toEqual({ checkedAt: daysAgo(10), checkedById: 'admin-new' });
    expect(checks.has('p2')).toBe(false);
    expect(checks.has('stranger')).toBe(false);
    const query = prisma.auditLog.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ action: 'ADMIN_VERIFICATION_APPROVE', metadata: { path: ['resourceType'], equals: 'HealthPractitioner' } });
    expect(query.orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('sweepPractitionerRechecks', () => {
  it('takes a lapsed practitioner out of the directory, records it, and tells her and the admins', async () => {
    prisma.healthPractitioner.findMany.mockResolvedValue([practitioner('lapsed'), practitioner('fine')]);
    prisma.auditLog.findMany.mockResolvedValue([approval('lapsed', daysAgo(420)), approval('fine', daysAgo(30))]);

    const result = await sweepPractitionerRechecks(now);

    expect(result).toEqual({ verified: 2, due: 0, newlyDue: 0, lapsed: 1 });
    expect(prisma.healthPractitioner.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.healthPractitioner.updateMany).toHaveBeenCalledWith({ where: { id: 'lapsed', isVerified: true }, data: { isVerified: false } });

    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: 'ADMIN_VERIFICATION_REJECT', actorUserId: null, targetUserId: 'owner-lapsed' });
    expect(audit.metadata).toMatchObject({ resourceType: 'HealthPractitioner', resourceId: 'lapsed', lapsed: true, isVerified: false });

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'owner-lapsed', link: '/dashboard/wellness/practice' });
    expect(prisma.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({ userId: 'admin-1', link: '/admin/practitioners' });
  });

  it('does not take down a practitioner an admin re-verified between the read and the write', async () => {
    prisma.healthPractitioner.findMany.mockResolvedValue([practitioner('raced')]);
    prisma.auditLog.findMany.mockResolvedValue([approval('raced', daysAgo(420))]);
    prisma.healthPractitioner.updateMany.mockResolvedValue({ count: 0 });

    const result = await sweepPractitionerRechecks(now);

    expect(result.lapsed).toBe(0);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('tells the admins when someone has newly fallen due, and not again every day after', async () => {
    prisma.healthPractitioner.findMany.mockResolvedValue([practitioner('today'), practitioner('last-week')]);
    prisma.auditLog.findMany.mockResolvedValue([
      approval('today', new Date(now.getTime() - 365 * DAY - 2 * 60 * 60 * 1000)),
      approval('last-week', daysAgo(372)),
    ]);

    const first = await sweepPractitionerRechecks(now);
    expect(first).toMatchObject({ due: 2, newlyDue: 1, lapsed: 0 });
    const notice = prisma.notification.createMany.mock.calls[0][0].data[0];
    expect(notice.title).toBe('2 practitioners are due their yearly registration check');
    expect(notice.message).toContain('Dr today');
    expect(notice.message).not.toContain('Dr last-week');

    jest.clearAllMocks();
    const tomorrow = new Date(now.getTime() + DAY);
    const second = await sweepPractitionerRechecks(tomorrow);
    expect(second.newlyDue).toBe(0);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(prisma.healthPractitioner.updateMany).not.toHaveBeenCalled();
  });

  it('never throws: a failed read is reported and counted as nothing done', async () => {
    prisma.healthPractitioner.findMany.mockRejectedValue(new Error('db down'));
    await expect(sweepPractitionerRechecks(now)).resolves.toEqual({ verified: 0, due: 0, newlyDue: 0, lapsed: 0 });
  });
});
