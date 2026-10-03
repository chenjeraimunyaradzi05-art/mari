/**
 * Who may put a file in a conversation, and who may read one out of it.
 *
 * The key of a chat file names the conversation it was sent in and the member
 * who sent it (utils/chat-attachments), so these questions are answered from the
 * key and the two tables that already say who is in a conversation: nothing new
 * is stored, and nothing about a file has to be kept in step with the thread.
 *
 * Writing a file is held to what sending a message is held to, because a file is
 * a message that has not been sent yet: she has to be in the thread, a request
 * she has run out of messages on or one that was declined takes no more, a block
 * on either side closes the door, and a group's mute and ban apply. Reading is
 * held to being in the thread now, not having been: a member who has left a group
 * or been removed from it reads nothing more from it, and a file sent by someone
 * on either side of a block with her is not hers to open, as the thread no longer
 * shows her that person's messages. And it is held to the message still being on
 * the thread (isCarriedByLiveMessage): a file goes with its message, except
 * behind a message somebody reported, which is kept for the people deciding the
 * report (services/chat-attachment-cleanup), and a member who could still open a
 * key after unsending its message would learn from whether the file was there
 * that it had been reported, which in a thread of two says by whom.
 *
 * Every refusal to read is the same "not found", so a key is not a way to learn
 * which conversations exist, who is in them, or what has been reported.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { isStaffRole, staffTwoFactorRefusal } from '../middleware/roles';
import { isBlockedEitherWay } from './audience.service';
import { assertCanSendInConversation } from './direct-message.service';
import { groupChatService } from './group-chat.service';
import { unexpiredMessageWhere } from './message-expiry.service';
import { isChatSegment, parseChatKey } from '../utils/chat-attachments';

/** One value out of a query string, which may arrive as text, a list, or not at all. */
function oneValue(raw: unknown): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * The conversation or group a file is being uploaded for, once she is allowed to
 * send in it. Throws the refusal otherwise. Asked before the file is read, so
 * nobody who cannot send here has a file buffered on the server's behalf.
 */
export async function resolveChatUploadScope(
  userId: string,
  target: { conversationId?: unknown; groupId?: unknown }
): Promise<string> {
  const conversationId = oneValue(target.conversationId);
  const groupId = oneValue(target.groupId);

  if (Boolean(conversationId) === Boolean(groupId)) {
    throw new ApiError(400, 'Say which conversation the file is for.');
  }

  if (conversationId) {
    if (!isChatSegment(conversationId)) throw new ApiError(404, 'Conversation not found');
    const { receiverId } = await assertCanSendInConversation(conversationId, userId);
    if (await isBlockedEitherWay(userId, receiverId)) {
      throw new ApiError(403, 'You cannot message this user');
    }
    return conversationId;
  }

  if (!isChatSegment(groupId)) throw new ApiError(404, 'Group not found');
  const policy = await groupChatService.canSendMessage(groupId, userId);
  if (!policy.allowed) {
    throw new ApiError(403, policy.reason || 'You are not allowed to send messages in this group');
  }
  return groupId;
}

/** Whether she is in the conversation, or an active member of the group, that this id names. */
export async function isInChat(scopeId: string, userId: string): Promise<boolean> {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: scopeId, userId } },
    select: { id: true },
  });
  if (participant) return true;

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: scopeId, userId } },
    select: { isBanned: true },
  });
  return Boolean(member && !member.isBanned);
}

/**
 * Whether a message still on the thread carries this file: sent by the member
 * the key names, in the conversation it names, not unsent, and not past a
 * disappearing timer the sweep has yet to reach. Unsending takes the files off
 * the row (routes/message.routes, services/chat-storage) and the sweep deletes
 * the row, so a key no live message carries is a file that is gone, or one that
 * is kept behind a report and is nobody's to open but the staff deciding it.
 */
export async function isCarriedByLiveMessage(key: string, now: Date = new Date()): Promise<boolean> {
  const parsed = parseChatKey(key);
  if (!parsed) return false;
  const carried = await prisma.message.findFirst({
    where: {
      AND: [
        {
          conversationId: parsed.scopeId,
          senderId: parsed.senderId,
          deletedAt: null,
          metadata: { path: ['attachments'], array_contains: [{ key }] },
        },
        unexpiredMessageWhere(now),
      ],
    },
    select: { id: true },
  });
  return Boolean(carried);
}

/**
 * Whether this member may open the file under this key right now: she is in the
 * thread, no block stands between her and the sender, and a message on the
 * thread still carries the file (the sender included: her own unsent file is not
 * hers to probe for, see the note at the top).
 *
 * A failure to read the block lists is an error, not "allowed": a file is
 * opened or it is not, and guessing wrong is a photograph in the wrong hands.
 */
export async function mayReadChatAttachment(key: string, userId: string): Promise<boolean> {
  const parsed = parseChatKey(key);
  if (!parsed) return false;
  if (!(await isInChat(parsed.scopeId, userId))) return false;
  if (parsed.senderId !== userId && (await isBlockedEitherWay(userId, parsed.senderId))) return false;
  return isCarriedByLiveMessage(key);
}

/** Where a report's copy of the reported message lists its files (services/report-context). */
const REPORTED_ATTACHMENTS_PATH = ['messageContext', 'reported', 'attachments'];

/**
 * Whether a report on a message names this file in its copy of that message.
 *
 * The copy is taken when the report is filed, so this holds after the message
 * is unsent or swept, which is exactly when the file behind it is kept for the
 * people deciding the report (services/chat-attachment-cleanup). Only the
 * reported message counts, not the lines copied before it for context: those
 * files go with their own messages and are nobody's evidence.
 */
export async function isReportedChatAttachment(key: string): Promise<boolean> {
  if (!parseChatKey(key)) return false;
  const report = await prisma.contentReport.findFirst({
    where: {
      contentType: { equals: 'message', mode: 'insensitive' },
      evidence: { path: REPORTED_ATTACHMENTS_PATH, array_contains: [{ key }] },
    },
    select: { id: true },
  });
  return Boolean(report);
}

/** Who is asking to read a file: the signed-in principal, as the auth middleware fills it in. */
export type Reader = { id: string; role?: string; twoFactorEnabled?: boolean };

/**
 * Whether a member of staff may open this file although she is not in the
 * conversation: only when a report names it, and only with the second factor
 * every staff power is behind (middleware/roles). The file is the thing a
 * moderator has to look at to decide a report on a picture, and the message it
 * came with is usually gone by then. A staff account is given nothing else
 * under the chat folder: a conversation nobody has reported is not hers to read.
 */
export async function mayStaffReadChatAttachment(reader: Reader, key: string): Promise<boolean> {
  if (!isStaffRole(reader.role) || staffTwoFactorRefusal(reader) !== null) return false;
  return isReportedChatAttachment(key);
}
