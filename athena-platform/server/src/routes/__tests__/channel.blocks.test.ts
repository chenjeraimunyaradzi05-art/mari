/**
 * A block ends contact, and a channel's replies are contact with everyone
 * subscribed. The channel routes read no block list at all: two members who had
 * blocked each other read each other's replies in the history, in the pinned
 * messages, in the channel's search and in the live push, and each was named in
 * the other's list of members. The assertions are on the query, in both stores
 * and both directions, for the reason the other block tests give: applied to the
 * page afterwards they would shorten it, and the total would count messages she
 * is never shown.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    channel: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    channelMember: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    channelMessage: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      create: jest.fn(),
    },
    // A block is stored on the safety settings row, and from the DV safety page on that profile.
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
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

jest.mock('../../middleware/account-gates', () => {
  const actual = jest.requireActual('../../middleware/account-gates') as Record<string, unknown>;
  return { ...actual, requireWomanMember: (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// The room broadcast is the one thing here that needs a live socket server.
jest.mock('../../services/socket.service', () => {
  const actual = jest.requireActual('../../services/socket.service') as Record<string, unknown>;
  return { ...actual, emitToChannel: jest.fn() };
});

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { emitToChannel } from '../../services/socket.service';

const prisma: any = prismaTyped;
const VIEWER = 'user-123';
const signedIn = { 'x-test-auth': '1' };

const channel = { id: 'c1', ownerId: 'owner-1', isPublic: true, allowReplies: true };

/** She blocked 'him'; 'blocked-her' blocked her; she blocked 'dv-only' from the DV page; 'dv-blocked-her' blocked her from it. */
const blockEveryWay = () => {
  prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
  prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'blocked-her' }]);
  prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only'] });
  prisma.dvSafetyProfile.findMany.mockResolvedValue([{ userId: 'dv-blocked-her' }]);
};
const EVERYONE_BLOCKED = ['blocked-her', 'dv-blocked-her', 'dv-only', 'him'];

beforeEach(() => {
  jest.clearAllMocks();
  prisma.channel.findUnique.mockResolvedValue(channel);
  prisma.channelMember.findUnique.mockResolvedValue(null);
  prisma.channelMember.findMany.mockResolvedValue([]);
  prisma.channelMessage.findMany.mockResolvedValue([]);
  prisma.channelMessage.count.mockResolvedValue(0);
  prisma.userSafetySettings.findUnique.mockResolvedValue(null);
  prisma.userSafetySettings.findMany.mockResolvedValue([]);
  prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
  prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
});

describe('Channel replies and blocks', () => {
  describe('the history', () => {
    it('leaves a blocked member’s replies out in the query, whichever side blocked and whichever store holds the block', async () => {
      blockEveryWay();

      await request(app).get('/api/channels/c1/messages').set(signedIn).expect(200);

      const { where } = prisma.channelMessage.findMany.mock.calls[0][0];
      expect(where.channelId).toBe('c1');
      expect([...where.authorId.notIn].sort()).toEqual(EVERYONE_BLOCKED);
    });

    it('counts the total with the same clause, so a page count is not of messages she is never shown', async () => {
      blockEveryWay();

      await request(app).get('/api/channels/c1/messages').set(signedIn).expect(200);

      expect(prisma.channelMessage.count.mock.calls[0][0].where).toEqual(prisma.channelMessage.findMany.mock.calls[0][0].where);
    });

    it('leaves the reactions of a blocked member off the messages she can read', async () => {
      blockEveryWay();

      await request(app).get('/api/channels/c1/messages').set(signedIn).expect(200);

      const { include } = prisma.channelMessage.findMany.mock.calls[0][0];
      expect([...include.reactions.where.userId.notIn].sort()).toEqual(EVERYONE_BLOCKED);
    });

    it('asks for no block clause when nobody is blocked, or for a signed-out reader', async () => {
      await request(app).get('/api/channels/c1/messages').set(signedIn).expect(200);
      await request(app).get('/api/channels/c1/messages').expect(200);

      for (const [args] of prisma.channelMessage.findMany.mock.calls) {
        expect(args.where).toEqual({ channelId: 'c1' });
        expect(args.include.reactions.where).toBeUndefined();
      }
      // A signed-out reader has blocked nobody: nothing is read for her.
      expect(prisma.userSafetySettings.findMany).toHaveBeenCalledTimes(1);
    });

    it('does not answer with the whole channel when the block lists cannot be read', async () => {
      prisma.userSafetySettings.findMany.mockRejectedValue(new Error('connection reset'));

      const res = await request(app).get('/api/channels/c1/messages').set(signedIn);

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body.data).toBeUndefined();
      expect(prisma.channelMessage.findMany).not.toHaveBeenCalled();
    });
  });

  describe('the pinned messages and the search', () => {
    it('leaves a blocked member’s pinned reply out in the query', async () => {
      blockEveryWay();

      await request(app).get('/api/channels/c1/pinned').set(signedIn).expect(200);

      const { where } = prisma.channelMessage.findMany.mock.calls[0][0];
      expect(where).toMatchObject({ channelId: 'c1', isPinned: true });
      expect([...where.authorId.notIn].sort()).toEqual(EVERYONE_BLOCKED);
    });

    it('leaves a blocked member’s replies out of the channel’s search', async () => {
      blockEveryWay();

      await request(app).get('/api/channels/c1/search').query({ q: 'hello' }).set(signedIn).expect(200);

      const { where } = prisma.channelMessage.findMany.mock.calls[0][0];
      expect(where).toMatchObject({ channelId: 'c1', content: { contains: 'hello', mode: 'insensitive' } });
      expect([...where.authorId.notIn].sort()).toEqual(EVERYONE_BLOCKED);
    });
  });

  describe('the list of members', () => {
    it('names nobody on either side of a block with her, in the query', async () => {
      blockEveryWay();

      await request(app).get('/api/channels/c1/members').set(signedIn).expect(200);

      const { where } = prisma.channelMember.findMany.mock.calls[0][0];
      expect(where.channelId).toBe('c1');
      expect([...where.userId.notIn].sort()).toEqual(EVERYONE_BLOCKED);
    });
  });

  describe('the live push', () => {
    beforeEach(() => {
      prisma.channelMember.findUnique.mockResolvedValue({ id: 'cm1' });
      prisma.channelMessage.create.mockImplementation(async (args: any) => ({
        id: 'm1',
        ...args.data,
        author: { id: VIEWER, displayName: 'Mei', avatar: null },
      }));
    });

    it('is not pushed to a member on either side of a block with the sender, in either store', async () => {
      blockEveryWay();

      await request(app).post('/api/channels/c1/messages').send({ content: 'Hello channel' }).expect(201);

      const [, , , options] = (emitToChannel as any).mock.calls[0];
      expect([...options.exceptUserIds].sort()).toEqual(EVERYONE_BLOCKED);
    });

    it('pushes nothing, rather than everything, when the sender’s block lists cannot be read; the reply is still stored', async () => {
      prisma.dvSafetyProfile.findMany.mockRejectedValue(new Error('connection reset'));

      const res = await request(app).post('/api/channels/c1/messages').send({ content: 'Hello channel' }).expect(201);

      expect(res.body.data.content).toBe('Hello channel');
      expect(prisma.channelMessage.create).toHaveBeenCalledTimes(1);
      expect(emitToChannel).not.toHaveBeenCalled();
    });
  });
});
