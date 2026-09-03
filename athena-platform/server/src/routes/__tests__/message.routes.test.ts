import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversationParticipant: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    messageReaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userSafetySettings: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

const prisma: any = prismaTyped;

const VIEWER = 'user-123';
const OTHER = 'user-999';
const CONVERSATION = 'conv-1';

// The two people are participants of one direct conversation and both accept
// messages — the baseline every test below starts from.
function mockOpenConversation() {
  (prisma.conversation.findUnique as any).mockResolvedValue({
    id: CONVERSATION,
    participants: [{ userId: VIEWER }, { userId: OTHER }],
  });
  (prisma.user.findUnique as any).mockResolvedValue({ id: OTHER, allowMessages: true });
  (prisma.userSafetySettings.findMany as any).mockResolvedValue([]);
}

describe('Direct message attachments, replies and reactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenConversation();
    (prisma.conversation.update as any).mockResolvedValue({});
    (prisma.conversationParticipant.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.message.create as any).mockImplementation((args: any) => ({
      id: 'm-new',
      conversationId: CONVERSATION,
      senderId: VIEWER,
      ...args.data,
    }));
    (prisma.$transaction as any).mockImplementation(async (ops: any[]) => ops);
  });

  describe('GET /conversations/:id/messages', () => {
    it('collapses reaction rows into per-emoji chips flagged for the viewer', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        id: 'p1',
        hasUnread: false,
      });
      (prisma.message.findMany as any).mockResolvedValue([
        {
          id: 'm1',
          senderId: OTHER,
          content: 'hello',
          reactions: [
            { emoji: '👍', userId: VIEWER },
            { emoji: '👍', userId: OTHER },
            { emoji: '🎉', userId: OTHER },
          ],
        },
      ]);

      const res = await request(app)
        .get(`/api/messages/conversations/${CONVERSATION}/messages`)
        .expect(200);

      expect(res.body.data[0].reactions).toEqual([
        { emoji: '👍', count: 2, hasReacted: true },
        { emoji: '🎉', count: 1, hasReacted: false },
      ]);
    });
  });

  describe('POST /conversations/:id/messages', () => {
    it('refuses a message that carries neither text nor attachments', async () => {
      const res = await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({ content: '   ' })
        .expect(400);

      expect(res.body.message).toMatch(/Content or attachments required/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('persists attachments on an image-only message', async () => {
      await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({
          attachments: [
            { url: '/uploads/posts/user-123/photo.webp', name: 'photo.webp', contentType: 'image/webp' },
          ],
        })
        .expect(201);

      const data = (prisma.message.create as any).mock.calls[0][0].data;
      expect(data.type).toBe('IMAGE');
      expect(data.metadata.attachments).toEqual([
        { url: '/uploads/posts/user-123/photo.webp', name: 'photo.webp', contentType: 'image/webp' },
      ]);
    });

    it('rejects an attachment that is not one of our own uploads', async () => {
      await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({ content: 'look', attachments: [{ url: 'javascript:alert(1)' }] })
        .expect(400);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('stores replyToId when the quoted message is in the same conversation', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        conversationId: CONVERSATION,
        deletedAt: null,
      });

      await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({ content: 'agreed', replyToId: 'm1' })
        .expect(201);

      expect((prisma.message.create as any).mock.calls[0][0].data.replyToId).toBe('m1');
    });

    it('refuses to quote a message from another conversation', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        conversationId: 'conv-elsewhere',
        deletedAt: null,
      });

      const res = await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({ content: 'agreed', replyToId: 'm1' })
        .expect(400);

      expect(res.body.message).toMatch(/Invalid reply target/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('reactions', () => {
    beforeEach(() => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'm1',
        conversationId: CONVERSATION,
        deletedAt: null,
      });
    });

    it('records a reaction and pushes it to the other participant', async () => {
      (prisma.messageReaction.findUnique as any).mockResolvedValue(null);
      (prisma.messageReaction.create as any).mockResolvedValue({ id: 'r1' });

      await request(app).post('/api/messages/m1/reactions').send({ emoji: '👍' }).expect(201);

      expect(prisma.messageReaction.create).toHaveBeenCalledWith({
        data: { messageId: 'm1', userId: VIEWER, emoji: '👍' },
      });
      expect(emitToUserRoom).toHaveBeenCalledWith(
        OTHER,
        'messages:reaction',
        expect.objectContaining({ conversationId: CONVERSATION, messageId: 'm1', action: 'added' })
      );
    });

    it('is idempotent when the same reaction is sent twice', async () => {
      (prisma.messageReaction.findUnique as any).mockResolvedValue({ id: 'r1' });

      await request(app).post('/api/messages/m1/reactions').send({ emoji: '👍' }).expect(201);

      expect(prisma.messageReaction.create).not.toHaveBeenCalled();
      expect(emitToUserRoom).not.toHaveBeenCalled();
    });

    it('removes a reaction and only announces a change that happened', async () => {
      (prisma.messageReaction.deleteMany as any).mockResolvedValue({ count: 0 });

      await request(app)
        .delete(`/api/messages/m1/reactions/${encodeURIComponent('👍')}`)
        .expect(200);

      expect(prisma.messageReaction.deleteMany).toHaveBeenCalledWith({
        where: { messageId: 'm1', userId: VIEWER, emoji: '👍' },
      });
      expect(emitToUserRoom).not.toHaveBeenCalled();
    });

    it('404s on a message that does not exist', async () => {
      (prisma.message.findUnique as any).mockResolvedValue(null);

      await request(app).post('/api/messages/nope/reactions').send({ emoji: '👍' }).expect(404);
    });

    it('refuses a reaction from someone outside the conversation', async () => {
      (prisma.conversation.findUnique as any).mockResolvedValue({
        id: CONVERSATION,
        participants: [{ userId: OTHER }, { userId: 'user-777' }],
      });

      await request(app).post('/api/messages/m1/reactions').send({ emoji: '👍' }).expect(403);

      expect(prisma.messageReaction.create).not.toHaveBeenCalled();
    });
  });
});
