export declare function assertCanMessageUser(senderId: string, receiverId: string): Promise<{
    id: string;
    allowMessages: boolean;
}>;
export declare function findDirectConversation(userIdA: string, userIdB: string): Promise<string | null>;
export declare function getOrCreateDirectConversation(senderId: string, receiverId: string): Promise<{
    id: string;
    isNew: boolean;
}>;
export declare function assertCanSendInConversation(conversationId: string, senderId: string): Promise<{
    conversation: {
        participants: {
            conversationId: string;
            id: string;
            userId: string;
            joinedAt: Date;
            hasUnread: boolean;
            unreadCount: number;
            lastReadAt: Date;
            lastReadMessageId: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        messageCount: number;
        lastMessageAt: Date;
        lastMessageId: string | null;
    };
    participantIds: string[];
    receiverId: string;
}>;
//# sourceMappingURL=direct-message.service.d.ts.map