/**
 * Socket.IO Real-time Service
 * Handles notifications, messages, and real-time updates
 */
import { Server as SocketIOServer } from 'socket.io';
export declare function initializeSocketHandlers(io: SocketIOServer): SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare function isUserOnline(userId: string): boolean;
export declare function getOnlineUsers(): string[];
interface NotificationData {
    userId: string;
    type: string;
    title: string;
    message?: string;
    link?: string;
    data?: Record<string, unknown>;
    i18nKey?: string;
    i18nParams?: Record<string, string | number>;
}
export declare function sendRealTimeMessage(receiverId: string, message: any): Promise<void>;
export declare function createNotification(io: SocketIOServer, data: NotificationData): Promise<{
    message: string | null;
    data: import("@prisma/client/runtime/library").JsonValue | null;
    id: string;
    link: string | null;
    createdAt: Date;
    userId: string;
    title: string;
    type: import(".prisma/client").$Enums.NotificationType;
    isRead: boolean;
    readAt: Date | null;
}>;
export declare function emitToUser(io: SocketIOServer, userId: string, event: string, data: any): Promise<void>;
export declare function emitJobApplicationUpdate(io: SocketIOServer, userId: string, application: any): Promise<void>;
export declare function emitNewJobMatch(io: SocketIOServer, userId: string, job: any): Promise<void>;
export declare function sendNotification(data: NotificationData): Promise<{
    message: string | null;
    data: import("@prisma/client/runtime/library").JsonValue | null;
    id: string;
    link: string | null;
    createdAt: Date;
    userId: string;
    title: string;
    type: import(".prisma/client").$Enums.NotificationType;
    isRead: boolean;
    readAt: Date | null;
}>;
export {};
//# sourceMappingURL=socket.service.d.ts.map