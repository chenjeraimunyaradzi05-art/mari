/**
 * Socket.IO Real-time Service
 * Handles notifications, messages, and real-time updates
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import {
  ACCOUNT_LOCKED_MESSAGE,
  authenticateSocketToken,
  EMAIL_NOT_VERIFIED_MESSAGE,
  SUSPENDED_ACCOUNT_MESSAGE,
} from '../middleware/auth';
import { liveChatThrottle, socketMessageThrottle } from '../middleware/socialLimits';
import { sessionEvents, SessionRevokedEvent } from '../utils/session-events';
import { isBlockedRelationship } from '../utils/safety-store';
import { blockedEitherWayIds, isBlockedEitherWay } from './audience.service';
import { pushPreview, pushToUser } from './push.service';

/** A direct message reaches the recipient's phone when no client of theirs is connected. */
function pushMessageIfAway(
  receiverId: string,
  message: { id?: string; conversationId?: string | null; senderId?: string; content?: string | null; sender?: { firstName?: string | null; displayName?: string | null } | null },
  options: { request?: boolean } = {}
) {
  if (isUserOnline(receiverId)) return;
  // Her public name, else her first name: a push title is read on a lock screen by whoever is holding the phone.
  const name = message.sender?.displayName?.trim() || message.sender?.firstName?.trim() || 'New message';
  void pushToUser(receiverId, 'MESSAGE', {
    // A request knocks once and says so; the preview waits until they accept.
    title: options.request ? `${name} wants to message you` : name,
    body: options.request ? 'Open your message requests to accept or decline.' : pushPreview(message.content),
    link: options.request
      ? '/dashboard/messages?tab=requests'
      : message.senderId ? `/dashboard/messages?user=${message.senderId}` : '/dashboard/messages',
    data: { type: 'MESSAGE', conversationId: message.conversationId ?? undefined, messageId: message.id },
  });
}
import { prisma } from '../utils/prisma';
import { i18nService, NOTIFICATION_KEYS, SupportedLocale } from './i18n.service';
import { getLocaleForUser } from '../utils/region';
import { directMessageGateRefusal } from '../middleware/account-gates';
import { accountStandingRefusal } from '../middleware/account-standing';
import { CONTENT_LIMITS, normalizeUserText } from '../utils/contentSafety';
import { findDirectConversation, readReceiptsWithheldFrom, sendDirectMessage } from './direct-message.service';
import { LIVE_CHAT_MAX_LENGTH, postChatMessage, recordViewerCount } from './livestream.service';
// presence.service imports emitToUserRoom from this file; the cycle resolves
// at call time, as it already does for livestream.service.
import { announcePresence } from './presence.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  /** The session the handshake token belonged to; a revocation names it. */
  sessionId?: string;
}

// Store active connections
const userSockets = new Map<string, Set<string>>();
let ioInstance: SocketIOServer | null = null;

/**
 * Ends the live connections a revocation covers: every socket of the
 * account, or only the one on the named session, sparing the session that
 * did the revoking. Without this, logging out everywhere or changing a
 * password ended the REST access but left the other devices' sockets
 * receiving messages until they next reconnected.
 */
export function disconnectRevokedSockets(io: SocketIOServer, event: SessionRevokedEvent): number {
  let closed = 0;
  for (const socket of io.sockets.sockets.values()) {
    const live = socket as AuthenticatedSocket;
    if (live.userId !== event.userId) continue;
    if (event.sessionId && live.sessionId !== event.sessionId) continue;
    if (event.exceptSessionId && live.sessionId === event.exceptSessionId) continue;
    live.emit('session:revoked', { reason: event.reason });
    live.disconnect(true);
    closed += 1;
  }
  if (closed > 0) {
    logger.info('Sockets closed after session revocation', { userId: event.userId, reason: event.reason, closed });
  }
  return closed;
}

/**
 * Whether an account may still send over a connection it opened earlier.
 *
 * A socket authenticates once, at the handshake. A member suspended or banned
 * afterwards kept a connection that went on sending direct messages and live
 * chat until it dropped: the REST API refuses her on her next request, but
 * nothing here read her standing again. Revoking her sessions closes her
 * sockets (disconnectRevokedSockets), and this is the second line behind that,
 * for a revocation that failed or a path that closed an account without
 * revoking. It is read from the database at the moment of sending, like the
 * REST middleware does, and an account that no longer exists is refused too.
 *
 * Returns the refusal to emit, or null when the account is in good standing.
 * The words are the ones every other surface uses, so the account's state is
 * never inferable from the wording.
 */
export async function closedAccountRefusal(userId: string): Promise<{ message: string; code: string } | null> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuspended: true, bannedAt: true, lockedAt: true, emailVerified: true },
  });
  if (!account || account.isSuspended || account.bannedAt) {
    return { message: SUSPENDED_ACCOUNT_MESSAGE, code: 'ACCOUNT_SUSPENDED' };
  }
  // She locked it herself. Locking closes her sockets too (the revocation says
  // so), and this is the second line behind that, in its own words.
  if (account.lockedAt) {
    return { message: ACCOUNT_LOCKED_MESSAGE, code: 'ACCOUNT_LOCKED' };
  }
  // An address an admin has un-confirmed holds no session on the REST API
  // (authenticate and /refresh refuse it), and the same rule applies to a
  // connection opened before that happened: sign-in would refuse it, so a
  // message from it is refused too. Only an explicit false counts, as in
  // authenticate, so a row that does not say is not read as unconfirmed.
  if (account.emailVerified === false) {
    return { message: EMAIL_NOT_VERIFIED_MESSAGE, code: 'EMAIL_NOT_VERIFIED' };
  }
  return null;
}

/**
 * The account-standing rule authenticate applies to every write over HTTP
 * (middleware/account-standing.ts), asked of a socket: a member a reviewer has
 * refused, or whose date of birth is under the minimum, may not act on other
 * members. Live chat arrives over the socket (the page sends there, and the
 * REST route behind authenticate is the other door), so without this a refused
 * member could still speak in a host's room.
 *
 * A refusal of the message and not of the connection: she can go on reading,
 * which is what the rule leaves her. Returns null when she may write, and also
 * when her row cannot be found, because closedAccountRefusal has already turned
 * that away.
 */
export async function standingRefusal(userId: string): Promise<{ message: string; code: string } | null> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { womanVerificationStatus: true, dateOfBirth: true },
  });
  if (!account) return null;
  // The path is not one any exemption names, so a write is refused.
  const refusal = accountStandingRefusal(account, 'POST', '/socket');
  return refusal ? { message: refusal.error, code: refusal.code } : null;
}

export function initializeSocketHandlers(io: SocketIOServer) {
  ioInstance = io;
  sessionEvents.onRevoked((event) => {
    try {
      disconnectRevokedSockets(io, event);
    } catch (error) {
      logger.warn('Could not close sockets after revocation', { error: error instanceof Error ? error.message : String(error) });
    }
  });
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
      socket.sessionId = principal.sessionId;
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

    // The pair room carries the typing notices and the read receipts between
    // two members, and anyone could join any pair's room by naming the other
    // member: a man she had blocked could sit in theirs and watch "typing" come
    // and go. Nobody joins the room of a pair they are on either side of a block
    // with. If the lists cannot be read the join is refused, which costs a
    // typing dot and nothing else.
    socket.on('messages:join_conversation', async (otherUserId: string) => {
      if (typeof otherUserId !== 'string' || !otherUserId) return;
      if (await pairIsBlocked(userId, otherUserId)) return;
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
        // account can send, her standing, the women-only floor and the age gate
        // here, and from sendDirectMessage the block, the recipient's "who can
        // message me" choice, the request rules and the content moderation.
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
        // Her standing now, not at the handshake: a suspension or a ban made
        // since then ends this connection instead of letting it keep sending.
        const closed = await closedAccountRefusal(userId);
        if (closed) {
          socket.emit('messages:error', closed);
          socket.disconnect(true);
          return;
        }
        // The women-only floor and the age gate are about her, and stay at the
        // door; everything about who may write to whom is in sendDirectMessage,
        // the function the REST route calls, so this door cannot be held to less
        // than that one. It used to be: it skipped the request cap and a declined
        // request, so an opener could send without limit past a no, and every line
        // buzzed her phone and wrote a notification because the quiet rule for
        // requests was only on the REST side.
        const gateRefusal = await directMessageGateRefusal(userId);
        if (gateRefusal) {
          socket.emit('messages:error', gateRefusal);
          return;
        }
        const sent = await sendDirectMessage({ senderId: userId, receiverId, content });

        // The recipient was reached by sendDirectMessage. The sender's own
        // devices, every one of them and not only the one that sent, get the
        // stored message here, which is how a socket client sees its own line.
        io.to(`user:${userId}`).emit('messages:new', sent.message);

        logger.debug('Message sent', { from: userId, to: receiverId, messageId: sent.message.id });
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

    // "Is typing" is a notice to the other member of the pair, and a member on
    // either side of a block with her is told nothing by her, a typing dot
    // included; the channel notices below hold to the same rule, and these did
    // not. If the block lists cannot be read the notice is not sent: it is a
    // nicety, and the cost of a missing one is nothing.
    socket.on('messages:typing', async (payload: TypingPayload) => {
      const { receiverId, conversationId } = parseTypingPayload(payload);
      if (!receiverId) return;
      if (await pairIsBlocked(userId, receiverId)) return;
      const roomId = getConversationRoomId(userId, receiverId);
      socket.to(roomId).emit('messages:user_typing', { userId, conversationId });
    });

    socket.on('messages:stop_typing', async (payload: TypingPayload) => {
      const { receiverId, conversationId } = parseTypingPayload(payload);
      if (!receiverId) return;
      if (await pairIsBlocked(userId, receiverId)) return;
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

    // "Is typing" names her id to everyone in the room, and a member on either
    // side of a block with her is not among them (the replies are held to the
    // same rule). If the block lists cannot be read the indicator is not sent:
    // it is a nicety, and the cost of a missing one is nothing.
    socket.on('channels:typing', async (channelId: string) => {
      if (typeof channelId !== 'string' || !channelId) return;
      const except = await blockedRoomsOf(userId);
      if (!except) return;
      const room = socket.to(getChannelRoomId(channelId));
      (except.length > 0 ? room.except(except) : room).emit('channels:user_typing', { channelId, userId });
    });

    socket.on('channels:stop_typing', async (channelId: string) => {
      if (typeof channelId !== 'string' || !channelId) return;
      const except = await blockedRoomsOf(userId);
      if (!except) return;
      const room = socket.to(getChannelRoomId(channelId));
      (except.length > 0 ? room.except(except) : room).emit('channels:user_stopped_typing', { channelId, userId });
    });

    // ==========================================
    // GROUP CHAT HANDLERS
    // ==========================================

    // A group's chat room is for its members: GroupMember decides, and a
    // banned row is not a member. The REST chat routes broadcast into the
    // room (groups:message, groups:message_removed, groups:message_pinned).
    socket.on('groups:join', async (groupId: string) => {
      try {
        if (typeof groupId !== 'string' || !groupId) return;

        const membership = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId } },
          select: { isBanned: true },
        });
        if (!membership || membership.isBanned) {
          socket.emit('groups:error', { groupId, message: 'Not a member of this group' });
          return;
        }

        socket.join(getGroupRoomId(groupId));
        logger.debug('User joined group room', { userId, groupId });
      } catch (error) {
        logger.error('Failed to join group room', { error, groupId });
      }
    });

    socket.on('groups:leave', (groupId: string) => {
      if (typeof groupId !== 'string' || !groupId) return;
      socket.leave(getGroupRoomId(groupId));
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

        // The messages are read either way; what she can switch off is the
        // sender being told. "Hide read receipts" in her safety settings used
        // to be stored and then ignored here, so the blue ticks went out
        // regardless. If her settings cannot be read, nothing is sent: a
        // receipt she asked to withhold is worse than one that is late.
        let hideReceipts = true;
        try {
          const settings = await prisma.userSafetySettings.findUnique({
            where: { userId },
            select: { hideReadReceipts: true },
          });
          hideReceipts = settings?.hideReadReceipts ?? false;
        } catch (lookupError) {
          logger.warn('Read receipt withheld: safety settings unreadable', {
            userId,
            error: lookupError instanceof Error ? lookupError.message : String(lookupError),
          });
        }
        if (hideReceipts) return;

        // And never across a block, in either store and either direction. The
        // inbox list no longer shows her a thread with someone she has blocked,
        // but a client that still had it open, or any client naming his id,
        // could mark his old messages read and so tell him she had been there.
        // The messages are read all the same, for her own badge. If the lists
        // cannot be read the receipt is withheld, as above.
        let acrossBlock = true;
        try {
          acrossBlock = await isBlockedEitherWay(userId, senderId);
        } catch (lookupError) {
          logger.warn('Read receipt withheld: the block lists could not be read', {
            userId,
            error: lookupError instanceof Error ? lookupError.message : String(lookupError),
          });
        }
        if (acrossBlock) return;

        // And never to the person who opened a request that has not been
        // accepted: the banner tells the asked person she cannot see when it was
        // read. A thread that cannot be read is treated as withheld, as above.
        const thread = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { requestedById: true, requestAcceptedAt: true },
        });
        if (!thread || readReceiptsWithheldFrom(thread, senderId)) return;

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
        // The room was the one social surface a block did not reach. Refusing
        // the join, rather than only the chat, is what makes the host's
        // "remove from my stream" hold: he does not get to sit in her audience
        // reading it either.
        if (await isBlockedRelationship(userId, stream.hostId)) {
          socket.emit('live:error', { streamId, message: 'You cannot take part in this stream.' });
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
        // This is the real door into a host's chat — the page sends here, and
        // the REST route calls itself the other one — and it had no ceiling of
        // any kind, so one account could flood a woman's room at socket speed
        // while she was on camera. Keyed on the account, not the room, so
        // opening five streams does not buy five budgets. The block check and
        // the moderation gate are inside postChatMessage, which both doors
        // share; only the throttle has to live out here, because a socket has
        // no middleware chain to mount one on.
        if (!liveChatThrottle.allow(userId)) {
          socket.emit('live:error', {
            streamId,
            message: 'You are sending messages very quickly. Take a short break and try again.',
          });
          return;
        }
        // The same re-check as direct messages: a host's room is as much a place
        // to reach someone as her inbox is.
        const closed = await closedAccountRefusal(userId);
        if (closed) {
          socket.emit('live:error', { streamId, message: closed.message, code: closed.code });
          socket.disconnect(true);
          return;
        }
        // Reading a room is hers; speaking in it is not, once a reviewer has
        // refused her or her date of birth is under the minimum.
        const notInStanding = await standingRefusal(userId);
        if (notInStanding) {
          socket.emit('live:error', { streamId, message: notInStanding.message, code: notInStanding.code });
          return;
        }
        const content = normalizeUserText(data?.content, {
          field: 'content',
          maxLength: LIVE_CHAT_MAX_LENGTH,
        });
        // postChatMessage broadcasts live:message to the room itself.
        await postChatMessage(streamId, userId, content);
      } catch (error) {
        // A refusal she can act on (muted, slow mode, a block, moderation, the
        // moderation service being down) is said plainly. Anything else is not:
        // a database error's text names tables and queries, and this socket is
        // the one an audience is sitting on.
        const { isOperational, statusCode } = (error ?? {}) as { isOperational?: boolean; statusCode?: number };
        const sayable =
          error instanceof Error &&
          isOperational === true &&
          typeof statusCode === 'number' &&
          (statusCode < 500 || statusCode === 503);
        if (!sayable) logger.error('Failed to post live chat', { streamId, error });
        socket.emit('live:error', { streamId, message: sayable ? (error as Error).message : 'Message not sent' });
      }
    });

    // ==========================================
    // PRESENCE HANDLERS
    // ==========================================

    // This used to be socket.broadcast.emit to every connected socket on the
    // platform: no block, no "hide my online status", no Safe Mode, so any
    // account at all, a man she had blocked included, could watch her user id
    // come online and go offline. presence.service holds the audience rule
    // (established threads only, never across a block, never while she hides)
    // and never throws; a failure there is logged and costs only the dot.
    socket.on('presence:online', () => {
      void announcePresence(userId, 'online');
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
            // Fully offline. The same audience as her online notice, for the
            // same reason: to someone she hides from, "offline" would say she
            // had been on until this moment.
            void announcePresence(userId, 'offline');
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

// A typing event is sent as often as someone types, so the block lists behind
// it (and behind joining a pair's room, which is what the notices travel in)
// are read at most once in half a minute for each member rather than on every
// event. A block made in that half minute holds from the next read; what it
// lets through meanwhile is a "typing" notice, not a word.
const TYPING_BLOCK_TTL_MS = 30_000;
const TYPING_BLOCK_CACHE_MAX = 5_000;
const typingBlockCache = new Map<string, { until: number; rooms: string[] }>();

/**
 * The personal rooms of every member on either side of a block with this one,
 * to leave out of a broadcast she makes; null when the lists cannot be read, so
 * that the caller sends nothing rather than everything.
 */
async function blockedRoomsOf(userId: string): Promise<string[] | null> {
  const now = Date.now();
  const cached = typingBlockCache.get(userId);
  if (cached && cached.until > now) return cached.rooms;
  try {
    const rooms = (await blockedEitherWayIds(userId)).map((id) => `user:${id}`);
    if (typingBlockCache.size >= TYPING_BLOCK_CACHE_MAX) typingBlockCache.clear();
    typingBlockCache.set(userId, { until: now + TYPING_BLOCK_TTL_MS, rooms });
    return rooms;
  } catch (error) {
    logger.warn('Typing notice not sent: the block lists could not be read', { userId, error });
    return null;
  }
}

/**
 * Whether this member and one other are on either side of a block, from the
 * same cached read the channel notices use. True as well when the lists cannot
 * be read, so the caller holds back rather than lets through.
 */
async function pairIsBlocked(userId: string, otherUserId: string): Promise<boolean> {
  const rooms = await blockedRoomsOf(userId);
  return rooms === null || rooms.includes(`user:${otherUserId}`);
}

export function getLiveRoomId(streamId: string): string {
  return `live:${streamId}`;
}

/** How many sockets are watching a stream right now. */
export function liveRoomSize(streamId: string): number {
  if (!ioInstance) return 0;
  return ioInstance.sockets.adapter.rooms.get(getLiveRoomId(streamId))?.size ?? 0;
}

/**
 * Put someone out of a stream's room now.
 *
 * Recording the host's removal is what keeps him out of every future join;
 * this is what ends the one he is already sitting in, without waiting for him
 * to reload. His own clients are told why — `live:removed` — so the page can
 * say so rather than appearing to break, and the room is recounted so the
 * viewer number the host sees is the truth a second later.
 *
 * Returns how many sockets were put out, which is zero when he was not
 * watching; the removal is no less recorded for that.
 */
export function removeFromLiveRoom(streamId: string, userId: string): number {
  if (!ioInstance) return 0;
  const room = getLiveRoomId(streamId);
  let removed = 0;
  for (const socket of ioInstance.sockets.sockets.values()) {
    const client = socket as AuthenticatedSocket;
    if (client.userId !== userId) continue;
    if (!client.rooms.has(room)) continue;
    client.leave(room);
    client.emit('live:removed', { streamId, message: 'The host removed you from this stream.' });
    removed += 1;
  }
  if (removed > 0) {
    const count = liveRoomSize(streamId);
    ioInstance.to(room).emit('live:viewers', { streamId, count });
    void recordViewerCount(streamId, count);
  }
  return removed;
}

// The live stream routes and service push chat, gifts and status changes to
// the room without importing `io` from index.ts (same reason as emitToChannel).
//
// `exceptUserIds` keeps one broadcast from reaching particular members even
// though they are in the room: every socket of a member is also in her own
// `user:` room, so excluding that room reaches all of her devices at once. It is
// how a line from someone she blocked never arrives on her screen.
export function emitToLiveRoom(
  streamId: string,
  event: string,
  payload: unknown,
  options: { exceptUserIds?: string[] } = {}
): void {
  if (!ioInstance) {
    logger.debug('Socket.IO not initialized, skipping live broadcast', { streamId, event });
    return;
  }
  const except = (options.exceptUserIds ?? []).map((id) => `user:${id}`);
  const room = ioInstance.to(getLiveRoomId(streamId));
  (except.length > 0 ? room.except(except) : room).emit(event, payload);
}

// Lets the REST channel routes broadcast without importing `io` from index.ts,
// which would close an import cycle (index -> routes -> index).
//
// `exceptUserIds` is the same keep-it-from-a-blocked-member list emitToLiveRoom
// and emitToGroupRoom take: a reply in a channel is not pushed to a member on
// either side of a block with whoever wrote it.
export function emitToChannel(
  channelId: string,
  event: string,
  payload: unknown,
  options: { exceptUserIds?: string[] } = {}
): void {
  if (!ioInstance) {
    logger.debug('Socket.IO not initialized, skipping channel broadcast', { channelId, event });
    return;
  }
  const except = (options.exceptUserIds ?? []).map((id) => `user:${id}`);
  const room = ioInstance.to(getChannelRoomId(channelId));
  (except.length > 0 ? room.except(except) : room).emit(event, payload);
}

export function getGroupRoomId(groupId: string): string {
  return `group:${groupId}`;
}

// The group chat routes push new, removed and pinned messages to everyone
// with the room open, without importing `io` from index.ts (as emitToChannel).
//
// `exceptUserIds` is how a message is kept from a member who is on either side
// of a block with whoever wrote it, though both are in the room (see
// emitToLiveRoom for how a member is excluded on every device at once). The
// list a member reads is filtered the same way, so the block holds in the live
// push as much as in the history.
export function emitToGroupRoom(
  groupId: string,
  event: string,
  payload: unknown,
  options: { exceptUserIds?: string[] } = {}
): void {
  if (!ioInstance) {
    logger.debug('Socket.IO not initialized, skipping group broadcast', { groupId, event });
    return;
  }
  const except = (options.exceptUserIds ?? []).map((id) => `user:${id}`);
  const room = ioInstance.to(getGroupRoomId(groupId));
  (except.length > 0 ? room.except(except) : room).emit(event, payload);
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

// quiet: the recipient muted this thread, or has not accepted the request it
// belongs to. The message still arrives; nothing buzzes or lights up for it.
export async function sendRealTimeMessage(
  receiverId: string,
  message: any,
  options: { quiet?: boolean; request?: boolean } = {}
) {
  if (!ioInstance) return;
  
  // 1. Emit to main "user:ID" room (for notifications badge)
  if (!options.quiet) {
    ioInstance.to(`user:${receiverId}`).emit('messages:new_count', { userId: receiverId, increment: 1 });
  }
  
  // 2. Emit to `user:${receiverId}` with the full message
  ioInstance.to(`user:${receiverId}`).emit('messages:new', message);

  // A recipient with nothing connected hears about it on their phone instead.
  if (!options.quiet) pushMessageIfAway(receiverId, message, { request: options.request });

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

    // One emit to the union of the two rooms. Two separate emits delivered the
    // notification twice to every socket that had subscribed, since every
    // socket is also in its user room from the moment it connects.
    io.to(`user:${data.userId}`).to(`notifications:${data.userId}`).emit('notifications:new', notification);

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

