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
    // The DV safety page's own block list, the second place a block can be written: nobody is blocked there unless a test says so.
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
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

// A file sent in a thread is uploaded to it first and carried by its key, which
// names the thread and the member (utils/chat-attachments).
const chatKey = (name: string, scope = CONVERSATION, sender = VIEWER) =>
  `chat/${scope}/${sender}_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c${name}`;

// The two people are participants of one direct conversation and both accept
// messages — the baseline every test below starts from.
function mockOpenConversation() {
  (prisma.conversation.findUnique as any).mockResolvedValue({
    id: CONVERSATION,
    participants: [{ userId: VIEWER }, { userId: OTHER }],
  });
  (prisma.user.findUnique as any).mockResolvedValue({ id: OTHER, allowMessages: true, womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: null, profile: null, dateOfBirth: new Date('1990-01-01') });
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

  // The pseudonymous display name: a message's sender used to carry only her legal
  // first and last name (no displayName was loaded at all), so a member who had chosen
  // a public name was shown to the person she wrote to by her legal one.
  describe('who a message says it is from', () => {
    it('is the sender\'s public name, with her legal first and last name left out, and her own messages left whole', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({ id: 'p1', hasUnread: false });
      (prisma.message.findMany as any).mockResolvedValue([
        { id: 'm1', senderId: OTHER, content: 'hello', reactions: [], sender: { id: OTHER, firstName: 'Jane', displayName: 'Willow Rain', lastName: 'Doe', avatar: null } },
        { id: 'm2', senderId: VIEWER, content: 'hi', reactions: [], sender: { id: VIEWER, firstName: 'Vee', displayName: 'Vee', lastName: 'Own', avatar: null } },
      ]);

      const res = await request(app).get(`/api/messages/conversations/${CONVERSATION}/messages`).expect(200);

      // The thread comes back oldest first, so each message is found by its id.
      const message = (id: string) => res.body.data.find((m: any) => m.id === id);
      expect(message('m1').sender).toEqual({ id: OTHER, firstName: 'Willow Rain', displayName: 'Willow Rain', lastName: '', avatar: null });
      expect(JSON.stringify(message('m1'))).not.toMatch(/Doe|Jane/);
      expect(message('m2').sender).toMatchObject({ lastName: 'Own' });
      const select = (prisma.message.findMany as any).mock.calls[0][0].include.sender.select;
      expect(Object.keys(select)).not.toContain('lastName');
      expect(Object.keys(select)).toContain('displayName');
    });
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

    it('persists attachments on an image-only message, by key and with no link', async () => {
      await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({
          attachments: [
            // A link the client also sends is not kept: the message carries where the file is, not a way to open it.
            { key: chatKey('1.webp'), url: 'https://bucket.example/anything', name: 'photo.webp', contentType: 'image/webp' },
          ],
        })
        .expect(201);

      const data = (prisma.message.create as any).mock.calls[0][0].data;
      expect(data.type).toBe('IMAGE');
      expect(data.metadata.attachments).toEqual([{ key: chatKey('1.webp'), name: 'photo.webp', contentType: 'image/webp' }]);
    });

    // A video used to be labelled FILE, which both clients draw as a download
    // link although both can play it.
    it('labels a video-only message VIDEO and a mixed set FILE', async () => {
      await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({ attachments: [{ key: chatKey('2.mp4'), name: 'clip.mp4', contentType: 'video/mp4' }] })
        .expect(201);
      expect((prisma.message.create as any).mock.calls[0][0].data.type).toBe('VIDEO');

      await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({
          attachments: [
            { key: chatKey('2.mp4'), name: 'clip.mp4', contentType: 'video/mp4' },
            { key: chatKey('1.webp'), name: 'photo.webp', contentType: 'image/webp' },
          ],
        })
        .expect(201);
      expect((prisma.message.create as any).mock.calls[1][0].data.type).toBe('FILE');
    });

    it('rejects an attachment that is not one of our own uploads', async () => {
      await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({ content: 'look', attachments: [{ url: 'javascript:alert(1)' }] })
        .expect(400);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // A file in a thread is one she uploaded to that thread. A link, however
    // well formed, is somebody's public picture or reel and would put it in the
    // thread as though she had sent it; a key from another thread would show one
    // thread's file in another; and a key somebody else uploaded is not hers to send.
    describe('a file has to be one she uploaded to this thread', () => {
      const refused = async (attachment: Record<string, unknown>) => {
        const res = await request(app)
          .post(`/api/messages/conversations/${CONVERSATION}/messages`)
          .send({ content: 'look', attachments: [attachment] })
          .expect(400);
        expect(res.body.message).toMatch(/not sent from this conversation/i);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.message.create).not.toHaveBeenCalled();
      };

      it('refuses a link to a public post picture', async () => {
        await refused({ url: '/uploads/posts/user-123/photo.webp', name: 'photo.webp', contentType: 'image/webp' });
      });

      it('refuses a key in a public folder', async () => {
        await refused({ key: 'posts/user-123/0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.webp', contentType: 'image/webp' });
      });

      it('refuses a key under another conversation', async () => {
        await refused({ key: chatKey('3.webp', 'conv-elsewhere'), contentType: 'image/webp' });
      });

      it('refuses a key somebody else uploaded', async () => {
        await refused({ key: chatKey('3.webp', CONVERSATION, OTHER), contentType: 'image/webp' });
      });

      it('refuses a key that is not one this server could have written', async () => {
        await refused({ key: `chat/${CONVERSATION}/${VIEWER}_not-a-uuid.webp`, contentType: 'image/webp' });
      });
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

  // The Safety Centre's "Close my messages" writes User.allowMessages. It was
  // enforced on every door, and tested on none: nothing in this suite refused a
  // message because the recipient had closed them, so a change that dropped the
  // check would have passed everything.
  describe('a member who has closed her messages', () => {
    beforeEach(() => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: OTHER,
        allowMessages: false,
        womanVerificationStatus: 'UNVERIFIED',
        dvSafetyProfile: null,
        profile: null,
        dateOfBirth: new Date('1990-01-01'),
      });
    });

    it('cannot be opened a conversation with, and nothing is created', async () => {
      const res = await request(app).post('/api/messages/conversations').send({ userId: OTHER }).expect(403);

      expect(res.body.message).toMatch(/not accepting messages/i);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('cannot be written to in a conversation that already exists', async () => {
      const res = await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({ content: 'Are you there?' })
        .expect(403);

      expect(res.body.message).toMatch(/not accepting messages/i);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('can be written to again once she opens them', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: OTHER,
        allowMessages: true,
        womanVerificationStatus: 'UNVERIFIED',
        dvSafetyProfile: null,
        profile: null,
        dateOfBirth: new Date('1990-01-01'),
      });

      await request(app)
        .post(`/api/messages/conversations/${CONVERSATION}/messages`)
        .send({ content: 'Are you there?' })
        .expect(201);
    });
  });
});
