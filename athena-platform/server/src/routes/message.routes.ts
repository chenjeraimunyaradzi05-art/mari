import { Router, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { sendRealTimeMessage } from '../services/socket.service';
import { parsePagination } from '../utils/pagination';

const router = Router();

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
    const before = req.query.before as string;

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

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
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
      },
    });

    res.json({
      success: true,
      data: messages.reverse(),
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
  [body('userId').notEmpty().withMessage('Target user ID is required')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId: targetUserId } = req.body;
      const myUserId = req.user!.id;

      if (targetUserId === myUserId) {
        throw new ApiError(400, 'Cannot message yourself');
      }

      // Check for existing conversation (Private 1:1)
      const myConvos = await prisma.conversationParticipant.findMany({
        where: { userId: myUserId },
        select: { conversationId: true },
      });

      const targetConvos = await prisma.conversationParticipant.findMany({
        where: { userId: targetUserId },
        select: { conversationId: true },
      });

      const commonConvoIds = myConvos
        .map((c) => c.conversationId)
        .filter((id) => targetConvos.some((t) => t.conversationId === id));

      if (commonConvoIds.length > 0) {
        return res.json({
          success: true,
          data: { id: commonConvoIds[0], isNew: false },
        });
      }

      // Create new
      const conversation = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: myUserId },
              { userId: targetUserId },
            ],
          },
        },
      });

      res.status(201).json({
        success: true,
        data: { id: conversation.id, isNew: true },
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
  [body('content').notEmpty().trim()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: { participants: true },
      });

      if (!conversation) {
        throw new ApiError(404, 'Conversation not found');
      }

      const participantIds = conversation.participants.map(p => p.userId);
      if (!participantIds.includes(userId)) {
        throw new ApiError(403, 'Not a participant');
      }

      const receiverId = participantIds.find(pid => pid !== userId);
      // Allow not found if it's a group chat in future, but for now 1:1 needs receiver
      if (!receiverId) throw new ApiError(500, 'Recipient not found');

      const [message] = await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: id,
            senderId: userId,
            receiverId,
            content,
          },
          include: {
            sender: {
                select: { id: true, firstName: true, lastName: true, avatar: true }
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

export default router;
