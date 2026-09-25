/**
 * Disappearing messages.
 *
 * The setting lives on the conversation (a TTL in seconds, or null for off).
 * Every message sent while it is on is stamped with its own expiresAt, so a
 * later change never retroactively deletes or resurrects anything. Reads
 * filter expired rows out immediately; a sweep deletes them for real every
 * minute and tells both participants which ids to drop, so an open thread
 * loses the message at the same moment the database does.
 *
 * The same timer also sweeps expired stories (services/story-expiry). They
 * are a different feature with the same promise — content the platform told a
 * member would be gone by a certain time — and the promise was being kept for
 * messages and not for stories. Rather than add a second interval and a
 * second lock for work that takes milliseconds, the one sweeper does both.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { emitToUserRoom } from './socket.service';
import { runExclusively } from '../utils/redis';
import { sweepExpiredStories } from './story-expiry.service';

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
 *
 * Everything after the delete used to run a query per row: a participant
 * lookup for each conversation, then an unread count and an update for each
 * participant of each conversation. A batch that cleared 500 messages spread
 * over 200 threads therefore issued over a thousand round trips on a timer
 * nobody is watching, and it got worse as the platform grew. It is now two
 * reads and one write per batch, with the same arithmetic done in memory.
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

    if (byConversation.size > 0) {
      const conversationIds = [...byConversation.keys()];

      const [participants, unreadBySender] = await Promise.all([
        prisma.conversationParticipant.findMany({
          where: { conversationId: { in: conversationIds } },
          select: { id: true, userId: true, conversationId: true },
        }),
        // A participant's unread count is everything still unread in the thread
        // that somebody else sent, so one count grouped by sender answers it for
        // every participant of every affected thread at once. This runs after
        // the delete above, so the rows that just vanished are already gone.
        prisma.message.groupBy({
          by: ['conversationId', 'senderId'],
          where: { conversationId: { in: conversationIds }, isRead: false },
          _count: { _all: true },
        }),
      ]);

      const unreadInThread = new Map<string, number>();
      const unreadFromSender = new Map<string, number>();
      for (const row of unreadBySender) {
        if (!row.conversationId) continue;
        const count = row._count._all;
        unreadInThread.set(row.conversationId, (unreadInThread.get(row.conversationId) ?? 0) + count);
        unreadFromSender.set(`${row.conversationId}:${row.senderId}`, count);
      }

      const participantsByConversation = new Map<string, typeof participants>();
      for (const participant of participants) {
        const list = participantsByConversation.get(participant.conversationId) ?? [];
        list.push(participant);
        participantsByConversation.set(participant.conversationId, list);
      }

      // Participants that land on the same count share one updateMany, so the
      // usual sweep — where everyone ends on nothing unread — is a single
      // statement. updateMany also shrugs at a participant who left the thread
      // mid-sweep, where update would have thrown and abandoned the rest.
      const idsByUnread = new Map<number, string[]>();
      const notices: Array<{ userId: string; conversationId: string; messageIds: string[] }> = [];

      for (const [conversationId, messageIds] of byConversation) {
        for (const participant of participantsByConversation.get(conversationId) ?? []) {
          const unread =
            (unreadInThread.get(conversationId) ?? 0) -
            (unreadFromSender.get(`${conversationId}:${participant.userId}`) ?? 0);
          const ids = idsByUnread.get(unread) ?? [];
          ids.push(participant.id);
          idsByUnread.set(unread, ids);
          notices.push({ userId: participant.userId, conversationId, messageIds });
        }
      }

      if (idsByUnread.size > 0) {
        await prisma.$transaction(
          [...idsByUnread].map(([unread, ids]) =>
            prisma.conversationParticipant.updateMany({
              where: { id: { in: ids } },
              data: { unreadCount: unread, hasUnread: unread > 0 },
            })
          )
        );
      }

      // The emission stays one call per participant: it goes to that person's
      // own socket room, so there is nothing to group. It still happens after
      // the counts are written, the order the per-row version used.
      for (const notice of notices) {
        emitToUserRoom(notice.userId, 'messages:expired', {
          conversationId: notice.conversationId,
          messageIds: notice.messageIds,
        });
      }
    }

    if (expired.length < SWEEP_BATCH) break;
  }

  if (removed > 0) {
    logger.info('Expired messages removed', { removed });
  }
  return removed;
}

/**
 * Runs the expiry sweeps on an interval. Returns a function that stops it.
 *
 * Messages and stories are swept in sequence under the one lock. Stories go
 * second and in their own try, so a story sweep that throws — a bucket
 * refusing deletes, say — never stops messages from being deleted on time.
 */
export function startMessageExpirySweeper(intervalMs = 60_000): () => void {
  const run = () =>
    runExclusively(
      'message-expiry',
      async () => {
        const messages = await sweepExpiredMessages();
        try {
          await sweepExpiredStories();
        } catch (error) {
          logger.error('Story expiry sweep failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return messages;
      },
      5 * 60 * 1000
    ).catch((error) => {
      logger.error('Message expiry sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  void run();
  return () => clearInterval(timer);
}
