import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  thumbnailUrl?: string; // For video/image previews
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
  // Optimistic update tracking
  isOptimistic?: boolean;
  retryCount?: number;
  errorMessage?: string;
}

export interface Conversation {
  id: string;
  participants: { id: string; name: string; avatar?: string }[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  updatedAt: string;
  isTyping?: boolean; // UI only
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
}

interface ChatState {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  totalUnread: number;
  // Draft messages per conversation
  drafts: Record<string, string>;
  // Pending optimistic messages
  pendingMessages: Record<string, ChatMessage[]>;

  // Actions
  setActiveConversation: (id: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: ChatMessage['status']) => void;
  markConversationAsRead: (conversationId: string) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  getUnreadCount: () => number;
  
  // Optimistic update actions
  addOptimisticMessage: (conversationId: string, message: ChatMessage) => void;
  confirmMessage: (conversationId: string, tempId: string, confirmedMessage: ChatMessage) => void;
  failMessage: (conversationId: string, messageId: string, error: string) => void;
  retryMessage: (conversationId: string, messageId: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  
  // Draft actions
  setDraft: (conversationId: string, content: string) => void;
  clearDraft: (conversationId: string) => void;
  
  // Conversation management
  pinConversation: (conversationId: string, pinned: boolean) => void;
  muteConversation: (conversationId: string, muted: boolean) => void;
  archiveConversation: (conversationId: string) => void;
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
  },

  // Initialize missing state
  drafts: {},
  pendingMessages: {},

  // Optimistic update: Add message with 'sending' status
  addOptimisticMessage: (conversationId, message) => {
    const optimisticMessage: ChatMessage = {
      ...message,
      status: 'sending',
      isOptimistic: true,
      retryCount: 0,
    };

    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      const pending = state.pendingMessages[conversationId] || [];
      
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...currentMessages, optimisticMessage],
        },
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: [...pending, optimisticMessage],
        },
      };
    });
  },

  // Confirm optimistic message with server-returned message
  confirmMessage: (conversationId, tempId, confirmedMessage) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      const pending = state.pendingMessages[conversationId] || [];

      // Replace optimistic message with confirmed one
      const updatedMessages = currentMessages.map((msg) =>
        msg.id === tempId
          ? { ...confirmedMessage, isOptimistic: false, status: 'sent' as const }
          : msg
      );

      // Remove from pending
      const updatedPending = pending.filter((msg) => msg.id !== tempId);

      // Update conversation's last message
      const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
      const updatedConversations = [...state.conversations];
      
      if (conversationIndex > -1) {
        updatedConversations[conversationIndex] = {
          ...updatedConversations[conversationIndex],
          lastMessage: confirmedMessage,
          updatedAt: confirmedMessage.createdAt,
        };
      }

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: updatedPending,
        },
        conversations: updatedConversations,
      };
    });
  },

  // Mark message as failed with error
  failMessage: (conversationId, messageId, error) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];

      const updatedMessages = currentMessages.map((msg) =>
        msg.id === messageId
          ? { ...msg, status: 'error' as const, errorMessage: error }
          : msg
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  // Retry sending failed message
  retryMessage: (conversationId, messageId) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];

      const updatedMessages = currentMessages.map((msg) =>
        msg.id === messageId
          ? { 
              ...msg, 
              status: 'sending' as const, 
              errorMessage: undefined,
              retryCount: (msg.retryCount || 0) + 1,
            }
          : msg
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  // Remove message (for delete or permanent failure)
  removeMessage: (conversationId, messageId) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      const pending = state.pendingMessages[conversationId] || [];

      return {
        messages: {
          ...state.messages,
          [conversationId]: currentMessages.filter((msg) => msg.id !== messageId),
        },
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: pending.filter((msg) => msg.id !== messageId),
        },
      };
    });
  },

  // Draft management
  setDraft: (conversationId, content) => {
    set((state) => ({
      drafts: {
        ...state.drafts,
        [conversationId]: content,
      },
    }));
  },

  clearDraft: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.drafts;
      return { drafts: rest };
    });
  },

  // Conversation management
  pinConversation: (conversationId, pinned) => {
    set((state) => {
      const idx = state.conversations.findIndex(c => c.id === conversationId);
      if (idx === -1) return state;

      const updatedConversations = [...state.conversations];
      updatedConversations[idx] = { ...updatedConversations[idx], isPinned: pinned };
      
      // Sort: pinned first, then by updatedAt
      updatedConversations.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      return { conversations: updatedConversations };
    });
  },

  muteConversation: (conversationId, muted) => {
    set((state) => {
      const idx = state.conversations.findIndex(c => c.id === conversationId);
      if (idx === -1) return state;

      const updatedConversations = [...state.conversations];
      updatedConversations[idx] = { ...updatedConversations[idx], isMuted: muted };

      return { conversations: updatedConversations };
    });
  },

  archiveConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
    }));
  },
}));
