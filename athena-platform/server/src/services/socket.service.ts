/**
 * Socket.IO Real-time Service
 * Handles notifications, messages, and real-time updates
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { i18nService, NOTIFICATION_KEYS, SupportedLocale } from './i18n.service';
import { getLocaleForUser } from '../utils/region';
import { CONTENT_LIMITS, normalizeUserText } from '../utils/contentSafety';
import { getOrCreateDirectConversation } from './direct-message.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

// Store active connections
const userSockets = new Map<string, Set<string>>();
let ioInstance: SocketIOServer | null = null;

export function initializeSocketHandlers(io: SocketIOServer) {
  ioInstance = io;
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const authToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
      const authHeader = socket.handshake.headers.authorization;
      const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : undefined;
      const token = authToken || bearerToken;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyToken(token);
      if (!payload || typeof payload === 'string') {
        return next(new Error('Invalid token'));
      }

      socket.userId = payload.userId;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId;
    
    if (!userId) {
      socket.disconnect();
      return;
    }

    // Track user connection
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Join user's personal room
    socket.join(`user:${userId}`);
    
    logger.info('Socket connected', { userId, socketId: socket.id });

    // ==========================================
    // NOTIFICATION HANDLERS
    // ==========================================

    socket.on('notifications:subscribe', () => {
      socket.join(`notifications:${userId}`);
      logger.debug('User subscribed to notifications', { userId });
    });

    socket.on('notifications:mark_read', async (notificationId: string) => {
      try {
        await prisma.notification.update({
          where: { id: notificationId, userId },
          data: { isRead: true, readAt: new Date() },
        });
        socket.emit('notifications:updated', { id: notificationId, isRead: true });
      } catch (error) {
        logger.error('Failed to mark notification read', { error, notificationId });
      }
    });

    socket.on('notifications:mark_all_read', async () => {
      try {
        await prisma.notification.updateMany({
          where: { userId, isRead: false },
          data: { isRead: true, readAt: new Date() },
        });
        socket.emit('notifications:all_read');
      } catch (error) {
        logger.error('Failed to mark all notifications read', { error });
      }
    });

    // ==========================================
    // MESSAGING HANDLERS
    // ==========================================

    socket.on('messages:join_conversation', (otherUserId: string) => {
      const roomId = getConversationRoomId(userId, otherUserId);
      socket.join(roomId);
      logger.debug('User joined conversation', { userId, otherUserId, roomId });
    });

    socket.on('messages:leave_conversation', (otherUserId: string) => {
      const roomId = getConversationRoomId(userId, otherUserId);
      socket.leave(roomId);
    });

    socket.on('messages:send', async (data: { receiverId: string; content: string }) => {
      try {
        const receiverId = typeof data?.receiverId === 'string' ? data.receiverId : '';
        const content = normalizeUserText(data?.content, {
          field: 'content',
          maxLength: CONTENT_LIMITS.directMessage,
        });

        const conversation = await getOrCreateDirectConversation(userId, receiverId);

        const [message] = await prisma.$transaction([
          prisma.message.create({
            data: {
              conversationId: conversation.id,
              senderId: userId,
              receiverId,
              content,
              type: 'TEXT',
            },
            include: {
              sender: {
                select: { id: true, firstName: true, lastName: true, avatar: true },
              },
            },
          }),
          prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              lastMessageAt: new Date(),
              messageCount: { increment: 1 },
            },
          }),
          prisma.conversationParticipant.updateMany({
            where: {
              conversationId: conversation.id,
              userId: { not: userId },
            },
            data: {
              hasUnread: true,
              unreadCount: { increment: 1 },
            },
          }),
        ]);

        const roomId = getConversationRoomId(userId, receiverId);

        // Emit to conversation room
        io.to(roomId).emit('messages:new', message);

        // Also emit to receiver's personal room for notification badge
        io.to(`user:${receiverId}`).emit('messages:unread_count_updated');

        // Create notification for receiver
        await createNotification(io, {
          userId: receiverId,
          type: 'MESSAGE',
          title: 'Athena',
          i18nKey: NOTIFICATION_KEYS.MESSAGE_RECEIVED,
          i18nParams: { name: message.sender.firstName },
          link: `/dashboard/messages?user=${userId}`,
        });

        logger.debug('Message sent', { from: userId, to: receiverId, messageId: message.id });
      } catch (error) {
        logger.error('Failed to send message', { error });
        socket.emit('messages:error', { message: 'Failed to send message' });
      }
    });

    socket.on('messages:typing', (receiverId: string) => {
      const roomId = getConversationRoomId(userId, receiverId);
      socket.to(roomId).emit('messages:user_typing', { userId });
    });

    socket.on('messages:stop_typing', (receiverId: string) => {
      const roomId = getConversationRoomId(userId, receiverId);
      socket.to(roomId).emit('messages:user_stopped_typing', { userId });
    });

    // ==========================================
    // CHANNEL HANDLERS
    // ==========================================

    // Channels are not conversations: membership decides who may listen, so the
    // room is only joined after checking ChannelMember (or public visibility).
    socket.on('channels:join', async (channelId: string) => {
      try {
        if (typeof channelId !== 'string' || !channelId) return;

        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
          select: { id: true, isPublic: true },
        });
        if (!channel) return;

        if (!channel.isPublic) {
          const membership = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } },
            select: { id: true },
          });
          if (!membership) {
            socket.emit('channels:error', { channelId, message: 'Not a member of this channel' });
            return;
          }
        }

        socket.join(getChannelRoomId(channelId));
        logger.debug('User joined channel room', { userId, channelId });
      } catch (error) {
        logger.error('Failed to join channel room', { error, channelId });
      }
    });

    socket.on('channels:leave', (channelId: string) => {
      if (typeof channelId !== 'string' || !channelId) return;
      socket.leave(getChannelRoomId(channelId));
    });

    socket.on('channels:typing', (channelId: string) => {
      if (typeof channelId !== 'string' || !channelId) return;
      socket.to(getChannelRoomId(channelId)).emit('channels:user_typing', { channelId, userId });
    });

    socket.on('channels:stop_typing', (channelId: string) => {
      if (typeof channelId !== 'string' || !channelId) return;
      socket
        .to(getChannelRoomId(channelId))
        .emit('channels:user_stopped_typing', { channelId, userId });
    });

    socket.on('messages:mark_read', async (senderId: string) => {
      try {
        await prisma.message.updateMany({
          where: {
            senderId,
            receiverId: userId,
            isRead: false,
          },
          data: { isRead: true, readAt: new Date() },
        });

        const roomId = getConversationRoomId(userId, senderId);
        io.to(roomId).emit('messages:read', { readerId: userId });
      } catch (error) {
        logger.error('Failed to mark messages read', { error });
      }
    });

    // ==========================================
    // PRESENCE HANDLERS
    // ==========================================

    socket.on('presence:online', () => {
      socket.broadcast.emit('presence:user_online', { userId });
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on('disconnect', () => {
      if (userId) {
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            // User fully offline
            socket.broadcast.emit('presence:user_offline', { userId });
          }
        }
      }
      logger.info('Socket disconnected', { userId, socketId: socket.id });
    });
  });

  return io;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getConversationRoomId(userId1: string, userId2: string): string {
  return `conversation:${[userId1, userId2].sort().join(':')}`;
}

export function getChannelRoomId(channelId: string): string {
  return `channel:${channelId}`;
}

// Lets the REST channel routes broadcast without importing `io` from index.ts,
// which would close an import cycle (index -> routes -> index).
export function emitToChannel(channelId: string, event: string, payload: unknown): void {
  if (!ioInstance) {
    logger.debug('Socket.IO not initialized, skipping channel broadcast', { channelId, event });
    return;
  }
  ioInstance.to(getChannelRoomId(channelId)).emit(event, payload);
}

export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}

export function getOnlineUsers(): string[] {
  return Array.from(userSockets.keys());
}

// ==========================================
// SERVER-SIDE EMIT FUNCTIONS
// ==========================================

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

export async function sendRealTimeMessage(receiverId: string, message: any) {
  if (!ioInstance) return;
  
  // 1. Emit to main "user:ID" room (for notifications badge)
  ioInstance.to(`user:${receiverId}`).emit('messages:new_count', { 
    userId: receiverId, 
    increment: 1 
  });
  
  // 2. Emit to `user:${receiverId}` with the full message
  ioInstance.to(`user:${receiverId}`).emit('messages:new', message);

  // 3. Emit matching notification (Notification Center)
  // We avoid createNotification here to prevent double-DB write via socket service if createNotification writes to DB too?
  // Check createNotification logic: Yes it does.
  // Actually, messages usually don't populate the "Bell" notification list in apps like LinkedIn, 
  // they live in the "Message" tab. 
  // But for this MVP, let's skip the Notification DB entry for messages to keep the Bell clean for "Likes/Jobs".
}

export async function createNotification(io: SocketIOServer, data: NotificationData) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { preferredLocale: true, region: true },
    });

    const locale = getLocaleForUser(user) as SupportedLocale;
    const resolvedMessage = data.message || (data.i18nKey
      ? i18nService.tSync(data.i18nKey, data.i18nParams, locale)
      : undefined);

    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        title: data.title,
        message: resolvedMessage,
        link: data.link,
        data: {
          ...(data.data || {}),
          ...(data.i18nKey ? { i18nKey: data.i18nKey, i18nParams: data.i18nParams } : {}),
        },
      },
    });

    // Emit to user's room
    io.to(`user:${data.userId}`).emit('notifications:new', notification);
    io.to(`notifications:${data.userId}`).emit('notifications:new', notification);

    return notification;
  } catch (error) {
    logger.error('Failed to create notification', { error, data });
    throw error;
  }
}

export async function emitToUser(io: SocketIOServer, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data);
}

export async function emitJobApplicationUpdate(io: SocketIOServer, userId: string, application: any) {
  io.to(`user:${userId}`).emit('applications:updated', application);
  
  await createNotification(io, {
    userId,
    type: 'APPLICATION_UPDATE',
    title: 'Application Update',
    i18nKey: NOTIFICATION_KEYS.JOB_APPLICATION_VIEWED,
    i18nParams: { jobTitle: application.jobTitle || 'your application' },
    link: `/dashboard/applications/${application.id}`,
  });
}

export async function emitNewJobMatch(io: SocketIOServer, userId: string, job: any) {
  io.to(`user:${userId}`).emit('jobs:new_match', job);
  
  await createNotification(io, {
    userId,
    type: 'JOB_MATCH',
    title: 'New Job Match!',
    i18nKey: NOTIFICATION_KEYS.JOB_MATCH_FOUND,
    i18nParams: { jobTitle: job.title, company: job.organization?.name || 'a company' },
    link: `/dashboard/jobs/${job.id}`,
  });
}

export async function sendNotification(data: NotificationData) {
  if (!ioInstance) {
    logger.warn('Socket.IO not initialized, created notification only in DB');
    // Still create DB record even if socket is down/not ready
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        title: data.title,
        message: data.message,
        link: data.link,
      },
    });
  }
  return createNotification(ioInstance, data);
}

