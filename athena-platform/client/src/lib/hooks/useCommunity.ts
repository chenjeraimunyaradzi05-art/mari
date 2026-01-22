import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { User } from '@/lib/types';
import { toast } from 'react-hot-toast';

export interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
  createdAt: string;
  replies?: Comment[];
}

export interface Post {
  id: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'JOB_SHARE';
  author: User;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  mediaUrls?: string[];
  comments?: Comment[];
}

interface CreatePostValues {
  content: string;
  type?: string;
  visibility?: string;
  mediaUrls?: string[];
}

export const useFeed = (type: string = 'for-you') => {
  return useQuery({
    queryKey: ['posts', 'feed', type],
    queryFn: async () => {
      // type might be used for query params in future, current backend is generic feed
      const { data } = await api.get<{ data: Post[] }>('/posts/feed');
      return data.data;
    },
  });
};

export const usePost = (postId: string) => {
  return useQuery({
    queryKey: ['posts', postId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Post }>(`/posts/${postId}`);
      return data.data;
    },
    enabled: !!postId,
  });
};

export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const { data } = await api.post(`/posts/${postId}/comments`, { content });
      return data;
    },
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['posts', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] }); // Update count
      toast.success('Comment added');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    },
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CreatePostValues) => {
      const { data } = await api.post<{ data: Post }>('/posts', values);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] });
      toast.success('Post created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create post');
    },
  });
};

export const useLikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data } = await api.post(`/posts/${postId}/like`);
      return data;
    },
    onSuccess: (_, postId) => {
        // Optimistic update could go here, for now invalidate
        queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] });
    }
  });
};

export const useUnlikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
        const { data } = await api.delete(`/posts/${postId}/like`);
        return data;
    },
    onSuccess: (_, postId) => {
        queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] });
    }
  });
};
