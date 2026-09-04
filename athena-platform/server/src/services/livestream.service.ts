/**
 * Live streams.
 *
 * The picture itself travels outside this API: the host's encoder (OBS,
 * Streamlabs, a phone app) pushes RTMP to an ingest server, which publishes
 * HLS that the viewer's player pulls. This module owns everything around
 * that: the stream record viewers find, the key the encoder authenticates
 * with, going live and ending, the chat, the viewer count, and gifts.
 *
 * Where the ingest and playback URLs come from:
 *
 *   LIVESTREAM_RTMP_INGEST_URL         e.g. rtmp://ingest.example.com/live
 *   LIVESTREAM_PLAYBACK_URL_TEMPLATE   e.g. https://cdn.example.com/hls/{streamKey}/index.m3u8
 *
 * With neither set, a host can still go live by pasting the playback URL of
 * a stream they run elsewhere (Mux, Cloudflare Stream, a YouTube HLS URL):
 * the room, chat and gifts all work the same. An RTMP server that supports
 * publish hooks (nginx-rtmp, SRS, MediaMTX) can call /key/validate and
 * /webhooks/rtmp so going live and ending follow the encoder automatically.
 */

import crypto from 'crypto';
import { LiveStreamStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { GIFT_TYPES, getCreatorTier } from './creator.service';
import { emitToLiveRoom, emitToUserRoom, liveRoomSize, sendNotification } from './socket.service';

export const LIVE_CATEGORIES = ['career', 'learning', 'business', 'wellbeing', 'community', 'q-and-a'] as const;
export const LIVE_CHAT_MAX_LENGTH = 500;
const FOLLOWER_NOTIFY_CAP = 500;

const HOST_SELECT = {
  id: true,
  displayName: true,
  avatar: true,
  headline: true,
  isVerified: true,
} as const;

const CHAT_USER_SELECT = { id: true, displayName: true, avatar: true } as const;

export function ingestConfig(): { ingestUrl: string | null; playbackTemplate: string | null } {
  const ingestUrl = process.env.LIVESTREAM_RTMP_INGEST_URL?.trim() || null;
  const playbackTemplate = process.env.LIVESTREAM_PLAYBACK_URL_TEMPLATE?.trim() || null;
  return { ingestUrl, playbackTemplate };
}

export function playbackUrlFor(streamKey: string): string | null {
  const { playbackTemplate } = ingestConfig();
  if (!playbackTemplate) return null;
  return playbackTemplate.replace('{streamKey}', streamKey);
}

function newStreamKey(): string {
  return crypto.randomBytes(24).toString('hex');
}

type StreamRow = Prisma.LiveStreamGetPayload<{ include: { host: { select: typeof HOST_SELECT } } }>;

/**
 * What a viewer sees. The key and ingest URL are the host's alone: with them
 * anyone could push video into someone else's stream.
 */
export function publicView(stream: StreamRow, viewerId?: string) {
  const isHost = Boolean(viewerId && viewerId === stream.hostId);
  const live = stream.status === 'LIVE';
  const { streamKey, ingestUrl, ...rest } = stream;
  return {
    ...rest,
    viewerCount: live ? Math.max(stream.viewerCount, liveRoomSize(stream.id)) : 0,
    isHost,
    ...(isHost ? { streamKey, ingestUrl, ingestConfigured: Boolean(ingestUrl) } : {}),
  };
}

export interface StreamInput {
  title: string;
  description?: string | null;
  category?: string | null;
  thumbnailUrl?: string | null;
  playbackUrl?: string | null;
  scheduledFor?: Date | null;
}

/**
 * Prepares a stream. A host has at most one stream that is not ended; asking
 * again updates that one rather than minting a second key, so the console
 * can be reloaded freely.
 */
export async function createStream(hostId: string, input: StreamInput) {
  const open = await prisma.liveStream.findFirst({
    where: { hostId, status: { in: ['SCHEDULED', 'LIVE'] } },
    include: { host: { select: HOST_SELECT } },
    orderBy: { createdAt: 'desc' },
  });

  if (open?.status === 'LIVE') {
    throw new ApiError(409, 'You are live right now. End that stream before preparing another.');
  }

  const { ingestUrl } = ingestConfig();

  if (open) {
    const updated = await prisma.liveStream.update({
      where: { id: open.id },
      data: {
        title: input.title,
        description: input.description ?? open.description,
        category: input.category ?? open.category,
        thumbnailUrl: input.thumbnailUrl ?? open.thumbnailUrl,
        playbackUrl: input.playbackUrl ?? open.playbackUrl ?? playbackUrlFor(open.streamKey),
        scheduledFor: input.scheduledFor ?? open.scheduledFor,
        ingestUrl,
      },
      include: { host: { select: HOST_SELECT } },
    });
    return publicView(updated, hostId);
  }

  const streamKey = newStreamKey();
  const created = await prisma.liveStream.create({
    data: {
      hostId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      streamKey,
      ingestUrl,
      playbackUrl: input.playbackUrl ?? playbackUrlFor(streamKey),
      scheduledFor: input.scheduledFor ?? null,
    },
    include: { host: { select: HOST_SELECT } },
  });
  return publicView(created, hostId);
}

async function loadOwnStream(streamId: string, hostId: string): Promise<StreamRow> {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    include: { host: { select: HOST_SELECT } },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  if (stream.hostId !== hostId) throw new ApiError(403, 'Only the host can do that');
  return stream;
}

export async function updateStream(streamId: string, hostId: string, patch: Partial<StreamInput>) {
  const stream = await loadOwnStream(streamId, hostId);
  if (stream.status === 'ENDED') throw new ApiError(409, 'This stream has ended');

  const updated = await prisma.liveStream.update({
    where: { id: streamId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.thumbnailUrl !== undefined ? { thumbnailUrl: patch.thumbnailUrl } : {}),
      ...(patch.playbackUrl !== undefined ? { playbackUrl: patch.playbackUrl } : {}),
      ...(patch.scheduledFor !== undefined ? { scheduledFor: patch.scheduledFor } : {}),
    },
    include: { host: { select: HOST_SELECT } },
  });
  return publicView(updated, hostId);
}

async function notifyFollowersLive(stream: StreamRow) {
  const hostName = stream.host.displayName?.trim() || 'Someone you follow';
  const followers = await prisma.follow.findMany({
    where: { followingId: stream.hostId },
    select: { followerId: true },
    take: FOLLOWER_NOTIFY_CAP,
  });
  if (followers.length === 0) return;

  const title = `${hostName} is live`;
  const message = stream.title;
  const link = `/live/${stream.id}`;

  await prisma.notification.createMany({
    data: followers.map((f) => ({ userId: f.followerId, type: 'SYSTEM' as const, title, message, link })),
  });
  for (const follower of followers) {
    emitToUserRoom(follower.followerId, 'notifications:new', {
      type: 'SYSTEM',
      title,
      message,
      link,
      createdAt: new Date().toISOString(),
    });
  }
}

export async function startStream(streamId: string, hostId: string) {
  const stream = await loadOwnStream(streamId, hostId);
  if (stream.status === 'ENDED') {
    throw new ApiError(409, 'This stream has ended. Prepare a new one to go live again.');
  }
  if (stream.status === 'LIVE') {
    return publicView(stream, hostId);
  }
  if (!stream.playbackUrl) {
    throw new ApiError(
      400,
      'There is nothing for viewers to play yet. Configure the ingest server, or paste the playback URL of your stream.'
    );
  }

  const started = await prisma.liveStream.update({
    where: { id: streamId },
    data: { status: 'LIVE', startedAt: stream.startedAt ?? new Date(), endedAt: null },
    include: { host: { select: HOST_SELECT } },
  });

  emitToLiveRoom(streamId, 'live:status', { streamId, status: 'LIVE' });
  emitToLiveRoom('index', 'live:index_changed', { streamId, status: 'LIVE' });
  notifyFollowersLive(started).catch((error) => {
    logger.warn('Live notification to followers failed', {
      streamId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return publicView(started, hostId);
}

export async function endStream(streamId: string, hostId: string) {
  const stream = await loadOwnStream(streamId, hostId);
  if (stream.status === 'ENDED') return publicView(stream, hostId);

  const ended = await prisma.liveStream.update({
    where: { id: streamId },
    data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 },
    include: { host: { select: HOST_SELECT } },
  });

  emitToLiveRoom(streamId, 'live:status', { streamId, status: 'ENDED' });
  emitToLiveRoom('index', 'live:index_changed', { streamId, status: 'ENDED' });
  return publicView(ended, hostId);
}

/** For an RTMP server's publish hook: is this key allowed to push right now? */
export async function validateStreamKey(key: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { streamKey: key },
    select: { id: true, hostId: true, status: true },
  });
  if (!stream || stream.status === 'ENDED') {
    return { valid: false as const };
  }
  return { valid: true as const, streamId: stream.id, hostId: stream.hostId };
}

/** The encoder connected or went away; follow it. */
export async function rtmpEvent(key: string, event: 'publish' | 'publish_done') {
  const stream = await prisma.liveStream.findUnique({
    where: { streamKey: key },
    include: { host: { select: HOST_SELECT } },
  });
  if (!stream) throw new ApiError(404, 'Unknown stream key');

  if (event === 'publish') {
    if (stream.status === 'ENDED') throw new ApiError(409, 'Stream has ended');
    if (stream.status === 'LIVE') return { streamId: stream.id, status: stream.status };
    const started = await startStream(stream.id, stream.hostId);
    return { streamId: started.id, status: started.status };
  }

  if (stream.status !== 'LIVE') return { streamId: stream.id, status: stream.status };
  const ended = await endStream(stream.id, stream.hostId);
  return { streamId: ended.id, status: ended.status };
}

export async function listStreams(options: {
  status?: LiveStreamStatus;
  category?: string;
  limit?: number;
  viewerId?: string;
}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const status = options.status ?? 'LIVE';
  const streams = await prisma.liveStream.findMany({
    where: { status, ...(options.category ? { category: options.category } : {}) },
    include: { host: { select: HOST_SELECT } },
    orderBy: status === 'LIVE' ? [{ viewerCount: 'desc' }, { startedAt: 'desc' }] : [{ endedAt: 'desc' }],
    take: limit,
  });
  return streams.map((stream) => publicView(stream, options.viewerId));
}

export async function getStream(streamId: string, viewerId?: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    include: { host: { select: HOST_SELECT } },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  return publicView(stream, viewerId);
}

export async function myStreams(hostId: string, limit = 20) {
  const streams = await prisma.liveStream.findMany({
    where: { hostId },
    include: { host: { select: HOST_SELECT } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });
  return streams.map((stream) => publicView(stream, hostId));
}

// ===========================================
// Chat
// ===========================================

export async function postChatMessage(streamId: string, userId: string, content: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { id: true, status: true, hostId: true },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  if (stream.status !== 'LIVE' && stream.hostId !== userId) {
    throw new ApiError(409, 'This stream is not live');
  }

  const [message] = await prisma.$transaction([
    prisma.liveStreamMessage.create({
      data: { streamId, userId, content },
      include: { user: { select: CHAT_USER_SELECT } },
    }),
    prisma.liveStream.update({ where: { id: streamId }, data: { messageCount: { increment: 1 } } }),
  ]);

  emitToLiveRoom(streamId, 'live:message', { streamId, message: { ...message, isHost: userId === stream.hostId } });
  return message;
}

export async function recentMessages(streamId: string, limit = 100) {
  const stream = await prisma.liveStream.findUnique({ where: { id: streamId }, select: { hostId: true } });
  if (!stream) throw new ApiError(404, 'Stream not found');
  const rows = await prisma.liveStreamMessage.findMany({
    where: { streamId },
    include: { user: { select: CHAT_USER_SELECT } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });
  return rows.reverse().map((row) => ({ ...row, isHost: row.userId === stream.hostId }));
}

// ===========================================
// Viewer count
// ===========================================

/** Called by the socket layer whenever the room changes size. */
export async function recordViewerCount(streamId: string, count: number) {
  try {
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { peakViewers: true, status: true },
    });
    if (!stream || stream.status !== 'LIVE') return;
    await prisma.liveStream.update({
      where: { id: streamId },
      data: { viewerCount: count, peakViewers: Math.max(stream.peakViewers, count) },
    });
  } catch (error) {
    logger.debug('Viewer count not recorded', { streamId, error: error instanceof Error ? error.message : String(error) });
  }
}

// ===========================================
// Gifts
// ===========================================

export function giftCatalog() {
  return Object.values(GIFT_TYPES);
}

export async function walletBalance(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { giftBalance: true } });
  const balance = user?.giftBalance ?? 0;
  return { balance, valueAud: balance * 0.01 };
}

export async function sendStreamGift(streamId: string, senderId: string, giftType: string, message?: string) {
  const gift = GIFT_TYPES[String(giftType).toUpperCase() as keyof typeof GIFT_TYPES];
  if (!gift) throw new ApiError(400, 'Unknown gift');

  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    include: { host: { select: HOST_SELECT } },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  if (stream.status !== 'LIVE') throw new ApiError(409, 'This stream is not live');
  if (stream.hostId === senderId) throw new ApiError(400, 'You cannot gift your own stream');

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, displayName: true, giftBalance: true },
  });
  if (!sender || sender.giftBalance < gift.value) {
    throw new ApiError(402, 'Not enough gift points. Top up to send this gift.');
  }

  const followerCount = await prisma.follow.count({ where: { followingId: stream.hostId } });
  const tier = getCreatorTier(followerCount);
  const creatorShare = Math.floor(gift.value * (tier.revShare / 100));
  const platformShare = gift.value - creatorShare;

  const [transaction, updatedStream] = await prisma.$transaction([
    prisma.giftTransaction.create({
      data: {
        senderId,
        receiverId: stream.hostId,
        streamId,
        giftType: gift.id,
        giftValue: gift.value,
        creatorShare,
        platformShare,
        message: message ?? null,
      },
    }),
    prisma.liveStream.update({
      where: { id: streamId },
      data: { totalGiftPoints: { increment: gift.value } },
      select: { totalGiftPoints: true },
    }),
    prisma.user.update({ where: { id: senderId }, data: { giftBalance: { decrement: gift.value } } }),
    prisma.creatorProfile.updateMany({
      where: { userId: stream.hostId },
      data: { totalEarnings: { increment: creatorShare }, pendingPayout: { increment: creatorShare } },
    }),
  ]);

  const payload = {
    streamId,
    gift: { id: gift.id, name: gift.name, icon: gift.icon, value: gift.value },
    sender: { id: sender.id, displayName: sender.displayName },
    message: message ?? null,
    totalGiftPoints: updatedStream.totalGiftPoints,
    at: transaction.createdAt,
  };
  emitToLiveRoom(streamId, 'live:gift', payload);

  sendNotification({
    userId: stream.hostId,
    type: 'GIFT_RECEIVED',
    title: `You received a ${gift.name}!`,
    message: `${sender.displayName || 'Someone'} sent ${gift.icon} ${gift.name} during your live stream`,
    link: `/live/${streamId}`,
  }).catch(() => {});

  return { transaction, totalGiftPoints: updatedStream.totalGiftPoints, balance: sender.giftBalance - gift.value };
}

export async function giftLeaderboard(streamId: string, limit = 10) {
  const rows = await prisma.giftTransaction.groupBy({
    by: ['senderId'],
    where: { streamId },
    _sum: { giftValue: true },
    _count: { _all: true },
    orderBy: { _sum: { giftValue: 'desc' } },
    take: Math.min(limit, 50),
  });
  if (rows.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.senderId) } },
    select: CHAT_USER_SELECT,
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((row, index) => ({
    rank: index + 1,
    user: byId.get(row.senderId) ?? { id: row.senderId, displayName: 'Member', avatar: null },
    points: row._sum.giftValue ?? 0,
    gifts: row._count._all,
  }));
}
