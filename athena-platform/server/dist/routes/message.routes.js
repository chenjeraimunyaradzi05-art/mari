"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const socket_service_1 = require("../services/socket.service");
const router = (0, express_1.Router)();
// ===========================================
// GET CONVERSATIONS
// ===========================================
router.get('/conversations', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Use the new efficient Conversation model
        const conversations = await prisma_1.prisma.conversationParticipant.findMany({
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
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET MESSAGES
// ===========================================
router.get('/conversations/:id/messages', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const before = req.query.before;
        // Verify participation
        const participation = await prisma_1.prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: id,
                    userId,
                },
            },
        });
        if (!participation) {
            throw new errorHandler_1.ApiError(403, 'Not a participant of this conversation');
        }
        // Mark as read
        if (participation.hasUnread) {
            await prisma_1.prisma.conversationParticipant.update({
                where: { id: participation.id },
                data: { hasUnread: false, unreadCount: 0, lastReadAt: new Date() },
            });
            // Optionally update message read status
            await prisma_1.prisma.message.updateMany({
                where: {
                    conversationId: id,
                    senderId: { not: userId },
                    isRead: false,
                },
                data: { isRead: true, readAt: new Date() },
            });
        }
        const messages = await prisma_1.prisma.message.findMany({
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
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// START CONVERSATION
// ===========================================
router.post('/conversations', auth_1.authenticate, [(0, express_validator_1.body)('userId').notEmpty().withMessage('Target user ID is required')], async (req, res, next) => {
    try {
        const { userId: targetUserId } = req.body;
        const myUserId = req.user.id;
        if (targetUserId === myUserId) {
            throw new errorHandler_1.ApiError(400, 'Cannot message yourself');
        }
        // Check for existing conversation (Private 1:1)
        const myConvos = await prisma_1.prisma.conversationParticipant.findMany({
            where: { userId: myUserId },
            select: { conversationId: true },
        });
        const targetConvos = await prisma_1.prisma.conversationParticipant.findMany({
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
        const conversation = await prisma_1.prisma.conversation.create({
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
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// SEND MESSAGE
// ===========================================
router.post('/conversations/:id/messages', auth_1.authenticate, [(0, express_validator_1.body)('content').notEmpty().trim()], async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        const conversation = await prisma_1.prisma.conversation.findUnique({
            where: { id },
            include: { participants: true },
        });
        if (!conversation) {
            throw new errorHandler_1.ApiError(404, 'Conversation not found');
        }
        const participantIds = conversation.participants.map(p => p.userId);
        if (!participantIds.includes(userId)) {
            throw new errorHandler_1.ApiError(403, 'Not a participant');
        }
        const receiverId = participantIds.find(pid => pid !== userId);
        // Allow not found if it's a group chat in future, but for now 1:1 needs receiver
        if (!receiverId)
            throw new errorHandler_1.ApiError(500, 'Recipient not found');
        const [message] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.message.create({
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
            prisma_1.prisma.conversation.update({
                where: { id },
                data: {
                    lastMessageAt: new Date(),
                },
            }),
            prisma_1.prisma.conversationParticipant.updateMany({
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
        await (0, socket_service_1.sendRealTimeMessage)(receiverId, message);
        res.status(201).json({
            success: true,
            data: message,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=message.routes.js.map