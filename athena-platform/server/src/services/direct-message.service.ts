import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { bestEffort } from '../utils/best-effort';
import { logger } from '../utils/logger';
import { isBlockedEitherWay } from './audience.service';
import { normalizeMessageAttachments } from '../utils/contentSafety';
import { requireChatAttachments, type StoredChatAttachment } from '../utils/chat-attachments';
import { messageTypeForAttachments } from './chat-storage.service';
import { canOpenConversation } from './message-permissions.service';
import { assertContentAllowed } from './moderation.service';
import { conversationTtl, expiryFor } from './message-expiry.service';
// socket.service imports this file too; the cycle resolves at call time, as it
// already does for livestream.service and message-expiry.service.
import { sendRealTimeMessage } from './socket.service';
import { maskLegalNames } from '../utils/member-display';

// How many messages the opener of a message request may send before the other
// person accepts. Enough to say who you are and why; not enough to flood.
export const MESSAGE_REQUEST_LIMIT = 3;

export async function assertCanMessageUser(senderId: string, receiverId: string) {
  if (senderId === receiverId) {
    throw new ApiError(400, 'Cannot message yourself');
  }

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true, allowMessages: true },
  });

  if (!receiver) {
    throw new ApiError(404, 'User not found');
  }

  if (!receiver.allowMessages) {
    throw new ApiError(403, 'This user is not accepting messages');
  }

  return receiver;
}

export async function findDirectConversation(userIdA: string, userIdB: string): Promise<string | null> {
  const conversations = await prisma.conversation.findMany({
    where: {
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
      ],
    },
    select: {
      id: true,
      participants: { select: { userId: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const participantSet = new Set([userIdA, userIdB]);
  const directConversation = conversations.find((conversation) => {
    const participants = conversation.participants.map((participant) => participant.userId);
    return participants.length === 2 && participants.every((participantId) => participantSet.has(participantId));
  });

  return directConversation?.id ?? null;
}

export async function getOrCreateDirectConversation(senderId: string, receiverId: string) {
  await assertCanMessageUser(senderId, receiverId);

  const existingConversationId = await findDirectConversation(senderId, receiverId);
  if (existingConversationId) {
    return { id: existingConversationId, isNew: false, isRequest: false };
  }

  // A thread opened by someone the recipient does not follow is a request: it
  // waits in their Requests tab until they accept it.
  const receiverFollowsSender = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: receiverId, followingId: senderId } },
    select: { followerId: true },
  });
  const isRequest = !receiverFollowsSender;

  const conversation = await prisma.conversation.create({
    data: {
      requestedById: isRequest ? senderId : null,
      participants: {
        create: [
          { userId: senderId },
          { userId: receiverId },
        ],
      },
    },
    select: { id: true },
  });

  return { id: conversation.id, isNew: true, isRequest };
}

/**
 * The request state of a thread from one participant's side. isRequest: this
 * person is being asked. requestPending: this person asked and is waiting.
 * requestDeclined: the answer was no.
 */
export function requestStateFor(
  conversation: { requestedById: string | null; requestAcceptedAt: Date | null; requestDeclinedAt: Date | null },
  viewerId: string
) {
  const pending = Boolean(conversation.requestedById) && !conversation.requestAcceptedAt && !conversation.requestDeclinedAt;
  return {
    isRequest: pending && conversation.requestedById !== viewerId,
    requestPending: pending && conversation.requestedById === viewerId,
    requestDeclined: Boolean(conversation.requestDeclinedAt),
  };
}

/**
 * Whether the person who asked is kept from learning that her messages were read.
 *
 * The request banner tells the person who was asked that the other "cannot see
 * when you read them", and that has to be true everywhere a read state leaves
 * the server: the socket's read receipt, and the `isRead` and `readAt` of the
 * thread and of the inbox list. Until the request is accepted (or while it is
 * declined, which is never accepted), the opener learns neither that her message
 * was opened nor when, so a stranger cannot tell that the woman she wrote to is
 * online and looking.
 *
 * `viewerId` is whoever is about to be told: true for the opener of a request
 * that has not been accepted, false for everyone else.
 */
export function readReceiptsWithheldFrom(
  conversation: { requestedById?: string | null; requestAcceptedAt?: Date | null } | null | undefined,
  viewerId: string
): boolean {
  return Boolean(conversation?.requestedById) && conversation?.requestedById === viewerId && !conversation?.requestAcceptedAt;
}

/**
 * Which of these members have switched read receipts off.
 *
 * "Read receipts" in her message settings promises that the people who write to
 * her are not told when she has read them. The live receipt honoured that, but
 * the two reads that serve the same fact afterwards did not: the thread
 * (isRead and readAt on every message) and the inbox list (the last message's
 * isRead) came straight from the row, and the sender's client turned them into
 * the "read" tick on every refetch. The switch hid the tick for a moment and
 * the next reload put it back, so the caller of those two reads asks here, and
 * withholds what she asked to be withheld.
 *
 * If her settings cannot be read, she is counted as having hidden them, as the
 * live receipt does: a tick she asked to withhold is worse than one that is
 * missing.
 */
export async function readersHidingReceipts(readerIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(readerIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  try {
    const rows = await prisma.userSafetySettings.findMany({
      where: { userId: { in: ids }, hideReadReceipts: true },
      select: { userId: true },
    });
    return new Set(rows.map((row) => row.userId));
  } catch (error) {
    logger.warn('Read receipts withheld: safety settings unreadable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set(ids);
  }
}

export async function assertCanSendInConversation(conversationId: string, senderId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const participantIds = conversation.participants.map((participant) => participant.userId);
  if (!participantIds.includes(senderId)) {
    throw new ApiError(403, 'Not a participant');
  }

  if (participantIds.length !== 2) {
    throw new ApiError(400, 'Use the group chat endpoint for group messages');
  }

  const receiverId = participantIds.find((participantId) => participantId !== senderId);
  if (!receiverId) {
    throw new ApiError(500, 'Recipient not found');
  }

  await assertCanMessageUser(senderId, receiverId);

  // The opener of a request gets a few messages to introduce themselves, then
  // waits. A declined request is closed to them for good.
  if (conversation.requestedById === senderId && !conversation.requestAcceptedAt) {
    if (conversation.requestDeclinedAt) {
      throw new ApiError(403, 'They declined your message request');
    }
    const sent = await prisma.message.count({ where: { conversationId, senderId } });
    if (sent >= MESSAGE_REQUEST_LIMIT) {
      throw new ApiError(403, 'Wait for them to accept your message request before sending more');
    }
  }

  return {
    conversation,
    participantIds,
    receiverId,
  };
}

// ===========================================
// SENDING
// ===========================================

export interface SendDirectMessageInput {
  senderId: string;
  /** A thread that exists already (the REST route has its id)... */
  conversationId?: string;
  /** ...or the person to message, when the sender has only that (the socket). */
  receiverId?: string;
  content: string;
  attachments?: ReturnType<typeof normalizeMessageAttachments>;
  replyToId?: string;
}

/**
 * The one way a direct message is sent, for both doors into an inbox.
 *
 * The REST route and the socket's `messages:send` each grew their own copy of
 * this, and the copies drifted: the socket skipped assertCanSendInConversation,
 * so an opener could send past the three-message cap, a declined sender could
 * keep writing to the person who had said no, a reply never accepted a request,
 * and every line pushed to her phone and wrote a notification because the quiet
 * rule for requests lived only on the REST side. Any client can emit the socket
 * event, so the cap was a suggestion. Both doors now call this, so a rule added
 * here holds on both and cannot be forgotten on one.
 *
 * What stays with the caller is what is about the transport: the REST route's
 * validation of the body and its middleware chain, the socket's throttle and
 * its re-check of her standing. Everything about who may write to whom is here.
 */
export async function sendDirectMessage(input: SendDirectMessageInput) {
  const { senderId, content, replyToId } = input;
  let attachments: StoredChatAttachment[] | undefined = input.attachments as StoredChatAttachment[] | undefined;
  let conversationId = input.conversationId;
  let receiverId = input.receiverId;
  let thread: Awaited<ReturnType<typeof assertCanSendInConversation>> | null = null;

  if (conversationId) {
    thread = await assertCanSendInConversation(conversationId, senderId);
    receiverId = thread.receiverId;
    if (await isBlockedEitherWay(senderId, receiverId)) {
      throw new ApiError(403, 'You cannot message this user');
    }
  } else {
    if (!receiverId) throw new ApiError(400, 'Choose someone to message');
    // Asked before anything else about the other person is read, so a refusal
    // tells a blocked sender nothing about her. Both stores: a block written
    // only to the DV safety page's own list (the platform list is written first
    // now, but was not always) still stops a message.
    if (await isBlockedEitherWay(senderId, receiverId)) {
      throw new ApiError(403, 'You cannot message this user');
    }
    const verdict = await canOpenConversation(senderId, receiverId);
    if (!verdict.allowed) throw new ApiError(403, verdict.reason);

    conversationId = (await findDirectConversation(senderId, receiverId)) ?? undefined;
    if (conversationId) {
      // A thread that exists is held to its request rules: the cap, and a no.
      thread = await assertCanSendInConversation(conversationId, senderId);
    } else {
      await assertCanMessageUser(senderId, receiverId);
    }
  }

  // A file in a thread is one she uploaded to this thread (utils/chat-attachments):
  // by key, never by link, so nothing a message carries can be opened without
  // asking the API, and a thread cannot be made to show a picture from somewhere
  // else. A thread that does not exist yet has no files to send in it, and this
  // is asked before one is opened so a refusal leaves no empty request behind.
  if (attachments?.length) {
    if (!conversationId) throw new ApiError(400, 'Open the conversation before sending a file in it.');
    attachments = requireChatAttachments(attachments, conversationId, senderId);
  }

  // A reply may only quote a live message from this same thread, otherwise the
  // quote leaks content the recipient never had access to.
  if (replyToId) {
    const replyTo = conversationId
      ? await prisma.message.findUnique({
          where: { id: replyToId },
          select: { conversationId: true, deletedAt: true },
        })
      : null;
    if (!replyTo || replyTo.conversationId !== conversationId || replyTo.deletedAt) {
      throw new ApiError(400, 'Invalid reply target');
    }
  }

  // Before a thread is opened, not after: a first message the moderation gate
  // refuses must not leave an empty request waiting in her inbox.
  if (content) {
    await assertContentAllowed(content, { kind: 'message', userId: senderId });
  }

  let opened = false;
  if (!conversationId || !thread) {
    const created = await getOrCreateDirectConversation(senderId, receiverId!);
    conversationId = created.id;
    opened = created.isNew;
    thread = await assertCanSendInConversation(conversationId, senderId);
  }
  const { conversation, receiverId: to } = thread;

  // Disappearing messages: stamped at send time from the thread's setting, so
  // changing the setting later never touches what was already sent.
  const expiresAt = expiryFor(await conversationTtl(conversationId));

  // The person who was asked replying is the acceptance. A muted thread, or a
  // request they have not accepted, reaches them without a push or a badge
  // bump; the very first request message does knock once, so they know someone
  // is waiting.
  const pendingRequest = Boolean(conversation.requestedById) && !conversation.requestAcceptedAt && !conversation.requestDeclinedAt;
  const acceptsRequest = pendingRequest && conversation.requestedById !== senderId;
  const receiverMuted = conversation.participants.some((p) => p.userId === to && p.isMuted);
  const quiet =
    receiverMuted ||
    (pendingRequest && !acceptsRequest && (await prisma.message.count({ where: { conversationId, senderId } })) > 0);

  const [stored] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        receiverId: to,
        content,
        type: messageTypeForAttachments(attachments),
        replyToId,
        expiresAt,
        ...(attachments ? { metadata: { attachments } } : {}),
      },
      include: {
        sender: { select: { id: true, firstName: true, displayName: true, avatar: true } },
        replyTo: { select: { id: true, senderId: true, content: true } },
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        ...(acceptsRequest ? { requestAcceptedAt: new Date(), requestDeclinedAt: null } : {}),
      },
    }),
    prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: { not: senderId } },
      data: { hasUnread: true, unreadCount: { increment: 1 } },
    }),
  ]);

  // What goes out over the socket, and back to the route, names the sender as the
  // person she wrote to may see her: by her public name, with her legal first and
  // last name left out. The REST routes mask their answers (utils/member-display);
  // this message is also emitted straight to the other person's sockets and push
  // notification, which do not pass through a route.
  const message = maskLegalNames(stored, to);

  // The message is stored; a failure to announce it must not read as a failure
  // to send, or she would send it again.
  await bestEffort(
    'direct-message.deliver',
    sendRealTimeMessage(to, message, { quiet, request: pendingRequest && !acceptsRequest })
  );

  return {
    message,
    conversationId,
    receiverId: to,
    opened,
    quiet,
    acceptedRequest: acceptsRequest,
  };
}
