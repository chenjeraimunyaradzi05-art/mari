import { io, Socket } from 'socket.io-client';
import { useChatStore } from './stores/chat.store';
import { useNotificationStore } from './stores/notification.store';

class SocketClient {
  private socket: Socket | null = null;
  private static instance: SocketClient;

  private constructor() {}

  public static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  public connect(token: string) {
    if (this.socket?.connected) return;

    const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
    this.socket = io(apiOrigin, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
    });

    this.setupListeners();
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    // ===========================
    // NOTIFICATIONS
    // ===========================
    this.socket.on('notifications:new', (notification) => {
      useNotificationStore.getState().addNotification(notification);
    });

    // ===========================
    // MESSAGING
    // ===========================
    this.socket.on('messages:new', (message) => {
      // Assuming message has conversationId attached or we derive it
      // For simplified store logic, we expect the payload to include wrapper or matches Interface
      const { conversationId, ...msg } = message;
      if (conversationId) {
          useChatStore.getState().addMessage(conversationId, msg);
      }
    });

    this.socket.on('messages:typing', ({ conversationId, userId, isTyping }) => {
        // We could enhance store to track WHO is typing, for now just boolean toggle
        useChatStore.getState().setTyping(conversationId, isTyping);
    });
    
    // ===========================
    // MENTORSHIP
    // ===========================
    // Mentorship updates usually come through notifications, 
    // but we could listen for specific events if we had a live session store.
  }
  
  // Method to manually emit events
  public emit(event: string, data: any) {
      if (this.socket?.connected) {
          this.socket.emit(event, data);
      }
  }
}

export const socketClient = SocketClient.getInstance();
