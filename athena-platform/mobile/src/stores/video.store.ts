/**
 * Video Feed Store
 * Phase 5: Mobile Parity - Zustand state management
 * 
 * Handles TikTok-style video feed state for mobile
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// TYPES
// ============================================

export interface VideoPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userVerified: boolean;
  videoUrl: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  hashtags: string[];
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  category: 'career' | 'education' | 'business' | 'lifestyle' | 'entertainment';
  opportunityType?: 'job' | 'course' | 'mentorship' | 'event';
  opportunityId?: string;
  createdAt: Date;
}

export type FeedType = 'forYou' | 'following' | 'trending' | 'opportunities';

interface VideoFeedState {
  // Videos
  videos: VideoPost[];
  currentIndex: number;
  
  // Feed type
  feedType: FeedType;
  
  // Playback
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  
  // Pagination
  page: number;
  hasMore: boolean;
  
  // Interactions (optimistic)
  pendingLikes: Set<string>;
  pendingSaves: Set<string>;
  
  // Watch history
  watchHistory: string[];
  watchProgress: Map<string, number>;
  
  // Loading
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

interface VideoFeedActions {
  // Videos
  setVideos: (videos: VideoPost[]) => void;
  appendVideos: (videos: VideoPost[]) => void;
  prependVideos: (videos: VideoPost[]) => void;
  
  // Navigation
  setCurrentIndex: (index: number) => void;
  nextVideo: () => void;
  previousVideo: () => void;
  
  // Feed type
  setFeedType: (type: FeedType) => void;
  
  // Playback
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  
  // Interactions (optimistic)
  likeVideo: (videoId: string) => void;
  unlikeVideo: (videoId: string) => void;
  saveVideo: (videoId: string) => void;
  unsaveVideo: (videoId: string) => void;
  followUser: (userId: string) => void;
  unfollowUser: (userId: string) => void;
  
  // Update video stats
  incrementViews: (videoId: string) => void;
  updateVideoStats: (videoId: string, stats: Partial<Pick<VideoPost, 'likes' | 'comments' | 'shares'>>) => void;
  
  // Watch history
  addToWatchHistory: (videoId: string) => void;
  updateWatchProgress: (videoId: string, progress: number) => void;
  clearWatchHistory: () => void;
  
  // Pagination
  setPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  
  // Loading
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  
  // Reset
  reset: () => void;
  refresh: () => void;
}

type VideoFeedStore = VideoFeedState & VideoFeedActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: VideoFeedState = {
  videos: [],
  currentIndex: 0,
  feedType: 'forYou',
  isPlaying: true,
  isMuted: false,
  volume: 1,
  page: 1,
  hasMore: true,
  pendingLikes: new Set(),
  pendingSaves: new Set(),
  watchHistory: [],
  watchProgress: new Map(),
  isLoading: false,
  isRefreshing: false,
  error: null,
};

// ============================================
// STORE
// ============================================

export const useVideoFeedStore = create<VideoFeedStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Videos
      setVideos: (videos) => set({ 
        videos, 
        currentIndex: 0, 
        page: 1 
      }),

      appendVideos: (newVideos) => set((state) => ({
        videos: [...state.videos, ...newVideos],
      })),

      prependVideos: (newVideos) => set((state) => ({
        videos: [...newVideos, ...state.videos],
      })),

      // Navigation
      setCurrentIndex: (index) => set({ currentIndex: index }),

      nextVideo: () => set((state) => {
        const nextIndex = Math.min(state.currentIndex + 1, state.videos.length - 1);
        return { currentIndex: nextIndex };
      }),

      previousVideo: () => set((state) => {
        const prevIndex = Math.max(state.currentIndex - 1, 0);
        return { currentIndex: prevIndex };
      }),

      // Feed type
      setFeedType: (feedType) => set({ 
        feedType, 
        videos: [], 
        currentIndex: 0, 
        page: 1, 
        hasMore: true 
      }),

      // Playback
      setPlaying: (isPlaying) => set({ isPlaying }),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setMuted: (isMuted) => set({ isMuted }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      setVolume: (volume) => set({ volume }),

      // Interactions (optimistic)
      likeVideo: (videoId) => set((state) => {
        const videos = state.videos.map((v) =>
          v.id === videoId ? { ...v, isLiked: true, likes: v.likes + 1 } : v
        );
        const pendingLikes = new Set(state.pendingLikes);
        pendingLikes.add(videoId);
        return { videos, pendingLikes };
      }),

      unlikeVideo: (videoId) => set((state) => {
        const videos = state.videos.map((v) =>
          v.id === videoId ? { ...v, isLiked: false, likes: Math.max(0, v.likes - 1) } : v
        );
        const pendingLikes = new Set(state.pendingLikes);
        pendingLikes.delete(videoId);
        return { videos, pendingLikes };
      }),

      saveVideo: (videoId) => set((state) => {
        const videos = state.videos.map((v) =>
          v.id === videoId ? { ...v, isSaved: true } : v
        );
        const pendingSaves = new Set(state.pendingSaves);
        pendingSaves.add(videoId);
        return { videos, pendingSaves };
      }),

      unsaveVideo: (videoId) => set((state) => {
        const videos = state.videos.map((v) =>
          v.id === videoId ? { ...v, isSaved: false } : v
        );
        const pendingSaves = new Set(state.pendingSaves);
        pendingSaves.delete(videoId);
        return { videos, pendingSaves };
      }),

      followUser: (userId) => set((state) => ({
        videos: state.videos.map((v) =>
          v.userId === userId ? { ...v, isFollowing: true } : v
        ),
      })),

      unfollowUser: (userId) => set((state) => ({
        videos: state.videos.map((v) =>
          v.userId === userId ? { ...v, isFollowing: false } : v
        ),
      })),

      // Update stats
      incrementViews: (videoId) => set((state) => ({
        videos: state.videos.map((v) =>
          v.id === videoId ? { ...v, views: v.views + 1 } : v
        ),
      })),

      updateVideoStats: (videoId, stats) => set((state) => ({
        videos: state.videos.map((v) =>
          v.id === videoId ? { ...v, ...stats } : v
        ),
      })),

      // Watch history
      addToWatchHistory: (videoId) => set((state) => {
        const history = state.watchHistory.filter((id) => id !== videoId);
        return { watchHistory: [videoId, ...history].slice(0, 100) };
      }),

      updateWatchProgress: (videoId, progress) => set((state) => {
        const watchProgress = new Map(state.watchProgress);
        watchProgress.set(videoId, progress);
        return { watchProgress };
      }),

      clearWatchHistory: () => set({ 
        watchHistory: [], 
        watchProgress: new Map() 
      }),

      // Pagination
      setPage: (page) => set({ page }),
      setHasMore: (hasMore) => set({ hasMore }),

      // Loading
      setLoading: (isLoading) => set({ isLoading }),
      setRefreshing: (isRefreshing) => set({ isRefreshing }),
      setError: (error) => set({ error, isLoading: false, isRefreshing: false }),

      // Reset
      reset: () => set(initialState),

      refresh: () => set({
        videos: [],
        currentIndex: 0,
        page: 1,
        hasMore: true,
        isRefreshing: true,
        error: null,
      }),
    }),
    {
      name: 'athena-video-feed-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        feedType: state.feedType,
        isMuted: state.isMuted,
        volume: state.volume,
        watchHistory: state.watchHistory.slice(0, 50),
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectCurrentVideo = (state: VideoFeedStore) => 
  state.videos[state.currentIndex];

export const selectHasNextVideo = (state: VideoFeedStore) => 
  state.currentIndex < state.videos.length - 1;

export const selectHasPreviousVideo = (state: VideoFeedStore) => 
  state.currentIndex > 0;

export const selectVideoById = (videoId: string) => (state: VideoFeedStore) =>
  state.videos.find((v) => v.id === videoId);
