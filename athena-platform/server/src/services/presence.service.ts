/**
 * Presence Service
 * ================
 * Real-time user presence tracking using Redis and WebSockets.
 */

import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

// ===========================================
// CONFIGURATION
// ===========================================

const PRESENCE_KEY_PREFIX = 'presence:';
const PRESENCE_TTL = 120; // 2 minutes
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// ===========================================
// TYPES
// ===========================================

export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export interface PresenceInfo {
  userId: string;
  status: UserStatus;
  lastSeen: Date;
  deviceType?: 'web' | 'mobile' | 'desktop';
  activeContext?: string; // e.g., 'feed', 'messages', 'jobs'
}

// ===========================================
// PRESENCE SERVICE CLASS
// ===========================================

class PresenceService {
  private redis: Redis | null = null;
  private io: SocketIOServer | null = null;
  private localPresence: Map<string, PresenceInfo> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  initialize(redis: Redis, io: SocketIOServer) {
    this.redis = redis;
    this.io = io;

    // Subscribe to presence updates from other server instances
    const subscriber = redis.duplicate();
    subscriber.subscribe('presence:updates');
    subscriber.on('message', (channel, message) => {
      if (channel === 'presence:updates') {
        const update = JSON.parse(message);
        this.handleExternalPresenceUpdate(update);
      }
    });

    logger.info('Presence service initialized');
  }

  // ===========================================
  // PUBLIC METHODS
  // ===========================================

  async setOnline(
    userId: string,
    options: {
      deviceType?: 'web' | 'mobile' | 'desktop';
      activeContext?: string;
    } = {}
  ): Promise<void> {
    const presence: PresenceInfo = {
      userId,
      status: 'online',
      lastSeen: new Date(),
      deviceType: options.deviceType || 'web',
      activeContext: options.activeContext,
    };

    await this.updatePresence(presence);
    this.startHeartbeat(userId);
  }

  async setAway(userId: string): Promise<void> {
    const existing = await this.getPresence(userId);
    if (existing) {
      existing.status = 'away';
      existing.lastSeen = new Date();
      await this.updatePresence(existing);
    }
  }

  async setBusy(userId: string): Promise<void> {
    const existing = await this.getPresence(userId);
    if (existing) {
      existing.status = 'busy';
      existing.lastSeen = new Date();
      await this.updatePresence(existing);
    }
  }

  async setOffline(userId: string): Promise<void> {
    this.stopHeartbeat(userId);

    if (this.redis) {
      await this.redis.del(`${PRESENCE_KEY_PREFIX}${userId}`);
    }
    this.localPresence.delete(userId);

    // Broadcast offline status
    this.broadcastPresenceUpdate({
      userId,
      status: 'offline',
      lastSeen: new Date(),
    });
  }

  async getPresence(userId: string): Promise<PresenceInfo | null> {
    // Check local cache first
    const local = this.localPresence.get(userId);
    if (local) return local;

    // Check Redis
    if (this.redis) {
      const data = await this.redis.get(`${PRESENCE_KEY_PREFIX}${userId}`);
      if (data) {
        const presence = JSON.parse(data) as PresenceInfo;
        presence.lastSeen = new Date(presence.lastSeen);
        this.localPresence.set(userId, presence);
        return presence;
      }
    }

    return null;
  }

  async getMultiplePresence(userIds: string[]): Promise<Map<string, PresenceInfo>> {
    const result = new Map<string, PresenceInfo>();

    if (!this.redis || userIds.length === 0) {
      return result;
    }

    const keys = userIds.map((id) => `${PRESENCE_KEY_PREFIX}${id}`);
    const values = await this.redis.mget(...keys);

    userIds.forEach((userId, index) => {
      const data = values[index];
      if (data) {
        const presence = JSON.parse(data) as PresenceInfo;
        presence.lastSeen = new Date(presence.lastSeen);
        result.set(userId, presence);
      }
    });

    return result;
  }

  async getOnlineUsers(userIds: string[]): Promise<string[]> {
    const presenceMap = await this.getMultiplePresence(userIds);
    return Array.from(presenceMap.entries())
      .filter(([_, info]) => info.status === 'online')
      .map(([userId]) => userId);
  }

  async updateActiveContext(userId: string, context: string): Promise<void> {
    const presence = await this.getPresence(userId);
    if (presence) {
      presence.activeContext = context;
      presence.lastSeen = new Date();
      await this.updatePresence(presence, false); // Don't broadcast for context updates
    }
  }

  // ===========================================
  // SOCKET HANDLERS
  // ===========================================

  handleSocketConnection(userId: string, socketId: string): void {
    this.setOnline(userId, { deviceType: 'web' });
    logger.debug('User connected', { userId, socketId });
  }

  handleSocketDisconnection(userId: string, socketId: string): void {
    // Small delay to handle page refreshes
    setTimeout(async () => {
      // Check if user has other active connections
      const userSockets = this.io?.sockets.adapter.rooms.get(`user:${userId}`);
      if (!userSockets || userSockets.size === 0) {
        await this.setOffline(userId);
        logger.debug('User went offline', { userId });
      }
    }, 5000);
  }

  // ===========================================
  // INTERNAL METHODS
  // ===========================================

  private async updatePresence(presence: PresenceInfo, broadcast: boolean = true): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${presence.userId}`;

    if (this.redis) {
      await this.redis.setex(key, PRESENCE_TTL, JSON.stringify(presence));
    }

    this.localPresence.set(presence.userId, presence);

    if (broadcast) {
      this.broadcastPresenceUpdate(presence);
    }
  }

  private broadcastPresenceUpdate(presence: PresenceInfo): void {
    // Broadcast to local sockets
    if (this.io) {
      this.io.emit('presence:update', {
        userId: presence.userId,
        status: presence.status,
        lastSeen: presence.lastSeen,
      });
    }

    // Publish to Redis for other server instances
    if (this.redis) {
      this.redis.publish('presence:updates', JSON.stringify(presence));
    }
  }

  private handleExternalPresenceUpdate(presence: PresenceInfo): void {
    // Update local cache from external update
    presence.lastSeen = new Date(presence.lastSeen);
    this.localPresence.set(presence.userId, presence);

    // Broadcast to local sockets (already done by the originating server)
    // Only needed if we want local clients to get the update immediately
  }

  private startHeartbeat(userId: string): void {
    this.stopHeartbeat(userId);

    const interval = setInterval(async () => {
      const presence = await this.getPresence(userId);
      if (presence && presence.status === 'online') {
        // Refresh TTL
        presence.lastSeen = new Date();
        await this.updatePresence(presence, false);
      } else {
        this.stopHeartbeat(userId);
      }
    }, HEARTBEAT_INTERVAL);

    this.heartbeatIntervals.set(userId, interval);
  }

  private stopHeartbeat(userId: string): void {
    const interval = this.heartbeatIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(userId);
    }
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  async cleanup(): Promise<void> {
    // Clear all heartbeat intervals
    for (const [userId, interval] of this.heartbeatIntervals) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();
    this.localPresence.clear();
    logger.info('Presence service cleaned up');
  }
}

// ===========================================
// SINGLETON EXPORT
// ===========================================

export const presenceService = new PresenceService();
