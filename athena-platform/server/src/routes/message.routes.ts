import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdultAccount, requireWomanMember } from '../middleware/account-gates';
import { emitToUserRoom, isUserOnline } from '../services/socket.service';
import { onlineCounterpartsFor } from '../services/presence.service';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';
import {
  CONTENT_LIMITS,
  normalizeMessageAttachments,
  normalizeUserText,
  parseOptionalDate,
} from '../utils/contentSafety';
import {
  assertCanSendInConversation,
  getOrCreateDirectConversation,
  readersHidingReceipts,
  readReceiptsWithheldFrom,
  requestStateFor,
  sendDirectMessage,
} from '../services/direct-message.service';
import { assertContentAllowed } from '../services/moderation.service';
import { blockedEitherWayIds, isBlockedEitherWay } from '../services/audience.service';
import { canOpenConversation } from '../services/message-permissions.service';
import { reviewUnwantedContact } from '../services/unwanted-contact.service';
import { deleteChatAttachmentFiles } from '../services/chat-attachment-cleanup.service';
import { conversationLimiter, messageLimiter } from '../middleware/socialLimits';
import { Prisma } from '@prisma/client';
import { maskLegalNamesInResponses } from '../utils/member-display';
import {
  isAllowedTtl,
  setDisappearingTtl,
  unexpiredMessageWhere,
} from '../services/message-expiry.service';

const router = Router();

// Every answer from here goes to other members, so a member who is not the reader is
// named by her public name and her legal first and last name are never sent (see
// utils/member-display: the pseudonymous display name). The other person in a thread, and each message's sender, are both covered.
router.use(maskLegalNamesInResponses);

type RawReaction = { emoji: string; userId: string };

// The client renders one chip per emoji with a count and whether the viewer
// reacted, so collapse the raw rows into that shape here (same contract the
// channel message list uses).
function shapeReactions(reactions: RawReaction[], viewerId: string) {
  const byEmoji = new Map<string, { emoji: string; count: number; hasReacted: boolean }>();
  for (const reaction of reactions) {
    const entry = byEmoji.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, hasReacted: false };
    entry.count += 1;
    if (reaction.userId === viewerId) entry.hasReacted = true;
    byEmoji.set(reaction.emoji, entry);
  }
  return [...byEmoji.values()];
}

// A reaction lands in the other person's thread like a message does, so it is
// gated by exactly the same rules as sending one — participation, the
// recipient's allowMessages setting, and blocks. Returns the counterpart so the
// caller can push the change to them.
async function loadReactableMessage(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, deletedAt: true },
  });

  if (!message || message.deletedAt || !message.conversationId) {
    throw new ApiError(404, 'Message not found');
  }

  const { receiverId } = await assertCanSendInConversation(message.conversationId, userId);

  if (await isBlockedEitherWay(userId, receiverId)) {
    throw new ApiError(403, 'You cannot message this user');
  }

  return { conversationId: message.conversationId, counterpartId: receiverId };
}

// ===========================================
// GET CONVERSATIONS
// ===========================================

/**
 * How many threads one page of the inbox carries. The list used to have no
 * page at all: every thread a member had ever opened, each joined to the
 * other participant and its latest message, on every inbox open and again on
 * every thirty-second refetch, so the cost of opening Messages grew without
 * limit with how long she had been here.
 *
 * A caller that does not ask for a page gets the largest one. Both clients
 * still read this list whole, and the web chat window finds the thread it
 * has open in it, so a small default would have hidden a member's older
 * threads from a client that does not page yet; a hundred covers nearly
 * every inbox, and the pagination block says when it does not.
 */
const CONVERSATION_PAGE_MAX = 100;
const CONVERSATION_PAGE_SIZE = CONVERSATION_PAGE_MAX;

router.get('/conversations', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const query = req.query as { page?: string; limit?: string };
    const { page, limit, skip } = parsePagination(
      { page: query.page, limit: query.limit ?? String(CONVERSATION_PAGE_SIZE) },
      CONVERSATION_PAGE_MAX
    );

    // A request this person declined is gone from their side; the opener
    // still sees it, closed.
    //
    // And so is a thread with anyone on either side of a block with her, in either
    // store: the list shows the other person's name, picture and last message, so
    // a thread left in it was a place the person she blocked (or who blocked her)
    // stayed in front of her, and the unread badge counted what they had written.
    // Left out in the query, so a page is full and the total is the number of
    // threads she can see. The messages are not deleted; a report of them still
    // carries a copy. If the block lists cannot be read the list fails rather than
    // showing every thread.
    const blocked = await blockedEitherWayIds(userId);
    const where: Prisma.ConversationParticipantWhereInput = {
      userId,
      conversation: {
        OR: [{ requestDeclinedAt: null }, { requestedById: userId }],
        ...(blocked.length > 0 ? { participants: { none: { userId: { in: blocked } } } } : {}),
      },
    };

    // The unread badge is a total over every thread, not over the page on
    // screen, so it is worked out here from the threads that have anything
    // unread (a handful, where the whole list may be hundreds) under the same
    // rules the clients apply: muted and archived threads, and requests not
    // yet accepted, stay off it.
    const [conversations, total, unreadRows] = await Promise.all([
      prisma.conversationParticipant.findMany({
        where,
        include: {
          conversation: {
            include: {
              participants: {
                where: { userId: { not: userId } },
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      displayName: true,
                      avatar: true,
                      isVerified: true,
                    },
                  },
                },
              },
              messages: {
                // A message past its expiry is gone as far as the reader is
                // concerned, even if the sweep has not deleted the row yet.
                where: unexpiredMessageWhere(),
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        // The id last, so two threads with the same lastMessageAt keep one
        // order and a page boundary never shows a thread twice or skips one.
        orderBy: [{ isPinned: 'desc' }, { conversation: { lastMessageAt: 'desc' } }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.conversationParticipant.count({ where }),
      prisma.conversationParticipant.findMany({
        where: { ...where, unreadCount: { gt: 0 }, isMuted: false, isArchived: false },
        select: {
          unreadCount: true,
          conversation: { select: { requestedById: true, requestAcceptedAt: true, requestDeclinedAt: true } },
        },
      }),
    ]);

    const unreadTotal = unreadRows.reduce(
      (sum, row) => (requestStateFor(row.conversation, userId).isRequest ? sum : sum + row.unreadCount),
      0
    );

    // Who of the people she is writing to has switched read receipts off, so
    // the "read" tick on her last message is withheld in the list as it is in
    // the thread. One lookup for the whole page.
    const hidingReceipts = await readersHidingReceipts(
      conversations.flatMap((cp) => cp.conversation.participants.map((participant) => participant.userId))
    );

    const formatted = conversations.map((cp) => {
      const conv = cp.conversation;
      const otherParticipant = conv.participants[0]?.user;
      const lastMessage = conv.messages[0];
      const receiptsWithheldHere =
        readReceiptsWithheldFrom(conv, userId) || conv.participants.some((participant) => hidingReceipts.has(participant.userId));

      return {
        id: conv.id,
        disappearingTtlSeconds: conv.disappearingTtlSeconds ?? null,
        isPinned: cp.isPinned,
        isMuted: cp.isMuted,
        isArchived: cp.isArchived,
        ...requestStateFor(conv, userId),
        participant: otherParticipant || {
          id: 'deleted',
          firstName: 'Deleted',
          lastName: 'User',
          displayName: 'Deleted User',
          avatar: null
        },
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
              isRead: lastMessage.senderId === userId && receiptsWithheldHere ? false : lastMessage.isRead,
              deletedAt: lastMessage.deletedAt,
            }
          : null,
        unreadCount: cp.unreadCount,
        updatedAt: conv.updatedAt,
      };
    });

    res.json({
      success: true,
      data: formatted,
      pagination: buildPaginationMeta(total, page, limit),
      unreadTotal,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PRESENCE
// ===========================================

/**
 * GET /api/messages/presence
 *
 * Which of the people in your threads are online right now. A client that
 * has just connected learns this here and then follows the presence events;
 * before, nothing told it who was already on, so a chat with someone who had
 * been online for an hour read "Offline" until she happened to reconnect.
 *
 * The answer follows exactly the rule the live events follow (see
 * presence.service): established threads only, never across a block, and
 * never a member who has hidden her online status or turned on Safe Mode —
 * she reads as offline, which is what hiding is for.
 */
router.get('/presence', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const online = await onlineCounterpartsFor(req.user!.id, isUserOnline);
    res.json({ success: true, data: { online } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET MESSAGES
// ===========================================
router.get('/conversations/:id/messages', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { limit } = parsePagination(req.query as { page?: string; limit?: string }, 100);
    const before = parseOptionalDate(req.query.before, 'before');

    // Verify participation
    const participation = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId,
        },
      },
      include: {
        conversation: {
          select: {
            requestedById: true,
            requestAcceptedAt: true,
            participants: { where: { userId: { not: userId } }, select: { userId: true } },
          },
        },
      },
    });

    if (!participation) {
      throw new ApiError(403, 'Not a participant of this conversation');
    }

    // The person who opened a request is not told whether, or when, it was read
    // until it is accepted: the request banner promises as much, and a read
    // receipt is how a stranger learns she is online and looking. Nor is anyone
    // told by a member who has switched her read receipts off, which the live
    // tick honoured and this read did not, so the tick came back on a reload.
    const hidingReceipts = await readersHidingReceipts(
      (participation.conversation?.participants ?? []).map((participant) => participant.userId)
    );
    const receiptsWithheld =
      readReceiptsWithheldFrom(participation.conversation, userId) || hidingReceipts.size > 0;

    // Mark as read
    if (participation.hasUnread) {
      await prisma.conversationParticipant.update({
        where: { id: participation.id },
        data: { hasUnread: false, unreadCount: 0, lastReadAt: new Date() },
      });
      // Optionally update message read status
      await prisma.message.updateMany({
        where: {
          conversationId: id,
          senderId: { not: userId },
          isRead: false,
        },
        data: { isRead: true, readAt: new Date() },
      });
    }

    // ?q= searches the thread's text instead of paging it.
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: before } } : {}),
        ...(q ? { content: { contains: q, mode: 'insensitive' } } : {}),
        ...unexpiredMessageWhere(),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            displayName: true,
            avatar: true,
          },
        },
        replyTo: {
          select: { id: true, senderId: true, content: true, deletedAt: true },
        },
        reactions: { select: { emoji: true, userId: true } },
      },
    });

    const shaped = messages.map(({ reactions, ...message }) => ({
      ...message,
      ...(receiptsWithheld && message.senderId === userId ? { isRead: false, readAt: null } : {}),
      reactions: shapeReactions(reactions, userId),
    }));

    res.json({
      success: true,
      data: shaped.reverse(),
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// START CONVERSATION
// ===========================================
// Opening a thread is where an unwanted stranger first reaches a member, so the
// women-only gate and the age gate are applied here rather than on the reads.
// Threads that already exist keep working either way: this refuses the first
// contact, not the conversation a member has already chosen to be in.
router.post(
  '/conversations',
  authenticate,
  requireWomanMember,
  requireAdultAccount,
  conversationLimiter,
  [body('userId').isString().notEmpty().withMessage('Target user ID is required')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { userId: targetUserId } = req.body;
      const myUserId = req.user!.id;

      // Neither side of a block gets to open a thread with the other, in either
      // of the two stores a block can be written to.
      if (await isBlockedEitherWay(myUserId, targetUserId)) {
        throw new ApiError(403, 'You cannot message this user');
      }

      // "Who can message me": a thread that already exists stays open; a new
      // one respects the other member's choice.
      const verdict = await canOpenConversation(myUserId, targetUserId);
      if (!verdict.allowed) {
        throw new ApiError(403, verdict.reason);
      }

      const conversation = await getOrCreateDirectConversation(myUserId, targetUserId);

      res.status(conversation.isNew ? 201 : 200).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// SEND MESSAGE
// ===========================================
router.post(
  '/conversations/:id/messages',
  authenticate,
  requireAdultAccount,
  messageLimiter,
  [
    body('content').optional().isString().isLength({ max: CONTENT_LIMITS.directMessage }),
    body('attachments').optional().isArray({ max: 5 }),
    body('replyToId').optional().isString().notEmpty(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const attachments = normalizeMessageAttachments(req.body?.attachments);
      // An attachment-only message is legitimate, so content may be empty — but
      // only when something else is actually being delivered.
      const content = req.body?.content === undefined || req.body?.content === null
        ? ''
        : normalizeUserText(req.body.content, {
            field: 'content',
            maxLength: CONTENT_LIMITS.directMessage,
            allowEmpty: true,
          });
      const replyToId = typeof req.body?.replyToId === 'string' && req.body.replyToId.trim()
        ? req.body.replyToId.trim()
        : undefined;
      const userId = req.user!.id;

      if (!content && (!attachments || attachments.length === 0)) {
        throw new ApiError(400, 'Content or attachments required');
      }

      // The rules about who may write to whom — the participant check, the
      // block, the request cap and a declined request, moderation, expiry and
      // the quiet request delivery — are in sendDirectMessage, which the socket
      // door calls too, so neither can be held to less than the other.
      const { message } = await sendDirectMessage({
        senderId: userId,
        conversationId: id,
        content,
        attachments,
        replyToId,
      });

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// PREFERENCES: PIN, MUTE, ARCHIVE
// ===========================================
// Each person's own view of a thread. Pinning holds it at the top of their
// list, muting stops pushes and the badge, archiving takes it out of the inbox
// until it is unarchived.
router.patch(
  '/conversations/:id/preferences',
  authenticate,
  [
    body('isPinned').optional().isBoolean(),
    body('isMuted').optional().isBoolean(),
    body('isArchived').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const { id } = req.params;
      const userId = req.user!.id;

      const data: { isPinned?: boolean; isMuted?: boolean; isArchived?: boolean } = {};
      for (const key of ['isPinned', 'isMuted', 'isArchived'] as const) {
        if (typeof req.body[key] === 'boolean') data[key] = req.body[key];
      }
      if (Object.keys(data).length === 0) {
        throw new ApiError(400, 'Nothing to change');
      }

      const participation = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: id, userId } },
        select: { id: true },
      });
      if (!participation) {
        throw new ApiError(404, 'Conversation not found');
      }

      const updated = await prisma.conversationParticipant.update({
        where: { id: participation.id },
        data,
        select: { isPinned: true, isMuted: true, isArchived: true },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// MESSAGE REQUESTS
// ===========================================
// Only the person who was asked decides. Accepting opens the thread for good;
// declining keeps the row so the same person cannot simply ask again, and
// hides it from the decliner.
async function loadRequestFor(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      requestedById: true,
      requestAcceptedAt: true,
      requestDeclinedAt: true,
      participants: { select: { userId: true } },
    },
  });
  if (!conversation || !conversation.participants.some((p) => p.userId === userId)) {
    throw new ApiError(404, 'Conversation not found');
  }
  if (!conversation.requestedById || conversation.requestedById === userId) {
    throw new ApiError(400, 'There is no message request here for you to decide');
  }
  if (conversation.requestAcceptedAt) {
    throw new ApiError(409, 'This request was already accepted');
  }
  return conversation;
}

router.post('/conversations/:id/request/accept', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const conversation = await loadRequestFor(req.params.id, userId);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { requestAcceptedAt: new Date(), requestDeclinedAt: null },
    });
    emitToUserRoom(conversation.requestedById!, 'messages:request_accepted', { conversationId: conversation.id, by: userId });
    res.json({ success: true, data: { conversationId: conversation.id, accepted: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/conversations/:id/request/decline', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const conversation = await loadRequestFor(req.params.id, userId);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { requestDeclinedAt: new Date() },
    });
    // One woman's no is answered by the thread closing. Several women's no, to
    // the same account, is something a moderator should hear about; this counts
    // them and never throws, so the decline she just made is what she is told.
    await reviewUnwantedContact(conversation.requestedById!);
    res.json({ success: true, data: { conversationId: conversation.id, accepted: false } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DISAPPEARING MESSAGES
// ===========================================
// Either participant sets the thread's timer: null turns it off, otherwise one
// of the allowed TTLs. A system message records the change for both sides.
router.patch(
  '/conversations/:id/settings',
  authenticate,
  [body('disappearingTtlSeconds').custom((value) => value === null || Number.isInteger(value))],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'disappearingTtlSeconds must be null or a number of seconds');
      }
      const ttl = req.body.disappearingTtlSeconds;
      if (!isAllowedTtl(ttl)) {
        throw new ApiError(400, 'Choose off, 1 hour, 24 hours, 7 days or 90 days');
      }

      const result = await setDisappearingTtl(req.params.id, req.user!.id, ttl);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UNSEND AND EDIT
// ===========================================
// Only the sender, only their own words. Unsending leaves a marker where the
// message was ("This message was unsent") rather than closing the gap, so
// neither side is left wondering whether something was there; the text,
// attachments and reactions are gone. Editing is allowed for a short while
// after sending and stamps editedAt so the thread says the words changed.

export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

async function loadOwnMessage(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      type: true,
      isRead: true,
      deletedAt: true,
      createdAt: true,
      // What the unsend takes away, read before it goes: the files it carried.
      metadata: true,
      conversation: { select: { participants: { select: { userId: true } } } },
    },
  });
  if (!message || !message.conversationId) {
    throw new ApiError(404, 'Message not found');
  }
  const participantIds = message.conversation?.participants.map((p) => p.userId) ?? [];
  if (!participantIds.includes(userId)) {
    throw new ApiError(404, 'Message not found');
  }
  if (message.senderId !== userId) {
    throw new ApiError(403, 'You can only change your own messages');
  }
  if (message.type === 'SYSTEM') {
    throw new ApiError(400, 'That notice cannot be changed');
  }
  return { ...message, conversationId: message.conversationId, participantIds };
}

router.delete('/:messageId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await loadOwnMessage(req.params.messageId, req.user!.id);
    if (message.deletedAt) {
      res.json({ success: true, message: 'Message unsent', data: { id: message.id, deletedAt: message.deletedAt } });
      return;
    }

    const deletedAt = new Date();
    await prisma.$transaction([
      prisma.message.update({
        where: { id: message.id },
        data: { content: '', metadata: Prisma.DbNull, deletedAt, editedAt: null },
      }),
      prisma.messageReaction.deleteMany({ where: { messageId: message.id } }),
      // An unread message that is taken back must not stay counted against
      // the person who never read it.
      ...(message.isRead
        ? []
        : [
            prisma.conversationParticipant.updateMany({
              where: { conversationId: message.conversationId, userId: { not: req.user!.id }, unreadCount: { gt: 0 } },
              data: { unreadCount: { decrement: 1 } },
            }),
          ]),
    ]);

    const payload = { conversationId: message.conversationId, messageId: message.id, deletedAt: deletedAt.toISOString() };
    for (const participantId of message.participantIds) {
      emitToUserRoom(participantId, 'messages:deleted', payload);
    }

    // The files go with the words. The row's attachments were cleared above, and
    // what they pointed at is removed here, unless somebody has reported the
    // message, in which case the people deciding the report keep it
    // (services/chat-attachment-cleanup).
    await deleteChatAttachmentFiles([{ id: message.id, metadata: message.metadata }]);

    res.json({ success: true, message: 'Message unsent', data: { id: message.id, deletedAt } });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:messageId',
  authenticate,
  [body('content').isString().isLength({ min: 1, max: CONTENT_LIMITS.directMessage })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }
      const content = normalizeUserText(req.body.content, { field: 'content', maxLength: CONTENT_LIMITS.directMessage });

      const message = await loadOwnMessage(req.params.messageId, req.user!.id);
      if (message.deletedAt) {
        throw new ApiError(409, 'That message was unsent');
      }
      if (Date.now() - new Date(message.createdAt).getTime() > MESSAGE_EDIT_WINDOW_MS) {
        throw new ApiError(409, 'Messages can be edited for 15 minutes after sending');
      }

      await assertContentAllowed(content, { kind: 'message', userId: req.user!.id });

      const editedAt = new Date();
      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { content, editedAt },
        select: { id: true, content: true, editedAt: true },
      });

      const payload = { conversationId: message.conversationId, messageId: message.id, content: updated.content, editedAt: editedAt.toISOString() };
      for (const participantId of message.participantIds) {
        emitToUserRoom(participantId, 'messages:edited', payload);
      }

      res.json({ success: true, message: 'Message edited', data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REACT TO A MESSAGE
// ===========================================
router.post(
  '/:messageId/reactions',
  authenticate,
  [body('emoji').isString().trim().notEmpty().isLength({ max: 32 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { messageId } = req.params;
      const userId = req.user!.id;
      const { conversationId, counterpartId } = await loadReactableMessage(messageId, userId);

      const emoji = String(req.body.emoji).trim();

      // The unique constraint makes this idempotent: reacting twice with the
      // same emoji is a no-op rather than a duplicate row or an error.
      const existing = await prisma.messageReaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      });

      if (!existing) {
        await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
        emitToUserRoom(counterpartId, 'messages:reaction', {
          conversationId,
          messageId,
          emoji,
          userId,
          action: 'added',
        });
      }

      res.status(201).json({ success: true, message: 'Reaction added' });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:messageId/reactions/:emoji',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { messageId } = req.params;
      const userId = req.user!.id;
      const { conversationId, counterpartId } = await loadReactableMessage(messageId, userId);

      const emoji = decodeURIComponent(req.params.emoji);
      const deleted = await prisma.messageReaction.deleteMany({
        where: { messageId, userId, emoji },
      });

      if (deleted.count > 0) {
        emitToUserRoom(counterpartId, 'messages:reaction', {
          conversationId,
          messageId,
          emoji,
          userId,
          action: 'removed',
        });
      }

      res.json({ success: true, message: 'Reaction removed' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
