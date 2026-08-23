import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    channel: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    channelMessage: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    channelMessageReaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const VIEWER = 'user-123';
const OTHER = 'user-999';

function mockChannel(ownerId: string) {
  (prisma.channel.findUnique as any).mockResolvedValue({
    id: 'c1',
    ownerId,
    isPublic: true,
    allowReplies: true,
  });
}

function mockMessage(authorId: string, channelId = 'c1') {
  (prisma.channelMessage.findUnique as any).mockResolvedValue({
    id: 'm1',
    channelId,
    authorId,
    content: 'original',
    isPinned: false,
  });
}

describe('Channel message edit / delete / pin / reactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.channel.update as any).mockResolvedValue({});
    (prisma.channelMessage.update as any).mockResolvedValue({ id: 'm1' });
    (prisma.channelMessage.delete as any).mockResolvedValue({ id: 'm1' });
  });

  describe('PATCH /:channelId/messages/:messageId', () => {
    it('lets the author edit and stamps editedAt', async () => {
      mockChannel(OTHER);
      mockMessage(VIEWER);

      await request(app)
        .patch('/api/channels/c1/messages/m1')
        .send({ content: 'updated' })
        .expect(200);

      const data = (prisma.channelMessage.update as any).mock.calls[0][0].data;
      expect(data.content).toBe('updated');
      expect(data.editedAt).toBeInstanceOf(Date);
    });

    it('refuses to edit somebody else\'s message', async () => {
      mockChannel(OTHER);
      mockMessage(OTHER);

      await request(app)
        .patch('/api/channels/c1/messages/m1')
        .send({ content: 'updated' })
        .expect(403);

      expect(prisma.channelMessage.update).not.toHaveBeenCalled();
    });

    it('rejects empty content', async () => {
      mockChannel(VIEWER);
      mockMessage(VIEWER);

      await request(app).patch('/api/channels/c1/messages/m1').send({ content: '' }).expect(400);
    });

    it('404s when the message belongs to a different channel', async () => {
      mockChannel(VIEWER);
      mockMessage(VIEWER, 'some-other-channel');

      await request(app)
        .patch('/api/channels/c1/messages/m1')
        .send({ content: 'updated' })
        .expect(404);
    });
  });

  describe('DELETE /:channelId/messages/:messageId', () => {
    it('lets the author delete and decrements the channel count', async () => {
      mockChannel(OTHER);
      mockMessage(VIEWER);

      await request(app).delete('/api/channels/c1/messages/m1').expect(200);

      expect(prisma.channelMessage.delete).toHaveBeenCalled();
      expect((prisma.channel.update as any).mock.calls[0][0].data).toEqual({
        messageCount: { decrement: 1 },
      });
    });

    it('lets the channel owner delete somebody else\'s message', async () => {
      mockChannel(VIEWER);
      mockMessage(OTHER);

      await request(app).delete('/api/channels/c1/messages/m1').expect(200);
      expect(prisma.channelMessage.delete).toHaveBeenCalled();
    });

    it('refuses when the viewer is neither author nor channel owner', async () => {
      mockChannel(OTHER);
      mockMessage(OTHER);

      await request(app).delete('/api/channels/c1/messages/m1').expect(403);
      expect(prisma.channelMessage.delete).not.toHaveBeenCalled();
    });
  });

  describe('pin', () => {
    it('only the channel owner may pin', async () => {
      mockChannel(OTHER);
      mockMessage(VIEWER);

      await request(app).post('/api/channels/c1/messages/m1/pin').expect(403);
      expect(prisma.channelMessage.update).not.toHaveBeenCalled();
    });

    it('pins for the channel owner', async () => {
      mockChannel(VIEWER);
      mockMessage(OTHER);

      await request(app).post('/api/channels/c1/messages/m1/pin').expect(200);
      expect((prisma.channelMessage.update as any).mock.calls[0][0].data).toEqual({
        isPinned: true,
      });
    });

    it('unpins for the channel owner', async () => {
      mockChannel(VIEWER);
      mockMessage(OTHER);

      await request(app).delete('/api/channels/c1/messages/m1/pin').expect(200);
      expect((prisma.channelMessage.update as any).mock.calls[0][0].data).toEqual({
        isPinned: false,
      });
    });
  });

  describe('reactions', () => {
    it('adds a reaction and increments the count', async () => {
      mockChannel(OTHER);
      mockMessage(OTHER);
      (prisma.channelMessageReaction.findUnique as any).mockResolvedValue(null);
      (prisma.channelMessageReaction.create as any).mockResolvedValue({ id: 'r1' });

      await request(app)
        .post('/api/channels/c1/messages/m1/reactions')
        .send({ emoji: '👍' })
        .expect(201);

      expect(prisma.channelMessageReaction.create).toHaveBeenCalled();
      expect((prisma.channelMessage.update as any).mock.calls[0][0].data).toEqual({
        reactionCount: { increment: 1 },
      });
    });

    it('is idempotent when the same reaction already exists', async () => {
      mockChannel(OTHER);
      mockMessage(OTHER);
      (prisma.channelMessageReaction.findUnique as any).mockResolvedValue({ id: 'r1' });

      await request(app)
        .post('/api/channels/c1/messages/m1/reactions')
        .send({ emoji: '👍' })
        .expect(201);

      expect(prisma.channelMessageReaction.create).not.toHaveBeenCalled();
      expect(prisma.channelMessage.update).not.toHaveBeenCalled();
    });

    it('rejects a missing emoji', async () => {
      mockChannel(OTHER);
      mockMessage(OTHER);

      await request(app).post('/api/channels/c1/messages/m1/reactions').send({}).expect(400);
    });

    it('removes a reaction and decrements only when a row was deleted', async () => {
      mockChannel(OTHER);
      mockMessage(OTHER);
      (prisma.channelMessageReaction.deleteMany as any).mockResolvedValue({ count: 0 });

      await request(app)
        .delete(`/api/channels/c1/messages/m1/reactions/${encodeURIComponent('👍')}`)
        .expect(200);

      expect(prisma.channelMessage.update).not.toHaveBeenCalled();
    });
  });
});
