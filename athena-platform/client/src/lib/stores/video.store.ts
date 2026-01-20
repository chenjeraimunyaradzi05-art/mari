import { create } from 'zustand';

export interface VideoItem {
  id: string;
  url: string;
  thumbnail?: string;
  description: string;
  creator: {
    id: string;
    username: string;
    avatar?: string;
  };
  likes: number;
  comments: number;
  shares: number;
  isLiked?: boolean;
}

interface VideoFeedState {
  feed: VideoItem[];
  currentIndex: number;
  isMuted: boolean;
  isPlaying: boolean;
  page: number;
  hasMore: boolean;
  isLoading: boolean;

  // Actions
  setFeed: (videos: VideoItem[]) => void;
  appendVideos: (videos: VideoItem[]) => void;
  setIndex: (index: number) => void;
  toggleMute: () => void;
  setPlaying: (playing: boolean) => void;
  toggleLike: (videoId: string) => void;
}

export const useVideoFeedStore = create<VideoFeedState>((set) => ({
  feed: [],
  currentIndex: 0,
  isMuted: true, // Auto-play usually muted by default for UX
  isPlaying: true,
  page: 1,
  hasMore: true,
  isLoading: false,

  setFeed: (videos) => set({ feed: videos, currentIndex: 0, page: 1 }),

  appendVideos: (videos) => set((state) => ({ 
      feed: [...state.feed, ...videos],
      hasMore: videos.length > 0
  })),

  setIndex: (index) => set({ currentIndex: index }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  setPlaying: (playing) => set({ isPlaying: playing }),

  toggleLike: (videoId) => set((state) => {
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
      return { feed };
  })
}));
