/**
 * Chat Store
 * Phase 5: Mobile Parity - Zustand state management
 * 
 * Handles messaging and chat state for mobile
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// TYPES
// ============================================

export interface ChatParticipant {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: string;
  reactions: Record<string, string[]>; // emoji -> userIds
  isEdited: boolean;
  isDeleted: boolean;
  readBy: string[];
  deliveredTo: string[];
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatar?: string;
  participants: ChatParticipant[];
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  userName: string;
}

interface ChatState {
  // Conversations
  conversations: Conversation[];
  selectedConversationId: string | null;
  
  // Messages
  messages: Record<string, Message[]>; // conversationId -> messages
  
  // Real-time
  typingIndicators: TypingIndicator[];
  onlineUsers: Set<string>;
  
  // UI State
  isComposing: boolean;
  replyingTo: Message | null;
  editingMessage: Message | null;
  
  // Search
  searchQuery: string;
  searchResults: Message[];
  
  // Drafts
  drafts: Record<string, string>; // conversationId -> draft text
  
  // Pending messages (optimistic)
  pendingMessages: Message[];
  failedMessages: Message[];
  
  // Loading
  isLoading: boolean;
  isLoadingMessages: boolean;
  error: string | null;
}

interface ChatActions {
  // Conversations
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  selectConversation: (id: string | null) => void;
  
  // Messages
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  
  // Optimistic sending
  sendMessageOptimistic: (conversationId: string, message: Message) => void;
  confirmMessageSent: (tempId: string, confirmedMessage: Message) => void;
  markMessageFailed: (tempId: string) => void;
  retryFailedMessage: (messageId: string) => void;
  
  // Real-time
  setTyping: (conversationId: string, userId: string, userName: string, isTyping: boolean) => void;
  setUserOnline: (userId: string, isOnline: boolean) => void;
  markAsRead: (conversationId: string, messageIds: string[]) => void;
  markAsDelivered: (conversationId: string, messageIds: string[]) => void;
  
  // UI State
  setComposing: (isComposing: boolean) => void;
  setReplyingTo: (message: Message | null) => void;
  setEditingMessage: (message: Message | null) => void;
  
  // Search
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Message[]) => void;
  clearSearch: () => void;
  
  // Drafts
  saveDraft: (conversationId: string, text: string) => void;
  clearDraft: (conversationId: string) => void;
  
  // Actions
  pinConversation: (id: string) => void;
  unpinConversation: (id: string) => void;
  muteConversation: (id: string) => void;
  unmuteConversation: (id: string) => void;
  archiveConversation: (id: string) => void;
  unarchiveConversation: (id: string) => void;
  
  // Loading
  setLoading: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Reset
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: ChatState = {
  conversations: [],
  selectedConversationId: null,
  messages: {},
  typingIndicators: [],
  onlineUsers: new Set(),
  isComposing: false,
  replyingTo: null,
  editingMessage: null,
  searchQuery: '',
  searchResults: [],
  drafts: {},
  pendingMessages: [],
  failedMessages: [],
  isLoading: false,
  isLoadingMessages: false,
  error: null,
};

// ============================================
// STORE
// ============================================

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Conversations
      setConversations: (conversations) => set({ conversations }),

      addConversation: (conversation) => set((state) => ({
        conversations: [conversation, ...state.conversations],
      })),

      updateConversation: (id, updates) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })),

      removeConversation: (id) => set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        messages: { ...state.messages, [id]: undefined } as any,
      })),

      selectConversation: (id) => set({ selectedConversationId: id }),

      // Messages
      setMessages: (conversationId, messages) => set((state) => ({
        messages: { ...state.messages, [conversationId]: messages },
      })),

      addMessage: (conversationId, message) => set((state) => {
        const existingMessages = state.messages[conversationId] || [];
        return {
          messages: {
            ...state.messages,
            [conversationId]: [...existingMessages, message],
          },
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: message, updatedAt: new Date() }
              : c
          ),
        };
      }),

      updateMessage: (conversationId, messageId, updates) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        },
      })),

      deleteMessage: (conversationId, messageId) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, content: '' } : m
          ),
        },
      })),

      prependMessages: (conversationId, messages) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: [...messages, ...(state.messages[conversationId] || [])],
        },
      })),

      // Optimistic sending
      sendMessageOptimistic: (conversationId, message) => set((state) => ({
        pendingMessages: [...state.pendingMessages, message],
        messages: {
          ...state.messages,
          [conversationId]: [...(state.messages[conversationId] || []), message],
        },
      })),

      confirmMessageSent: (tempId, confirmedMessage) => set((state) => {
        const conversationId = confirmedMessage.conversationId;
        return {
          pendingMessages: state.pendingMessages.filter((m) => m.id !== tempId),
          messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).map((m) =>
              m.id === tempId ? confirmedMessage : m
            ),
          },
        };
      }),

      markMessageFailed: (tempId) => set((state) => {
        const failedMessage = state.pendingMessages.find((m) => m.id === tempId);
        if (!failedMessage) return state;
        return {
          pendingMessages: state.pendingMessages.filter((m) => m.id !== tempId),
          failedMessages: [...state.failedMessages, { ...failedMessage, status: 'failed' as const }],
        };
      }),

      retryFailedMessage: (messageId) => set((state) => {
        const message = state.failedMessages.find((m) => m.id === messageId);
        if (!message) return state;
        return {
          failedMessages: state.failedMessages.filter((m) => m.id !== messageId),
          pendingMessages: [...state.pendingMessages, { ...message, status: 'sending' as const }],
        };
      }),

      // Real-time
      setTyping: (conversationId, userId, userName, isTyping) => set((state) => {
        if (isTyping) {
          const exists = state.typingIndicators.some(
            (t) => t.conversationId === conversationId && t.userId === userId
          );
          if (exists) return state;
          return {
            typingIndicators: [
              ...state.typingIndicators,
              { conversationId, userId, userName },
            ],
          };
        } else {
          return {
            typingIndicators: state.typingIndicators.filter(
              (t) => !(t.conversationId === conversationId && t.userId === userId)
            ),
          };
        }
      }),

      setUserOnline: (userId, isOnline) => set((state) => {
        const onlineUsers = new Set(state.onlineUsers);
        if (isOnline) {
          onlineUsers.add(userId);
        } else {
          onlineUsers.delete(userId);
        }
        return { onlineUsers };
      }),

      markAsRead: (conversationId, messageIds) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            messageIds.includes(m.id) ? { ...m, status: 'read' as const } : m
          ),
        },
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      })),

      markAsDelivered: (conversationId, messageIds) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            messageIds.includes(m.id) && m.status !== 'read'
              ? { ...m, status: 'delivered' as const }
              : m
          ),
        },
      })),

      // UI State
      setComposing: (isComposing) => set({ isComposing }),
      setReplyingTo: (replyingTo) => set({ replyingTo }),
      setEditingMessage: (editingMessage) => set({ editingMessage }),

      // Search
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSearchResults: (searchResults) => set({ searchResults }),
      clearSearch: () => set({ searchQuery: '', searchResults: [] }),

      // Drafts
      saveDraft: (conversationId, text) => set((state) => ({
        drafts: { ...state.drafts, [conversationId]: text },
      })),

      clearDraft: (conversationId) => set((state) => {
        const drafts = { ...state.drafts };
        delete drafts[conversationId];
        return { drafts };
      }),

      // Actions
      pinConversation: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, isPinned: true } : c
        ),
      })),

      unpinConversation: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, isPinned: false } : c
        ),
      })),

      muteConversation: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, isMuted: true } : c
        ),
      })),

      unmuteConversation: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, isMuted: false } : c
        ),
      })),

      archiveConversation: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, isArchived: true } : c
        ),
      })),

      unarchiveConversation: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, isArchived: false } : c
        ),
      })),

      // Loading
      setLoading: (isLoading) => set({ isLoading }),
      setLoadingMessages: (isLoadingMessages) => set({ isLoadingMessages }),
      setError: (error) => set({ error }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'athena-chat-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        drafts: state.drafts,
        conversations: state.conversations.slice(0, 20).map((c) => ({
          ...c,
          participants: c.participants,
        })),
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectSelectedConversation = (state: ChatStore) =>
  state.conversations.find((c) => c.id === state.selectedConversationId);

export const selectConversationMessages = (conversationId: string) => (state: ChatStore) =>
  state.messages[conversationId] || [];

export const selectTypingUsers = (conversationId: string) => (state: ChatStore) =>
  state.typingIndicators.filter((t) => t.conversationId === conversationId);

export const selectUnreadCount = (state: ChatStore) =>
  state.conversations.reduce((sum, c) => sum + c.unreadCount, 0);

export const selectPinnedConversations = (state: ChatStore) =>
  state.conversations.filter((c) => c.isPinned);

export const selectArchivedConversations = (state: ChatStore) =>
  state.conversations.filter((c) => c.isArchived);
