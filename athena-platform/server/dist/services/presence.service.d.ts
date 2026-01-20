/**
 * Presence Service
 * ================
 * Real-time user presence tracking using Redis and WebSockets.
 */
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
export type UserStatus = 'online' | 'away' | 'busy' | 'offline';
export interface PresenceInfo {
    userId: string;
    status: UserStatus;
    lastSeen: Date;
    deviceType?: 'web' | 'mobile' | 'desktop';
    activeContext?: string;
}
declare class PresenceService {
    private redis;
    private io;
    private localPresence;
    private heartbeatIntervals;
    initialize(redis: Redis, io: SocketIOServer): void;
    setOnline(userId: string, options?: {
        deviceType?: 'web' | 'mobile' | 'desktop';
        activeContext?: string;
    }): Promise<void>;
    setAway(userId: string): Promise<void>;
    setBusy(userId: string): Promise<void>;
    setOffline(userId: string): Promise<void>;
    getPresence(userId: string): Promise<PresenceInfo | null>;
    getMultiplePresence(userIds: string[]): Promise<Map<string, PresenceInfo>>;
    getOnlineUsers(userIds: string[]): Promise<string[]>;
    updateActiveContext(userId: string, context: string): Promise<void>;
    handleSocketConnection(userId: string, socketId: string): void;
    handleSocketDisconnection(userId: string, socketId: string): void;
    private updatePresence;
    private broadcastPresenceUpdate;
    private handleExternalPresenceUpdate;
    private startHeartbeat;
    private stopHeartbeat;
    cleanup(): Promise<void>;
}
export declare const presenceService: PresenceService;
export {};
//# sourceMappingURL=presence.service.d.ts.map