/**
 * Socket.IO Real-time Service
 * Handles notifications, messages, and real-time updates
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { authenticateSocketToken } from '../middleware/auth';
import { socketMessageThrottle } from '../middleware/socialLimits';
import { isBlockedRelationship } from '../utils/safety-store';
import { canOpenConversation } from './message-permissions.service';
import { assertContentAllowed } from './moderation.service';
import { pushPreview, pushToUser } from './push.service';

/** A direct message reaches the recipient's phone when no client of theirs is connected. */
function pushMessageIfAway(receiverId: string, message: { id?: string; conversationId?: string | null; senderId?: string; content?: string | null; sender?: { firstName?: string | null; lastName?: string | null } | null }) {
  if (isUserOnline(receiverId)) return;
  const name = [message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(' ').trim() || 'New message';
  void pushToUser(receiverId, 'MESSAGE', {
    title: name,
    body: pushPreview(message.content),
    link: message.senderId ? `/dashboard/messages?user=${message.senderId}` : '/dashboard/messages',
    data: { type: 'MESSAGE', conversationId: message.conversationId ?? undefined, messageId: message.id },
  });
}
import { prisma } from '../utils/prisma';
import { i18nService, NOTIFICATION_KEYS, SupportedLocale } from './i18n.service';
import { getLocaleForUser } from '../utils/region';
import { CONTENT_LIMITS, normalizeUserText } from '../utils/contentSafety';
import { findDirectConversation, getOrCreateDirectConversation } from './direct-message.service';
import { conversationTtl, expiryFor } from './message-expiry.service';
import { LIVE_CHAT_MAX_LENGTH, postChatMessage, recordViewerCount } from './livestream.service';

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

      // The same checks as the HTTP middleware: a token whose session was
      // logged out or revoked, or whose account is suspended, is refused
      // here too rather than keeping a live connection the REST API would
      // already have turned away.
      const principal = await authenticateSocketToken(token);
      socket.userId = principal.id;
      next();
    } catch {
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

        // The socket is a second door into someone's inbox, so it is held to
        // exactly what the REST route enforces: a ceiling on how fast one
        // account can send, no thread across a block, the recipient's "who
        // can message me" choice, and the same content moderation.
        if (!socketMessageThrottle.allow(userId)) {
          socket.emit('messages:error', {
            message: 'You are sending messages very quickly. Take a short break and try again.',
          });
          return;
        }
        if (!receiverId || receiverId === userId) {
          socket.emit('messages:error', { message: 'Choose someone to message' });
          return;
        }
        if (await isBlockedRelationship(userId, receiverId)) {
          socket.emit('messages:error', { message: 'You cannot message this user' });
          return;
        }
        const verdict = await canOpenConversation(userId, receiverId);
        if (!verdict.allowed) {
          socket.emit('messages:error', { message: verdict.reason });
          return;
        }
        await assertContentAllowed(content, { kind: 'message', userId });

        const conversation = await getOrCreateDirectConversation(userId, receiverId);
        // Disappearing messages: stamped at send time from the thread's setting.
        const expiresAt = expiryFor(await conversationTtl(conversation.id));

        const [message] = await prisma.$transaction([
          prisma.message.create({
            data: {
              conversationId: conversation.id,
              senderId: userId,
              receiverId,
              content,
              type: 'TEXT',
              expiresAt,
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

        // Union of the two rooms, so a receiver who has not opened the thread
        // still gets the message and one who has does not get it twice.
        io.to(roomId).to(`user:${receiverId}`).emit('messages:new', message);

        // Also emit to receiver's personal room for notification badge
        io.to(`user:${receiverId}`).emit('messages:unread_count_updated');

        if (isUserOnline(receiverId)) {
          io.to(`user:${userId}`).emit('messages:delivered', {
            conversationId: conversation.id,
            messageIds: [message.id],
            receiverId,
          });
        }

        pushMessageIfAway(receiverId, message);

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
        // A refusal the sender can act on (moderation, permissions) is said
        // plainly; anything else stays generic so internals never leak.
        const status = (error as { statusCode?: number })?.statusCode;
        const operational = typeof status === 'number' && status >= 400 && status < 500;
        if (!operational) logger.error('Failed to send message', { error });
        socket.emit('messages:error', {
          message: operational && error instanceof Error ? error.message : 'Failed to send message',
        });
      }
    });

    socket.on('messages:typing', (payload: TypingPayload) => {
      const { receiverId, conversationId } = parseTypingPayload(payload);
      if (!receiverId) return;
      const roomId = getConversationRoomId(userId, receiverId);
      socket.to(roomId).emit('messages:user_typing', { userId, conversationId });
    });

    socket.on('messages:stop_typing', (payload: TypingPayload) => {
      const { receiverId, conversationId } = parseTypingPayload(payload);
      if (!receiverId) return;
      const roomId = getConversationRoomId(userId, receiverId);
      socket.to(roomId).emit('messages:user_stopped_typing', { userId, conversationId });
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
        if (typeof senderId !== 'string' || !senderId) return;

        // The sender needs to know *which* of their messages turned blue, and
        // in which thread — a bare readerId leaves the client guessing.
        const conversationId = await findDirectConversation(userId, senderId);
        if (!conversationId) return;

        const unread = await prisma.message.findMany({
          where: { conversationId, senderId, receiverId: userId, isRead: false },
          select: { id: true },
        });
        if (unread.length === 0) return;

        const messageIds = unread.map((message) => message.id);
        await prisma.message.updateMany({
          where: { id: { in: messageIds } },
          data: { isRead: true, readAt: new Date() },
        });

        const payload = { conversationId, readerId: userId, messageIds };
        const roomId = getConversationRoomId(userId, senderId);
        io.to(roomId).emit('messages:read', payload);
        // The sender may have the thread closed and so not be in the room; their
        // personal room always reaches them.
        io.to(`user:${senderId}`).emit('messages:read', payload);
      } catch (error) {
        logger.error('Failed to mark messages read', { error });
      }
    });

    // ==========================================
    // LIVE STREAM HANDLERS
    // ==========================================
    // A viewer joins the stream's room for chat, gifts and the viewer count;
    // the count is simply the room's size, so leaving (or dropping) is
    // reflected the moment it happens. The index room carries "someone went
    // live / ended" for the list page.

    const joinedLiveRooms = new Set<string>();

    const broadcastViewerCount = (streamId: string) => {
      const count = liveRoomSize(streamId);
      io.to(getLiveRoomId(streamId)).emit('live:viewers', { streamId, count });
      void recordViewerCount(streamId, count);
    };

    socket.on('live:join', async (streamId: string) => {
      try {
        if (typeof streamId !== 'string' || !streamId) return;
        const stream = await prisma.liveStream.findUnique({
          where: { id: streamId },
          select: { id: true, status: true, hostId: true },
        });
        if (!stream) {
          socket.emit('live:error', { streamId, message: 'Stream not found' });
          return;
        }
        // The host may sit in the room before going live to watch chat fill up.
        if (stream.status !== 'LIVE' && stream.hostId !== userId) {
          socket.emit('live:error', { streamId, message: 'This stream is not live' });
          return;
        }
        socket.join(getLiveRoomId(streamId));
        joinedLiveRooms.add(streamId);
        broadcastViewerCount(streamId);
      } catch (error) {
        logger.error('Failed to join live room', { error, streamId });
      }
    });

    socket.on('live:leave', (streamId: string) => {
      if (typeof streamId !== 'string' || !streamId) return;
      socket.leave(getLiveRoomId(streamId));
      joinedLiveRooms.delete(streamId);
      broadcastViewerCount(streamId);
    });

    socket.on('live:join_index', () => socket.join(getLiveRoomId('index')));
    socket.on('live:leave_index', () => socket.leave(getLiveRoomId('index')));

    socket.on('live:chat', async (data: { streamId?: string; content?: string }) => {
      const streamId = typeof data?.streamId === 'string' ? data.streamId : '';
      try {
        if (!streamId) return;
        const content = normalizeUserText(data?.content, {
          field: 'content',
          maxLength: LIVE_CHAT_MAX_LENGTH,
        });
        // postChatMessage broadcasts live:message to the room itself.
        await postChatMessage(streamId, userId, content);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Message not sent';
        socket.emit('live:error', { streamId, message });
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
      // The socket has already left its rooms; recount for the streams it was
      // watching so the number viewers see drops with it.
      for (const streamId of joinedLiveRooms) {
        broadcastViewerCount(streamId);
      }
      joinedLiveRooms.clear();

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

// Typing used to be a bare counterpart id. Clients that know their DB
// conversation id may send it too, so the receiver can key the indicator
// without re-deriving it; older callers keep working unchanged.
type TypingPayload = string | { receiverId?: unknown; conversationId?: unknown } | undefined;

function parseTypingPayload(payload: TypingPayload): {
  receiverId: string | null;
  conversationId?: string;
} {
  if (typeof payload === 'string') {
    return { receiverId: payload || null };
  }

  if (!payload || typeof payload !== 'object') {
    return { receiverId: null };
  }

  return {
    receiverId: typeof payload.receiverId === 'string' && payload.receiverId ? payload.receiverId : null,
    conversationId: typeof payload.conversationId === 'string' ? payload.conversationId : undefined,
  };
}

export function getChannelRoomId(channelId: string): string {
  return `channel:${channelId}`;
}

export function getLiveRoomId(streamId: string): string {
  return `live:${streamId}`;
}

/** How many sockets are watching a stream right now. */
export function liveRoomSize(streamId: string): number {
  if (!ioInstance) return 0;
  return ioInstance.sockets.adapter.rooms.get(getLiveRoomId(streamId))?.size ?? 0;
}

// The live stream routes and service push chat, gifts and status changes to
// the room without importing `io` from index.ts (same reason as emitToChannel).
export function emitToLiveRoom(streamId: string, event: string, payload: unknown): void {
  if (!ioInstance) {
    logger.debug('Socket.IO not initialized, skipping live broadcast', { streamId, event });
    return;
  }
  ioInstance.to(getLiveRoomId(streamId)).emit(event, payload);
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

// Same reason as emitToChannel: the REST message routes need to push without
// importing `io` from index.ts.
export function emitToUserRoom(userId: string, event: string, payload: unknown): void {
  if (!ioInstance) {
    logger.debug('Socket.IO not initialized, skipping user broadcast', { userId, event });
    return;
  }
  ioInstance.to(`user:${userId}`).emit(event, payload);
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

  // A recipient with nothing connected hears about it on their phone instead.
  pushMessageIfAway(receiverId, message);

  // 3. Tell the sender it actually reached a live client. This is the only
  // honest "delivered" signal we have — anything stronger would need an ack
  // from the receiver, and claiming delivery to an offline user would be a lie.
  if (message?.senderId && message?.id && isUserOnline(receiverId)) {
    ioInstance.to(`user:${message.senderId}`).emit('messages:delivered', {
      conversationId: message.conversationId,
      messageIds: [message.id],
      receiverId,
    });
  }

  // 4. Emit matching notification (Notification Center)
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

