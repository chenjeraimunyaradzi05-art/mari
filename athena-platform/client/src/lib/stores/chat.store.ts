import { create } from 'zustand';

export interface ChatMessageReply {
  id: string;
  senderId: string;
  content: string;
}

export interface ChatMessageAttachment {
  id: string;
  type: 'image' | 'video' | 'file';
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  type: 'text' | 'image' | 'video' | 'file';
  mediaUrl?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  replyTo?: ChatMessageReply;
  attachments?: ChatMessageAttachment[];
}

export interface Conversation {
  id: string;
  participants: { id: string; name: string; avatar?: string }[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  updatedAt: string;
  isTyping?: boolean; // UI only
}

interface ChatState {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  totalUnread: number;

  // Actions
  setActiveConversation: (id: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: ChatMessage['status']) => void;
  markConversationAsRead: (conversationId: string) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  getUnreadCount: () => number;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: null,
  conversations: [],
  messages: {},
  isLoadingConversations: false,
  isLoadingMessages: false,
  totalUnread: 0,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setConversations: (conversations) => set({ 
    conversations,
    totalUnread: conversations.reduce((acc, c) => acc + c.unreadCount, 0)
  }),

  addMessage: (conversationId, message) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      // Prevent duplicates
      if (currentMessages.some(m => m.id === message.id)) return state;

      // Update conversations list (last message)
      const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
      const updatedConversations = [...state.conversations];
      
      if (conversationIndex > -1) {
        const conv = updatedConversations[conversationIndex];
        updatedConversations[conversationIndex] = {
            ...conv,
            lastMessage: message,
            updatedAt: message.createdAt,
            // If active, unread count doesn't increase, handled by UI effect usually. 
            // But if we are just receiving in background:
            unreadCount: state.activeConversationId === conversationId ? 0 : conv.unreadCount + 1
        };
        // Move to top
        updatedConversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }

      return {
        messages: {
          ...state.messages,
          [conversationId]: [...currentMessages, message],
        },
        conversations: updatedConversations,
        totalUnread: state.activeConversationId === conversationId 
            ? state.totalUnread 
            : state.totalUnread + 1
      };
    });
  },

  setMessages: (conversationId, messages) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    }));
  },

  updateMessageStatus: (conversationId, messageId, status) => {
    set((state) => {
      const conversationMessages = state.messages[conversationId];
      if (!conversationMessages) return state;

      const updatedMessages = conversationMessages.map((msg) =>
        msg.id === messageId ? { ...msg, status } : msg
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  markConversationAsRead: (conversationId) => {
      set((state) => {
          const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
          if (conversationIndex === -1) return state;

          const oldUnread = state.conversations[conversationIndex].unreadCount;
          const updatedConversations = [...state.conversations];
          updatedConversations[conversationIndex] = {
              ...updatedConversations[conversationIndex],
              unreadCount: 0
          };

          return {
              conversations: updatedConversations,
              totalUnread: Math.max(0, state.totalUnread - oldUnread)
          };
      });
  },

  setTyping: (conversationId, isTyping) => {
      set((state) => {
          const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
          if (conversationIndex === -1) return state;
          
          const updatedConversations = [...state.conversations];
          updatedConversations[conversationIndex] = {
              ...updatedConversations[conversationIndex],
              isTyping
          };
          
          return { conversations: updatedConversations };
      });
  },

  getUnreadCount: () => {
      return get().totalUnread;
  }
}));
