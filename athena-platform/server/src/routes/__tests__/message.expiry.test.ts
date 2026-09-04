import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    conversation: { findUnique: jest.fn(), update: jest.fn() },
    conversationParticipant: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    message: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
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
    prisma.message.findMany
      .mockResolvedValueOnce([
        { id: 'old-1', conversationId: CONVERSATION },
        { id: 'old-2', conversationId: CONVERSATION },
      ])
      .mockResolvedValueOnce([]);
    prisma.message.deleteMany.mockResolvedValue({ count: 2 });
    prisma.conversationParticipant.findMany.mockResolvedValue([{ id: 'cp-1', userId: VIEWER }, { id: 'cp-2', userId: OTHER }]);
    prisma.message.count.mockResolvedValue(0);
    prisma.conversationParticipant.update.mockResolvedValue({});

    const removed = await sweepExpiredMessages(new Date('2026-09-04T10:00:00Z'));

    expect(removed).toBe(2);
    expect(prisma.message.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['old-1', 'old-2'] } } });
    expect(prisma.conversationParticipant.update).toHaveBeenCalledTimes(2);
    expect(prisma.conversationParticipant.update.mock.calls[0][0].data).toEqual({ unreadCount: 0, hasUnread: false });

    const expired = (emitToUserRoom as jest.Mock).mock.calls.filter((c) => c[1] === 'messages:expired');
    expect(expired).toHaveLength(2);
    expect(expired[0][2]).toEqual({ conversationId: CONVERSATION, messageIds: ['old-1', 'old-2'] });
  });
});
