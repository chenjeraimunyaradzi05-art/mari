import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    conversation: { findUnique: jest.fn(), update: jest.fn() },
    conversationParticipant: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    message: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    messageReaction: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    user: { findUnique: jest.fn() },
    userSafetySettings: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../services/socket.service', () => ({
  initializeSocketHandlers: jest.fn(),
  sendRealTimeMessage: jest.fn(),
  emitToUserRoom: jest.fn(),
  emitToChannel: jest.fn(),
  emitToLiveRoom: jest.fn(),
  liveRoomSize: jest.fn(() => 0),
  emitToUser: jest.fn(),
  createNotification: jest.fn(),
  sendNotification: jest.fn(),
  emitJobApplicationUpdate: jest.fn(),
  emitNewJobMatch: jest.fn(),
  getChannelRoomId: jest.fn(),
  getLiveRoomId: jest.fn(),
  isUserOnline: jest.fn(() => false),
  getOnlineUsers: jest.fn(() => []),
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { emitToUserRoom } from '../../services/socket.service';
import {
  expiryFor,
  isAllowedTtl,
  sweepExpiredMessages,
  ttlLabel,
  unexpiredMessageWhere,
} from '../../services/message-expiry.service';

const prisma: any = prismaTyped;

const VIEWER = 'user-123';
const OTHER = 'user-999';
const CONVERSATION = 'conv-1';

function mockOpenConversation(disappearingTtlSeconds: number | null) {
  prisma.conversation.findUnique.mockResolvedValue({
    id: CONVERSATION,
    disappearingTtlSeconds,
    participants: [{ userId: VIEWER }, { userId: OTHER }],
  });
  prisma.user.findUnique.mockResolvedValue({ id: OTHER, allowMessages: true, displayName: 'Sarah D.' });
  prisma.userSafetySettings.findMany.mockResolvedValue([]);
  prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'cp-1', conversationId: CONVERSATION, userId: VIEWER, hasUnread: false });
  prisma.conversationParticipant.findMany.mockResolvedValue([{ id: 'cp-1', userId: VIEWER }, { id: 'cp-2', userId: OTHER }]);
}

describe('Disappearing messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('knows the allowed timers and how to name them', () => {
    expect(isAllowedTtl(null)).toBe(true);
    expect(isAllowedTtl(86400)).toBe(true);
    expect(isAllowedTtl(1234)).toBe(false);
    expect(ttlLabel(86400)).toBe('24 hours');
    expect(ttlLabel(null)).toBe('off');

    const now = new Date('2026-09-04T10:00:00Z');
    expect(expiryFor(3600, now)?.toISOString()).toBe('2026-09-04T11:00:00.000Z');
    expect(expiryFor(null, now)).toBeUndefined();
    expect(unexpiredMessageWhere(now)).toEqual({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
  });

  it('refuses to change the timer for a thread you are not in', async () => {
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);

    await request(app)
      .patch(`/api/messages/conversations/${CONVERSATION}/settings`)
      .send({ disappearingTtlSeconds: 86400 })
      .expect(403);
  });

  it('rejects timers that are not on the list', async () => {
    mockOpenConversation(null);
    await request(app)
      .patch(`/api/messages/conversations/${CONVERSATION}/settings`)
      .send({ disappearingTtlSeconds: 42 })
      .expect(400);
  });

  it('turning the timer on records a system message and tells both sides', async () => {
    mockOpenConversation(null);
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Mei C.', firstName: 'Mei', lastName: 'Chen' });
    const notice = { id: 'm-sys', type: 'SYSTEM', content: 'x', conversationId: CONVERSATION };
    prisma.$transaction.mockResolvedValue([{ id: CONVERSATION }, notice]);

    const res = await request(app)
      .patch(`/api/messages/conversations/${CONVERSATION}/settings`)
      .send({ disappearingTtlSeconds: 86400 })
      .expect(200);

    expect(res.body.data.disappearingTtlSeconds).toBe(86400);
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONVERSATION }, data: expect.objectContaining({ disappearingTtlSeconds: 86400 }) })
    );
    const created = prisma.message.create.mock.calls[0][0].data;
    expect(created.type).toBe('SYSTEM');
    expect(created.content).toContain('Mei C. turned on disappearing messages');
    expect(created.content).toContain('24 hours');
    expect(created.expiresAt).toBeUndefined();

    const settingsCalls = (emitToUserRoom as jest.Mock).mock.calls.filter((c) => c[1] === 'messages:settings');
    expect(settingsCalls.map((c) => c[0]).sort()).toEqual([VIEWER, OTHER].sort());
  });

  it('a message sent while the timer is on is stamped with its expiry', async () => {
    mockOpenConversation(3600);
    const sent = { id: 'm1', conversationId: CONVERSATION, senderId: VIEWER, content: 'hi' };
    prisma.$transaction.mockResolvedValue([sent]);

    const before = Date.now();
    await request(app)
      .post(`/api/messages/conversations/${CONVERSATION}/messages`)
      .send({ content: 'hi' })
      .expect(201);

    const data = prisma.message.create.mock.calls[0][0].data;
    expect(data.expiresAt).toBeInstanceOf(Date);
    const delta = data.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(3600 * 1000 - 5000);
    expect(delta).toBeLessThanOrEqual(3600 * 1000 + 5000);
  });

  it('a message sent with the timer off has no expiry', async () => {
    mockOpenConversation(null);
    prisma.$transaction.mockResolvedValue([{ id: 'm2', conversationId: CONVERSATION, senderId: VIEWER }]);

    await request(app)
      .post(`/api/messages/conversations/${CONVERSATION}/messages`)
      .send({ content: 'hi' })
      .expect(201);

    expect(prisma.message.create.mock.calls[0][0].data.expiresAt).toBeUndefined();
  });

  it('reading a thread hides messages that have already expired', async () => {
    mockOpenConversation(3600);
    prisma.message.findMany.mockResolvedValue([]);

    await request(app).get(`/api/messages/conversations/${CONVERSATION}/messages`).expect(200);

    const where = prisma.message.findMany.mock.calls[0][0].where;
    expect(where.conversationId).toBe(CONVERSATION);
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it('the sweep deletes expired rows, fixes unread counts and tells both sides', async () => {
    // One batch only. A second queued answer used to sit here as if the sweep
    // came round again, but two rows is short of SWEEP_BATCH, so the loop
    // breaks after the first read and that answer was never consumed.
    prisma.message.findMany.mockResolvedValueOnce([
      { id: 'old-1', conversationId: CONVERSATION },
      { id: 'old-2', conversationId: CONVERSATION },
    ]);
    prisma.message.deleteMany.mockResolvedValue({ count: 2 });
    prisma.conversationParticipant.findMany.mockResolvedValue([
      { id: 'cp-1', userId: VIEWER, conversationId: CONVERSATION },
      { id: 'cp-2', userId: OTHER, conversationId: CONVERSATION },
    ]);
    // Nothing is left unread in the thread once the expired rows are deleted.
    prisma.message.groupBy.mockResolvedValue([]);
    prisma.conversationParticipant.updateMany.mockResolvedValue({ count: 2 });
    prisma.$transaction.mockResolvedValue([{ count: 2 }]);

    const now = new Date('2026-09-04T10:00:00Z');
    const removed = await sweepExpiredMessages(now);

    expect(removed).toBe(2);
    // The read is bounded and happens once: a batch shorter than SWEEP_BATCH
    // (500) means there is nothing left to sweep, so going round again would
    // be a wasted query on a timer nobody is watching.
    expect(prisma.message.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { expiresAt: { lte: now } }, take: 500 })
    );
    // Both ids go in one delete, not a delete per message.
    expect(prisma.message.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.message.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['old-1', 'old-2'] } } });

    // The sweep reads the whole batch at once: one participant lookup and one
    // grouped count, never a count or an update per participant.
    expect(prisma.conversationParticipant.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.conversationParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId: { in: [CONVERSATION] } } })
    );
    expect(prisma.message.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.message.count).not.toHaveBeenCalled();
    expect(prisma.conversationParticipant.update).not.toHaveBeenCalled();

    // Both sides land on nothing unread, so one write covers the pair.
    expect(prisma.conversationParticipant.updateMany).toHaveBeenCalledTimes(1);
    const write = prisma.conversationParticipant.updateMany.mock.calls[0][0];
    expect([...write.where.id.in].sort()).toEqual(['cp-1', 'cp-2']);
    expect(write.data).toEqual({ unreadCount: 0, hasUnread: false });

    // Each side is told once, and told about both ids in the one payload,
    // because the batch groups the deleted rows by conversation before it
    // emits rather than emitting per message.
    const expired = (emitToUserRoom as jest.Mock).mock.calls.filter((c) => c[1] === 'messages:expired');
    expect(expired).toHaveLength(2);
    expect(expired.map((c) => c[0]).sort()).toEqual([VIEWER, OTHER].sort());
    expect(expired[0][2]).toEqual({ conversationId: CONVERSATION, messageIds: ['old-1', 'old-2'] });
    expect(expired[1][2]).toEqual({ conversationId: CONVERSATION, messageIds: ['old-1', 'old-2'] });
  });

  it('the unread count each side is left with still leaves out their own messages', async () => {
    // clearAllMocks between tests clears the recorded calls, not a queued
    // mockResolvedValueOnce, so this test empties the queue itself rather than
    // trusting the test above to have consumed everything it set up.
    prisma.message.findMany.mockReset();
    prisma.message.findMany.mockResolvedValue([{ id: 'old-1', conversationId: CONVERSATION }]);
    prisma.message.deleteMany.mockResolvedValue({ count: 1 });
    prisma.conversationParticipant.findMany.mockResolvedValue([
      { id: 'cp-1', userId: VIEWER, conversationId: CONVERSATION },
      { id: 'cp-2', userId: OTHER, conversationId: CONVERSATION },
    ]);
    // Three unread left in the thread: two the viewer sent, one from the other
    // side. Each side should be left counting only what the other one sent, so
    // the viewer ends on one and the other participant on two — not three
    // apiece, which is what a plain per-thread count would have given them.
    prisma.message.groupBy.mockResolvedValue([
      { conversationId: CONVERSATION, senderId: VIEWER, _count: { _all: 2 } },
      { conversationId: CONVERSATION, senderId: OTHER, _count: { _all: 1 } },
    ]);
    prisma.conversationParticipant.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockResolvedValue([]);

    await sweepExpiredMessages(new Date('2026-09-04T10:00:00Z'));

    const writes = prisma.conversationParticipant.updateMany.mock.calls.map((c: any) => c[0]);
    const viewerWrite = writes.find((w: any) => w.where.id.in.includes('cp-1'));
    const otherWrite = writes.find((w: any) => w.where.id.in.includes('cp-2'));
    expect(viewerWrite.data).toEqual({ unreadCount: 1, hasUnread: true });
    expect(otherWrite.data).toEqual({ unreadCount: 2, hasUnread: true });
  });
});
