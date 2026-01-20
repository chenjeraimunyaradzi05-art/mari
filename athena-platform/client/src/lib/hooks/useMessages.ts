import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useEffect } from 'react';
import { socketClient } from '../socket';
import { getAccessToken } from '../auth';
import { useAuthStore } from '../store';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  displayName?: string;
  isVerified?: boolean;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  sender: User;
  createdAt: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    isRead: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export const useConversations = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Conversation[] }>('/messages/conversations');
      return data.data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    
    // We can get token from session if next-auth is configured to provide it,
    // or from localStorage as the api interceptor does.
    // The socket needs a token.
    const token = getAccessToken();
    if (!token) return;

    socketClient.connect(token);
    const socket = socketClient.getSocket();
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
        // Optimistically update conversations
        queryClient.setQueryData(['conversations'], (old: Conversation[] | undefined) => {
            if (!old) return old;
            
            const existingIndex = old.findIndex(c => c.id === message.conversationId);
            const newConversationState = {
                id: message.conversationId,
                participant: message.sender, // ideally we know the participant, but for incoming it is the sender
                lastMessage: {
                    content: message.content,
                    createdAt: message.createdAt,
                    senderId: message.senderId,
                    isRead: false
                },
                unreadCount: 1, // Will be incremented or set
                updatedAt: new Date().toISOString()
            };

            if (existingIndex > -1) {
                const updated = [...old];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    lastMessage: newConversationState.lastMessage,
                    unreadCount: updated[existingIndex].unreadCount + 1,
                    updatedAt: newConversationState.updatedAt
                };
                // Move to top
                updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                return updated;
            } else {
                // New conversation incoming triggers a refetch usually because we need participant details
                // But we can try to prepend if we have info.
                // Safest to invalidate.
                queryClient.invalidateQueries({ queryKey: ['conversations'] });
                return old;
            }
        });
        
        // Also play sound or toast?
        // toast.success(`New message from ${message.sender.firstName}`);
    };

    socket.on('messages:new', handleNewMessage);

    return () => {
      socket.off('messages:new', handleNewMessage);
    };
  }, [user, queryClient]); // session -> user

  return query;
};

export const useMessages = (conversationId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Message[] }>(`/messages/conversations/${conversationId}/messages`);
      return data.data;
    },
    enabled: !!conversationId && !!user,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post<{ data: Message }>(`/messages/conversations/${conversationId}/messages`, { content });
      return data.data;
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
        // Messages are usually displayed reversed (newest at bottom) or older at top.
        // My server returns most recent LAST?
        // Server: `messages.reverse()` -> So oldest first.
        // So I append.
        return old ? [...old, newMessage] : [newMessage];
      });
      
      // Update conversation list last message
      queryClient.setQueryData(['conversations'], (old: Conversation[] | undefined) => {
        if (!old) return old;
        const index = old.findIndex(c => c.id === conversationId);
        if (index > -1) {
            const updated = [...old];
            updated[index] = {
                ...updated[index],
                lastMessage: {
                    content: newMessage.content,
                    createdAt: newMessage.createdAt,
                    senderId: newMessage.senderId,
                    isRead: true 
                },
                updatedAt: newMessage.createdAt
            };
            updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            return updated;
        }
        return old;
      });
    },
  });

  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) return;
    socketClient.connect(token);
    const socket = socketClient.getSocket();
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      if (message.conversationId === conversationId) {
        queryClient.setQueryData(['messages', conversationId], (old: Message[] | undefined) => {
            return old ? [...old, message] : [message];
        });
        // Mark as read?
        // If we are looking at this conversation, we should mark as read.
        // api.post(`/conversations/${conversationId}/read`);
      }
    };

    socket.on('messages:new', handleNewMessage);

    return () => {
      socket.off('messages:new', handleNewMessage);
    };
  }, [conversationId, queryClient, user]);

  return { ...query, sendMessage };
};
