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
      findMany: jest.fn(async () => []),
      update: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    liveStreamMute: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    liveStreamMessage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(async () => null),
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

// What a block counts towards (services/block.service loads these when it needs them).
jest.mock('../trust.service', () => ({ recordUserBlock: jest.fn(async () => undefined) }));
jest.mock('../safety-score.service', () => ({ handleUserBlock: jest.fn(async () => undefined), handleUserUnblock: jest.fn(async () => undefined) }));
jest.mock('../unwanted-contact.service', () => ({ reviewUnwantedContact: jest.fn(async () => undefined) }));

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
import { handleUserBlock } from '../safety-score.service';
import { emitToLiveRoom, emitToUserRoom, removeFromLiveRoom, sendNotification } from '../socket.service';
import {
  deleteChatMessage,
  getStream,
  giftLeaderboard,
  liftStreamSuspension,
  listStreams,
  listStreamsForStaff,
  muteViewer,
  postChatMessage,
  recentMessages,
  removeChatMessageAsStaff,
  removeViewer,
  sendStreamGift,
  setSlowMode,
  startStream,
  suspendStream,
  unmuteViewer,
  validateStreamKey,
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
    prisma.liveStreamMessage.findFirst.mockResolvedValue(null);
    prisma.liveStreamMute.findUnique.mockResolvedValue(null);
    prisma.liveStream.findMany.mockResolvedValue([]);
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
      expect(emitToLiveRoom).toHaveBeenCalledWith('s1', 'live:message', expect.anything(), { exceptUserIds: [] });
    });

    // The room is not one audience: a viewer who blocked her, or whom she
    // blocked, is not sent the line, as the backlog already leaves her out.
    it('does not broadcast a line to anyone on either side of a block with its author', async () => {
      blockedIds.mockResolvedValue(['blocked-by-her', 'blocked-her']);
      prisma.liveStreamMessage.create.mockResolvedValue({ id: 'm1', userId: VIEWER, content: 'hello' });

      await postChatMessage('s1', VIEWER, 'hello');

      expect(emitToLiveRoom).toHaveBeenCalledWith('s1', 'live:message', expect.anything(), {
        exceptUserIds: ['blocked-by-her', 'blocked-her'],
      });
    });

    it('stores nothing when it cannot work out who the line must be kept from', async () => {
      blockedIds.mockRejectedValue(new Error('settings unreadable'));

      await expect(postChatMessage('s1', VIEWER, 'hello')).rejects.toThrow('settings unreadable');
      expect(prisma.liveStreamMessage.create).not.toHaveBeenCalled();
    });

    it('refuses chat on a stream staff took down, even from its host', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(stream({ status: 'ENDED', suspendedAt: new Date() }));

      await expect(postChatMessage('s1', VIEWER, 'hello')).rejects.toMatchObject({ statusCode: 409 });
      await expect(postChatMessage('s1', HOST, 'hello')).rejects.toMatchObject({ statusCode: 409 });
      expect(prisma.liveStreamMessage.create).not.toHaveBeenCalled();
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

  describe('mute and slow mode', () => {
    const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000);

    it('refuses a muted viewer a line until the mute runs out, and says how long', async () => {
      prisma.liveStreamMute.findUnique.mockResolvedValue({ until: minutesFromNow(5) });

      await expect(postChatMessage('s1', VIEWER, 'hello')).rejects.toMatchObject({ statusCode: 403 });
      await expect(postChatMessage('s1', VIEWER, 'hello')).rejects.toThrow(/muted you in this chat for about [45] more minutes/);
      // Said as a mute and not as a block, and she may keep watching.
      await expect(postChatMessage('s1', VIEWER, 'hello')).rejects.toThrow(/keep watching/);
      expect(moderate).not.toHaveBeenCalled();
      expect(prisma.liveStreamMessage.create).not.toHaveBeenCalled();
      expect(prisma.liveStreamMute.findUnique).toHaveBeenCalledWith({
        where: { streamId_userId: { streamId: 's1', userId: VIEWER } },
        select: { until: true },
      });
    });

    it('lets her speak again once the mute has expired, without anyone clearing it', async () => {
      prisma.liveStreamMute.findUnique.mockResolvedValue({ until: new Date(Date.now() - 1000) });
      prisma.liveStreamMessage.create.mockResolvedValue({ id: 'm1', userId: VIEWER, content: 'hello' });

      await postChatMessage('s1', VIEWER, 'hello');

      expect(prisma.liveStreamMessage.create).toHaveBeenCalled();
    });

    it('never mutes or slows the host in her own room', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(stream({ slowModeSeconds: 60 }));
      prisma.liveStreamMute.findUnique.mockResolvedValue({ until: minutesFromNow(30) });
      prisma.liveStreamMessage.findFirst.mockResolvedValue({ createdAt: new Date() });
      prisma.liveStreamMessage.create.mockResolvedValue({ id: 'm1', userId: HOST, content: 'welcome' });

      await postChatMessage('s1', HOST, 'welcome');

      expect(prisma.liveStreamMute.findUnique).not.toHaveBeenCalled();
      expect(prisma.liveStreamMessage.create).toHaveBeenCalled();
    });

    it('slow mode refuses a second line inside the window, and allows it after', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(stream({ slowModeSeconds: 30 }));
      prisma.liveStreamMessage.create.mockResolvedValue({ id: 'm2', userId: VIEWER, content: 'again' });

      prisma.liveStreamMessage.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 10_000) });
      await expect(postChatMessage('s1', VIEWER, 'again')).rejects.toMatchObject({ statusCode: 429 });
      await expect(postChatMessage('s1', VIEWER, 'again')).rejects.toThrow(/Slow mode is on.*in (19|20|21) seconds/);
      expect(prisma.liveStreamMessage.create).not.toHaveBeenCalled();
      // It is her own last line, in this stream, that is the clock.
      expect(prisma.liveStreamMessage.findFirst).toHaveBeenCalledWith({
        where: { streamId: 's1', userId: VIEWER },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      prisma.liveStreamMessage.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 31_000) });
      await postChatMessage('s1', VIEWER, 'again');
      expect(prisma.liveStreamMessage.create).toHaveBeenCalledTimes(1);
    });

    it('slow mode does not delay a first line, and is not read when it is off', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(stream({ slowModeSeconds: 30 }));
      prisma.liveStreamMessage.create.mockResolvedValue({ id: 'm1', userId: VIEWER, content: 'hi' });
      await postChatMessage('s1', VIEWER, 'hi');
      expect(prisma.liveStreamMessage.create).toHaveBeenCalledTimes(1);

      prisma.liveStreamMessage.findFirst.mockClear();
      prisma.liveStream.findUnique.mockResolvedValue(stream({ slowModeSeconds: null }));
      await postChatMessage('s1', VIEWER, 'hi again');
      expect(prisma.liveStreamMessage.findFirst).not.toHaveBeenCalled();
    });

    it('lets the host mute a viewer for a while, and tells the viewer', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: VIEWER });

      const result = await muteViewer('s1', HOST, VIEWER, 10);

      const call = prisma.liveStreamMute.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ streamId_userId: { streamId: 's1', userId: VIEWER } });
      expect(call.create).toMatchObject({ streamId: 's1', userId: VIEWER, mutedById: HOST });
      // Muting again moves the end of it rather than adding a second row.
      expect(call.update.until).toBeInstanceOf(Date);
      expect(call.create.until.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
      expect(call.create.until.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000);
      expect(emitToUserRoom).toHaveBeenCalledWith(VIEWER, 'live:muted', { streamId: 's1', until: result.until });
      // A mute is not a removal: no block, no deleted lines, still in the room.
      expect(block).not.toHaveBeenCalled();
      expect(removeFromLiveRoom).not.toHaveBeenCalled();
      expect(prisma.liveStreamMessage.deleteMany).not.toHaveBeenCalled();
    });

    it('lets nobody but the host mute, and not the host herself', async () => {
      await expect(muteViewer('s1', VIEWER, 'someone-else', 10)).rejects.toMatchObject({ statusCode: 403 });
      await expect(muteViewer('s1', HOST, HOST, 10)).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.liveStreamMute.upsert).not.toHaveBeenCalled();
    });

    it('refuses a mute that is not a whole number of minutes between 1 and a day', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: VIEWER });
      for (const minutes of [0, -5, 1.5, 24 * 60 + 1, Number.NaN]) {
        await expect(muteViewer('s1', HOST, VIEWER, minutes)).rejects.toMatchObject({ statusCode: 400 });
      }
      expect(prisma.liveStreamMute.upsert).not.toHaveBeenCalled();
    });

    it('will not mute an account that does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(muteViewer('s1', HOST, 'ghost', 10)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.liveStreamMute.upsert).not.toHaveBeenCalled();
    });

    it('lets the host lift a mute, and only the host', async () => {
      await expect(unmuteViewer('s1', VIEWER, VIEWER)).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.liveStreamMute.deleteMany).not.toHaveBeenCalled();

      await unmuteViewer('s1', HOST, VIEWER);
      expect(prisma.liveStreamMute.deleteMany).toHaveBeenCalledWith({ where: { streamId: 's1', userId: VIEWER } });
      expect(emitToUserRoom).toHaveBeenCalledWith(VIEWER, 'live:unmuted', { streamId: 's1' });
    });

    it('sets slow mode for the host, tells the room, and turns it off with 0 or null', async () => {
      prisma.liveStream.update.mockImplementation(async ({ data }: any) => stream({ ...data }));

      const on = await setSlowMode('s1', HOST, 15);
      expect(prisma.liveStream.update.mock.calls[0][0].data).toEqual({ slowModeSeconds: 15 });
      expect(on.slowModeSeconds).toBe(15);
      expect(emitToLiveRoom).toHaveBeenCalledWith('s1', 'live:slow_mode', { streamId: 's1', seconds: 15 });

      await setSlowMode('s1', HOST, 0);
      expect(prisma.liveStream.update.mock.calls[1][0].data).toEqual({ slowModeSeconds: null });
      await setSlowMode('s1', HOST, null);
      expect(prisma.liveStream.update.mock.calls[2][0].data).toEqual({ slowModeSeconds: null });
    });

    it('refuses slow mode from anyone but the host, out of range, or on a stream that has ended', async () => {
      await expect(setSlowMode('s1', VIEWER, 10)).rejects.toMatchObject({ statusCode: 403 });
      await expect(setSlowMode('s1', HOST, 601)).rejects.toMatchObject({ statusCode: 400 });
      await expect(setSlowMode('s1', HOST, 2.5)).rejects.toMatchObject({ statusCode: 400 });
      await expect(setSlowMode('s1', HOST, -1)).rejects.toMatchObject({ statusCode: 400 });

      prisma.liveStream.findUnique.mockResolvedValue(stream({ status: 'ENDED' }));
      await expect(setSlowMode('s1', HOST, 10)).rejects.toMatchObject({ statusCode: 409 });
      expect(prisma.liveStream.update).not.toHaveBeenCalled();
    });
  });

  describe('who can see the stream', () => {
    const fullRow = (overrides: Record<string, unknown> = {}) =>
      stream({
        title: 'Live',
        streamKey: 'secret-key',
        ingestUrl: 'rtmp://ingest/live',
        playbackUrl: 'https://cdn.example.com/hls/index.m3u8',
        viewerCount: 0,
        suspendedAt: null,
        suspendedById: null,
        suspendedReason: null,
        ...overrides,
      });

    it('is not found, and shows no playback URL, across a block with the host', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(fullRow());
      blocked.mockResolvedValue(true);

      await expect(getStream('s1', VIEWER)).rejects.toMatchObject({ statusCode: 404 });
      await expect(recentMessages('s1', 100, VIEWER)).rejects.toMatchObject({ statusCode: 404 });
      expect(blocked).toHaveBeenCalledWith(VIEWER, HOST);
    });

    it('stays open to a viewer with no block, and to the host whoever she has blocked', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(fullRow());

      const asViewer = await getStream('s1', VIEWER);
      expect(asViewer.playbackUrl).toBe('https://cdn.example.com/hls/index.m3u8');
      expect((asViewer as any).streamKey).toBeUndefined();

      blocked.mockResolvedValue(true);
      const asHost = await getStream('s1', HOST);
      expect(asHost.isHost).toBe(true);
      // The host is never asked about a block with herself.
      expect(blocked).not.toHaveBeenCalledWith(HOST, HOST);
    });

    it('is the host\'s alone once staff took it down, and never says who or why', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(
        fullRow({ status: 'ENDED', suspendedAt: new Date(), suspendedById: 'mod-1', suspendedReason: 'Threats on air' })
      );

      await expect(getStream('s1', VIEWER)).rejects.toMatchObject({ statusCode: 404 });
      await expect(getStream('s1')).rejects.toMatchObject({ statusCode: 404 });
      await expect(recentMessages('s1', 100, VIEWER)).rejects.toMatchObject({ statusCode: 404 });

      const asHost: any = await getStream('s1', HOST);
      expect(asHost.suspended).toBe(true);
      // Which moderator, and what they wrote, are staff's.
      expect(asHost.suspendedById).toBeUndefined();
      expect(asHost.suspendedReason).toBeUndefined();
      expect(asHost.suspendedAt).toBeUndefined();
    });

    it('keeps the gifters board to the same audience as the room: not for a taken-down stream, not across a block', async () => {
      prisma.giftTransaction.groupBy.mockResolvedValue([
        { senderId: 'fan-1', _sum: { giftValue: 50 }, _count: { _all: 2 } },
      ]);
      prisma.user.findMany = jest.fn(async () => [{ id: 'fan-1', displayName: 'Ayesha', avatar: null }]);

      // Staff took the stream down: only the host can still see who gifted.
      prisma.liveStream.findUnique.mockResolvedValue(fullRow({ status: 'ENDED', suspendedAt: new Date() }));
      await expect(giftLeaderboard('s1', 10, VIEWER)).rejects.toMatchObject({ statusCode: 404 });
      await expect(giftLeaderboard('s1', 10)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.giftTransaction.groupBy).not.toHaveBeenCalled();
      await expect(giftLeaderboard('s1', 10, HOST)).resolves.toHaveLength(1);

      // Across a block with the host it does not exist either.
      prisma.giftTransaction.groupBy.mockClear();
      prisma.liveStream.findUnique.mockResolvedValue(fullRow());
      blocked.mockResolvedValue(true);
      await expect(giftLeaderboard('s1', 10, VIEWER)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.giftTransaction.groupBy).not.toHaveBeenCalled();

      // Open, and a gifter she blocked (or who blocked her) is left off her board.
      blocked.mockResolvedValue(false);
      blockedIds.mockResolvedValue(['blocked-fan']);
      await giftLeaderboard('s1', 10, VIEWER);
      expect(prisma.giftTransaction.groupBy.mock.calls[0][0].where).toEqual({
        streamId: 's1',
        senderId: { notIn: ['blocked-fan'] },
      });

      // A signed-out viewer has nobody to hide from.
      prisma.giftTransaction.groupBy.mockClear();
      await giftLeaderboard('s1', 10);
      expect(prisma.giftTransaction.groupBy.mock.calls[0][0].where).toEqual({ streamId: 's1' });
    });

    it('is not found for a stream that does not exist', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(null);
      await expect(giftLeaderboard('nope', 10, VIEWER)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('leaves a host she blocked, or who blocked her, out of the list, and a suspended stream out for everyone', async () => {
      blockedIds.mockResolvedValue(['bad-host']);

      await listStreams({ viewerId: VIEWER });

      const where = prisma.liveStream.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ status: 'LIVE', suspendedAt: null, hostId: { notIn: ['bad-host'] } });

      // Signed out there is no one to hide from, but a taken-down stream is still not listed.
      prisma.liveStream.findMany.mockClear();
      await listStreams({});
      expect(prisma.liveStream.findMany.mock.calls[0][0].where).toEqual({ status: 'LIVE', suspendedAt: null });
      expect(blockedIds).toHaveBeenCalledTimes(1);
    });
  });

  describe('staff controls', () => {
    it('ends a stream for good: ended, stamped, the room and the host told', async () => {
      prisma.liveStream.findUnique.mockResolvedValue({
        id: 's1', hostId: HOST, title: 'Live', status: 'LIVE', endedAt: null, suspendedAt: null,
      });
      prisma.liveStream.update.mockImplementation(async ({ data }: any) => ({
        id: 's1', hostId: HOST, status: data.status, suspendedAt: data.suspendedAt,
      }));

      const result = await suspendStream('s1', 'mod-1', 'Threats on air');

      const data = prisma.liveStream.update.mock.calls[0][0].data;
      expect(data).toMatchObject({
        status: 'ENDED',
        viewerCount: 0,
        suspendedById: 'mod-1',
        suspendedReason: 'Threats on air',
      });
      expect(data.suspendedAt).toBeInstanceOf(Date);
      expect(data.endedAt).toBeInstanceOf(Date);
      expect(result).toMatchObject({ id: 's1', hostId: HOST, changed: true });
      expect(emitToLiveRoom).toHaveBeenCalledWith('s1', 'live:status', { streamId: 's1', status: 'ENDED', suspended: true });
      await new Promise((resolve) => setImmediate(resolve));
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: HOST, title: 'Your live stream was ended' })
      );
      // What the host is told must not carry the moderator's own note.
      const told = (sendNotification as jest.Mock).mock.calls[0][0] as { message: string };
      expect(told.message).not.toContain('Threats on air');
    });

    it('keeps the end time a host already set, and does nothing a second time', async () => {
      const endedAt = new Date('2026-09-30T01:00:00Z');
      prisma.liveStream.findUnique.mockResolvedValue({
        id: 's1', hostId: HOST, title: 'Live', status: 'ENDED', endedAt, suspendedAt: null,
      });
      prisma.liveStream.update.mockResolvedValue({ id: 's1', hostId: HOST, status: 'ENDED', suspendedAt: new Date() });
      await suspendStream('s1', 'mod-1', 'Reason');
      expect(prisma.liveStream.update.mock.calls[0][0].data.endedAt).toBe(endedAt);

      prisma.liveStream.update.mockClear();
      (emitToLiveRoom as jest.Mock).mockClear();
      prisma.liveStream.findUnique.mockResolvedValue({
        id: 's1', hostId: HOST, title: 'Live', status: 'ENDED', endedAt, suspendedAt: new Date(),
      });
      const again = await suspendStream('s1', 'mod-2', 'Another reason');
      expect(again.changed).toBe(false);
      expect(prisma.liveStream.update).not.toHaveBeenCalled();
      expect(emitToLiveRoom).not.toHaveBeenCalled();
    });

    it('two moderators acting at once: the second changes nothing, tells no one, and does not overwrite the first', async () => {
      // Both read the stream as not yet suspended; the first write wins, and the
      // second finds no row left that matches "not yet suspended".
      prisma.liveStream.findUnique.mockResolvedValue({
        id: 's1', hostId: HOST, title: 'Live', status: 'LIVE', endedAt: null, suspendedAt: null,
      });
      prisma.liveStream.update.mockRejectedValue(Object.assign(new Error('Record to update not found.'), { code: 'P2025' }));

      const result = await suspendStream('s1', 'mod-2', 'Also threats');

      expect(prisma.liveStream.update.mock.calls[0][0].where).toEqual({ id: 's1', suspendedAt: null });
      expect(result).toMatchObject({ id: 's1', hostId: HOST, changed: false });
      expect(emitToLiveRoom).not.toHaveBeenCalled();
      await new Promise((resolve) => setImmediate(resolve));
      expect(sendNotification).not.toHaveBeenCalled();

      // Any other failure is still a failure.
      prisma.liveStream.update.mockRejectedValue(new Error('database unavailable'));
      await expect(suspendStream('s1', 'mod-2', 'Also threats')).rejects.toThrow('database unavailable');
    });

    it('is not found for a stream that does not exist', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(null);
      await expect(suspendStream('nope', 'mod-1', 'Reason')).rejects.toMatchObject({ statusCode: 404 });
      await expect(liftStreamSuspension('nope')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('a suspended stream cannot be restarted, and its key can no longer push', async () => {
      prisma.liveStream.findUnique.mockResolvedValue(
        stream({ status: 'ENDED', suspendedAt: new Date(), playbackUrl: 'https://cdn.example.com/x.m3u8' })
      );

      await expect(startStream('s1', HOST)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringMatching(/ended by the ATHENA team/),
      });
      expect(prisma.liveStream.update).not.toHaveBeenCalled();

      prisma.liveStream.findUnique.mockResolvedValue({ id: 's1', hostId: HOST, status: 'LIVE', suspendedAt: new Date() });
      await expect(validateStreamKey('secret-key')).resolves.toEqual({ valid: false });
    });

    it('lifting a suspension lists and opens the stream again, and does nothing when there was none', async () => {
      prisma.liveStream.findUnique.mockResolvedValue({ id: 's1', hostId: HOST, suspendedAt: new Date() });
      prisma.liveStream.update.mockResolvedValue({});

      await expect(liftStreamSuspension('s1')).resolves.toEqual({ id: 's1', hostId: HOST, changed: true });
      expect(prisma.liveStream.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { suspendedAt: null, suspendedById: null, suspendedReason: null },
      });

      prisma.liveStream.update.mockClear();
      prisma.liveStream.findUnique.mockResolvedValue({ id: 's1', hostId: HOST, suspendedAt: null });
      await expect(liftStreamSuspension('s1')).resolves.toEqual({ id: 's1', hostId: HOST, changed: false });
      expect(prisma.liveStream.update).not.toHaveBeenCalled();
    });

    it('lists streams for staff without the key, the ingest URL or the playback URL', async () => {
      await listStreamsForStaff({});
      const live = prisma.liveStream.findMany.mock.calls[0][0];
      expect(live.where).toEqual({ status: 'LIVE' });
      expect(live.select.streamKey).toBeUndefined();
      expect(live.select.ingestUrl).toBeUndefined();
      expect(live.select.playbackUrl).toBeUndefined();

      await listStreamsForStaff({ suspended: true });
      expect(prisma.liveStream.findMany.mock.calls[1][0].where).toEqual({ suspendedAt: { not: null } });
    });

    it('takes one chat line out because a report was upheld, and is quiet when the host already deleted it', async () => {
      prisma.liveStreamMessage.findUnique.mockResolvedValue({ id: 'm1', streamId: 's1' });
      await expect(removeChatMessageAsStaff('m1')).resolves.toBe(true);
      expect(prisma.liveStreamMessage.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(emitToLiveRoom).toHaveBeenCalledWith('s1', 'live:message_removed', { streamId: 's1', messageId: 'm1' });

      prisma.liveStreamMessage.delete.mockClear();
      prisma.liveStreamMessage.findUnique.mockResolvedValue(null);
      await expect(removeChatMessageAsStaff('gone')).resolves.toBe(false);
      expect(prisma.liveStreamMessage.delete).not.toHaveBeenCalled();
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

    it('keeps the gift, which names its sender to the room, from anyone who blocked her or whom she blocked', async () => {
      blockedIds.mockResolvedValue(['blocked-her']);
      wallet(50, 45);

      await sendStreamGift('s1', VIEWER, 'star');

      expect(emitToLiveRoom).toHaveBeenCalledWith('s1', 'live:gift', expect.anything(), { exceptUserIds: ['blocked-her'] });
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

    // A host who removes the same person from stream after stream is one of the
    // signals a moderator is shown; the removal is a block, and a block counts.
    it('counts the removal towards the viewer as a block from the Safety Centre would', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: VIEWER, displayName: 'Sarah' });
      prisma.liveStreamMessage.findMany.mockResolvedValue([]);

      await removeViewer('s1', HOST, VIEWER);

      expect(handleUserBlock).toHaveBeenCalledWith(VIEWER, HOST);
    });

    it('will not let a host remove herself', async () => {
      await expect(removeViewer('s1', HOST, HOST)).rejects.toMatchObject({ statusCode: 400 });
      expect(block).not.toHaveBeenCalled();
    });
  });
});
