import { io, Socket } from 'socket.io-client';
import { useChatStore, toChatMessage } from './stores/chat.store';
import { useNotificationStore } from './stores/notification.store';
import { usePresenceStore } from './stores/presence.store';
import { API_ORIGIN } from './api';
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

  private constructor() {}

  public onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.changeListeners) {
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

  private setupListeners() {
    if (!this.socket) return;

    // ===========================
    // NOTIFICATIONS
    // ===========================
    this.socket.on('notifications:new', (notification) => {
      useNotificationStore.getState().addNotification(notification);
    });

    // ===========================
    // MESSAGING
    // ===========================
    this.socket.on('messages:new', (raw) => {
      const conversationId = raw?.conversationId;
      if (!conversationId) return;

      const isMine = raw.senderId === this.userId;
      useChatStore
        .getState()
        .addMessage(conversationId, toChatMessage(raw, this.userId || undefined), {
          countAsUnread: !isMine,
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
    this.socket.on('connect', () => {
      this.socket?.emit('presence:online');
      // Room membership does not survive a reconnect, so every open thread has
      // to be re-joined or live delivery silently stops after a dropout.
      for (const otherUserId of this.conversationByUser.keys()) {
        this.socket?.emit('messages:join_conversation', otherUserId);
      }
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
