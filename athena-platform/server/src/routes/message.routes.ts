import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { emitToUserRoom, sendRealTimeMessage } from '../services/socket.service';
import { parsePagination } from '../utils/pagination';
import {
  CONTENT_LIMITS,
  SanitizedAttachment,
  normalizeMessageAttachments,
  normalizeUserText,
  parseOptionalDate,
} from '../utils/contentSafety';
import {
  assertCanSendInConversation,
  getOrCreateDirectConversation,
} from '../services/direct-message.service';
import { assertContentAllowed } from '../services/moderation.service';
import { isBlockedRelationship } from '../utils/safety-store';
import { canOpenConversation } from '../services/message-permissions.service';
import { conversationLimiter } from '../middleware/socialLimits';
import {
  conversationTtl,
  expiryFor,
  isAllowedTtl,
  setDisappearingTtl,
  unexpiredMessageWhere,
} from '../services/message-expiry.service';

const router = Router();

type RawReaction = { emoji: string; userId: string };

// Message.type drives how clients render a row, so it has to describe the
// payload rather than the endpoint that produced it.
function messageTypeFor(attachments: SanitizedAttachment[] | undefined): 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' {
  if (!attachments || attachments.length === 0) return 'TEXT';
  if (attachments.every((attachment) => attachment.contentType?.startsWith('image/'))) return 'IMAGE';
  // A voice note: one recording and nothing else.
  if (attachments.every((attachment) => attachment.contentType?.startsWith('audio/'))) return 'AUDIO';
  return 'FILE';
}

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

  if (await isBlockedRelationship(userId, receiverId)) {
    throw new ApiError(403, 'You cannot message this user');
  }

  return { conversationId: message.conversationId, counterpartId: receiverId };
}

// ===========================================
// GET CONVERSATIONS
// ===========================================
router.get('/conversations', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // Use the new efficient Conversation model
    const conversations = await prisma.conversationParticipant.findMany({
      where: { userId },
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
                    lastName: true,
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
      orderBy: { conversation: { lastMessageAt: 'desc' } },
    });

    const formatted = conversations.map((cp) => {
      const conv = cp.conversation;
      const otherParticipant = conv.participants[0]?.user;
      const lastMessage = conv.messages[0];

      return {
        id: conv.id,
        disappearingTtlSeconds: conv.disappearingTtlSeconds ?? null,
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
              isRead: lastMessage.isRead,
            }
          : null,
        unreadCount: cp.unreadCount,
        updatedAt: conv.updatedAt,
      };
    });

    res.json({
      success: true,
      data: formatted,
    });
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
    });

    if (!participation) {
      throw new ApiError(403, 'Not a participant of this conversation');
    }

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
            lastName: true,
            avatar: true,
          },
        },
        replyTo: {
          select: { id: true, senderId: true, content: true },
        },
        reactions: { select: { emoji: true, userId: true } },
      },
    });

    const shaped = messages.map(({ reactions, ...message }) => ({
      ...message,
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
router.post(
  '/conversations',
  authenticate,
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

      // Neither side of a block gets to open a thread with the other.
      if (await isBlockedRelationship(myUserId, targetUserId)) {
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

      const { receiverId } = await assertCanSendInConversation(id, userId);

      if (await isBlockedRelationship(userId, receiverId)) {
        throw new ApiError(403, 'You cannot message this user');
      }

      // A reply may only quote a live message from this same thread, otherwise
      // the quote leaks content the recipient never had access to.
      if (replyToId) {
        const replyTo = await prisma.message.findUnique({
          where: { id: replyToId },
          select: { conversationId: true, deletedAt: true },
        });

        if (!replyTo || replyTo.conversationId !== id || replyTo.deletedAt) {
          throw new ApiError(400, 'Invalid reply target');
        }
      }

      if (content) {
        await assertContentAllowed(content, { kind: 'message', userId });
      }

      // Disappearing messages: stamped at send time from the thread's setting,
      // so changing the setting later never touches what was already sent.
      const expiresAt = expiryFor(await conversationTtl(id));

      const [message] = await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: id,
            senderId: userId,
            receiverId,
            content,
            type: messageTypeFor(attachments),
            replyToId,
            expiresAt,
            ...(attachments ? { metadata: { attachments } } : {}),
          },
          include: {
            sender: {
                select: { id: true, firstName: true, lastName: true, avatar: true }
            },
            replyTo: {
                select: { id: true, senderId: true, content: true }
            }
          }
        }),
        prisma.conversation.update({
          where: { id },
          data: {
            lastMessageAt: new Date(),
          },
        }),
        prisma.conversationParticipant.updateMany({
          where: {
            conversationId: id,
            userId: { not: userId },
          },
          data: {
            hasUnread: true,
            unreadCount: { increment: 1 },
          },
        }),
      ]);

      // Emit Socket Event
      await sendRealTimeMessage(receiverId, message);

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
