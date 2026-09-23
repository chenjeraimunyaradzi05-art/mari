import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Group chat, channel broadcasts and reel comments published without ever
// touching the moderation gate, which is how abuse, slurs and threats reached
// the rooms a harasser would pick. These are the tests that stop that
// happening again: each surface must call the gate, and must write nothing when
// the gate refuses.

jest.mock('../../utils/prisma', () => ({
  prisma: {
    groupMember: { findUnique: jest.fn(), update: jest.fn() },
    conversation: { upsert: jest.fn(async () => ({ id: 'g1' })), update: jest.fn() },
    conversationParticipant: { updateMany: jest.fn() },
    message: { create: jest.fn(), findUnique: jest.fn() },
    channel: { findUnique: jest.fn(), update: jest.fn() },
    channelMember: { findUnique: jest.fn() },
    channelMessage: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    video: { findUnique: jest.fn(), update: jest.fn() },
    videoComment: { create: jest.fn(), findUnique: jest.fn(), count: jest.fn(async () => 0) },
    user: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    notification: { create: jest.fn(async () => ({ id: 'n1' })) },
  },
}));

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'sender-1', role: 'USER', email: 'm@athena.com' };
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
import { assertContentAllowed } from '../../services/moderation.service';
import { ApiError } from '../../middleware/errorHandler';

const prisma: any = prismaTyped;
const gate = assertContentAllowed as jest.Mock;

const SENDER = 'sender-1';
const OWNER = 'owner-1';
const ABUSE = 'Something a provider refuses';

const refuses = () => {
  gate.mockImplementation(async () => {
    throw new ApiError(400, 'This content violates our community guidelines');
  });
};

describe('Moderation gate on group chat, channels and reels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gate.mockImplementation(async () => undefined);
  });

  describe('group chat', () => {
    beforeEach(() => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'g1',
        userId: SENDER,
        role: 'MEMBER',
        isBanned: false,
        isMuted: false,
      });
      prisma.message.create.mockImplementation(async ({ data }: any) => ({ id: 'm1', ...data }));
    });

    it('screens the message and only then stores it', async () => {
      await request(app)
        .post('/api/groups/g1/chat/message')
        .send({ content: '  Morning all  ' })
        .expect(200);

      expect(gate).toHaveBeenCalledWith('Morning all', { kind: 'group_message', userId: SENDER });
      expect(prisma.message.create).toHaveBeenCalled();
    });

    it('writes nothing when the gate refuses', async () => {
      refuses();

      await request(app).post('/api/groups/g1/chat/message').send({ content: ABUSE }).expect(400);

      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('does not screen on behalf of somebody who cannot post here', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      await request(app).post('/api/groups/g1/chat/message').send({ content: ABUSE }).expect(403);

      expect(gate).not.toHaveBeenCalled();
    });
  });

  describe('channel messages', () => {
    beforeEach(() => {
      prisma.channel.findUnique.mockResolvedValue({
        id: 'c1',
        ownerId: OWNER,
        isPublic: true,
        allowReplies: true,
      });
      prisma.channelMember.findUnique.mockResolvedValue({ channelId: 'c1', userId: SENDER });
      prisma.channelMessage.create.mockImplementation(async ({ data }: any) => ({ id: 'cm1', ...data }));
      prisma.channel.update.mockResolvedValue({});
    });

    it('screens the message and only then stores it', async () => {
      await request(app)
        .post('/api/channels/c1/messages')
        .send({ content: 'Applications close Friday' })
        .expect(201);

      expect(gate).toHaveBeenCalledWith('Applications close Friday', {
        kind: 'channel_message',
        userId: SENDER,
      });
      expect(prisma.channelMessage.create).toHaveBeenCalled();
    });

    it('writes nothing when the gate refuses', async () => {
      refuses();

      await request(app).post('/api/channels/c1/messages').send({ content: ABUSE }).expect(400);

      expect(prisma.channelMessage.create).not.toHaveBeenCalled();
    });

    it('does not screen on behalf of somebody who is not in the channel', async () => {
      prisma.channelMember.findUnique.mockResolvedValue(null);

      await request(app).post('/api/channels/c1/messages').send({ content: ABUSE }).expect(403);

      expect(gate).not.toHaveBeenCalled();
    });

    it('screens an edit, because an edit republishes the message', async () => {
      prisma.channelMessage.findUnique.mockResolvedValue({
        id: 'cm1',
        channelId: 'c1',
        authorId: SENDER,
        content: 'original',
      });
      prisma.channelMessage.update.mockResolvedValue({ id: 'cm1' });

      await request(app)
        .patch('/api/channels/c1/messages/cm1')
        .send({ content: 'rewritten' })
        .expect(200);

      expect(gate).toHaveBeenCalledWith('rewritten', {
        kind: 'channel_message',
        userId: SENDER,
      });
    });
  });

  describe('reel comments', () => {
    beforeEach(() => {
      prisma.video.findUnique.mockResolvedValue({
        id: 'v1',
        authorId: OWNER,
        status: 'PUBLISHED',
        isHidden: false,
      });
      prisma.videoComment.create.mockImplementation(async ({ data }: any) => ({ id: 'vc1', ...data }));
      prisma.video.update.mockResolvedValue({});
    });

    it('screens the comment and only then stores it', async () => {
      await request(app)
        .post('/api/video/v1/comments')
        .send({ content: 'This helped me' })
        .expect(201);

      expect(gate).toHaveBeenCalledWith('This helped me', { kind: 'comment', userId: SENDER });
      expect(prisma.videoComment.create).toHaveBeenCalled();
    });

    it('writes nothing, and notifies nobody, when the gate refuses', async () => {
      refuses();

      await request(app).post('/api/video/v1/comments').send({ content: ABUSE }).expect(400);

      expect(prisma.videoComment.create).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
