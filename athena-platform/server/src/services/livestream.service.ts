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
import { bestEffort } from '../utils/best-effort';
import { getBlockedRelationshipIds, isBlockedRelationship } from '../utils/safety-store';
import { applyBlock } from './block.service';
import { GIFT_TYPES, getCreatorTier } from './creator.service';
import { GIFT_POINT_VALUE_AUD } from '../config/price-book';
import { assertContentAllowed } from './moderation.service';
import { emitToLiveRoom, emitToUserRoom, liveRoomSize, removeFromLiveRoom, sendNotification } from './socket.service';

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

/**
 * The viewer-facing URL for a stream.
 *
 * `{streamKey}` is the token the documented nginx-rtmp style template uses,
 * because those servers publish HLS under the name the encoder pushed — which
 * is the key. That has a cost worth stating plainly: the key is the credential
 * that authorises pushing video into this stream, and a URL handed to every
 * viewer prints it. `publicView` strips `streamKey` and `ingestUrl` from a
 * non-host response and always did, but it cannot strip `playbackUrl`, because
 * that is the thing a viewer needs in order to watch.
 *
 * So `{streamId}` is accepted too. An ingest server that can publish under a
 * name of our choosing — the publish hook already hands it the stream id in
 * the /key/validate response — can be pointed at a template built from the id,
 * and then nothing the audience receives contains the key at all. Deployments
 * that cannot remap keep using `{streamKey}` and are no worse off than before.
 */
export function playbackUrlFor(stream: { id: string; streamKey: string }): string | null {
  const { playbackTemplate } = ingestConfig();
  if (!playbackTemplate) return null;
  return playbackTemplate.replace('{streamKey}', stream.streamKey).replace('{streamId}', stream.id);
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
  // Who in staff took a stream down, and what they wrote about it, is theirs:
  // a viewer, or the host, is told that it was ended and nothing more.
  const { streamKey, ingestUrl, suspendedAt, suspendedById, suspendedReason, ...rest } = stream;
  return {
    ...rest,
    suspended: Boolean(suspendedAt),
    viewerCount: live ? Math.max(stream.viewerCount, liveRoomSize(stream.id)) : 0,
    isHost,
    ...(isHost ? { streamKey, ingestUrl, ingestConfigured: Boolean(ingestUrl) } : {}),
  };
}

/** What a member is told when a stream was ended by ATHENA's team. */
const SUSPENDED_MESSAGE = 'This stream was ended by the ATHENA team and cannot be restarted.';

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
        playbackUrl: input.playbackUrl ?? open.playbackUrl ?? playbackUrlFor(open),
        scheduledFor: input.scheduledFor ?? open.scheduledFor,
        ingestUrl,
      },
      include: { host: { select: HOST_SELECT } },
    });
    return publicView(updated, hostId);
  }

  const streamKey = newStreamKey();
  // The id is minted here rather than by the database default so the playback
  // URL can be templated on it in the same statement that creates the row.
  const id = crypto.randomUUID();
  const created = await prisma.liveStream.create({
    data: {
      id,
      hostId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      streamKey,
      ingestUrl,
      playbackUrl: input.playbackUrl ?? playbackUrlFor({ id, streamKey }),
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
  // Ahead of the ENDED check below, because a suspended stream is ENDED and
  // "prepare a new one" is the wrong advice for a stream staff took down: it
  // would read as though going live again were just a matter of a fresh key.
  if (stream.suspendedAt) throw new ApiError(403, SUSPENDED_MESSAGE);
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
    select: { id: true, hostId: true, status: true, suspendedAt: true },
  });
  // A suspended stream is ENDED already; naming it keeps the refusal from
  // depending on that, so the key of a stream staff took down can never push.
  if (!stream || stream.status === 'ENDED' || stream.suspendedAt) {
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
  // A host she blocked, or who blocked her, is not in her list: the one place
  // the platform would otherwise put the two in front of each other again.
  const hidden = options.viewerId ? await getBlockedRelationshipIds(options.viewerId) : [];
  const streams = await prisma.liveStream.findMany({
    where: {
      status,
      // Taken down by staff: never listed, whoever is asking.
      suspendedAt: null,
      ...(hidden.length ? { hostId: { notIn: hidden } } : {}),
      ...(options.category ? { category: options.category } : {}),
    },
    include: { host: { select: HOST_SELECT } },
    orderBy: status === 'LIVE' ? [{ viewerCount: 'desc' }, { startedAt: 'desc' }] : [{ endedAt: 'desc' }],
    take: limit,
  });
  return streams.map((stream) => publicView(stream, options.viewerId));
}

/**
 * Whether this viewer may open the stream at all. A stream staff took down is
 * the host's to see and nobody else's, and across a block it does not exist:
 * 404 rather than 403, as for a blocked profile, so the page neither shows the
 * playback URL nor says why. The host always passes.
 */
async function assertStreamVisible(stream: { hostId: string; suspendedAt: Date | null }, viewerId?: string) {
  if (viewerId && viewerId === stream.hostId) return;
  if (stream.suspendedAt) throw new ApiError(404, 'Stream not found');
  if (viewerId && (await isBlockedRelationship(viewerId, stream.hostId))) {
    throw new ApiError(404, 'Stream not found');
  }
}

export async function getStream(streamId: string, viewerId?: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    include: { host: { select: HOST_SELECT } },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  await assertStreamVisible(stream, viewerId);
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

/**
 * Both doors into a host's chat come through here — the REST route and the
 * socket's `live:chat` — which is why the block check and the moderation gate
 * live in the service rather than on one of them. Neither existed: a woman
 * could block someone hard enough that he could not message her, comment on
 * her posts or repost her, and he could still walk into her live chat and
 * talk to her in front of her audience.
 */
export async function postChatMessage(streamId: string, userId: string, content: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { id: true, status: true, hostId: true, slowModeSeconds: true, suspendedAt: true },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  // Not even the host: a stream staff took down has no chat left to speak in.
  if (stream.suspendedAt) throw new ApiError(409, SUSPENDED_MESSAGE);
  if (stream.status !== 'LIVE' && stream.hostId !== userId) {
    throw new ApiError(409, 'This stream is not live');
  }
  // Deliberately says neither who blocked whom nor that a block exists: the
  // room is public, so 404 would be a transparent lie, but confirming the
  // block back to him tells him something he is not owed.
  if (await isBlockedRelationship(userId, stream.hostId)) {
    throw new ApiError(403, 'You cannot take part in this stream.');
  }

  // The host's own controls are for her audience; she is never muted or slowed
  // in her own room.
  if (userId !== stream.hostId) {
    await assertNotMuted(streamId, userId);
    await assertSlowModeAllows(stream, userId);
  }

  // 'live_chat', not 'message': both are held to the conversational line, but
  // the kind is what a reviewer reads when something was let through, and a
  // line said in front of a stream's whole audience is not a direct message.
  await assertContentAllowed(content, { kind: 'live_chat', userId });

  // Read before the write, not after: if this fails the line is not sent and
  // she is told so, where reading it afterwards would leave a stored line that
  // was never shown to anyone, her own screen included.
  const hidden = await getBlockedRelationshipIds(userId);

  const [message] = await prisma.$transaction([
    prisma.liveStreamMessage.create({
      data: { streamId, userId, content },
      include: { user: { select: CHAT_USER_SELECT } },
    }),
    prisma.liveStream.update({ where: { id: streamId }, data: { messageCount: { increment: 1 } } }),
  ]);

  // The room is not one audience. A viewer who blocked her, or whom she
  // blocked, is not sent the line, exactly as the backlog leaves her out.
  emitToLiveRoom(
    streamId,
    'live:message',
    { streamId, message: { ...message, isHost: userId === stream.hostId } },
    { exceptUserIds: hidden }
  );
  return message;
}

/** "about 4 more minutes", for a mute that has not run out yet. */
function minutesLeft(until: Date): string {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return minutes === 1 ? 'about 1 more minute' : `about ${minutes} more minutes`;
}

async function assertNotMuted(streamId: string, userId: string) {
  const mute = await prisma.liveStreamMute.findUnique({
    where: { streamId_userId: { streamId, userId } },
    select: { until: true },
  });
  if (mute && mute.until.getTime() > Date.now()) {
    // Said plainly, and to her alone: a mute is the host's choice, she can keep
    // watching, and she is owed a reason the chat box stopped working.
    throw new ApiError(403, `The host has muted you in this chat for ${minutesLeft(mute.until)}. You can keep watching.`);
  }
}

/**
 * Slow mode: one line from a viewer per window. The last line she wrote is the
 * clock, so it needs no state of its own. Two lines sent in the same instant can
 * both pass this read; the per-account chat throttle in front of both doors is
 * what bounds that, and a host's slow mode is a pace, not a guarantee.
 */
async function assertSlowModeAllows(stream: { id: string; slowModeSeconds: number | null }, userId: string) {
  if (!stream.slowModeSeconds) return;
  const last = await prisma.liveStreamMessage.findFirst({
    where: { streamId: stream.id, userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!last) return;
  const waitMs = last.createdAt.getTime() + stream.slowModeSeconds * 1000 - Date.now();
  if (waitMs > 0) {
    throw new ApiError(
      429,
      `Slow mode is on. You can send another message in ${Math.ceil(waitMs / 1000)} seconds.`
    );
  }
}

/**
 * The backlog a viewer sees when she opens the room. Filtered for her: someone
 * she blocked, or who blocked her, is not in it — including anyone the host
 * removed after they had already spoken, whose lines the removal deletes but
 * whose earlier presence would otherwise still be readable to everyone who
 * reloads.
 */
export async function recentMessages(streamId: string, limit = 100, viewerId?: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { hostId: true, suspendedAt: true },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  await assertStreamVisible(stream, viewerId);
  const hidden = viewerId ? await getBlockedRelationshipIds(viewerId) : [];
  const rows = await prisma.liveStreamMessage.findMany({
    where: { streamId, ...(hidden.length ? { userId: { notIn: hidden } } : {}) },
    include: { user: { select: CHAT_USER_SELECT } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });
  return rows.reverse().map((row) => ({ ...row, isHost: row.userId === stream.hostId }));
}

// ===========================================
// Host controls
// ===========================================
//
// A host had none of these. Her only answer to someone abusing her chat was to
// end the stream, which is the abuser's win. These are modelled on the group
// moderation in routes/group.routes.ts: the actor is checked first, the target
// is looked up second, and the room is told what happened so every client
// agrees on what is in the chat.

/**
 * Take one message out of the room.
 *
 * The row is deleted rather than flagged. Live chat is a transcript of a
 * moment, not a record anyone can navigate back to, and there is nothing in
 * the schema to flag it with — so a soft-delete here would mean a message that
 * is still served to everyone who reloads. What preserves the evidence is the
 * report, which copies the text out of the chat and into the moderation queue;
 * that is why the report path must not depend on the row surviving.
 */
export async function deleteChatMessage(streamId: string, messageId: string, hostId: string) {
  const stream = await loadOwnStream(streamId, hostId);

  const message = await prisma.liveStreamMessage.findUnique({
    where: { id: messageId },
    select: { id: true, streamId: true, userId: true },
  });
  if (!message || message.streamId !== stream.id) throw new ApiError(404, 'Message not found');

  await dropChatMessage(stream.id, message.id);
  return { removed: message.id };
}

/** The delete behind both a host's and a moderator's removal of one line. */
async function dropChatMessage(streamId: string, messageId: string) {
  await prisma.$transaction([
    prisma.liveStreamMessage.delete({ where: { id: messageId } }),
    // messageCount is what the stream summary reports, so a removed message
    // must stop counting; the floor keeps a stream whose count drifted from a
    // failed write from going negative.
    prisma.liveStream.updateMany({
      where: { id: streamId, messageCount: { gt: 0 } },
      data: { messageCount: { decrement: 1 } },
    }),
  ]);

  emitToLiveRoom(streamId, 'live:message_removed', { streamId, messageId });
}

/** Longest a host can silence a viewer in one go. */
export const LIVE_MUTE_MAX_MINUTES = 24 * 60;
/** Longest gap slow mode can ask for between one viewer's lines. */
export const LIVE_SLOW_MODE_MAX_SECONDS = 600;

/**
 * Silence a viewer's chat for a while without putting her out of the room.
 *
 * Removing someone is a block and lasts; this is the proportionate answer to
 * a viewer who is being a nuisance rather than abusive, and it ends by itself.
 * The mute is a row keyed by (stream, viewer), so muting again moves the end of
 * it, and `postChatMessage` reads it at the one place both doors share. She is
 * told on her own sockets, so her chat box can say why it stopped working.
 */
export async function muteViewer(streamId: string, hostId: string, targetUserId: string, minutes: number) {
  const stream = await loadOwnStream(streamId, hostId);
  if (targetUserId === hostId) throw new ApiError(400, 'You cannot mute yourself in your own stream');
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > LIVE_MUTE_MAX_MINUTES) {
    throw new ApiError(400, `Choose a mute of between 1 minute and ${LIVE_MUTE_MAX_MINUTES / 60} hours`);
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) throw new ApiError(404, 'Member not found');

  const until = new Date(Date.now() + minutes * 60_000);
  await prisma.liveStreamMute.upsert({
    where: { streamId_userId: { streamId: stream.id, userId: target.id } },
    create: { streamId: stream.id, userId: target.id, mutedById: hostId, until },
    update: { until, mutedById: hostId },
  });

  emitToUserRoom(target.id, 'live:muted', { streamId: stream.id, until: until.toISOString() });
  return { muted: target.id, until: until.toISOString() };
}

export async function unmuteViewer(streamId: string, hostId: string, targetUserId: string) {
  const stream = await loadOwnStream(streamId, hostId);
  await prisma.liveStreamMute.deleteMany({ where: { streamId: stream.id, userId: targetUserId } });
  emitToUserRoom(targetUserId, 'live:unmuted', { streamId: stream.id });
  return { unmuted: targetUserId };
}

/**
 * Slow mode on or off. `null` or 0 turns it off. The room is told, so every
 * viewer's chat box shows the pace before she is refused for going faster.
 */
export async function setSlowMode(streamId: string, hostId: string, seconds: number | null) {
  const stream = await loadOwnStream(streamId, hostId);
  if (stream.suspendedAt || stream.status === 'ENDED') throw new ApiError(409, 'This stream has ended');

  const value = seconds === null || seconds === 0 ? null : seconds;
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > LIVE_SLOW_MODE_MAX_SECONDS)) {
    throw new ApiError(400, `Slow mode can be off, or between 1 and ${LIVE_SLOW_MODE_MAX_SECONDS} seconds`);
  }

  const updated = await prisma.liveStream.update({
    where: { id: stream.id },
    data: { slowModeSeconds: value },
    include: { host: { select: HOST_SELECT } },
  });

  emitToLiveRoom(stream.id, 'live:slow_mode', { streamId: stream.id, seconds: value });
  return publicView(updated, hostId);
}

/**
 * Remove someone from the stream and keep them out.
 *
 * Removal is a block, not a stream-scoped ban, and that is the point. A ban
 * that covers one broadcast means she does it again at her next one, to the
 * same man; the block store this calls is the platform's durable answer, it is
 * symmetric, every other surface already enforces it, and she can see and undo
 * it from the Safety Center. Once it is recorded, `postChatMessage`,
 * `sendStreamGift` and the socket's `live:join` above all refuse him on their
 * own — so this function does not have to hold any state of its own to make
 * the removal stick.
 *
 * What it does do is make the removal immediate: his lines come out of the
 * chat, his sockets leave the room, and the room is told, so nobody is still
 * reading him a minute later.
 */
export async function removeViewer(streamId: string, hostId: string, targetUserId: string) {
  const stream = await loadOwnStream(streamId, hostId);
  if (targetUserId === hostId) throw new ApiError(400, 'You cannot remove yourself from your own stream');

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, displayName: true },
  });
  if (!target) throw new ApiError(404, 'Member not found');

  // Counted like any other block (services/block.service): a host removing the
  // same person from stream after stream is one of the signals a moderator is
  // shown, and she is not asked to press a second button for it.
  await applyBlock(hostId, target.id, { source: 'live-stream' });

  const removed = await prisma.liveStreamMessage.findMany({
    where: { streamId: stream.id, userId: target.id },
    select: { id: true },
  });
  if (removed.length > 0) {
    await prisma.$transaction([
      prisma.liveStreamMessage.deleteMany({ where: { id: { in: removed.map((row) => row.id) } } }),
      prisma.liveStream.updateMany({
        where: { id: stream.id, messageCount: { gte: removed.length } },
        data: { messageCount: { decrement: removed.length } },
      }),
    ]);
    for (const row of removed) {
      emitToLiveRoom(streamId, 'live:message_removed', { streamId, messageId: row.id });
    }
  }

  removeFromLiveRoom(stream.id, target.id);

  return {
    removed: target.id,
    messagesRemoved: removed.length,
    blocked: true,
  };
}

// ===========================================
// Staff controls
// ===========================================
//
// Until these, a stream that broke the rules could be stopped by one person
// only: its host. A moderator who had a report in front of her could decide it
// was upheld and then do nothing to the broadcast it was about.

/**
 * End a stream for good, on staff's say.
 *
 * It is ENDED, as when a host ends it, and also stamped as suspended, which is
 * what makes it different: it cannot be restarted, `listStreams` and
 * `getStream` stop showing it to anyone but its host, and the ingest key check
 * refuses its key, so the encoder cannot simply reconnect. The room is told it
 * ended, and the host is told it was staff who ended it. The caller records the
 * audit row; this holds no opinion about who is allowed to ask.
 *
 * Idempotent: suspending a suspended stream changes nothing, so a second
 * moderator working the same report does not overwrite who did it first.
 */
export async function suspendStream(streamId: string, staffId: string, reason: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { id: true, hostId: true, title: true, status: true, endedAt: true, suspendedAt: true },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  if (stream.suspendedAt) {
    return { id: stream.id, hostId: stream.hostId, status: stream.status, suspendedAt: stream.suspendedAt, changed: false };
  }

  const now = new Date();
  let updated: { id: string; hostId: string; status: LiveStreamStatus; suspendedAt: Date | null };
  try {
    updated = await prisma.liveStream.update({
      // The filter is what makes "who did it first" true: two moderators who both
      // read the stream as not yet suspended cannot both write, so the second
      // finds nothing to update and neither overwrites the first one's name and
      // reason nor files a second audit row.
      where: { id: streamId, suspendedAt: null },
      data: {
        status: 'ENDED',
        endedAt: stream.endedAt ?? now,
        viewerCount: 0,
        suspendedAt: now,
        suspendedById: staffId,
        suspendedReason: reason,
      },
      select: { id: true, hostId: true, status: true, suspendedAt: true },
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2025') throw error;
    return { id: stream.id, hostId: stream.hostId, status: stream.status, suspendedAt: stream.suspendedAt, changed: false };
  }

  emitToLiveRoom(streamId, 'live:status', { streamId, status: 'ENDED', suspended: true });
  emitToLiveRoom('index', 'live:index_changed', { streamId, status: 'ENDED' });

  void bestEffort('notification.livestream-suspended', () =>
    sendNotification({
      userId: stream.hostId,
      type: 'SYSTEM',
      title: 'Your live stream was ended',
      message: `Our team ended your stream "${stream.title}" because it did not meet the community guidelines. If you think this was a mistake, please contact support.`,
      link: '/live',
    })
  );

  return { ...updated, changed: true };
}

/**
 * Undo a suspension, for a decision reversed on appeal or a mistake. The stream
 * stays ENDED: the broadcast is over and the host prepares a new one. What comes
 * back is that it is listed and open again, and that its key may push again.
 */
export async function liftStreamSuspension(streamId: string) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { id: true, hostId: true, suspendedAt: true },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  if (!stream.suspendedAt) return { id: stream.id, hostId: stream.hostId, changed: false };
  await prisma.liveStream.update({
    where: { id: streamId },
    data: { suspendedAt: null, suspendedById: null, suspendedReason: null },
  });
  return { id: stream.id, hostId: stream.hostId, changed: true };
}

/**
 * Streams for the moderation console: what is live now, and what was taken
 * down. No key, no ingest URL and no playback URL: a moderator watches a
 * stream on its own page, and the key is a credential.
 */
export async function listStreamsForStaff(options: { status?: LiveStreamStatus; suspended?: boolean; limit?: number }) {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const rows = await prisma.liveStream.findMany({
    where: {
      status: options.suspended ? undefined : options.status ?? 'LIVE',
      ...(options.suspended ? { suspendedAt: { not: null } } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      viewerCount: true,
      messageCount: true,
      startedAt: true,
      endedAt: true,
      suspendedAt: true,
      suspendedReason: true,
      host: { select: { id: true, displayName: true } },
    },
    orderBy: options.suspended ? { suspendedAt: 'desc' } : [{ viewerCount: 'desc' }, { startedAt: 'desc' }],
    take: limit,
  });
  return rows.map((row) => ({
    ...row,
    viewerCount: row.status === 'LIVE' ? Math.max(row.viewerCount, liveRoomSize(row.id)) : 0,
  }));
}

/**
 * Take one line out of a room because a report about it was upheld. Quiet when
 * it is already gone — the host may have deleted it, which is the common case —
 * because the report holds its own copy of the words.
 */
export async function removeChatMessageAsStaff(messageId: string): Promise<boolean> {
  const message = await prisma.liveStreamMessage.findUnique({
    where: { id: messageId },
    select: { id: true, streamId: true },
  });
  if (!message) return false;
  await dropChatMessage(message.streamId, message.id);
  return true;
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
  return { balance, valueAud: balance * GIFT_POINT_VALUE_AUD };
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
  if (await isBlockedRelationship(senderId, stream.hostId)) {
    throw new ApiError(403, 'You cannot take part in this stream.');
  }
  // The gift names its sender to the whole room, so it is kept from anyone who
  // blocked her or whom she blocked, as a chat line is. Read before any money
  // moves, so a failure here costs her nothing.
  const hidden = await getBlockedRelationshipIds(senderId);

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, displayName: true, giftBalance: true },
  });
  // A cheap early exit, and nothing more than that. It used to be the only
  // check, and it cannot be: gift points are bought with real money, and
  // between this read and the debit below sits a follower count — a whole
  // database round trip — during which a second request can read the same
  // balance and spend it again. Two gifts, one balance, and the creator's
  // share of both lands in pendingPayout and leaves as a real Stripe transfer.
  if (!sender || sender.giftBalance < gift.value) {
    throw new ApiError(402, 'Not enough gift points. Top up to send this gift.');
  }

  const followerCount = await prisma.follow.count({ where: { followingId: stream.hostId } });
  const tier = getCreatorTier(followerCount);
  const creatorShare = Math.floor(gift.value * (tier.revShare / 100));
  const platformShare = gift.value - creatorShare;

  // The interactive form, so a refused debit rolls back the sibling writes
  // instead of recording a gift nobody paid for.
  const { transaction, updatedStream, balance } = await prisma.$transaction(async (tx) => {
    // The debit is the guard. A conditional updateMany makes the balance test
    // and the decrement one atomic statement, so of two racing gifts exactly
    // one finds points to take and the other gets a clean 402 — where before,
    // both took them and the balance went negative.
    const debit = await tx.user.updateMany({
      where: { id: senderId, giftBalance: { gte: gift.value } },
      data: { giftBalance: { decrement: gift.value } },
    });
    if (debit.count === 0) {
      throw new ApiError(402, 'Not enough gift points. Top up to send this gift.');
    }

    const created = await tx.giftTransaction.create({
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
    });
    const credited = await tx.liveStream.update({
      where: { id: streamId },
      data: { totalGiftPoints: { increment: gift.value } },
      select: { totalGiftPoints: true },
    });
    await tx.creatorProfile.updateMany({
      where: { userId: stream.hostId },
      data: { totalEarnings: { increment: creatorShare }, pendingPayout: { increment: creatorShare } },
    });
    // Read back rather than subtracting from the stale figure above, which
    // reported a balance that was already wrong whenever anything else had
    // touched the wallet since.
    const after = await tx.user.findUnique({ where: { id: senderId }, select: { giftBalance: true } });

    return { transaction: created, updatedStream: credited, balance: after?.giftBalance ?? 0 };
  });

  const payload = {
    streamId,
    gift: { id: gift.id, name: gift.name, icon: gift.icon, value: gift.value },
    sender: { id: sender.id, displayName: sender.displayName },
    message: message ?? null,
    totalGiftPoints: updatedStream.totalGiftPoints,
    at: transaction.createdAt,
  };
  emitToLiveRoom(streamId, 'live:gift', payload, { exceptUserIds: hidden });

  // Not awaited, and that part was always right: the gift transaction has
  // committed, the sender's balance is already down and the room has already
  // seen the animation, so a notification that will not send must not turn a
  // successful gift into a 500. It was `.catch(() => {})` that was wrong. This
  // call is how the host learns she earned something, and when it failed she
  // was simply never told and no line anywhere recorded that anyone had tried,
  // which is unanswerable when she asks why a gift she can see in the
  // leaderboard never reached her notifications. startStream above already logs
  // its own fire-and-forget notification failure; these two now agree. No
  // fallback, because nothing reads the result.
  void bestEffort('notification.livestream-gift-received', () =>
    sendNotification({
      userId: stream.hostId,
      type: 'GIFT_RECEIVED',
      title: `You received a ${gift.name}!`,
      message: `${sender.displayName || 'Someone'} sent ${gift.icon} ${gift.name} during your live stream`,
      link: `/live/${streamId}`,
    })
  );

  return { transaction, totalGiftPoints: updatedStream.totalGiftPoints, balance };
}

export async function giftLeaderboard(streamId: string, limit = 10, viewerId?: string) {
  // The board names the people who gifted, so it is held to the same rule as the
  // room it belongs to: a stream staff took down is the host's alone, across a
  // block with the host it does not exist, and someone she blocked (or who
  // blocked her) is not on her board.
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { hostId: true, suspendedAt: true },
  });
  if (!stream) throw new ApiError(404, 'Stream not found');
  await assertStreamVisible(stream, viewerId);
  const hidden = viewerId ? await getBlockedRelationshipIds(viewerId) : [];

  const rows = await prisma.giftTransaction.groupBy({
    by: ['senderId'],
    where: { streamId, ...(hidden.length ? { senderId: { notIn: hidden } } : {}) },
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
