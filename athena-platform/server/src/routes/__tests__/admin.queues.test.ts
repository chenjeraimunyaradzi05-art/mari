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
    contentReport: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
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
      action: 'DATA_ACCESS',
      metadata: { path: ['adminAction'], equals: 'DV_SERVICE_UPDATED' },
    });
  });
});

describe('GET /api/admin/moderation/reports?status=open', () => {
  const now = Date.now();
  const rows = [
    // Harassment from 20 hours ago, no stamped deadline: due in 28 hours.
    { id: 'harassment', createdAt: new Date(now - 20 * HOUR), reason: 'HARASSMENT', status: 'PENDING', evidence: null },
    // CSAM from 2 hours ago, stamped 24 hours: due in 22 hours.
    {
      id: 'csam',
      createdAt: new Date(now - 2 * HOUR),
      reason: 'CSAM',
      status: 'REVIEWING',
      evidence: { reviewDeadline: new Date(now + 22 * HOUR).toISOString(), contactEmail: 'reporter@example.org' },
    },
    // Spam from three days ago: overdue.
    { id: 'spam', createdAt: new Date(now - 72 * HOUR), reason: 'SPAM', status: 'PENDING', evidence: null },
  ];

  beforeEach(() => {
    prisma.contentReport.findMany.mockImplementation(async (args: any) => {
      if (args.where?.id?.in) {
        return rows
          .filter((row) => args.where.id.in.includes(row.id))
          .map((row) => ({ ...row, contentType: 'POST', contentId: 'p', description: null, action: null, reviewerId: null, reviewNotes: null, actionTakenAt: null, updatedAt: row.createdAt, reporter: null, reportedUser: null }));
      }
      return rows;
    });
    prisma.contentReport.count.mockResolvedValue(rows.length);
  });

  it('orders the open queue by deadline and says which reports are late', async () => {
    const res = await request(app).get('/api/admin/moderation/reports?status=open');

    expect(res.status).toBe(200);
    expect(res.body.reports.map((r: any) => r.id)).toEqual(['spam', 'csam', 'harassment']);
    expect(res.body.reports[0].overdue).toBe(true);
    expect(res.body.reports[1].overdue).toBe(false);
    expect(res.body.overdueCount).toBe(1);
    // The open view asks the database for open reports, not everything.
    expect(prisma.contentReport.findMany.mock.calls[0][0].where).toEqual({ status: { in: ['PENDING', 'REVIEWING'] } });
  });

  it('never sends the reporter’s contact address to the queue list', async () => {
    const res = await request(app).get('/api/admin/moderation/reports?status=open');

    expect(JSON.stringify(res.body)).not.toContain('reporter@example.org');
    expect(res.body.reports[0].evidence).toBeUndefined();
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
  it('refuses a suspension that does not say why', async () => {
    const res = await request(app).patch('/api/admin/users/member-1').send({ isSuspended: true });

    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps the reason with the suspension and reads it back on the user list', async () => {
    prisma.user.update.mockResolvedValue({ id: 'member-1', isSuspended: true });

    const patch = await request(app)
      .patch('/api/admin/users/member-1')
      .send({ isSuspended: true, suspensionReason: 'Threats in direct messages' });

    expect(patch.status).toBe(200);
    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata.suspensionReason).toBe('Threats in direct messages');

    prisma.user.findMany.mockResolvedValue([
      { id: 'member-1', isSuspended: true, _count: { posts: 0, applications: 0 } },
      { id: 'member-2', isSuspended: false, _count: { posts: 0, applications: 0 } },
    ]);
    prisma.user.count.mockResolvedValue(2);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        targetUserId: 'member-1',
        actorUserId: 'admin-1',
        createdAt: new Date('2026-09-25T00:00:00.000Z'),
        metadata: { isSuspended: true, suspensionReason: 'Threats in direct messages' },
      },
    ]);

    const list = await request(app).get('/api/admin/users');

    expect(list.status).toBe(200);
    expect(list.body.users[0].suspension).toMatchObject({ reason: 'Threats in direct messages', source: 'admin' });
    expect(list.body.users[1].suspension).toBeNull();
  });

  it('shows the moderator’s notes as the reason when a report decision suspended the account', async () => {
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
