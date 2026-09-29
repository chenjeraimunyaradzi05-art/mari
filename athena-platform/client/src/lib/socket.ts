import { io, Socket } from 'socket.io-client';
import { useChatStore, toChatMessage } from './stores/chat.store';
import { usePresenceStore } from './stores/presence.store';
import { API_ORIGIN, messageApi } from './api';
import { getAccessToken } from './auth';

const SOCKET_ORIGIN = (process.env.NEXT_PUBLIC_SOCKET_URL || API_ORIGIN).replace(/\/$/, '');

/**
 * The socket API is keyed by the counterpart user id (join/send/mark_read all
 * take the other person), while the REST API and every screen are keyed by the
 * DB conversation id. This client owns that translation: callers speak
 * conversation ids, the wire speaks user ids, and inbound events are normalised
 * back to conversation ids before they reach the store.
 */
class SocketClient {
  private socket: Socket | null = null;
  private static instance: SocketClient;
  private userId: string | null = null;
  private token: string | null = null;
  // counterpart user id -> conversation id, for the events the server keys by user
  private conversationByUser = new Map<string, string>();
  // Pages that hold a socket (live rooms, channels) are told when the
  // instance is replaced or reconnects, so they re-register and re-join
  // rather than listening on a socket that no longer exists.
  private changeListeners = new Set<() => void>();
  // The bell and the Messages badge are react-query caches, and this class
  // cannot reach a QueryClient. Live notifications used to be written into a
  // zustand store that nothing rendered, so the bell only ever moved on its
  // 30-second poll however quickly the server spoke. Now the hooks that own
  // those caches subscribe here and invalidate them when the server says
  // something changed.
  private notificationListeners = new Set<() => void>();
  private unreadListeners = new Set<() => void>();

  private constructor() {}

  public onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /** Called when a new in-app notification arrives for the signed-in member. */
  public onNotification(listener: () => void): () => void {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  /** Called when the server says her direct-message unread counts moved. */
  public onUnreadChange(listener: () => void): () => void {
    this.unreadListeners.add(listener);
    return () => {
      this.unreadListeners.delete(listener);
    };
  }

  private notify(listeners: Set<() => void> = this.changeListeners) {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // A listener that throws must not stop the others being told.
      }
    }
  }

  public static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  public connect(token: string, userId: string) {
    // A new token means a different session (refresh or a different account),
    // so the old connection has to go rather than be reused.
    if (this.socket && this.token === token && this.userId === userId) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.disconnect();
    this.token = token;
    this.userId = userId;

    this.socket = io(SOCKET_ORIGIN, {
      // Callback form, not a fixed object: it runs on every reconnection
      // attempt, so a socket that drops after the access token was rotated
      // re-handshakes with the current one instead of an expired copy.
      auth: (cb) => cb({ token: getAccessToken() || token }),
      autoConnect: true,
      reconnection: true,
    });

    this.setupListeners();
    this.socket.on('connect', () => this.notify());
    this.socket.on('disconnect', () => this.notify());
    this.notify();
  }

  public disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.conversationByUser.clear();
    this.token = null;
    this.userId = null;
    this.notify();
  }

  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  // ===========================
  // CONVERSATION ACTIONS
  // ===========================

  public joinConversation(conversationId: string, otherUserId: string) {
    this.conversationByUser.set(otherUserId, conversationId);
    this.emit('messages:join_conversation', otherUserId);
  }

  public leaveConversation(conversationId: string, otherUserId: string) {
    if (this.conversationByUser.get(otherUserId) === conversationId) {
      this.conversationByUser.delete(otherUserId);
    }
    this.emit('messages:leave_conversation', otherUserId);
  }

  public setTyping(conversationId: string, otherUserId: string, isTyping: boolean) {
    this.emit(isTyping ? 'messages:typing' : 'messages:stop_typing', {
      receiverId: otherUserId,
      conversationId,
    });
  }

  public markConversationRead(otherUserId: string) {
    this.emit('messages:mark_read', otherUserId);
  }

  // Method to manually emit events
  public emit(event: string, data: unknown) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  private resolveConversationId(payload: { conversationId?: string; userId?: string }): string | null {
    if (payload?.conversationId) return payload.conversationId;
    if (payload?.userId) return this.conversationByUser.get(payload.userId) || null;
    return null;
  }

  /**
   * Who among her threads was already online when this connection came up.
   *
   * The presence events only report changes, so before this a counterpart who
   * had been online for an hour read "Offline" in the chat header until one of
   * them happened to reconnect. The server answers with the same rule the live
   * events follow (established threads, never across a block, never someone
   * hiding her status), and that answer replaces what the store believed:
   * anyone it had as online who is not in the list went offline while this
   * client was not listening.
   *
   * A failed lookup is logged and leaves the store as it was. Marking everyone
   * offline because the request failed would be a guess presented as a fact.
   */
  private async seedPresence() {
    const socket = this.socket;
    try {
      const response = await messageApi.presence();
      // The connection was replaced (a new token, a sign-out) while the
      // request was out; this answer belongs to a session that has gone.
      if (this.socket !== socket) return;
      const payload = response.data?.data as { online?: unknown } | undefined;
      const online = Array.isArray(payload?.online)
        ? payload.online.filter((id): id is string => typeof id === 'string')
        : [];
      const onlineIds = new Set(online);
      const store = usePresenceStore.getState();
      const wentOffline = Array.from(store.onlineUsers.values())
        .filter((presence) => presence.status === 'online' && !onlineIds.has(presence.userId))
        .map((presence) => ({ ...presence, status: 'offline' as const }));
      store.setUsersPresence([
        ...wentOffline,
        ...online.map((userId) => ({ userId, status: 'online' as const })),
      ]);
    } catch (error) {
      console.warn('Could not load who is online; presence will follow live updates only', error);
    }
  }

  private setupListeners() {
    if (!this.socket) return;

    // ===========================
    // NOTIFICATIONS
    // ===========================
    this.socket.on('notifications:new', () => {
      this.notify(this.notificationListeners);
    });

    // The server's answers to a read marked over the socket (the mobile app
    // marks them that way). The bell's unread dot has to follow them too, or
    // it keeps showing a notification she has already read.
    this.socket.on('notifications:updated', () => {
      this.notify(this.notificationListeners);
    });

    this.socket.on('notifications:all_read', () => {
      this.notify(this.notificationListeners);
    });

    // Sent to the receiver when a message lands in one of her threads and when
    // her unread counts are recomputed. Nothing listened for either, so the
    // Messages badge waited for its poll too.
    this.socket.on('messages:new_count', () => {
      this.notify(this.unreadListeners);
    });

    this.socket.on('messages:unread_count_updated', () => {
      this.notify(this.unreadListeners);
    });

    // ===========================
    // MESSAGING
    // ===========================
    this.socket.on('messages:new', (raw) => {
      const conversationId = raw?.conversationId;
      if (!conversationId) return;

      const isMine = raw.senderId === this.userId;
      // A muted thread or an unaccepted request still receives the message; it
      // just does not bump the badge.
      const thread = useChatStore.getState().conversations.find((c) => c.id === conversationId);
      useChatStore
        .getState()
        .addMessage(conversationId, toChatMessage(raw, this.userId || undefined), {
          countAsUnread: !isMine && !thread?.isMuted && !thread?.isRequest,
        });
    });

    // The server broadcasts user_typing / user_stopped_typing — there is no
    // 'messages:typing' coming back down the wire.
    this.socket.on('messages:user_typing', (payload) => {
      const conversationId = this.resolveConversationId(payload || {});
      if (conversationId) useChatStore.getState().setTyping(conversationId, true);
    });

    this.socket.on('messages:user_stopped_typing', (payload) => {
      const conversationId = this.resolveConversationId(payload || {});
      if (conversationId) useChatStore.getState().setTyping(conversationId, false);
    });

    this.socket.on('messages:read', (payload) => {
      const { conversationId, messageIds, readerId } = payload || {};
      // Our own read receipt tells us nothing about our own messages.
      if (!conversationId || !Array.isArray(messageIds) || readerId === this.userId) return;
      useChatStore.getState().updateMessagesStatus(conversationId, messageIds, 'read');
    });

    this.socket.on('messages:delivered', (payload) => {
      const { conversationId, messageIds } = payload || {};
      if (!conversationId || !Array.isArray(messageIds)) return;
      useChatStore.getState().updateMessagesStatus(conversationId, messageIds, 'delivered');
    });

    this.socket.on('messages:reaction', (payload) => {
      const { conversationId, messageId, emoji, userId, action } = payload || {};
      if (!conversationId || !messageId || !emoji) return;
      useChatStore
        .getState()
        .applyReaction(conversationId, messageId, emoji, action === 'removed' ? 'removed' : 'added', userId === this.userId);
    });

    // Disappearing messages: the sweep says which ids are gone, and a timer
    // change arrives so the thread's banner follows without a refetch.
    this.socket.on('messages:expired', (payload) => {
      const { conversationId, messageIds } = payload || {};
      if (!conversationId || !Array.isArray(messageIds)) return;
      useChatStore.getState().removeMessages(conversationId, messageIds);
    });

    // Unsent and edited messages: the thread shows the marker or the new
    // words the moment the sender acts, on their other devices too.
    this.socket.on('messages:deleted', (payload) => {
      const { conversationId, messageId, deletedAt } = payload || {};
      if (!conversationId || !messageId) return;
      useChatStore
        .getState()
        .markMessageUnsent(conversationId, messageId, typeof deletedAt === 'string' ? deletedAt : new Date().toISOString());
    });

    this.socket.on('messages:edited', (payload) => {
      const { conversationId, messageId, content, editedAt } = payload || {};
      if (!conversationId || !messageId || typeof content !== 'string') return;
      useChatStore
        .getState()
        .applyMessageEdit(conversationId, messageId, content, typeof editedAt === 'string' ? editedAt : new Date().toISOString());
    });

    this.socket.on('messages:settings', (payload) => {
      const { conversationId, disappearingTtlSeconds } = payload || {};
      if (!conversationId) return;
      useChatStore
        .getState()
        .setDisappearingTtl(conversationId, typeof disappearingTtlSeconds === 'number' ? disappearingTtlSeconds : null);
    });

    // ===========================
    // PRESENCE
    // ===========================
    // Whether this socket has been connected before, so that a reconnect can be
    // told apart from the first connection.
    let connectedBefore = false;

    this.socket.on('connect', () => {
      this.socket?.emit('presence:online');
      // Room membership does not survive a reconnect, so every open thread has
      // to be re-joined or live delivery silently stops after a dropout.
      for (const otherUserId of this.conversationByUser.keys()) {
        this.socket?.emit('messages:join_conversation', otherUserId);
      }
      void this.seedPresence();

      // The server does not replay what it sent while the connection was down,
      // so a notification or a message that arrived during a dropout was lost
      // to the live path. The bell and the badge are asked to catch up now
      // rather than on their next poll. Not on the first connection: the
      // queries that listen here have only just fetched.
      if (connectedBefore) {
        this.notify(this.notificationListeners);
        this.notify(this.unreadListeners);
      }
      connectedBefore = true;
    });

    this.socket.on('presence:user_online', ({ userId }: { userId: string }) => {
      usePresenceStore.getState().setUserPresence(userId, { userId, status: 'online' });
    });

    this.socket.on('presence:user_offline', ({ userId }: { userId: string }) => {
      usePresenceStore.getState().setUserPresence(userId, {
        userId,
        status: 'offline',
        lastSeen: new Date().toISOString(),
      });
    });
  }
}

export const socketClient = SocketClient.getInstance();
