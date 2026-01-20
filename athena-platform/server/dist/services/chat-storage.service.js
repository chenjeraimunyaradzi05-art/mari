"use strict";
/**
 * Chat Storage Service
 * Optimized message persistence with partitioning and archival
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatStorageService = void 0;
exports.storeMessage = storeMessage;
exports.getMessages = getMessages;
exports.markAsRead = markAsRead;
exports.deleteMessage = deleteMessage;
exports.editMessage = editMessage;
exports.archiveOldMessages = archiveOldMessages;
exports.getConversationStats = getConversationStats;
exports.searchMessages = searchMessages;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
// ==========================================
// CONFIGURATION
// ==========================================
const PARTITION_INTERVAL_DAYS = 30;
const ARCHIVE_AFTER_DAYS = 365;
const MAX_MESSAGES_PER_QUERY = 100;
// ==========================================
// MESSAGE OPERATIONS
// ==========================================
/**
 * Store a new message with optimized indexing
 */
async function storeMessage(input) {
    const { conversationId, senderId, content, type = 'TEXT', metadata, replyToId } = input;
    try {
        // Create message
        const message = await prisma_1.prisma.message.create({
            data: {
                conversationId,
                senderId,
                content,
                type,
                metadata: metadata || {},
                replyToId,
                // Partition key based on date
                partitionKey: getPartitionKey(new Date()),
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        displayName: true,
                        avatar: true,
                    },
                },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        senderId: true,
                    },
                },
            },
        });
        // Update conversation's last message
        await prisma_1.prisma.conversation.update({
            where: { id: conversationId },
            data: {
                lastMessageId: message.id,
                lastMessageAt: message.createdAt,
                messageCount: { increment: 1 },
            },
        });
        // Update participant's unread count
        await prisma_1.prisma.conversationParticipant.updateMany({
            where: {
                conversationId,
                userId: { not: senderId },
            },
            data: {
                unreadCount: { increment: 1 },
            },
        });
        logger_1.logger.debug('Message stored', { messageId: message.id, conversationId });
        return message;
    }
    catch (error) {
        logger_1.logger.error('Failed to store message', { error, conversationId });
        throw error;
    }
}
/**
 * Retrieve messages with efficient pagination
 */
async function getMessages(query) {
    const { conversationId, before, after, limit = 50, includeDeleted = false } = query;
    const effectiveLimit = Math.min(limit, MAX_MESSAGES_PER_QUERY);
    try {
        const where = {
            conversationId,
            ...(includeDeleted ? {} : { deletedAt: null }),
        };
        if (before) {
            where.createdAt = { lt: before };
        }
        if (after) {
            where.createdAt = { ...where.createdAt, gt: after };
        }
        const messages = await prisma_1.prisma.message.findMany({
            where,
            include: {
                sender: {
                    select: {
                        id: true,
                        displayName: true,
                        avatar: true,
                    },
                },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        senderId: true,
                    },
                },
                reactions: {
                    select: {
                        emoji: true,
                        userId: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: effectiveLimit + 1, // Get one extra to check hasMore
        });
        const hasMore = messages.length > effectiveLimit;
        const resultMessages = hasMore ? messages.slice(0, effectiveLimit) : messages;
        // Return in chronological order
        return {
            messages: resultMessages.reverse(),
            hasMore,
            oldestDate: resultMessages[0]?.createdAt,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to get messages', { error, conversationId });
        throw error;
    }
}
/**
 * Mark messages as read up to a certain point
 */
async function markAsRead(conversationId, userId, upToMessageId) {
    try {
        await prisma_1.prisma.conversationParticipant.update({
            where: {
                conversationId_userId: { conversationId, userId },
            },
            data: {
                unreadCount: 0,
                lastReadAt: new Date(),
                lastReadMessageId: upToMessageId,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to mark messages as read', { error, conversationId, userId });
    }
}
/**
 * Soft delete a message
 */
async function deleteMessage(messageId, userId) {
    try {
        const message = await prisma_1.prisma.message.findUnique({
            where: { id: messageId },
        });
        if (!message || message.senderId !== userId) {
            return false;
        }
        await prisma_1.prisma.message.update({
            where: { id: messageId },
            data: {
                deletedAt: new Date(),
                content: '', // Clear content for privacy
            },
        });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to delete message', { error, messageId });
        return false;
    }
}
/**
 * Edit a message (within time limit)
 */
async function editMessage(messageId, userId, newContent) {
    const EDIT_WINDOW_MINUTES = 15;
    try {
        const message = await prisma_1.prisma.message.findUnique({
            where: { id: messageId },
        });
        if (!message || message.senderId !== userId) {
            return null;
        }
        // Check edit window
        const editDeadline = new Date(message.createdAt.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000);
        if (new Date() > editDeadline) {
            logger_1.logger.warn('Edit window expired', { messageId, userId });
            return null;
        }
        const updated = await prisma_1.prisma.message.update({
            where: { id: messageId },
            data: {
                content: newContent,
                editedAt: new Date(),
            },
        });
        return updated;
    }
    catch (error) {
        logger_1.logger.error('Failed to edit message', { error, messageId });
        return null;
    }
}
// ==========================================
// PARTITIONING & ARCHIVAL
// ==========================================
/**
 * Generate partition key for a date
 */
function getPartitionKey(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}`;
}
/**
 * Archive old messages to cold storage
 */
async function archiveOldMessages() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS);
    logger_1.logger.info('Starting message archival', { cutoffDate });
    try {
        // In production, this would move to S3/cold storage
        // For now, we just mark them as archived
        const result = await prisma_1.prisma.message.updateMany({
            where: {
                createdAt: { lt: cutoffDate },
                isArchived: false,
            },
            data: {
                isArchived: true,
            },
        });
        logger_1.logger.info('Message archival complete', { archived: result.count });
        return { archived: result.count };
    }
    catch (error) {
        logger_1.logger.error('Failed to archive messages', { error });
        throw error;
    }
}
/**
 * Get conversation statistics
 */
async function getConversationStats(conversationId) {
    try {
        const [messageStats, participants, lastMessage] = await Promise.all([
            prisma_1.prisma.message.aggregate({
                where: { conversationId, deletedAt: null },
                _count: true,
            }),
            prisma_1.prisma.conversationParticipant.count({
                where: { conversationId },
            }),
            prisma_1.prisma.message.findFirst({
                where: { conversationId, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            }),
        ]);
        const mediaCount = await prisma_1.prisma.message.count({
            where: {
                conversationId,
                deletedAt: null,
                type: { in: ['IMAGE', 'FILE'] },
            },
        });
        return {
            totalMessages: messageStats._count,
            mediaMessages: mediaCount,
            activeParticipants: participants,
            lastActivity: lastMessage?.createdAt || null,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to get conversation stats', { error, conversationId });
        throw error;
    }
}
// ==========================================
// SEARCH
// ==========================================
/**
 * Search messages within a conversation
 */
async function searchMessages(conversationId, query, limit = 20) {
    try {
        const messages = await prisma_1.prisma.message.findMany({
            where: {
                conversationId,
                deletedAt: null,
                content: {
                    contains: query,
                    mode: 'insensitive',
                },
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        displayName: true,
                        avatar: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return messages;
    }
    catch (error) {
        logger_1.logger.error('Failed to search messages', { error, conversationId, query });
        return [];
    }
}
exports.chatStorageService = {
    storeMessage,
    getMessages,
    markAsRead,
    deleteMessage,
    editMessage,
    archiveOldMessages,
    getConversationStats,
    searchMessages,
};
//# sourceMappingURL=chat-storage.service.js.map