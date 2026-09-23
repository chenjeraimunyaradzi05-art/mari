/**
 * The safety and money guards on a live stream, tested at the service rather
 * than the route, because both doors into a host's room — the REST route and
 * the socket's `live:chat` — go through these functions, and a guard proven on
 * one route says nothing about the other.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const client: any = {
    liveStream: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    liveStreamMessage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      delete: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    follow: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    giftTransaction: { create: jest.fn(), groupBy: jest.fn(async () => []) },
    creatorProfile: { updateMany: jest.fn(async () => ({ count: 1 })) },
    notification: { create: jest.fn(), createMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(client) : Promise.all(arg))),
  };
  return { prisma: client };
});

jest.mock('../../utils/safety-store', () => ({
  isBlockedRelationship: jest.fn(async () => false),
  getBlockedRelationshipIds: jest.fn(async () => [] as string[]),
  blockUser: jest.fn(async () => ({ created: true })),
}));

jest.mock('../moderation.service', () => ({ assertContentAllowed: jest.fn(async () => undefined) }));

jest.mock('../socket.service', () => ({
  emitToLiveRoom: jest.fn(),
  emitToUserRoom: jest.fn(),
  liveRoomSize: jest.fn(() => 0),
  removeFromLiveRoom: jest.fn(() => 1),
  sendNotification: jest.fn(async () => ({})),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { blockUser, getBlockedRelationshipIds, isBlockedRelationship } from '../../utils/safety-store';
import { assertContentAllowed } from '../moderation.service';
import { emitToLiveRoom, removeFromLiveRoom } from '../socket.service';
import {
  deleteChatMessage,
  postChatMessage,
  recentMessages,
  removeViewer,
  sendStreamGift,
} from '../livestream.service';

const prisma: any = prismaTyped;
const blocked = isBlockedRelationship as jest.MockedFunction<typeof isBlockedRelationship>;
const blockedIds = getBlockedRelationshipIds as jest.MockedFunction<typeof getBlockedRelationshipIds>;
const block = blockUser as jest.MockedFunction<typeof blockUser>;
const moderate = assertContentAllowed as jest.MockedFunction<typeof assertContentAllowed>;

const HOST = 'host-1';
const VIEWER = 'viewer-1';

const stream = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  hostId: HOST,
  status: 'LIVE',
  host: { id: HOST, displayName: 'Mei C.', avatar: null, headline: null, isVerified: false },
  ...overrides,
});

describe('live stream safety guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    blocked.mockResolvedValue(false);
    blockedIds.mockResolvedValue([]);
    block.mockResolvedValue({ created: true });
    moderate.mockResolvedValue(undefined);
    prisma.liveStream.findUnique.mockResolvedValue(stream());
    prisma.liveStream.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.liveStreamMessage.findMany.mockResolvedValue([]);
    prisma.liveStreamMessage.deleteMany.mockResolvedValue({ count: 0 });
  });

  describe('chat', () => {
    it('screens the text and writes the message', async () => {
      prisma.liveStreamMessage.create.mockResolvedValue({ id: 'm1', userId: VIEWER, content: 'hello' });

      await postChatMessage('s1', VIEWER, 'hello');

      // 'live_chat' rather than 'message': both are held to the conversational
      // line, but the kind is what a reviewer reads in the log when something
      // was let through, and a line said to a stream's whole audience is not a
      // direct message.
      expect(moderate).toHaveBeenCalledWith('hello', { kind: 'live_chat', userId: VIEWER });
      expect(prisma.liveStreamMessage.create).toHaveBeenCalled();
      expect(emitToLiveRoom).toHaveBeenCalledWith('s1', 'live:message', expect.anything());
    });

    it('refuses someone in a blocked relationship with the host', async () => {
      blocked.mockResolvedValue(true);

      await expect(postChatMessage('s1', VIEWER, 'hello')).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.liveStreamMessage.create).not.toHaveBeenCalled();
      // The refusal must not confirm that a block exists, only that he cannot
      // take part.
      await expect(postChatMessage('s1', VIEWER, 'hello')).rejects.toMatchObject({
        message: 'You cannot take part in this stream.',
      });
    });

    it('does not write a message the moderation gate refused', async () => {
      moderate.mockRejectedValue(Object.assign(new Error('nope'), { statusCode: 400 }));

      await expect(postChatMessage('s1', VIEWER, 'something vile')).rejects.toThrow('nope');
      expect(prisma.liveStreamMessage.create).not.toHaveBeenCalled();
    });

    it('keeps blocked accounts out of the backlog a viewer reads', async () => {
      blockedIds.mockResolvedValue(['troll-1', 'troll-2']);

      await recentMessages('s1', 100, VIEWER);

      expect(prisma.liveStreamMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { streamId: 's1', userId: { notIn: ['troll-1', 'troll-2'] } } })
      );
    });
  });

  describe('gifts', () => {
    const wallet = (before: number, after: number) => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: VIEWER, displayName: 'Sarah', giftBalance: before })
        .mockResolvedValueOnce({ giftBalance: after });
      prisma.giftTransaction.create.mockResolvedValue({ id: 'g1', createdAt: new Date() });
      prisma.liveStream.update.mockResolvedValue({ totalGiftPoints: 5 });
    };

    it('debits conditionally and reports the balance it read back', async () => {
      wallet(50, 45);

      const result = await sendStreamGift('s1', VIEWER, 'star');

      // The conditional updateMany IS the balance check. An unconditional
      // update here is what let two racing gifts spend the same points, and
      // gift points are bought with real money.
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: VIEWER, giftBalance: { gte: 5 } },
        data: { giftBalance: { decrement: 5 } },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.balance).toBe(45);
    });

    it('gives the loser of a race a clean 402 and writes nothing', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: VIEWER, displayName: 'Sarah', giftBalance: 5 });
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(sendStreamGift('s1', VIEWER, 'star')).rejects.toMatchObject({ statusCode: 402 });

      expect(prisma.giftTransaction.create).not.toHaveBeenCalled();
      expect(prisma.creatorProfile.updateMany).not.toHaveBeenCalled();
      expect(prisma.liveStream.update).not.toHaveBeenCalled();
    });

    it('refuses a gift from someone in a blocked relationship with the host', async () => {
      blocked.mockResolvedValue(true);

      await expect(sendStreamGift('s1', VIEWER, 'star')).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('host controls', () => {
    it('lets the host remove one message and tells the room', async () => {
      prisma.liveStreamMessage.findUnique.mockResolvedValue({ id: 'm1', streamId: 's1', userId: VIEWER });

      const result = await deleteChatMessage('s1', 'm1', HOST);

      expect(result).toEqual({ removed: 'm1' });
      expect(prisma.liveStreamMessage.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(emitToLiveRoom).toHaveBeenCalledWith('s1', 'live:message_removed', { streamId: 's1', messageId: 'm1' });
    });

    it('refuses anyone who is not the host', async () => {
      prisma.liveStreamMessage.findUnique.mockResolvedValue({ id: 'm1', streamId: 's1', userId: VIEWER });

      await expect(deleteChatMessage('s1', 'm1', VIEWER)).rejects.toMatchObject({ statusCode: 403 });
      await expect(removeViewer('s1', VIEWER, 'someone-else')).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.liveStreamMessage.delete).not.toHaveBeenCalled();
      expect(block).not.toHaveBeenCalled();
    });

    it('records the removal as a block, clears the lines and empties the seat', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: VIEWER, displayName: 'Sarah' });
      prisma.liveStreamMessage.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);

      const result = await removeViewer('s1', HOST, VIEWER);

      // The block is what makes the removal outlive the broadcast: the chat,
      // gift and join guards above all read it.
      expect(block).toHaveBeenCalledWith(HOST, VIEWER);
      expect(prisma.liveStreamMessage.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['m1', 'm2'] } } });
      expect(prisma.liveStream.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', messageCount: { gte: 2 } },
        data: { messageCount: { decrement: 2 } },
      });
      expect(removeFromLiveRoom).toHaveBeenCalledWith('s1', VIEWER);
      expect(result).toEqual({ removed: VIEWER, messagesRemoved: 2, blocked: true });
    });

    it('will not let a host remove herself', async () => {
      await expect(removeViewer('s1', HOST, HOST)).rejects.toMatchObject({ statusCode: 400 });
      expect(block).not.toHaveBeenCalled();
    });
  });
});
