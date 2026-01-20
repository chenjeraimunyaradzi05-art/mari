/**
 * Socket Service
 * Real-time connection to ATHENA backend
 */
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  async connect(): Promise<void> {
    const token = await SecureStore.getItemAsync('athena_auth_token');
    
    if (!token) {
      console.log('[Socket] No auth token, skipping connection');
      return;
    }

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    // Forward all events to listeners
    this.setupEventForwarding();
  }

  private setupEventForwarding() {
    const events = [
      'notifications:new',
      'notifications:updated',
      'messages:new',
      'messages:typing',
      'user:online',
      'user:offline',
      'job:application_update',
      'job:new_match',
    ];

    events.forEach((event) => {
      this.socket?.on(event, (data) => {
        this.emit(event, data);
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Subscribe to notifications
  subscribeToNotifications(): void {
    this.socket?.emit('notifications:subscribe');
  }

  // Mark notification as read
  markNotificationRead(notificationId: string): void {
    this.socket?.emit('notifications:mark_read', notificationId);
  }

  // Join a conversation room
  joinConversation(conversationId: string): void {
    this.socket?.emit('messages:join_conversation', conversationId);
  }

  // Leave a conversation room
  leaveConversation(conversationId: string): void {
    this.socket?.emit('messages:leave_conversation', conversationId);
  }

  // Send a message
  sendMessage(conversationId: string, content: string): void {
    this.socket?.emit('messages:send', { receiverId: conversationId, content });
  }

  // Typing indicators
  startTyping(conversationId: string): void {
    this.socket?.emit('messages:typing', { conversationId, isTyping: true });
  }

  stopTyping(conversationId: string): void {
    this.socket?.emit('messages:typing', { conversationId, isTyping: false });
  }

  // Event listener management
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any): void {
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
