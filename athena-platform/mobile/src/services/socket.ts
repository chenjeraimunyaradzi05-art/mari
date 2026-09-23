/**
 * The phone's real-time connection: live messages, typing, presence and
 * notifications.
 *
 * This client was fully written and never once ran. `connect()` had no caller
 * anywhere in the app, so `this.socket` was always null: every emit was a
 * no-op and every listener screens registered waited on a Map nothing emitted
 * into. A new message only ever appeared on pull-to-refresh. AuthContext now
 * connects on sign-in (and on a restored session at launch) and disconnects on
 * sign-out.
 *
 * Three things would still have been broken had it been called, and all three
 * are fixed here:
 *
 *   - It read the token from SecureStore under 'athena_auth_token', a key
 *     nothing writes; AuthContext stores the access token under
 *     'athena_access_token'. It no longer reads SecureStore at all. The
 *     handshake asks api.ts for the token in force *at that moment*, which
 *     also fixes the quieter version of the same bug: the response
 *     interceptor rotates the access token on a 401, and a reconnection an
 *     hour later carrying the original token would be refused by the server's
 *     socket middleware.
 *   - It connected to `extra.apiUrl`, which app.config.js has already
 *     suffixed with '/api'. Socket.IO is mounted at the server root
 *     (server/src/index.ts), not under the API prefix, so the suffix is
 *     stripped here.
 *   - Several event names and payloads were not the ones the server speaks.
 *     Every name below is the one server/src/services/socket.service.ts
 *     listens for or emits; the comments name the handler.
 */
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { getAuthToken } from './api';

// extra.apiUrl ends in '/api' (app.config.js). Socket.IO listens on the
// origin, so the API prefix comes off.
const SOCKET_URL = String(Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

/**
 * The events the server emits that screens can subscribe to. Anything not in
 * this list never reaches a listener, so a name that drifts from the server
 * shows up as a dead feature — which is how 'notification:new' (the server
 * emits 'notifications:new') went unnoticed on the notifications screen.
 */
export const SERVER_EVENTS = [
  // socket.service.ts createNotification()
  'notifications:new',
  // socket.service.ts 'notifications:mark_read' / 'notifications:mark_all_read'
  'notifications:updated',
  'notifications:all_read',
  // socket.service.ts 'messages:send' and sendRealTimeMessage()
  'messages:new',
  'messages:new_count',
  'messages:unread_count_updated',
  'messages:delivered',
  'messages:read',
  'messages:error',
  // socket.service.ts 'messages:typing' / 'messages:stop_typing'
  'messages:user_typing',
  'messages:user_stopped_typing',
  // socket.service.ts connection/disconnect handlers
  'presence:user_online',
  'presence:user_offline',
  // socket.service.ts emitJobApplicationUpdate() / emitNewJobMatch()
  'applications:updated',
  'jobs:new_match',
] as const;

/**
 * A payload from the server, whose shape each screen knows for the event it
 * subscribes to. The bus itself cannot know it, so `on` is generic and the
 * caller names the type it expects.
 */
type Listener = (payload: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();

  /**
   * Opens the connection for the signed-in member. Safe to call again: a
   * second call while a socket is open does nothing, so a re-render or a
   * second sign-in path cannot open two.
   */
  connect(): void {
    if (this.socket) return;

    if (!getAuthToken()) {
      console.warn('[Socket] No access token yet, so no real-time connection was opened');
      return;
    }

    this.socket = io(SOCKET_URL, {
      // A function rather than a value: socket.io calls it before every
      // connection attempt, so a reconnection carries the current token
      // instead of the one this member signed in with.
      auth: (cb) => cb({ token: getAuthToken() ?? '' }),
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      // The server puts every connection in `user:<id>`, but the notification
      // room is opt-in, and createNotification emits to both.
      this.socket?.emit('notifications:subscribe');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[Socket] Could not connect:', error.message);
    });

    // The server ends the sockets of a session that was logged out, had its
    // password changed or was revoked from another device. Reconnecting with
    // the same dead token would only be refused again, so this stops trying;
    // the next API call gets a 401 and AuthContext signs the member out.
    this.socket.on('session:revoked', (payload: { reason?: string }) => {
      console.log('[Socket] Session revoked:', payload?.reason);
      this.disconnect();
    });

    this.setupEventForwarding();
  }

  private setupEventForwarding() {
    SERVER_EVENTS.forEach((event) => {
      this.socket?.on(event, (data: unknown) => {
        this.emit(event, data);
      });
    });
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Marks one notification read. Server answers with 'notifications:updated'. */
  markNotificationRead(notificationId: string): void {
    this.socket?.emit('notifications:mark_read', notificationId);
  }

  /** Marks every notification read. Server answers with 'notifications:all_read'. */
  markAllNotificationsRead(): void {
    this.socket?.emit('notifications:mark_all_read');
  }

  /**
   * Marks the messages this member has received from `senderId` as read. The
   * server's handler takes the other person's id and works out the thread —
   * it is not the conversation id, and the client used to emit 'messages:read',
   * which is the event the server *sends* when someone else reads.
   */
  markMessagesRead(senderId: string): void {
    this.socket?.emit('messages:mark_read', senderId);
  }

  /**
   * Joins the room for the thread with `otherUserId`. The room id is derived
   * from the two member ids (getConversationRoomId), not from the stored
   * conversation id, so this takes the person and not the thread.
   */
  joinConversation(otherUserId: string): void {
    this.socket?.emit('messages:join_conversation', otherUserId);
  }

  leaveConversation(otherUserId: string): void {
    this.socket?.emit('messages:leave_conversation', otherUserId);
  }

  sendMessage(receiverId: string, content: string): void {
    this.socket?.emit('messages:send', { receiverId, content });
  }

  // Typing is two events on the server, not one event with a flag; the
  // conversation id is optional and only saves the other end re-deriving it.
  startTyping(receiverId: string, conversationId?: string): void {
    this.socket?.emit('messages:typing', { receiverId, conversationId });
  }

  stopTyping(receiverId: string, conversationId?: string): void {
    this.socket?.emit('messages:stop_typing', { receiverId, conversationId });
  }

  /** Subscribes to a server event; the returned function unsubscribes. */
  on<T = unknown>(event: string, callback: (payload: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[Socket] Error in listener for ${event}:`, error);
      }
    });
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
