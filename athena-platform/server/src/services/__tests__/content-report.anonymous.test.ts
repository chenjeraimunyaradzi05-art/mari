import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Reports filed without an account are SafetyIncident rows, and nothing read
// them back: no route, no page, no worker. These tests hold the reader and the
// decision path that closed that, because the surface they cover is the one the
// Online Safety Act cares most about.

jest.mock('../../utils/prisma', () => ({
  prisma: {
    safetyIncident: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(),
      count: jest.fn(async () => 0),
      update: jest.fn(),
    },
    user: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), update: jest.fn() },
    post: { update: jest.fn() },
    moderationLog: { create: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  listAnonymousReports,
  getAnonymousReport,
  resolveAnonymousReport,
} from '../content-report.service';

const prisma: any = prismaTyped;

const REPORTED = 'reported-user-1';
const MODERATOR = 'moderator-1';

const incident = (overrides: Record<string, unknown> = {}) => ({
  id: 'inc-1',
  userId: REPORTED,
  type: 'USER_REPORT',
  severity: 'HIGH',
  reason: 'HARASSMENT',
  reporterId: null,
  contentId: 'post-1',
  contentType: 'POST',
  verified: false,
  resolvedAt: null,
  resolvedById: null,
  metadata: {
    description: 'He posted my address',
    reviewDeadline: '2026-09-25T00:00:00.000Z',
    source: 'ONLINE_SAFETY_REPORT',
    anonymous: true,
  },
  createdAt: new Date('2026-09-23T01:00:00.000Z'),
  updatedAt: new Date('2026-09-23T01:00:00.000Z'),
  ...overrides,
});

describe('Anonymous reports reach a moderator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.safetyIncident.findMany.mockResolvedValue([incident()]);
    prisma.safetyIncident.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([
      {
        id: REPORTED,
        firstName: 'Ada',
        lastName: 'Rowe',
        displayName: 'Ada',
        email: 'ada@athena.com',
        isSuspended: false,
      },
    ]);
  });

  it('lists only anonymous reports, newest first, with the account they are about', async () => {
    const result = await listAnonymousReports({ status: 'PENDING' });

    const where = prisma.safetyIncident.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      type: 'USER_REPORT',
      metadata: { path: ['anonymous'], equals: true },
      resolvedAt: null,
    });
    expect(prisma.safetyIncident.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });

    expect(result.reports[0]).toMatchObject({
      id: 'inc-1',
      anonymous: true,
      status: 'PENDING',
      contentType: 'POST',
      description: 'He posted my address',
      reviewDeadline: '2026-09-25T00:00:00.000Z',
      reportedUser: { id: REPORTED, email: 'ada@athena.com' },
    });
    expect(result.openCount).toBe(1);
  });

  it('reads an actioned report back with the outcome the decision wrote', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(
      incident({
        resolvedAt: new Date('2026-09-23T04:00:00.000Z'),
        resolvedById: MODERATOR,
        metadata: {
          anonymous: true,
          status: 'RESOLVED',
          action: 'CONTENT_REMOVED',
          reviewNotes: 'Address removed',
        },
      })
    );

    const report = await getAnonymousReport('inc-1');

    expect(report).toMatchObject({
      status: 'RESOLVED',
      action: 'CONTENT_REMOVED',
      reviewNotes: 'Address removed',
      reviewerId: MODERATOR,
    });
  });

  it('removing on an anonymous report hides the content and records who decided it', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(incident());

    const outcome = await resolveAnonymousReport('inc-1', 'remove', MODERATOR, 'Doxxing');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { isHidden: true },
    });

    const update = prisma.safetyIncident.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'inc-1' });
    expect(update.data.resolvedById).toBe(MODERATOR);
    expect(update.data.resolvedAt).toBeInstanceOf(Date);
    expect(update.data.verified).toBe(true);
    expect(update.data.metadata).toMatchObject({
      status: 'RESOLVED',
      action: 'CONTENT_REMOVED',
      reviewNotes: 'Doxxing',
      moderatorId: MODERATOR,
      // The report's own details survive the decision.
      source: 'ONLINE_SAFETY_REPORT',
    });

    expect(prisma.moderationLog.create.mock.calls[0][0].data).toMatchObject({
      ticketId: 'inc-1',
      action: 'remove',
      moderatorId: MODERATOR,
    });

    expect(outcome).toMatchObject({
      reportId: 'inc-1',
      ticketId: null,
      status: 'RESOLVED',
      reportedUserId: REPORTED,
    });
  });

  it('a dismissal is not a verification', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(incident());

    await resolveAnonymousReport('inc-1', 'dismiss', MODERATOR);

    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(prisma.safetyIncident.update.mock.calls[0][0].data.verified).toBe(false);
    expect(prisma.safetyIncident.update.mock.calls[0][0].data.metadata).toMatchObject({
      status: 'DISMISSED',
      action: 'NO_ACTION',
    });
  });

  it('refuses a second decision on a report that has already been actioned', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(
      incident({ resolvedAt: new Date(), resolvedById: MODERATOR })
    );

    await expect(resolveAnonymousReport('inc-1', 'ban', 'moderator-2')).rejects.toThrow(
      'Report has already been actioned'
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('will not action an incident that is not an anonymous report', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(null);

    await expect(resolveAnonymousReport('inc-9', 'remove', MODERATOR)).rejects.toThrow(
      'Report not found'
    );

    expect(prisma.safetyIncident.findFirst.mock.calls[0][0].where).toMatchObject({
      type: 'USER_REPORT',
      metadata: { path: ['anonymous'], equals: true },
      id: 'inc-9',
    });
  });
});
