'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { videoApi } from '@/lib/api-extensions';
import { Loader2 } from 'lucide-react';
import { useVideoFeedStore, VideoItem } from '@/lib/stores/video.store';
import { Skeleton } from '@/components/ui/loading';

// Maps API response to Store Interface
function mapApiToVideoItem(v: any): VideoItem {
  return {
      id: v.id,
      url: v.videoUrl,
      thumbnail: v.thumbnailUrl,
      description: v.description || v.title,
      creator: {
          id: v.author.id,
          username: v.author.firstName, // + ' ' + v.author.lastName,
          avatar: v.author.avatarUrl
      },
      likes: v.likes,
      comments: v.comments,
      shares: v.shares,
      isLiked: v.isLiked
  };
}

interface VideoFeedProps {
  initialVideos?: any[]; 
  category?: string;
}

export function VideoFeed({ initialVideos = [], category }: VideoFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use global store
  const { 
      feed, 
      currentIndex, 
      setFeed, 
      appendVideos, 
      setIndex,
      toggleLike,
      isLoading,
      hasMore 
  } = useVideoFeedStore();

  const [loadingLocal, setLoadingLocal] = useState(false);

  // Fetch videos
  const fetchVideos = useCallback(async (pageNum: number) => {
    if (loadingLocal || !hasMore) return;
    
    setLoadingLocal(true);
    try {
      const response = await videoApi.getFeed({ page: pageNum, limit: 10, category });
      const newVideos = response.data.data?.videos || [];
      
      const mappedVideos: VideoItem[] = newVideos.map(mapApiToVideoItem);

      if (newVideos.length === 0) {
         // handle end?
      } else {
        if (pageNum === 1) setFeed(mappedVideos);
        else appendVideos(mappedVideos);
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoadingLocal(false);
    }
  }, [loadingLocal, hasMore, category, setFeed, appendVideos]);

  // Initial load
  useEffect(() => {
    if (feed.length === 0 && initialVideos.length === 0) {
      fetchVideos(1);
    } else if (initialVideos.length > 0 && feed.length === 0) {
        setFeed(initialVideos.map(mapApiToVideoItem));
    }
  }, [fetchVideos, initialVideos, feed.length, setFeed]);

  const handleScroll = () => {
      if (!containerRef.current) return;
      
      const { scrollTop, clientHeight } = containerRef.current;
      const index = Math.round(scrollTop / clientHeight);
      
      if (index !== currentIndex) {
        setIndex(index);
        
        // Load more
        if (index > feed.length - 4 && hasMore && !loadingLocal) {
            // Logic to fetch next page needs slightly better tracking of 'page' in helper
            // For now, assuming fetchVideos uses store page or we pass calculated page
             const nextPage = Math.floor(feed.length / 10) + 1;
             fetchVideos(nextPage);
        }
      }
  };

  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;
    const { clientHeight } = containerRef.current;
    containerRef.current.scrollTo({ top: index * clientHeight, behavior: 'smooth' });
  };

  // Interactions
  const handleLike = async (id: string) => {
    toggleLike(id); // Optimistic update
    try {
       // We'd access the video to check state if we needed exact toggle logic, 
       // but for now allow the API to handle idempotency or trust the toggle
       // Assuming API: await videoApi.toggleLike(id);
    } catch (err) {
       toggleLike(id); // Revert
    }
  };

  return (
    <div 
      ref={containerRef}
      data-testid="video-feed"
      onScroll={handleScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = Math.min(feed.length - 1, currentIndex + 1);
          setIndex(nextIndex);
          scrollToIndex(nextIndex);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = Math.max(0, currentIndex - 1);
          setIndex(prevIndex);
          scrollToIndex(prevIndex);
        }
      }}
      tabIndex={0}
      role="list"
      aria-label="Video feed"
      className="h-[100dvh] w-full max-w-md mx-auto overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar bg-black focus:outline-none"
    >
      {feed.length === 0 && loadingLocal && (
        <div className="h-full w-full snap-start flex items-center justify-center bg-zinc-900">
          <div className="w-full max-w-sm space-y-3 p-6">
            <Skeleton className="h-[70vh] w-full rounded-2xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      )}
      {feed.map((video, index) => (
        <div
          key={video.id}
          className="h-full w-full snap-start relative"
          role="listitem"
          data-testid="video-player"
          data-video-id={video.id}
          data-active={index === currentIndex}
        >
          <VideoPlayer 
            video={{
                id: video.id,
                title: video.description,
                description: video.description,
                videoUrl: video.url,
                thumbnailUrl: video.thumbnail,
                duration: 0, 
                author: {
                    id: video.creator.id,
                    firstName: video.creator.username, 
                    lastName: '',
                    avatarUrl: video.creator.avatar
                },
                likes: video.likes,
                comments: video.comments,
                shares: video.shares,
                isLiked: video.isLiked || false,
                isBookmarked: false,
                createdAt: new Date().toISOString()
            }} 
            isActive={index === currentIndex} 
            onLike={handleLike}
            onBookmark={() => {}}
            onShare={() => {}}
            onComment={() => {}}
            onAuthorClick={() => {}}
          />
        </div>
      ))}
      
      {loadingLocal && (
        <div className="h-full w-full snap-start flex items-center justify-center bg-zinc-900">
           <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}
