/**
 * Noticing someone who keeps messaging women who do not want it.
 *
 * The message-request gate limits what a stranger can do to one woman: three
 * lines, then silence until she answers, and a decline closes the thread. It
 * says nothing about the stranger who does it to everyone. Each woman's decline,
 * each block and each report was recorded and read only for what it did to that
 * one thread; nothing counted them against the person on the other end, so an
 * account could open requests to a new woman every day, be declined by all of
 * them, and never come to a moderator's notice.
 *
 * This counts, over a short window, how many different women declined a request
 * from the same account, blocked her after one, or reported her messages, and
 * puts her in front of a moderator when it is several. It does not restrict the
 * account on its own: a count of other people's clicks is a signal for a person
 * to look at, and acting on it automatically would hand anyone the means to
 * silence a woman by arranging a few declines.
 *
 * The queue is the safety-concern queue staff already work (AdminFlag, raised
 * under the name 'system' as the safety score does), so there is no new table
 * and nothing new for a moderator to learn to open.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { notifyAdmins } from './admin-notify.service';

export const UNWANTED_CONTACT_FLAG = 'UNWANTED_CONTACT';
export const UNWANTED_CONTACT_WINDOW_DAYS = 7;
/** Different women, across all three signals, before a moderator is asked to look. */
export const UNWANTED_CONTACT_THRESHOLD = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Requests one pass will read for one account; far above what the hourly limit allows in a week. */
const REQUEST_SCAN_LIMIT = 300;

export interface UnwantedContactSignal {
  declined: number;
  blockedAfterRequest: number;
  reported: number;
  /** Different members across the three, so one woman who declined and then blocked counts once. */
  members: number;
  since: Date;
}

export async function unwantedContactSignal(senderId: string, now: Date = new Date()): Promise<UnwantedContactSignal> {
  const since = new Date(now.getTime() - UNWANTED_CONTACT_WINDOW_DAYS * DAY_MS);

  const opened = await prisma.conversation.findMany({
    where: { requestedById: senderId, createdAt: { gte: since } },
    select: { requestDeclinedAt: true, participants: { select: { userId: true } } },
    orderBy: { createdAt: 'desc' },
    take: REQUEST_SCAN_LIMIT,
  });

  const asked: string[] = [];
  const declined: string[] = [];
  for (const conversation of opened) {
    const other = conversation.participants.find((participant) => participant.userId !== senderId)?.userId;
    if (!other) continue;
    asked.push(other);
    if (conversation.requestDeclinedAt) declined.push(other);
  }

  // Blocks carry no date of their own (they are an array on the safety
  // settings), so they are counted among the women this account opened a thread
  // with inside the window: those who then blocked her are the ones the window
  // is about.
  const blockers = asked.length
    ? await prisma.userSafetySettings.findMany({
        where: { userId: { in: asked }, blockedUsers: { has: senderId } },
        select: { userId: true },
      })
    : [];

  const reporters = await prisma.contentReport.findMany({
    where: { reportedUserId: senderId, createdAt: { gte: since }, contentType: { in: ['MESSAGE', 'USER'] } },
    select: { reporterId: true },
    distinct: ['reporterId'],
    take: 100,
  });

  const members = new Set<string>([
    ...declined,
    ...blockers.map((row) => row.userId),
    ...reporters.map((row) => row.reporterId),
  ]);

  return {
    declined: new Set(declined).size,
    blockedAfterRequest: blockers.length,
    reported: reporters.length,
    members: members.size,
    since,
  };
}

/**
 * Called when a request is declined, when someone blocks, and when a message or
 * a member is reported — the three things the count is made of. Raises one open
 * flag per account at a time: while a moderator has not closed the last one,
 * more declines add nothing she has not already been told.
 *
 * Returns whether a flag was raised. Never throws: it runs after the decline or
 * the block has been recorded, and the person who pressed the button is owed
 * that outcome whatever this does.
 */
export async function reviewUnwantedContact(senderId: string, now: Date = new Date()): Promise<boolean> {
  try {
    const signal = await unwantedContactSignal(senderId, now);
    if (signal.members < UNWANTED_CONTACT_THRESHOLD) return false;

    const open = await prisma.adminFlag.findFirst({
      where: { userId: senderId, type: UNWANTED_CONTACT_FLAG, resolvedAt: null },
      select: { id: true },
    });
    if (open) return false;

    const flag = await prisma.adminFlag.create({
      data: {
        userId: senderId,
        type: UNWANTED_CONTACT_FLAG,
        severity: 'MEDIUM',
        flaggedById: 'system',
        reason: `${signal.members} members declined, blocked or reported this account's message requests in ${UNWANTED_CONTACT_WINDOW_DAYS} days`,
        notes: [
          `Requests declined: ${signal.declined}`,
          `Blocked after a request: ${signal.blockedAfterRequest}`,
          `Reported (messages or the member): ${signal.reported}`,
          `Since ${signal.since.toISOString()}. Counts are of different members; open the member's reports for the messages themselves.`,
        ].join('\n'),
      },
    });

    // No member named: the notice goes to every admin's inbox, and who it is
    // about belongs behind the staff role in the queue it points to.
    await notifyAdmins({
      title: 'A member may be sending unwanted messages',
      message: 'Several members have declined, blocked or reported one account’s message requests. It is waiting in the safety queue.',
      link: '/admin/moderation#safety-concerns',
      data: { flagId: flag.id, flagType: UNWANTED_CONTACT_FLAG, severity: 'MEDIUM' },
    });

    logger.warn('Unwanted-contact pattern flagged', { userId: senderId, flagId: flag.id, members: signal.members });
    return true;
  } catch (error) {
    logger.error('Unwanted-contact review failed', {
      userId: senderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
