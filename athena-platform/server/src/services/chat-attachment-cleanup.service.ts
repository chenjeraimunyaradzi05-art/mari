/**
 * Removing the files behind messages that are gone.
 *
 * A disappearing message was deleted from the table and its picture stayed in
 * the bucket, at the same address, for good. So did the file behind a message a
 * member unsent, and behind every message of a member whose account was erased.
 * "It disappears" and "it is deleted" were true of the row and not of the thing
 * the row pointed at, which is what a person who had been sent a photograph, or
 * who sent one, would want gone.
 *
 * What is removed is only what this server wrote under the chat folder, named by
 * a key on the message (utils/chat-attachments): never a link, so a message that
 * carried somebody else's public picture cannot be turned into a way of deleting
 * it.
 *
 * What is kept is the file behind a message somebody reported. A report keeps its
 * own copy of the words and the names of the files (services/report-context), but
 * the picture a moderator has to look at to decide is the file, and the sender
 * unsending it a minute after it was reported is exactly when it would otherwise
 * go. It is kept for the people deciding the report, who reach it through the
 * report (routes/admin.routes) and nowhere else.
 *
 * Every call is best effort and none throws: this runs after the row is gone, in
 * a sweep, in the middle of an erasure, or behind a member pressing unsend, and a
 * bucket that is slow or refusing must not turn a deletion that happened into an
 * error. A failure is counted, so a bucket that has started refusing every delete
 * shows on the ops screen.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { recordFailure } from '../utils/ops-metrics';
import { deleteStoredKey } from '../utils/media-storage';
import { chatAttachmentKeys } from '../utils/chat-attachments';

/** How many files are removed at once: enough to clear a batch, few enough not to flood the bucket. */
const CONCURRENCY = 8;

/** The files a message carried, with the message they belong to. */
export interface MessageWithFiles {
  id: string;
  metadata: unknown;
}

/**
 * Which of these messages somebody has reported. A lookup that fails answers
 * "all of them": a file left behind is the lesser harm.
 */
async function reportedMessageIds(ids: string[]): Promise<Set<string>> {
  try {
    const rows = await prisma.contentReport.findMany({
      where: { contentType: { equals: 'message', mode: 'insensitive' }, contentId: { in: ids } },
      select: { contentId: true },
    });
    return new Set(rows.map((row) => row.contentId));
  } catch (error) {
    recordFailure('chat-attachment-cleanup.report-lookup', error);
    logger.warn('Chat files kept: which messages are reported could not be read', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set(ids);
  }
}

/**
 * Removes the files behind these messages, except behind one that has been
 * reported. Call it after the rows are gone (or their attachments cleared), with
 * what they held read beforehand. Returns how many files were removed.
 */
export async function deleteChatAttachmentFiles(messages: ReadonlyArray<MessageWithFiles>): Promise<number> {
  try {
    const withFiles = messages
      .map((message) => ({ id: message.id, keys: chatAttachmentKeys(message.metadata) }))
      .filter((message) => message.keys.length > 0);
    if (withFiles.length === 0) return 0;

    const kept = await reportedMessageIds(withFiles.map((message) => message.id));
    const keys = [...new Set(withFiles.filter((message) => !kept.has(message.id)).flatMap((message) => message.keys))];

    let removed = 0;
    for (let start = 0; start < keys.length; start += CONCURRENCY) {
      const results = await Promise.all(keys.slice(start, start + CONCURRENCY).map((key) => deleteStoredKey(key)));
      removed += results.filter(Boolean).length;
    }
    return removed;
  } catch (error) {
    recordFailure('chat-attachment-cleanup', error);
    logger.warn('Chat files could not be removed', { error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}

/**
 * The messages of a member's that carry files, for her erasure: what she sent and
 * what she was sent, since an erasure removes both rows (the register in
 * services/gdpr). Read before the rows go, and given back to
 * deleteChatAttachmentFiles once they have. Never throws: an erasure is not held
 * up by a bucket, and a file it could not list is a file left, counted.
 */
export async function chatFilesOfMember(userId: string): Promise<MessageWithFiles[]> {
  try {
    const found: MessageWithFiles[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await prisma.message.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
          type: { in: ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'] },
        },
        select: { id: true, metadata: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      });
      found.push(...page);
      if (page.length < 500) break;
      after = page[page.length - 1].id;
    }
    return found;
  } catch (error) {
    recordFailure('chat-attachment-cleanup.member-lookup', error);
    logger.warn('A member’s chat files could not be listed for her erasure', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
