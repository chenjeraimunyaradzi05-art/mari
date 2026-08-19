"use strict";
/**
 * Socket.IO Real-time Service
 * Handles notifications, messages, and real-time updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketHandlers = initializeSocketHandlers;
exports.isUserOnline = isUserOnline;
exports.getOnlineUsers = getOnlineUsers;
exports.sendRealTimeMessage = sendRealTimeMessage;
exports.createNotification = createNotification;
exports.emitToUser = emitToUser;
exports.emitJobApplicationUpdate = emitJobApplicationUpdate;
exports.emitNewJobMatch = emitNewJobMatch;
exports.sendNotification = sendNotification;
const jwt_1 = require("../utils/jwt");
const logger_1 = require("../utils/logger");
const prisma_1 = require("../utils/prisma");
const i18n_service_1 = require("./i18n.service");
const region_1 = require("../utils/region");
const contentSafety_1 = require("../utils/contentSafety");
const direct_message_service_1 = require("./direct-message.service");
// Store active connections
const userSockets = new Map();
let ioInstance = null;
function initializeSocketHandlers(io) {
    ioInstance = io;
    // Authentication middleware
    io.use(async (socket, next) => {
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
            const payload = (0, jwt_1.verifyToken)(token);
            if (!payload || typeof payload === 'string') {
                return next(new Error('Invalid token'));
            }
            socket.userId = payload.userId;
            next();
        }
        catch (error) {
            next(new Error('Authentication failed'));
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.userId;
        if (!userId) {
            socket.disconnect();
            return;
        }
        // Track user connection
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
        // Join user's personal room
        socket.join(`user:${userId}`);
        logger_1.logger.info('Socket connected', { userId, socketId: socket.id });
        // ==========================================
        // NOTIFICATION HANDLERS
        // ==========================================
        socket.on('notifications:subscribe', () => {
            socket.join(`notifications:${userId}`);
            logger_1.logger.debug('User subscribed to notifications', { userId });
        });
        socket.on('notifications:mark_read', async (notificationId) => {
            try {
                await prisma_1.prisma.notification.update({
                    where: { id: notificationId, userId },
                    data: { isRead: true, readAt: new Date() },
                });
                socket.emit('notifications:updated', { id: notificationId, isRead: true });
            }
            catch (error) {
                logger_1.logger.error('Failed to mark notification read', { error, notificationId });
            }
        });
        socket.on('notifications:mark_all_read', async () => {
            try {
                await prisma_1.prisma.notification.updateMany({
                    where: { userId, isRead: false },
                    data: { isRead: true, readAt: new Date() },
                });
                socket.emit('notifications:all_read');
            }
            catch (error) {
                logger_1.logger.error('Failed to mark all notifications read', { error });
            }
        });
        // ==========================================
        // MESSAGING HANDLERS
        // ==========================================
        socket.on('messages:join_conversation', (otherUserId) => {
            const roomId = getConversationRoomId(userId, otherUserId);
            socket.join(roomId);
            logger_1.logger.debug('User joined conversation', { userId, otherUserId, roomId });
        });
        socket.on('messages:leave_conversation', (otherUserId) => {
            const roomId = getConversationRoomId(userId, otherUserId);
            socket.leave(roomId);
        });
        socket.on('messages:send', async (data) => {
            try {
                const receiverId = typeof data?.receiverId === 'string' ? data.receiverId : '';
                const content = (0, contentSafety_1.normalizeUserText)(data?.content, {
                    field: 'content',
                    maxLength: contentSafety_1.CONTENT_LIMITS.directMessage,
                });
                const conversation = await (0, direct_message_service_1.getOrCreateDirectConversation)(userId, receiverId);
                const [message] = await prisma_1.prisma.$transaction([
                    prisma_1.prisma.message.create({
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
                    prisma_1.prisma.conversation.update({
                        where: { id: conversation.id },
                        data: {
                            lastMessageAt: new Date(),
                            messageCount: { increment: 1 },
                        },
                    }),
                    prisma_1.prisma.conversationParticipant.updateMany({
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
                    i18nKey: i18n_service_1.NOTIFICATION_KEYS.MESSAGE_RECEIVED,
                    i18nParams: { name: message.sender.firstName },
                    link: `/dashboard/messages?user=${userId}`,
                });
                logger_1.logger.debug('Message sent', { from: userId, to: receiverId, messageId: message.id });
            }
            catch (error) {
                logger_1.logger.error('Failed to send message', { error });
                socket.emit('messages:error', { message: 'Failed to send message' });
            }
        });
        socket.on('messages:typing', (receiverId) => {
            const roomId = getConversationRoomId(userId, receiverId);
            socket.to(roomId).emit('messages:user_typing', { userId });
        });
        socket.on('messages:stop_typing', (receiverId) => {
            const roomId = getConversationRoomId(userId, receiverId);
            socket.to(roomId).emit('messages:user_stopped_typing', { userId });
        });
        socket.on('messages:mark_read', async (senderId) => {
            try {
                await prisma_1.prisma.message.updateMany({
                    where: {
                        senderId,
                        receiverId: userId,
                        isRead: false,
                    },
                    data: { isRead: true, readAt: new Date() },
                });
                const roomId = getConversationRoomId(userId, senderId);
                io.to(roomId).emit('messages:read', { readerId: userId });
            }
            catch (error) {
                logger_1.logger.error('Failed to mark messages read', { error });
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
            logger_1.logger.info('Socket disconnected', { userId, socketId: socket.id });
        });
    });
    return io;
}
// ==========================================
// HELPER FUNCTIONS
// ==========================================
function getConversationRoomId(userId1, userId2) {
    return `conversation:${[userId1, userId2].sort().join(':')}`;
}
function isUserOnline(userId) {
    return userSockets.has(userId) && userSockets.get(userId).size > 0;
}
function getOnlineUsers() {
    return Array.from(userSockets.keys());
}
async function sendRealTimeMessage(receiverId, message) {
    if (!ioInstance)
        return;
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
async function createNotification(io, data) {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: data.userId },
            select: { preferredLocale: true, region: true },
        });
        const locale = (0, region_1.getLocaleForUser)(user);
        const resolvedMessage = data.message || (data.i18nKey
            ? i18n_service_1.i18nService.tSync(data.i18nKey, data.i18nParams, locale)
            : undefined);
        const notification = await prisma_1.prisma.notification.create({
            data: {
                userId: data.userId,
                type: data.type,
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
    }
    catch (error) {
        logger_1.logger.error('Failed to create notification', { error, data });
        throw error;
    }
}
async function emitToUser(io, userId, event, data) {
    io.to(`user:${userId}`).emit(event, data);
}
async function emitJobApplicationUpdate(io, userId, application) {
    io.to(`user:${userId}`).emit('applications:updated', application);
    await createNotification(io, {
        userId,
        type: 'APPLICATION_UPDATE',
        title: 'Application Update',
        i18nKey: i18n_service_1.NOTIFICATION_KEYS.JOB_APPLICATION_VIEWED,
        i18nParams: { jobTitle: application.jobTitle || 'your application' },
        link: `/dashboard/applications/${application.id}`,
    });
}
async function emitNewJobMatch(io, userId, job) {
    io.to(`user:${userId}`).emit('jobs:new_match', job);
    await createNotification(io, {
        userId,
        type: 'JOB_MATCH',
        title: 'New Job Match!',
        i18nKey: i18n_service_1.NOTIFICATION_KEYS.JOB_MATCH_FOUND,
        i18nParams: { jobTitle: job.title, company: job.organization?.name || 'a company' },
        link: `/dashboard/jobs/${job.id}`,
    });
}
async function sendNotification(data) {
    if (!ioInstance) {
        logger_1.logger.warn('Socket.IO not initialized, created notification only in DB');
        // Still create DB record even if socket is down/not ready
        return prisma_1.prisma.notification.create({
            data: {
                userId: data.userId,
                type: data.type,
                title: data.title,
                message: data.message,
                link: data.link,
            },
        });
    }
    return createNotification(ioInstance, data);
}
//# sourceMappingURL=socket.service.js.map