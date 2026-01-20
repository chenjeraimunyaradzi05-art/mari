/**
 * Chat Storage Service
 * Optimized message persistence with partitioning and archival
 * Phase 2: Backend Logic & Integrations
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// ==========================================
// CONFIGURATION
// ==========================================

const PARTITION_INTERVAL_DAYS = 30;
const ARCHIVE_AFTER_DAYS = 365;
const MAX_MESSAGES_PER_QUERY = 100;

// ==========================================
// TYPES
// ==========================================

export interface MessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  type?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  metadata?: Record<string, any>;
  replyToId?: string;
}

export interface MessageQuery {
  conversationId: string;
  before?: Date;
  after?: Date;
  limit?: number;
  includeDeleted?: boolean;
}

export interface MessageStats {
  totalMessages: number;
  mediaMessages: number;
  activeParticipants: number;
  lastActivity: Date | null;
}

// ==========================================
// MESSAGE OPERATIONS
// ==========================================

/**
 * Store a new message with optimized indexing
 */
export async function storeMessage(input: MessageInput): Promise<any> {
  const { conversationId, senderId, content, type = 'TEXT', metadata, replyToId } = input;
  
  try {
    // Create message
    const message = await prisma.message.create({
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
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt,
        messageCount: { increment: 1 },
      },
    });
    
    // Update participant's unread count
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: { not: senderId },
      },
      data: {
        unreadCount: { increment: 1 },
      },
    });
    
    logger.debug('Message stored', { messageId: message.id, conversationId });
    
    return message;
  } catch (error) {
    logger.error('Failed to store message', { error, conversationId });
    throw error;
  }
}

/**
 * Retrieve messages with efficient pagination
 */
export async function getMessages(query: MessageQuery): Promise<{
  messages: any[];
  hasMore: boolean;
  oldestDate?: Date;
}> {
  const { conversationId, before, after, limit = 50, includeDeleted = false } = query;
  
  const effectiveLimit = Math.min(limit, MAX_MESSAGES_PER_QUERY);
  
  try {
    const where: any = {
      conversationId,
      ...(includeDeleted ? {} : { deletedAt: null }),
    };
    
    if (before) {
      where.createdAt = { lt: before };
    }
    
    if (after) {
      where.createdAt = { ...where.createdAt, gt: after };
    }
    
    const messages = await prisma.message.findMany({
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
  } catch (error) {
    logger.error('Failed to get messages', { error, conversationId });
    throw error;
  }
}

/**
 * Mark messages as read up to a certain point
 */
export async function markAsRead(
  conversationId: string,
  userId: string,
  upToMessageId?: string
): Promise<void> {
  try {
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: {
        unreadCount: 0,
        lastReadAt: new Date(),
        lastReadMessageId: upToMessageId,
      },
    });
  } catch (error) {
    logger.error('Failed to mark messages as read', { error, conversationId, userId });
  }
}

/**
 * Soft delete a message
 */
export async function deleteMessage(
  messageId: string,
  userId: string
): Promise<boolean> {
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });
    
    if (!message || message.senderId !== userId) {
      return false;
    }
    
    await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: '', // Clear content for privacy
      },
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to delete message', { error, messageId });
    return false;
  }
}

/**
 * Edit a message (within time limit)
 */
export async function editMessage(
  messageId: string,
  userId: string,
  newContent: string
): Promise<any | null> {
  const EDIT_WINDOW_MINUTES = 15;
  
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });
    
    if (!message || message.senderId !== userId) {
      return null;
    }
    
    // Check edit window
    const editDeadline = new Date(message.createdAt.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000);
    if (new Date() > editDeadline) {
      logger.warn('Edit window expired', { messageId, userId });
      return null;
    }
    
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: newContent,
        editedAt: new Date(),
      },
    });
    
    return updated;
  } catch (error) {
    logger.error('Failed to edit message', { error, messageId });
    return null;
  }
}

// ==========================================
// PARTITIONING & ARCHIVAL
// ==========================================

/**
 * Generate partition key for a date
 */
function getPartitionKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${month.toString().padStart(2, '0')}`;
}

/**
 * Archive old messages to cold storage
 */
export async function archiveOldMessages(): Promise<{ archived: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS);
  
  logger.info('Starting message archival', { cutoffDate });
  
  try {
    // In production, this would move to S3/cold storage
    // For now, we just mark them as archived
    const result = await prisma.message.updateMany({
      where: {
        createdAt: { lt: cutoffDate },
        isArchived: false,
      },
      data: {
        isArchived: true,
      },
    });
    
    logger.info('Message archival complete', { archived: result.count });
    
    return { archived: result.count };
  } catch (error) {
    logger.error('Failed to archive messages', { error });
    throw error;
  }
}

/**
 * Get conversation statistics
 */
export async function getConversationStats(conversationId: string): Promise<MessageStats> {
  try {
    const [messageCount, participants, lastMessage] = await Promise.all([
      prisma.message.count({
        where: { conversationId, deletedAt: null },
      }),
      prisma.conversationParticipant.count({
        where: { conversationId },
      }),
      prisma.message.findFirst({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    
    const mediaCount = await prisma.message.count({
      where: {
        conversationId,
        deletedAt: null,
        type: { in: ['IMAGE', 'FILE'] },
      },
    });
    
    return {
      totalMessages: messageCount,
      mediaMessages: mediaCount,
      activeParticipants: participants,
      lastActivity: lastMessage?.createdAt || null,
    };
  } catch (error) {
    logger.error('Failed to get conversation stats', { error, conversationId });
    throw error;
  }
}

// ==========================================
// SEARCH
// ==========================================

/**
 * Search messages within a conversation
 */
export async function searchMessages(
  conversationId: string,
  query: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const messages = await prisma.message.findMany({
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
  } catch (error) {
    logger.error('Failed to search messages', { error, conversationId, query });
    return [];
  }
}

export const chatStorageService = {
  storeMessage,
  getMessages,
  markAsRead,
  deleteMessage,
  editMessage,
  archiveOldMessages,
  getConversationStats,
  searchMessages,
};
