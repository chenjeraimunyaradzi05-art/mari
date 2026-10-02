/**
 * Staff controls over live streams, and what a moderator sees of a report.
 *
 * Until these, a stream that broke the rules could be stopped by one person
 * only: its host. A moderator who had decided a report was upheld could do
 * nothing to the broadcast it was about. These pin who may end a stream, that
 * every change is audited against the host, and that a report opened in the
 * console carries the copy of the words it was filed with (and none of the rest
 * of its evidence, which includes a reporter's contact address).
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    liveStream: { findUnique: jest.fn(), findMany: jest.fn(async () => []), update: jest.fn() },
    contentReport: { findUnique: jest.fn(), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    notification: { create: jest.fn(async () => ({})) },
    user: { findMany: jest.fn(async () => []), findUnique: jest.fn() },
    auditLog: { create: jest.fn(async () => ({})) },
  },
}));

// The real requireRole, with the caller's role taken from a header.
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'staff-1', role: req.headers['x-test-role'] || 'USER', email: 'staff@athena.com', persona: 'EARLY_CAREER' };
      next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (role: string) => ({ 'x-test-role': role });

const liveRow = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  hostId: 'host-1',
  title: 'Salary negotiation, live',
  status: 'LIVE',
  endedAt: null,
  suspendedAt: null,
  ...overrides,
});

const auditRows = () => prisma.auditLog.create.mock.calls.map((call: any[]) => call[0].data);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.liveStream.update.mockImplementation(async ({ data }: any) => ({
    id: 's1',
    hostId: 'host-1',
    status: data.status,
    suspendedAt: data.suspendedAt,
  }));
});

describe('ending a live stream as staff', () => {
  it('lets a moderator and an administrator, and nobody else', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(liveRow());

    await request(app).post('/api/admin/moderation/livestreams/s1/suspend').set(as('USER')).send({ reason: 'Threats' }).expect(403);
    expect(prisma.liveStream.update).not.toHaveBeenCalled();

    await request(app).post('/api/admin/moderation/livestreams/s1/suspend').set(as('MODERATOR')).send({ reason: 'Threats' }).expect(200);
    prisma.liveStream.findUnique.mockResolvedValue(liveRow());
    await request(app).post('/api/admin/moderation/livestreams/s1/suspend').set(as('ADMIN')).send({ reason: 'Threats' }).expect(200);
    expect(prisma.liveStream.update).toHaveBeenCalledTimes(2);
  });

  it('ends it, stamps who and why, and files an audit row against the host', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(liveRow());

    const res = await request(app)
      .post('/api/admin/moderation/livestreams/s1/suspend')
      .set(as('MODERATOR'))
      .send({ reason: '  Threats on air  ' })
      .expect(200);

    expect(res.body.data).toEqual({ id: 's1', suspended: true, changed: true });
    expect(prisma.liveStream.update.mock.calls[0][0].data).toMatchObject({
      status: 'ENDED',
      suspendedById: 'staff-1',
      suspendedReason: 'Threats on air',
    });

    const [row] = auditRows();
    expect(row).toMatchObject({ action: 'MODERATION_SUSPEND', actorUserId: 'staff-1', targetUserId: 'host-1' });
    expect(row.metadata).toMatchObject({ resourceType: 'LiveStream', resourceId: 's1', moderationAction: 'suspend_livestream', reason: 'Threats on air' });
  });

  it('asks for a reason, and refuses one it cannot keep', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(liveRow());

    await request(app).post('/api/admin/moderation/livestreams/s1/suspend').set(as('MODERATOR')).send({}).expect(400);
    await request(app).post('/api/admin/moderation/livestreams/s1/suspend').set(as('MODERATOR')).send({ reason: '   ' }).expect(400);
    await request(app).post('/api/admin/moderation/livestreams/s1/suspend').set(as('MODERATOR')).send({ reason: 'x'.repeat(501) }).expect(400);
    await request(app).post('/api/admin/moderation/livestreams/s1/suspend').set(as('MODERATOR')).send({ reason: 'ok', extra: 1 }).expect(400);

    expect(prisma.liveStream.update).not.toHaveBeenCalled();
    expect(auditRows()).toEqual([]);
  });

  it('is not found for a stream that does not exist, and writes nothing', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(null);

    await request(app).post('/api/admin/moderation/livestreams/nope/suspend').set(as('MODERATOR')).send({ reason: 'Threats' }).expect(404);

    expect(auditRows()).toEqual([]);
  });

  it('a second moderator suspending the same stream changes nothing and adds no audit row', async () => {
    prisma.liveStream.findUnique.mockResolvedValue(liveRow({ status: 'ENDED', suspendedAt: new Date() }));

    const res = await request(app)
      .post('/api/admin/moderation/livestreams/s1/suspend')
      .set(as('MODERATOR'))
      .send({ reason: 'Also threats' })
      .expect(200);

    expect(res.body.data).toEqual({ id: 's1', suspended: true, changed: false });
    expect(prisma.liveStream.update).not.toHaveBeenCalled();
    expect(auditRows()).toEqual([]);
  });

  it('can be undone, and says who undid it', async () => {
    prisma.liveStream.findUnique.mockResolvedValue({ id: 's1', hostId: 'host-1', suspendedAt: new Date() });
    prisma.liveStream.update.mockResolvedValue({});

    const res = await request(app).post('/api/admin/moderation/livestreams/s1/lift').set(as('MODERATOR')).expect(200);

    expect(res.body.data).toEqual({ id: 's1', suspended: false, changed: true });
    expect(prisma.liveStream.update.mock.calls[0][0].data).toEqual({ suspendedAt: null, suspendedById: null, suspendedReason: null });
    const [row] = auditRows();
    expect(row).toMatchObject({ actorUserId: 'staff-1', targetUserId: 'host-1' });
    expect(row.metadata).toMatchObject({ adminAction: 'LIVESTREAM_SUSPENSION_LIFTED', resourceType: 'LiveStream', resourceId: 's1' });

    await request(app).post('/api/admin/moderation/livestreams/s1/lift').set(as('USER')).expect(403);
  });

  it('lists what is live, and with ?suspended=true what was taken down, never a key or a URL', async () => {
    prisma.liveStream.findMany.mockResolvedValue([
      { id: 's1', title: 'Live', status: 'LIVE', viewerCount: 3, messageCount: 9, startedAt: new Date(), endedAt: null, suspendedAt: null, suspendedReason: null, host: { id: 'host-1', displayName: 'Mei C.' } },
    ]);

    await request(app).get('/api/admin/moderation/livestreams').set(as('USER')).expect(403);
    const live = await request(app).get('/api/admin/moderation/livestreams').set(as('MODERATOR')).expect(200);
    expect(live.body.streams).toHaveLength(1);
    expect(prisma.liveStream.findMany.mock.calls[0][0].where).toEqual({ status: 'LIVE' });
    const select = prisma.liveStream.findMany.mock.calls[0][0].select;
    expect(select.streamKey).toBeUndefined();
    expect(select.playbackUrl).toBeUndefined();
    expect(select.ingestUrl).toBeUndefined();

    await request(app).get('/api/admin/moderation/livestreams?suspended=true').set(as('MODERATOR')).expect(200);
    expect(prisma.liveStream.findMany.mock.calls[1][0].where).toEqual({ suspendedAt: { not: null } });
  });
});

describe('opening a report in the console', () => {
  const reportRow = (evidence: unknown) => ({
    id: 'rep-1',
    contentType: 'MESSAGE',
    contentId: 'msg-1',
    reason: 'harassment',
    description: 'He will not stop',
    status: 'PENDING',
    action: null,
    reviewerId: null,
    reviewNotes: null,
    actionTakenAt: null,
    reviewDeadline: new Date('2026-10-03T00:00:00Z'),
    priority: 'NORMAL',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    reporter: { id: 'her', firstName: 'Ana', lastName: 'K', displayName: 'Ana', email: 'ana@example.com' },
    reportedUser: { id: 'him', firstName: 'Dan', lastName: 'R', displayName: 'Dan', email: 'dan@example.com', isSuspended: false, bannedAt: null },
    evidence,
  });

  it('carries the copy of the message and its context, and nothing else of the evidence', async () => {
    prisma.contentReport.findUnique.mockResolvedValue(
      reportRow({
        ticketId: 'RPT-1',
        contactEmail: 'anon-reporter@example.com',
        messageContext: { version: 1, surface: 'direct', conversationId: 'c1', reported: { id: 'msg-1', content: 'I know where you work' }, before: [] },
      })
    );

    const res = await request(app).get('/api/admin/moderation/reports/rep-1').set(as('MODERATOR')).expect(200);

    expect(res.body.report.context.messageContext.reported.content).toBe('I know where you work');
    expect(res.body.report.evidence).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('anon-reporter@example.com');
    expect(JSON.stringify(res.body)).not.toContain('RPT-1');
  });

  it('says there is no copy when the report kept none', async () => {
    prisma.contentReport.findUnique.mockResolvedValue(reportRow({ ticketId: 'RPT-1' }));

    const res = await request(app).get('/api/admin/moderation/reports/rep-1').set(as('MODERATOR')).expect(200);

    expect(res.body.report.context).toBeNull();
  });

  it('carries the live-chat copy for a live report too', async () => {
    prisma.contentReport.findUnique.mockResolvedValue(
      reportRow({ liveContext: { version: 1, streamId: 's1', streamTitle: 'Live', reported: { id: 'l1', content: 'show us your address' } } })
    );

    const res = await request(app).get('/api/admin/moderation/reports/rep-1').set(as('MODERATOR')).expect(200);

    expect(res.body.report.context.liveContext.reported.content).toBe('show us your address');
  });
});
