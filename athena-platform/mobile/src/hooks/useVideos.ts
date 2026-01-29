/**
 * Video Hooks
 * Phase 5: Mobile Parity - React Query hooks for video feed
 */

import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVideoStore, type VideoPost, type FeedType } from '../stores';
import { api } from '../services/api';

// ============================================
// QUERY KEYS
// ============================================

export const videoKeys = {
  all: ['videos'] as const,
  feed: (type: FeedType) => [...videoKeys.all, 'feed', type] as const,
  detail: (id: string) => [...videoKeys.all, 'detail', id] as const,
  user: (userId: string) => [...videoKeys.all, 'user', userId] as const,
  liked: () => [...videoKeys.all, 'liked'] as const,
  saved: () => [...videoKeys.all, 'saved'] as const,
  search: (query: string) => [...videoKeys.all, 'search', query] as const,
  trending: () => [...videoKeys.all, 'trending'] as const,
  hashtag: (tag: string) => [...videoKeys.all, 'hashtag', tag] as const,
};

// ============================================
// HOOKS
// ============================================

/**
 * Infinite scroll video feed
 */
export function useVideoFeed(feedType: FeedType = 'for-you') {
  const { setVideos, appendVideos, setHasMore, setLoading } = useVideoStore();

  return useInfiniteQuery({
    queryKey: videoKeys.feed(feedType),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/videos/feed', {
        params: { type: feedType, page: pageParam, limit: 10 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage.nextPage;
      }
      return undefined;
    },
    onSuccess: (data) => {
      const allVideos = data.pages.flatMap((page) => page.videos);
      setVideos(allVideos);
      setHasMore(!!data.pages[data.pages.length - 1]?.hasMore);
    },
    onSettled: () => {
      setLoading(false);
    },
  });
}

/**
 * Get single video details
 */
export function useVideo(videoId: string) {
  return useQuery({
    queryKey: videoKeys.detail(videoId),
    queryFn: async () => {
      const response = await api.get(`/videos/${videoId}`);
      return response.data;
    },
    enabled: !!videoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get user's videos
 */
export function useUserVideos(userId: string) {
  return useInfiniteQuery({
    queryKey: videoKeys.user(userId),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get(`/users/${userId}/videos`, {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    enabled: !!userId,
  });
}

/**
 * Like video mutation (optimistic)
 */
export function useLikeVideo() {
  const queryClient = useQueryClient();
  const { likeVideoOptimistic, unlikeVideoOptimistic } = useVideoStore();

  return useMutation({
    mutationFn: async ({ videoId, isLiked }: { videoId: string; isLiked: boolean }) => {
      if (isLiked) {
        await api.delete(`/videos/${videoId}/like`);
      } else {
        await api.post(`/videos/${videoId}/like`);
      }
      return { videoId, isLiked: !isLiked };
    },
    onMutate: async ({ videoId, isLiked }) => {
      // Optimistic update
      if (isLiked) {
        unlikeVideoOptimistic(videoId);
      } else {
        likeVideoOptimistic(videoId);
      }

      return { videoId, wasLiked: isLiked };
    },
    onError: (err, { videoId }, context) => {
      // Rollback
      if (context?.wasLiked) {
        likeVideoOptimistic(videoId);
      } else {
        unlikeVideoOptimistic(videoId);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.liked() });
    },
  });
}

/**
 * Save video mutation (optimistic)
 */
export function useSaveVideo() {
  const queryClient = useQueryClient();
  const { saveVideoOptimistic, unsaveVideoOptimistic } = useVideoStore();

  return useMutation({
    mutationFn: async ({ videoId, isSaved }: { videoId: string; isSaved: boolean }) => {
      if (isSaved) {
        await api.delete(`/videos/${videoId}/save`);
      } else {
        await api.post(`/videos/${videoId}/save`);
      }
      return { videoId, isSaved: !isSaved };
    },
    onMutate: async ({ videoId, isSaved }) => {
      if (isSaved) {
        unsaveVideoOptimistic(videoId);
      } else {
        saveVideoOptimistic(videoId);
      }
      return { videoId, wasSaved: isSaved };
    },
    onError: (err, { videoId }, context) => {
      if (context?.wasSaved) {
        saveVideoOptimistic(videoId);
      } else {
        unsaveVideoOptimistic(videoId);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.saved() });
    },
  });
}

/**
 * Follow creator mutation (optimistic)
 */
export function useFollowCreator() {
  const queryClient = useQueryClient();
  const { followCreatorOptimistic, unfollowCreatorOptimistic } = useVideoStore();

  return useMutation({
    mutationFn: async ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => {
      if (isFollowing) {
        await api.delete(`/users/${userId}/follow`);
      } else {
        await api.post(`/users/${userId}/follow`);
      }
      return { userId, isFollowing: !isFollowing };
    },
    onMutate: async ({ userId, isFollowing }) => {
      if (isFollowing) {
        unfollowCreatorOptimistic(userId);
      } else {
        followCreatorOptimistic(userId);
      }
      return { userId, wasFollowing: isFollowing };
    },
    onError: (err, { userId }, context) => {
      if (context?.wasFollowing) {
        followCreatorOptimistic(userId);
      } else {
        unfollowCreatorOptimistic(userId);
      }
    },
    onSettled: (_, __, { userId }) => {
      queryClient.invalidateQueries({ queryKey: videoKeys.user(userId) });
    },
  });
}

/**
 * Share video mutation
 */
export function useShareVideo() {
  return useMutation({
    mutationFn: async ({ videoId, platform }: { videoId: string; platform: string }) => {
      const response = await api.post(`/videos/${videoId}/share`, { platform });
      return response.data;
    },
  });
}

/**
 * Report video mutation
 */
export function useReportVideo() {
  return useMutation({
    mutationFn: async ({
      videoId,
      reason,
      description,
    }: {
      videoId: string;
      reason: string;
      description?: string;
    }) => {
      const response = await api.post(`/videos/${videoId}/report`, {
        reason,
        description,
      });
      return response.data;
    },
  });
}

/**
 * Add comment mutation
 */
export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videoId,
      content,
      replyTo,
    }: {
      videoId: string;
      content: string;
      replyTo?: string;
    }) => {
      const response = await api.post(`/videos/${videoId}/comments`, {
        content,
        replyTo,
      });
      return response.data;
    },
    onSuccess: (_, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: videoKeys.detail(videoId) });
    },
  });
}

/**
 * Get video comments
 */
export function useVideoComments(videoId: string) {
  return useInfiniteQuery({
    queryKey: [...videoKeys.detail(videoId), 'comments'] as const,
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get(`/videos/${videoId}/comments`, {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    enabled: !!videoId,
  });
}

/**
 * Search videos
 */
export function useSearchVideos(query: string) {
  return useInfiniteQuery({
    queryKey: videoKeys.search(query),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/videos/search', {
        params: { q: query, page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    enabled: query.length >= 2,
  });
}

/**
 * Get trending videos
 */
export function useTrendingVideos() {
  return useQuery({
    queryKey: videoKeys.trending(),
    queryFn: async () => {
      const response = await api.get('/videos/trending');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get videos by hashtag
 */
export function useHashtagVideos(hashtag: string) {
  return useInfiniteQuery({
    queryKey: videoKeys.hashtag(hashtag),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get(`/videos/hashtag/${hashtag}`, {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    enabled: !!hashtag,
  });
}

/**
 * Get liked videos
 */
export function useLikedVideos() {
  return useInfiniteQuery({
    queryKey: videoKeys.liked(),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/videos/liked', {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
  });
}

/**
 * Get saved videos
 */
export function useSavedVideos() {
  return useInfiniteQuery({
    queryKey: videoKeys.saved(),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/videos/saved', {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
  });
}

/**
 * Track video view
 */
export function useTrackView() {
  const { addToWatchHistory } = useVideoStore();

  return useMutation({
    mutationFn: async ({
      videoId,
      watchDuration,
      completed,
    }: {
      videoId: string;
      watchDuration: number;
      completed: boolean;
    }) => {
      const response = await api.post(`/videos/${videoId}/view`, {
        watchDuration,
        completed,
      });
      return response.data;
    },
    onSuccess: (_, { videoId, watchDuration }) => {
      addToWatchHistory(videoId, watchDuration);
    },
  });
}
