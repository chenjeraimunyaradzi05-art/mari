import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VideoItem {
  id: string;
  url: string;
  thumbnail?: string;
  description: string;
  creator: {
    id: string;
    username: string;
    avatar?: string;
    isFollowing?: boolean;
  };
  likes: number;
  comments: number;
  shares: number;
  views?: number;
  duration?: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isShared?: boolean;
  hashtags?: string[];
  soundId?: string;
  soundTitle?: string;
  createdAt?: string;
}

export interface WatchHistoryItem {
  videoId: string;
  watchedAt: string;
  progress: number; // 0-1 percentage
  completedWatch: boolean;
}

interface VideoFeedState {
  feed: VideoItem[];
  currentIndex: number;
  isMuted: boolean;
  isPlaying: boolean;
  page: number;
  hasMore: boolean;
  isLoading: boolean;

  // Bookmarks & Likes (persisted)
  bookmarkedVideos: string[];
  likedVideos: string[];
  sharedVideos: string[];
  
  // Watch history (persisted)
  watchHistory: WatchHistoryItem[];
  
  // Video progress tracking
  videoProgress: Record<string, number>;

  // Actions
  setFeed: (videos: VideoItem[]) => void;
  appendVideos: (videos: VideoItem[]) => void;
  setIndex: (index: number) => void;
  toggleMute: () => void;
  setPlaying: (playing: boolean) => void;
  toggleLike: (videoId: string) => void;
  
  // Bookmark actions
  toggleBookmark: (videoId: string) => void;
  isBookmarked: (videoId: string) => boolean;
  getBookmarkedVideos: () => string[];
  
  // Share tracking
  markAsShared: (videoId: string) => void;
  
  // Progress tracking
  updateProgress: (videoId: string, progress: number) => void;
  getProgress: (videoId: string) => number;
  
  // Watch history
  addToHistory: (videoId: string, progress: number, completed: boolean) => void;
  clearHistory: () => void;
  getRecentlyWatched: (limit?: number) => WatchHistoryItem[];
  
  // Creator follow
  toggleFollow: (creatorId: string) => void;
}

export const useVideoFeedStore = create<VideoFeedState>()(
  persist(
    (set, get) => ({
      feed: [],
      currentIndex: 0,
      isMuted: true, // Auto-play usually muted by default for UX
      isPlaying: true,
      page: 1,
      hasMore: true,
      isLoading: false,
      
      // Persisted state
      bookmarkedVideos: [],
      likedVideos: [],
      sharedVideos: [],
      watchHistory: [],
      videoProgress: {},

      setFeed: (videos) => {
        // Merge with bookmarked/liked state
        const { bookmarkedVideos, likedVideos } = get();
        const enrichedVideos = videos.map(v => ({
          ...v,
          isBookmarked: bookmarkedVideos.includes(v.id),
          isLiked: likedVideos.includes(v.id),
        }));
        set({ feed: enrichedVideos, currentIndex: 0, page: 1 });
      },

      appendVideos: (videos) => set((state) => {
        const enrichedVideos = videos.map(v => ({
          ...v,
          isBookmarked: state.bookmarkedVideos.includes(v.id),
          isLiked: state.likedVideos.includes(v.id),
        }));
        return { 
          feed: [...state.feed, ...enrichedVideos],
          hasMore: videos.length > 0
        };
      }),

      setIndex: (index) => set({ currentIndex: index }),

      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      setPlaying: (playing) => set({ isPlaying: playing }),

      toggleLike: (videoId) => set((state) => {
        const isCurrentlyLiked = state.likedVideos.includes(videoId);
        const likedVideos = isCurrentlyLiked
          ? state.likedVideos.filter(id => id !== videoId)
          : [...state.likedVideos, videoId];
          
        const feed = state.feed.map(video => {
          if (video.id === videoId) {
            const isLiked = !video.isLiked;
            return {
              ...video,
              isLiked,
              likes: video.likes + (isLiked ? 1 : -1)
            };
          }
          return video;
        });
        return { feed, likedVideos };
      }),

      toggleBookmark: (videoId) => set((state) => {
        const isCurrentlyBookmarked = state.bookmarkedVideos.includes(videoId);
        const bookmarkedVideos = isCurrentlyBookmarked
          ? state.bookmarkedVideos.filter(id => id !== videoId)
          : [...state.bookmarkedVideos, videoId];
          
        const feed = state.feed.map(video => {
          if (video.id === videoId) {
            return { ...video, isBookmarked: !video.isBookmarked };
          }
          return video;
        });
        return { feed, bookmarkedVideos };
      }),

      isBookmarked: (videoId) => get().bookmarkedVideos.includes(videoId),
      
      getBookmarkedVideos: () => get().bookmarkedVideos,

      markAsShared: (videoId) => set((state) => {
        if (state.sharedVideos.includes(videoId)) return state;
        
        const feed = state.feed.map(video => {
          if (video.id === videoId) {
            return { ...video, shares: video.shares + 1, isShared: true };
          }
          return video;
        });
        return { 
          feed, 
          sharedVideos: [...state.sharedVideos, videoId] 
        };
      }),

      updateProgress: (videoId, progress) => set((state) => ({
        videoProgress: {
          ...state.videoProgress,
          [videoId]: progress,
        },
      })),

      getProgress: (videoId) => get().videoProgress[videoId] || 0,

      addToHistory: (videoId, progress, completed) => set((state) => {
        // Remove existing entry for this video
        const filtered = state.watchHistory.filter(h => h.videoId !== videoId);
        
        const newEntry: WatchHistoryItem = {
          videoId,
          watchedAt: new Date().toISOString(),
          progress,
          completedWatch: completed,
        };
        
        // Keep only last 100 items
        const watchHistory = [newEntry, ...filtered].slice(0, 100);
        
        return { watchHistory };
      }),

      clearHistory: () => set({ watchHistory: [], videoProgress: {} }),

      getRecentlyWatched: (limit = 20) => get().watchHistory.slice(0, limit),

      toggleFollow: (creatorId) => set((state) => ({
        feed: state.feed.map(video => {
          if (video.creator.id === creatorId) {
            return {
              ...video,
              creator: {
                ...video.creator,
                isFollowing: !video.creator.isFollowing,
              },
            };
          }
          return video;
        }),
      })),
    }),
    {
      name: 'athena-video-feed',
      partialize: (state) => ({
        bookmarkedVideos: state.bookmarkedVideos,
        likedVideos: state.likedVideos,
        sharedVideos: state.sharedVideos,
        watchHistory: state.watchHistory,
        videoProgress: state.videoProgress,
        isMuted: state.isMuted,
      }),
    }
  )
);
