/**
 * Disappearing messages.
 *
 * The setting lives on the conversation (a TTL in seconds, or null for off).
 * Every message sent while it is on is stamped with its own expiresAt, so a
 * later change never retroactively deletes or resurrects anything. Reads
 * filter expired rows out immediately; a sweep deletes them for real every
 * minute and tells both participants which ids to drop, so an open thread
 * loses the message at the same moment the database does.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { emitToUserRoom } from './socket.service';

/** 1 hour, 24 hours, 7 days, 90 days. */
export const DISAPPEARING_TTL_OPTIONS = [3600, 86400, 604800, 7776000] as const;

const SWEEP_BATCH = 500;

export function isAllowedTtl(value: unknown): value is number | null {
  if (value === null) return true;
  return typeof value === 'number' && (DISAPPEARING_TTL_OPTIONS as readonly number[]).includes(value);
}

export function ttlLabel(ttl: number | null): string {
  switch (ttl) {
    case 3600:
      return '1 hour';
    case 86400:
      return '24 hours';
    case 604800:
      return '7 days';
    case 7776000:
      return '90 days';
    default:
      return 'off';
  }
}

/** The expiresAt for a message sent now under this TTL; undefined when off. */
export function expiryFor(ttl: number | null | undefined, now = new Date()): Date | undefined {
  if (!ttl || ttl <= 0) return undefined;
  return new Date(now.getTime() + ttl * 1000);
}

/** Prisma filter that hides rows past their expiry before the sweep runs. */
export function unexpiredMessageWhere(now = new Date()) {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

export async function conversationTtl(conversationId: string): Promise<number | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { disappearingTtlSeconds: true },
  });
  return conversation?.disappearingTtlSeconds ?? null;
}

/**
 * Turns disappearing messages on (with a TTL) or off for a thread. Either
 * participant may do it, and a system message records who, so the other
 * person is told rather than discovering messages have started vanishing.
 */
export async function setDisappearingTtl(conversationId: string, userId: string, ttl: number | null) {
  if (!isAllowedTtl(ttl)) {
    throw new ApiError(400, 'Choose off, 1 hour, 24 hours, 7 days or 90 days');
  }

  const participation = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (!participation) {
    throw new ApiError(403, 'Not a participant of this conversation');
  }

  const [actor, participants] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, firstName: true, lastName: true },
    }),
    prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    }),
  ]);
  const actorName =
    actor?.displayName?.trim() ||
    [actor?.firstName, actor?.lastName].filter(Boolean).join(' ').trim() ||
    'Someone';
  const otherIds = participants.map((p) => p.userId).filter((id) => id !== userId);

  const content = ttl
    ? `${actorName} turned on disappearing messages. New messages disappear after ${ttlLabel(ttl)}.`
    : `${actorName} turned off disappearing messages.`;

  const [, notice] = await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversationId },
      data: { disappearingTtlSeconds: ttl, lastMessageAt: new Date() },
    }),
    // The notice itself never expires: it is the record of the change.
    prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        receiverId: otherIds[0],
        content,
        type: 'SYSTEM',
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    }),
  ]);

  const payload = { conversationId, disappearingTtlSeconds: ttl, changedBy: userId };
  for (const participantId of participants.map((p) => p.userId)) {
    emitToUserRoom(participantId, 'messages:settings', payload);
    emitToUserRoom(participantId, 'messages:new', notice);
  }

  return { conversationId, disappearingTtlSeconds: ttl, message: notice };
}

/**
 * Deletes every message past its expiry, in batches, and tells both sides of
 * each affected thread which ids are gone. Unread counts are re-derived for
 * those threads, since a message that vanished unread must not stay counted.
 */
export async function sweepExpiredMessages(now = new Date()): Promise<number> {
  let removed = 0;

  for (;;) {
    const expired = await prisma.message.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, conversationId: true },
      take: SWEEP_BATCH,
    });
    if (expired.length === 0) break;

    await prisma.message.deleteMany({ where: { id: { in: expired.map((m) => m.id) } } });
    removed += expired.length;

    const byConversation = new Map<string, string[]>();
    for (const message of expired) {
      if (!message.conversationId) continue;
      const list = byConversation.get(message.conversationId) ?? [];
      list.push(message.id);
      byConversation.set(message.conversationId, list);
    }

    for (const [conversationId, messageIds] of byConversation) {
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { id: true, userId: true },
      });

      for (const participant of participants) {
        const unread = await prisma.message.count({
          where: { conversationId, senderId: { not: participant.userId }, isRead: false },
        });
        await prisma.conversationParticipant.update({
          where: { id: participant.id },
          data: { unreadCount: unread, hasUnread: unread > 0 },
        });
        emitToUserRoom(participant.userId, 'messages:expired', { conversationId, messageIds });
      }
    }

    if (expired.length < SWEEP_BATCH) break;
  }

  if (removed > 0) {
    logger.info('Expired messages removed', { removed });
  }
  return removed;
}

/** Runs the sweep on an interval. Returns a function that stops it. */
export function startMessageExpirySweeper(intervalMs = 60_000): () => void {
  const run = () =>
    sweepExpiredMessages().catch((error) => {
      logger.error('Message expiry sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  void run();
  return () => clearInterval(timer);
}
