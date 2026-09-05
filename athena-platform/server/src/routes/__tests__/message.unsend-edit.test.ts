import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    message: { findUnique: jest.fn(), update: jest.fn() },
    messageReaction: { deleteMany: jest.fn() },
    conversationParticipant: { updateMany: jest.fn() },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  },
}));

jest.mock('../../services/socket.service', () => ({
  initializeSocketHandlers: jest.fn(),
  sendRealTimeMessage: jest.fn(),
  emitToUserRoom: jest.fn(),
  emitToChannel: jest.fn(),
  emitToUser: jest.fn(),
  createNotification: jest.fn(),
  sendNotification: jest.fn(),
  emitJobApplicationUpdate: jest.fn(),
  emitNewJobMatch: jest.fn(),
  getChannelRoomId: jest.fn(),
  isUserOnline: jest.fn(() => false),
  getOnlineUsers: jest.fn(() => []),
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'me', role: 'USER', email: 'me@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { emitToUserRoom } from '../../services/socket.service';
import { assertContentAllowed } from '../../services/moderation.service';

const prisma: any = prismaTyped;
const ME = 'me';
const THEM = 'them';
const as = (userId: string) => ({ 'x-test-user': userId });

const message = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  conversationId: 'conv-1',
  senderId: ME,
  type: 'TEXT',
  isRead: false,
  deletedAt: null,
  createdAt: new Date(),
  conversation: { participants: [{ userId: ME }, { userId: THEM }] },
  ...overrides,
});

describe('Unsending a message', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.message.update.mockResolvedValue({});
    prisma.messageReaction.deleteMany.mockResolvedValue({ count: 0 });
    prisma.conversationParticipant.updateMany.mockResolvedValue({ count: 1 });
  });

  it('only the sender can unsend; the other participant and outsiders cannot', async () => {
    prisma.message.findUnique.mockResolvedValue(message());
    await request(app).delete('/api/messages/m1').set(as(THEM)).expect(403);
    await request(app).delete('/api/messages/m1').set(as('outsider')).expect(404);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('leaves a marker: the words, attachments and reactions go, both sides are told', async () => {
    prisma.message.findUnique.mockResolvedValue(message());

    await request(app).delete('/api/messages/m1').set(as(ME)).expect(200);

    const update = prisma.message.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'm1' });
    expect(update.data.content).toBe('');
    expect(update.data.deletedAt).toBeInstanceOf(Date);
    expect(prisma.messageReaction.deleteMany).toHaveBeenCalledWith({ where: { messageId: 'm1' } });
    // It was never read, so it stops counting against the recipient.
    expect(prisma.conversationParticipant.updateMany.mock.calls[0][0]).toMatchObject({
      where: { conversationId: 'conv-1', userId: { not: ME }, unreadCount: { gt: 0 } },
      data: { unreadCount: { decrement: 1 } },
    });
    const told = (emitToUserRoom as any).mock.calls.filter((c: any[]) => c[1] === 'messages:deleted').map((c: any[]) => c[0]);
    expect(told.sort()).toEqual([ME, THEM]);
  });

  it('a message already read does not touch the unread count', async () => {
    prisma.message.findUnique.mockResolvedValue(message({ isRead: true }));
    await request(app).delete('/api/messages/m1').set(as(ME)).expect(200);
    expect(prisma.conversationParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('unsending twice is a no-op, and a system notice cannot be unsent', async () => {
    prisma.message.findUnique.mockResolvedValue(message({ deletedAt: new Date() }));
    await request(app).delete('/api/messages/m1').set(as(ME)).expect(200);
    expect(prisma.message.update).not.toHaveBeenCalled();

    prisma.message.findUnique.mockResolvedValue(message({ type: 'SYSTEM' }));
    await request(app).delete('/api/messages/m1').set(as(ME)).expect(400);
  });
});

describe('Editing a message', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.message.update.mockImplementation(async (args: any) => ({ id: 'm1', ...args.data }));
  });

  it('the sender changes the words within the window; both sides see the edit', async () => {
    prisma.message.findUnique.mockResolvedValue(message());

    const res = await request(app).patch('/api/messages/m1').set(as(ME)).send({ content: ' fixed the typo ' }).expect(200);

    expect(prisma.message.update.mock.calls[0][0].data.content).toBe('fixed the typo');
    expect(prisma.message.update.mock.calls[0][0].data.editedAt).toBeInstanceOf(Date);
    expect(assertContentAllowed).toHaveBeenCalledWith('fixed the typo', { kind: 'message', userId: ME });
    expect(res.body.data.content).toBe('fixed the typo');
    const told = (emitToUserRoom as any).mock.calls.filter((c: any[]) => c[1] === 'messages:edited');
    expect(told.map((c: any[]) => c[0]).sort()).toEqual([ME, THEM]);
    expect(told[0][2]).toMatchObject({ conversationId: 'conv-1', messageId: 'm1', content: 'fixed the typo' });
  });

  it('is refused after the edit window, for an unsent message, and for the other participant', async () => {
    prisma.message.findUnique.mockResolvedValue(message({ createdAt: new Date(Date.now() - 16 * 60 * 1000) }));
    const late = await request(app).patch('/api/messages/m1').set(as(ME)).send({ content: 'too late' }).expect(409);
    expect(late.body.message).toMatch(/15 minutes/);

    prisma.message.findUnique.mockResolvedValue(message({ deletedAt: new Date() }));
    await request(app).patch('/api/messages/m1').set(as(ME)).send({ content: 'ghost' }).expect(409);

    prisma.message.findUnique.mockResolvedValue(message());
    await request(app).patch('/api/messages/m1').set(as(THEM)).send({ content: 'not mine' }).expect(403);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('refuses an empty edit', async () => {
    prisma.message.findUnique.mockResolvedValue(message());
    await request(app).patch('/api/messages/m1').set(as(ME)).send({ content: '' }).expect(400);
  });
});
