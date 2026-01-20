/**
 * Chat Storage Service
 * Optimized message persistence with partitioning and archival
 * Phase 2: Backend Logic & Integrations
 */
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
/**
 * Store a new message with optimized indexing
 */
export declare function storeMessage(input: MessageInput): Promise<any>;
/**
 * Retrieve messages with efficient pagination
 */
export declare function getMessages(query: MessageQuery): Promise<{
    messages: any[];
    hasMore: boolean;
    oldestDate?: Date;
}>;
/**
 * Mark messages as read up to a certain point
 */
export declare function markAsRead(conversationId: string, userId: string, upToMessageId?: string): Promise<void>;
/**
 * Soft delete a message
 */
export declare function deleteMessage(messageId: string, userId: string): Promise<boolean>;
/**
 * Edit a message (within time limit)
 */
export declare function editMessage(messageId: string, userId: string, newContent: string): Promise<any | null>;
/**
 * Archive old messages to cold storage
 */
export declare function archiveOldMessages(): Promise<{
    archived: number;
}>;
/**
 * Get conversation statistics
 */
export declare function getConversationStats(conversationId: string): Promise<MessageStats>;
/**
 * Search messages within a conversation
 */
export declare function searchMessages(conversationId: string, query: string, limit?: number): Promise<any[]>;
export declare const chatStorageService: {
    storeMessage: typeof storeMessage;
    getMessages: typeof getMessages;
    markAsRead: typeof markAsRead;
    deleteMessage: typeof deleteMessage;
    editMessage: typeof editMessage;
    archiveOldMessages: typeof archiveOldMessages;
    getConversationStats: typeof getConversationStats;
    searchMessages: typeof searchMessages;
};
//# sourceMappingURL=chat-storage.service.d.ts.map