/**
 * The admin queues and the audit trail behind them.
 *
 * Each of these was a place the console either said something untrue or broke
 * on a well-formed request: the report queue sorted newest first with no
 * deadline while reporters were promised 24 and 48 hours; the audit-log viewer
 * handed ?limit=abc straight to Prisma; a completed full erasure answered 500
 * because its audit row pointed at the account it had just removed; a
 * suspension's reason went to a log line nobody could read back; and the DSAR
 * table's 30-day clock had no reader at all.
 *
 * The admin router is mounted on its own so these tests answer for it alone.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    contentReport: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), count: jest.fn() },
    bannedIdentity: { upsert: jest.fn() },
    dSARRequest: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.test' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import adminRoutes from '../admin.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';
import { gdprService } from '../../services/gdpr.service';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(errorHandler);

const prisma: any = prismaTyped;
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  prisma.auditLog.findMany.mockResolvedValue([]);
  prisma.auditLog.count.mockResolvedValue(0);
  prisma.notification.create.mockResolvedValue({ id: 'n-1' });
});

describe('GET /api/admin/audit-logs', () => {
  it.each([
    ['limit=abc'],
    ['page=0'],
    ['limit=1000000'],
    ['action=NOT_A_REAL_ACTION'],
  ])('refuses %s with a 400 instead of passing it to Prisma', async (query) => {
    const res = await request(app).get(`/api/admin/audit-logs?${query}`);

    expect(res.status).toBe(400);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('pages within bounds and filters on the verb recordAdminAction writes', async () => {
    const res = await request(app).get('/api/admin/audit-logs?page=2&limit=25&action=DATA_ACCESS&adminAction=DV_SERVICE_UPDATED');

    expect(res.status).toBe(200);
    const args = prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.skip).toBe(25);
    expect(args.take).toBe(25);
    expect(args.where).toEqual({
      AND: [
        { action: 'DATA_ACCESS' },
        { metadata: { path: ['adminAction'], equals: 'DV_SERVICE_UPDATED' } },
      ],
    });
  });

  it('finds a ban recorded before moderation had verbs of its own when asked for MODERATION_BAN', async () => {
    const res = await request(app).get('/api/admin/audit-logs?action=MODERATION_BAN');

    expect(res.status).toBe(200);
    expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
      AND: [
        {
          OR: [
            { action: 'MODERATION_BAN' },
            { action: 'ADMIN_USER_UPDATE', metadata: { path: ['moderationAction'], equals: 'ban' } },
          ],
        },
      ],
    });
  });

  it('finds staff changes filed as data access when asked for the staff verb they belong to', async () => {
    const res = await request(app).get('/api/admin/audit-logs?action=ADMIN_CONFIG_UPDATE');

    expect(res.status).toBe(200);
    const clause = prisma.auditLog.findMany.mock.calls[0][0].where.AND[0];
    expect(clause.OR[0]).toEqual({ action: 'ADMIN_CONFIG_UPDATE' });
    // A flag flip written before the verb existed is still found, and a blog
    // edit — a content change, not configuration — is not.
    expect(clause.OR).toContainEqual({
      action: 'DATA_ACCESS',
      metadata: { path: ['adminAction'], equals: 'FEATURE_FLAG_UPDATED' },
    });
    expect(clause.OR).not.toContainEqual({
      action: 'DATA_ACCESS',
      metadata: { path: ['adminAction'], equals: 'BLOG_ARTICLE_UPDATED' },
    });
  });
});

describe('GET /api/admin/moderation/reports', () => {
  const now = Date.now();
  // Open reports with their deadline in the column, as the database would
  // return them for the deadline-ordered page.
  const rows = [
    { id: 'spam', createdAt: new Date(now - 72 * HOUR), reason: 'SPAM', status: 'PENDING', reviewDeadline: new Date(now - 24 * HOUR), priority: 'NORMAL', evidence: null },
    {
      id: 'csam',
      createdAt: new Date(now - 2 * HOUR),
      reason: 'CSAM',
      status: 'REVIEWING',
      reviewDeadline: new Date(now + 22 * HOUR),
      priority: 'URGENT',
      evidence: { ticketId: 'RPT-1', contactEmail: 'reporter@example.org' },
    },
    { id: 'harassment', createdAt: new Date(now - 20 * HOUR), reason: 'HARASSMENT', status: 'PENDING', reviewDeadline: new Date(now + 28 * HOUR), priority: 'NORMAL', evidence: null },
  ].map((row) => ({
    ...row,
    contentType: 'POST',
    contentId: 'p',
    description: null,
    action: null,
    reviewerId: null,
    reviewNotes: null,
    actionTakenAt: null,
    updatedAt: row.createdAt,
    reporter: null,
    reportedUser: null,
  }));

  /** Stamping pass, unstamped list, and the page itself, told apart by their where. */
  let unstamped: any[] = [];

  beforeEach(() => {
    unstamped = [];
    prisma.contentReport.findMany.mockImplementation(async (args: any) => {
      if (args.where?.OR) return unstamped; // stampMissingReviewClocks
      if (args.where?.reviewDeadline === null) return unstamped; // overdue count for unstamped rows
      return rows;
    });
    prisma.contentReport.update.mockResolvedValue({});
    prisma.contentReport.count.mockImplementation(async (args: any) =>
      args.where?.reviewDeadline?.lt ? 1 : rows.length
    );
  });

  it('asks the database for the open queue soonest due first, by the deadline column', async () => {
    const res = await request(app).get('/api/admin/moderation/reports?status=open');

    expect(res.status).toBe(200);
    const pageQuery = prisma.contentReport.findMany.mock.calls.find(
      ([args]: any[]) => args.where?.status && !args.where?.OR && args.where?.reviewDeadline === undefined
    )[0];
    expect(pageQuery.where).toEqual({ status: { in: ['PENDING', 'REVIEWING'] } });
    // Nulls first: a report with no deadline yet is looked at early, never
    // left behind every stamped one.
    expect(pageQuery.orderBy).toEqual([{ reviewDeadline: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }]);
    expect(pageQuery.skip).toBe(0);
  });

  it('says which reports are late and how urgent each is, from the columns', async () => {
    const res = await request(app).get('/api/admin/moderation/reports?status=open');

    expect(res.body.reports.map((r: any) => r.id)).toEqual(['spam', 'csam', 'harassment']);
    expect(res.body.reports[0]).toMatchObject({ overdue: true, priority: 'NORMAL' });
    expect(res.body.reports[1]).toMatchObject({ overdue: false, priority: 'URGENT' });
    expect(res.body.reports[1].reviewDeadline).toBe(rows[1].reviewDeadline.toISOString());
    expect(res.body.overdueCount).toBe(1);
    expect(res.body.overdueCountIsPartial).toBe(false);
  });

  it('has an overdue view that asks for open reports past the deadline column', async () => {
    const res = await request(app).get('/api/admin/moderation/reports?status=overdue');

    expect(res.status).toBe(200);
    const pageQuery = prisma.contentReport.findMany.mock.calls.find(([args]: any[]) => args.where?.reviewDeadline?.lt && args.skip !== undefined)[0];
    expect(pageQuery.where.status).toEqual({ in: ['PENDING', 'REVIEWING'] });
    expect(pageQuery.orderBy[0]).toEqual({ reviewDeadline: { sort: 'asc', nulls: 'first' } });
  });

  it('gives a report filed without a deadline the one its reason runs on before the queue is read', async () => {
    // The in-app dialog files reports without stamping them. Harassment runs on
    // the 48-hour clock, so this one was due 28 hours from now.
    const createdAt = new Date(now - 20 * HOUR);
    unstamped = [{ id: 'dialog', createdAt, reason: 'HARASSMENT', status: 'PENDING', reviewDeadline: null, priority: null, evidence: null }];

    await request(app).get('/api/admin/moderation/reports?status=open');

    expect(prisma.contentReport.update).toHaveBeenCalledWith({
      where: { id: 'dialog' },
      data: { reviewDeadline: new Date(createdAt.getTime() + 48 * HOUR), priority: 'NORMAL' },
    });
  });

  it('never sends the reporter’s contact address to the queue list', async () => {
    const res = await request(app).get('/api/admin/moderation/reports?status=open');

    expect(JSON.stringify(res.body)).not.toContain('reporter@example.org');
    expect(res.body.reports[1].evidence).toBeUndefined();
  });

  it('refuses a priority the column does not hold', async () => {
    const res = await request(app).get('/api/admin/moderation/reports?status=open&priority=critical');

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/users/:id?hard=true', () => {
  it('answers 200 for a completed erasure even when the audit insert is refused', async () => {
    jest.spyOn(gdprService, 'eraseAccountByAdmin').mockResolvedValue({
      requestId: 'ADMIN-ERASURE-member-1',
      status: 'COMPLETED',
      accountRemoved: true,
      retainedSections: [],
      rowsRemoved: 40,
    });
    // What the real foreign key does to a row pointing at a removed account.
    prisma.auditLog.create.mockRejectedValue(Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }));

    const res = await request(app).delete('/api/admin/users/member-1?hard=true');

    expect(res.status).toBe(200);
    expect(res.body.data.accountRemoved).toBe(true);
    // And the row it tried to write no longer points at the removed account.
    expect(prisma.auditLog.create.mock.calls[0][0].data.targetUserId).toBeNull();
    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata.erasureReference).toBe('ADMIN-ERASURE-member-1');
  });

  it('answers a retry after a finished erasure with a 404, not a 500', async () => {
    jest.spyOn(gdprService, 'eraseAccountByAdmin').mockRejectedValue(new Error('User not found'));

    const res = await request(app).delete('/api/admin/users/member-1?hard=true');

    expect(res.status).toBe(404);
  });
});

describe('Suspension reasons', () => {
  const memberRow = { id: 'member-1', isSuspended: false, bannedAt: null };

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue(memberRow);
    prisma.user.update.mockResolvedValue({ id: 'member-1' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'member-1', isSuspended: true, bannedAt: null });
  });

  it('refuses a suspension that does not say why', async () => {
    const res = await request(app).patch('/api/admin/users/member-1').send({ isSuspended: true });

    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('answers 404 for an account that does not exist, rather than a 500 from the update', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).patch('/api/admin/users/nobody').send({ isSuspended: true, suspensionReason: 'x' });

    expect(res.status).toBe(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps the reason on the account and on the audit row', async () => {
    const patch = await request(app)
      .patch('/api/admin/users/member-1')
      .send({ isSuspended: true, suspensionReason: 'Threats in direct messages' });

    expect(patch.status).toBe(200);
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      isSuspended: true,
      suspensionReason: 'Threats in direct messages',
      suspendedById: 'admin-1',
    });
    expect(prisma.user.update.mock.calls[0][0].data.suspendedAt).toBeInstanceOf(Date);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe('MODERATION_SUSPEND');
    expect(audit.metadata.suspensionReason).toBe('Threats in direct messages');
  });

  it('reads the reason back from the account itself', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'member-1',
        isSuspended: true,
        suspensionReason: 'Threats in direct messages',
        suspendedAt: new Date('2026-09-25T00:00:00.000Z'),
        suspendedById: 'admin-1',
        bannedAt: null,
        banReason: null,
        bannedById: null,
        _count: { posts: 0, applications: 0 },
      },
      { id: 'member-2', isSuspended: false, _count: { posts: 0, applications: 0 } },
    ]);
    prisma.user.count.mockResolvedValue(2);

    const list = await request(app).get('/api/admin/users');

    expect(list.status).toBe(200);
    expect(list.body.users[0].suspension).toMatchObject({ reason: 'Threats in direct messages', source: 'account', banned: false });
    expect(list.body.users[1].suspension).toBeNull();
    // Nothing needed from the audit trail when the account carries its reason.
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('still reads an older suspension’s reason from the audit trail', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'member-1', isSuspended: true, _count: { posts: 0, applications: 0 } }]);
    prisma.user.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        targetUserId: 'member-1',
        actorUserId: 'moderator-1',
        createdAt: new Date('2026-09-25T00:00:00.000Z'),
        metadata: { moderationAction: 'ban', notes: 'Stalking across accounts', contentType: 'POST' },
      },
    ]);

    const list = await request(app).get('/api/admin/users');

    expect(list.body.users[0].suspension).toMatchObject({
      reason: 'Stalking across accounts',
      source: 'moderation',
      moderationAction: 'ban',
    });
  });

  it('refuses a sort column the list does not have with a 400', async () => {
    const res = await request(app).get('/api/admin/users?sortBy=passwordHash');

    expect(res.status).toBe(400);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('Banning from the member list', () => {
  beforeEach(() => {
    process.env.BANNED_IDENTITY_HASH_KEY = 'test-ban-key';
    prisma.user.findUnique.mockResolvedValue({ id: 'member-1', isSuspended: false, bannedAt: null });
    prisma.user.update.mockResolvedValue({ id: 'member-1', email: 'Someone+tag@Example.org' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'member-1', isSuspended: true, bannedAt: new Date() });
    prisma.bannedIdentity.upsert.mockResolvedValue({ id: 'ban-1' });
  });

  it('marks the account banned and bars its address from registering again', async () => {
    const res = await request(app)
      .patch('/api/admin/users/member-1')
      .send({ isBanned: true, banReason: 'Threatened a member after being blocked' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ banned: true, banIdentityRecorded: true });

    const banWrite = prisma.user.update.mock.calls.find(([args]: any[]) => args.data.bannedAt)[0];
    expect(banWrite.data).toMatchObject({
      isSuspended: true,
      banReason: 'Threatened a member after being blocked',
      bannedById: 'admin-1',
    });

    const identity = prisma.bannedIdentity.upsert.mock.calls[0][0];
    // The address is kept as a keyed hash, never in the clear.
    expect(JSON.stringify(identity)).not.toContain('example.org');
    expect(identity.create).toMatchObject({ userId: 'member-1', createdById: 'admin-1', reportId: null });

    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('MODERATION_BAN');
  });

  it('refuses a ban without a reason', async () => {
    const res = await request(app).patch('/api/admin/users/member-1').send({ isBanned: true });

    expect(res.status).toBe(400);
    expect(prisma.bannedIdentity.upsert).not.toHaveBeenCalled();
  });

  it('does not lift a ban through the ordinary unsuspend', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'member-1', isSuspended: true, bannedAt: new Date() });

    const res = await request(app).patch('/api/admin/users/member-1').send({ isSuspended: false });

    expect(res.status).toBe(409);
    expect(res.body.error ?? res.body.message).toMatch(/appeal/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('says so when the account was locked but the address could not be barred', async () => {
    prisma.bannedIdentity.upsert.mockRejectedValue(new Error('database refused'));

    const res = await request(app)
      .patch('/api/admin/users/member-1')
      .send({ isBanned: true, banReason: 'Threatened a member after being blocked' });

    expect(res.status).toBe(200);
    expect(res.body.banIdentityRecorded).toBe(false);
  });
});

describe('The DSAR queue', () => {
  const dueIn = (days: number) => new Date(Date.now() + days * 24 * HOUR);

  it('lists open requests soonest due first, with the clock and the counts a privacy officer needs', async () => {
    prisma.dSARRequest.findMany.mockResolvedValue([
      { id: 'late', type: 'RECTIFICATION', status: 'IN_PROGRESS', dueDate: dueIn(-2), assignedTo: 'admin-1', user: null },
      { id: 'soon', type: 'DELETION', status: 'PENDING', dueDate: dueIn(3), assignedTo: null, user: null },
    ]);
    prisma.dSARRequest.count.mockResolvedValue(2);
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1', firstName: 'Priya', lastName: 'N', email: 'p@athena.test' }]);

    const res = await request(app).get('/api/admin/gdpr/dsar-requests');

    expect(res.status).toBe(200);
    const args = prisma.dSARRequest.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: { in: ['PENDING', 'IN_PROGRESS'] } });
    expect(args.orderBy).toEqual({ dueDate: 'asc' });
    // A live download link to someone's whole data file is not queue material.
    expect(args.select.exportUrl).toBeUndefined();
    expect(res.body.requests[0]).toMatchObject({ id: 'late', overdue: true, assignee: { id: 'admin-1' } });
    expect(res.body.requests[1]).toMatchObject({ id: 'soon', overdue: false, daysRemaining: 2 });
    expect(res.body.summary).toBeDefined();
  });

  it('will not mark an erasure done by hand', async () => {
    prisma.dSARRequest.findUnique.mockResolvedValue({
      id: 'dsar-1',
      userId: 'member-1',
      type: 'DELETION',
      status: 'PENDING',
      assignedTo: null,
      processingNotes: null,
    });

    const res = await request(app)
      .patch('/api/admin/gdpr/dsar-requests/dsar-1')
      .send({ status: 'COMPLETED', note: 'Done' });

    expect(res.status).toBe(409);
    expect(prisma.dSARRequest.update).not.toHaveBeenCalled();
  });

  it('refuses a request only with a reason, and tells the member that reason', async () => {
    prisma.dSARRequest.findUnique.mockResolvedValue({
      id: 'dsar-2',
      userId: 'member-1',
      type: 'DELETION',
      status: 'IN_PROGRESS',
      assignedTo: 'admin-1',
      processingNotes: 'Erasure refused: active legal hold',
    });

    const withoutReason = await request(app).patch('/api/admin/gdpr/dsar-requests/dsar-2').send({ status: 'REJECTED' });
    expect(withoutReason.status).toBe(400);

    prisma.dSARRequest.update.mockImplementation(async ({ data }: any) => ({
      id: 'dsar-2',
      type: 'DELETION',
      status: data.status,
      assignedTo: 'admin-1',
      processingNotes: data.processingNotes,
      dueDate: dueIn(10),
      completedAt: data.completedAt,
    }));

    const res = await request(app)
      .patch('/api/admin/gdpr/dsar-requests/dsar-2')
      .send({ status: 'REJECTED', memberMessage: 'Your records are held under a court order until it ends.' });

    expect(res.status).toBe(200);
    const update = prisma.dSARRequest.update.mock.calls[0][0].data;
    expect(update.status).toBe('REJECTED');
    expect(update.completedAt).toBeInstanceOf(Date);
    // Appended, never overwritten.
    expect(update.processingNotes).toContain('Erasure refused: active legal hold');
    expect(update.processingNotes).toContain('Told the member');
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'member-1',
      message: 'Your records are held under a court order until it ends.',
    });
  });

  it('takes a request for the admin who asks', async () => {
    prisma.dSARRequest.findUnique.mockResolvedValue({
      id: 'dsar-3',
      userId: 'member-1',
      type: 'RECTIFICATION',
      status: 'PENDING',
      assignedTo: null,
      processingNotes: null,
    });
    prisma.dSARRequest.update.mockImplementation(async ({ data }: any) => ({
      id: 'dsar-3',
      type: 'RECTIFICATION',
      status: data.status ?? 'PENDING',
      assignedTo: data.assignedTo,
      processingNotes: data.processingNotes ?? null,
      dueDate: dueIn(20),
      completedAt: null,
    }));

    const res = await request(app).patch('/api/admin/gdpr/dsar-requests/dsar-3').send({ assignedTo: 'me', status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(prisma.dSARRequest.update.mock.calls[0][0].data).toMatchObject({ assignedTo: 'admin-1', status: 'IN_PROGRESS' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
