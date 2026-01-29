/**
 * Chat Hooks
 * Phase 5: Mobile Parity - React Query hooks for messaging
 */

import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChatStore, type Message, type Conversation } from '../stores';
import { api } from '../services/api';
import { socketService } from '../services/socket';

// ============================================
// QUERY KEYS
// ============================================

export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
  messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
  search: (query: string) => [...chatKeys.all, 'search', query] as const,
};

// ============================================
// HOOKS
// ============================================

/**
 * Get all conversations with infinite scroll
 */
export function useConversations() {
  const { setConversations } = useChatStore();

  return useInfiniteQuery({
    queryKey: chatKeys.conversations(),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/conversations', {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    onSuccess: (data) => {
      const allConversations = data.pages.flatMap((page) => page.conversations);
      setConversations(allConversations);
    },
  });
}

/**
 * Get single conversation
 */
export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: async () => {
      const response = await api.get(`/conversations/${conversationId}`);
      return response.data;
    },
    enabled: !!conversationId,
  });
}

/**
 * Get messages for a conversation with infinite scroll (older messages)
 */
export function useMessages(conversationId: string) {
  const { setMessages, prependMessages, setLoadingMessages } = useChatStore();

  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: async ({ pageParam }) => {
      setLoadingMessages(true);
      const response = await api.get(`/conversations/${conversationId}/messages`, {
        params: {
          before: pageParam,
          limit: 50,
        },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore && lastPage.messages.length > 0) {
        return lastPage.messages[0].id;
      }
      return undefined;
    },
    enabled: !!conversationId,
    onSuccess: (data) => {
      const allMessages = data.pages.flatMap((page) => page.messages).reverse();
      if (data.pages.length === 1) {
        setMessages(conversationId, allMessages);
      } else {
        prependMessages(conversationId, data.pages[data.pages.length - 1].messages.reverse());
      }
    },
    onSettled: () => {
      setLoadingMessages(false);
    },
  });
}

/**
 * Send message mutation (optimistic)
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  const {
    sendMessageOptimistic,
    confirmMessageSent,
    markMessageFailed,
    clearDraft,
  } = useChatStore();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      type = 'text',
      replyTo,
      mediaUrl,
    }: {
      conversationId: string;
      content: string;
      type?: Message['type'];
      replyTo?: string;
      mediaUrl?: string;
    }) => {
      const response = await api.post(`/conversations/${conversationId}/messages`, {
        content,
        type,
        replyTo,
        mediaUrl,
      });
      return response.data;
    },
    onMutate: async ({ conversationId, content, type = 'text', replyTo }) => {
      // Create optimistic message
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        conversationId,
        senderId: 'current-user', // Will be replaced
        content,
        type,
        replyTo,
        reactions: {},
        isEdited: false,
        isDeleted: false,
        readBy: [],
        deliveredTo: [],
        status: 'sending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      sendMessageOptimistic(conversationId, optimisticMessage);
      clearDraft(conversationId);

      return { tempId, conversationId };
    },
    onSuccess: (data, _, context) => {
      if (context) {
        confirmMessageSent(context.tempId, data);
      }
    },
    onError: (_, __, context) => {
      if (context) {
        markMessageFailed(context.tempId);
      }
    },
    onSettled: (_, __, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Create new conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { addConversation, selectConversation } = useChatStore();

  return useMutation({
    mutationFn: async ({
      participantIds,
      type = 'direct',
      name,
    }: {
      participantIds: string[];
      type?: 'direct' | 'group';
      name?: string;
    }) => {
      const response = await api.post('/conversations', {
        participantIds,
        type,
        name,
      });
      return response.data;
    },
    onSuccess: (data) => {
      addConversation(data);
      selectConversation(data.id);
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Mark messages as read
 */
export function useMarkAsRead() {
  const { markAsRead: markAsReadLocal } = useChatStore();

  return useMutation({
    mutationFn: async ({
      conversationId,
      messageIds,
    }: {
      conversationId: string;
      messageIds: string[];
    }) => {
      await api.post(`/conversations/${conversationId}/read`, { messageIds });
      return { conversationId, messageIds };
    },
    onMutate: ({ conversationId, messageIds }) => {
      markAsReadLocal(conversationId, messageIds);
      
      // Emit socket event for real-time sync
      socketService.emit('messages:read', { conversationId, messageIds });
    },
  });
}

/**
 * Send typing indicator
 */
export function useSendTyping() {
  return useMutation({
    mutationFn: async ({
      conversationId,
      isTyping,
    }: {
      conversationId: string;
      isTyping: boolean;
    }) => {
      socketService.emit('typing', { conversationId, isTyping });
    },
  });
}

/**
 * Delete message
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const { deleteMessage: deleteMessageLocal } = useChatStore();

  return useMutation({
    mutationFn: async ({
      conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId: string;
    }) => {
      await api.delete(`/conversations/${conversationId}/messages/${messageId}`);
      return { conversationId, messageId };
    },
    onMutate: ({ conversationId, messageId }) => {
      deleteMessageLocal(conversationId, messageId);
    },
    onSettled: (_, __, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
    },
  });
}

/**
 * Edit message
 */
export function useEditMessage() {
  const queryClient = useQueryClient();
  const { updateMessage, setEditingMessage } = useChatStore();

  return useMutation({
    mutationFn: async ({
      conversationId,
      messageId,
      content,
    }: {
      conversationId: string;
      messageId: string;
      content: string;
    }) => {
      const response = await api.patch(
        `/conversations/${conversationId}/messages/${messageId}`,
        { content }
      );
      return response.data;
    },
    onSuccess: (data, { conversationId, messageId }) => {
      updateMessage(conversationId, messageId, { ...data, isEdited: true });
      setEditingMessage(null);
    },
    onSettled: (_, __, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
    },
  });
}

/**
 * React to message
 */
export function useReactToMessage() {
  const queryClient = useQueryClient();
  const { updateMessage } = useChatStore();

  return useMutation({
    mutationFn: async ({
      conversationId,
      messageId,
      emoji,
    }: {
      conversationId: string;
      messageId: string;
      emoji: string;
    }) => {
      const response = await api.post(
        `/conversations/${conversationId}/messages/${messageId}/react`,
        { emoji }
      );
      return response.data;
    },
    onSuccess: (data, { conversationId, messageId }) => {
      updateMessage(conversationId, messageId, { reactions: data.reactions });
    },
    onSettled: (_, __, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
    },
  });
}

/**
 * Pin/unpin conversation
 */
export function useTogglePinConversation() {
  const queryClient = useQueryClient();
  const { pinConversation, unpinConversation } = useChatStore();

  return useMutation({
    mutationFn: async ({
      conversationId,
      isPinned,
    }: {
      conversationId: string;
      isPinned: boolean;
    }) => {
      if (isPinned) {
        await api.delete(`/conversations/${conversationId}/pin`);
      } else {
        await api.post(`/conversations/${conversationId}/pin`);
      }
      return { conversationId, isPinned: !isPinned };
    },
    onMutate: ({ conversationId, isPinned }) => {
      if (isPinned) {
        unpinConversation(conversationId);
      } else {
        pinConversation(conversationId);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Mute/unmute conversation
 */
export function useToggleMuteConversation() {
  const queryClient = useQueryClient();
  const { muteConversation, unmuteConversation } = useChatStore();

  return useMutation({
    mutationFn: async ({
      conversationId,
      isMuted,
    }: {
      conversationId: string;
      isMuted: boolean;
    }) => {
      if (isMuted) {
        await api.delete(`/conversations/${conversationId}/mute`);
      } else {
        await api.post(`/conversations/${conversationId}/mute`);
      }
      return { conversationId, isMuted: !isMuted };
    },
    onMutate: ({ conversationId, isMuted }) => {
      if (isMuted) {
        unmuteConversation(conversationId);
      } else {
        muteConversation(conversationId);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Archive conversation
 */
export function useArchiveConversation() {
  const queryClient = useQueryClient();
  const { archiveConversation } = useChatStore();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      await api.post(`/conversations/${conversationId}/archive`);
      return conversationId;
    },
    onMutate: (conversationId) => {
      archiveConversation(conversationId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Search messages
 */
export function useSearchMessages(query: string) {
  const { setSearchResults } = useChatStore();

  return useQuery({
    queryKey: chatKeys.search(query),
    queryFn: async () => {
      const response = await api.get('/messages/search', {
        params: { q: query },
      });
      return response.data;
    },
    enabled: query.length >= 2,
    onSuccess: (data) => {
      setSearchResults(data);
    },
  });
}

/**
 * Upload media for message
 */
export function useUploadMedia() {
  return useMutation({
    mutationFn: async ({
      file,
      type,
    }: {
      file: { uri: string; type: string; name: string };
      type: 'image' | 'video' | 'audio' | 'file';
    }) => {
      const formData = new FormData();
      formData.append('file', file as any);
      formData.append('type', type);

      const response = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
  });
}

/**
 * Leave group conversation
 */
export function useLeaveConversation() {
  const queryClient = useQueryClient();
  const { removeConversation } = useChatStore();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      await api.post(`/conversations/${conversationId}/leave`);
      return conversationId;
    },
    onSuccess: (conversationId) => {
      removeConversation(conversationId);
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

/**
 * Add participants to group
 */
export function useAddParticipants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      participantIds,
    }: {
      conversationId: string;
      participantIds: string[];
    }) => {
      const response = await api.post(
        `/conversations/${conversationId}/participants`,
        { participantIds }
      );
      return response.data;
    },
    onSettled: (_, __, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
    },
  });
}
