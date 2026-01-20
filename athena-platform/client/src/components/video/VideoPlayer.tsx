'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, Play, Pause, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { useVideoFeedStore } from '@/lib/stores/video.store';

export interface VideoPost {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    isVerified?: boolean;
  };
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isBookmarked: boolean;
  category?: string;
  tags?: string[];
  createdAt: string;
}

interface VideoPlayerProps {
  video: VideoPost;
  isActive: boolean;
  onLike: (id: string) => void;
  onBookmark: (id: string) => void;
  onShare: (id: string) => void;
  onComment: (id: string) => void;
  onAuthorClick: (authorId: string) => void;
  onView?: (id: string, duration: number) => void;
}

export function VideoPlayer({
  video,
  isActive,
  onLike,
  onBookmark,
  onShare,
  onComment,
  onAuthorClick,
  onView,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { isMuted, toggleMute } = useVideoFeedStore(); // Global mute state
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const watchTimeRef = useRef(0);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Auto-play/pause based on visibility
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
         playPromise.catch(() => {
             // Autoplay was prevented
             setIsPlaying(false);
         });
      }
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      // Track view when video becomes inactive
      if (onView && watchTimeRef.current > 0) {
        onView(video.id, watchTimeRef.current);
        watchTimeRef.current = 0;
      }
    }
  }, [isActive, video.id, onView]);

  // Track progress
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(currentProgress);
    watchTimeRef.current = videoRef.current.currentTime;
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  // toggleMute is now imported from store

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div 
      className="relative h-full w-full bg-black snap-start snap-always"
      onClick={togglePlay}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          togglePlay();
        }
        if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          toggleMute();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={isPlaying ? 'Pause video' : 'Play video'}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        poster={video.thumbnailUrl}
        loop
        muted={isMuted}
        playsInline
        className="h-full w-full object-cover"
        onTimeUpdate={handleTimeUpdate}
        aria-label={video.title}
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />

      {/* Play/Pause indicator */}
      {showControls && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-4">
            {isPlaying ? (
              <Pause className="w-12 h-12 text-white" />
            ) : (
              <Play className="w-12 h-12 text-white" />
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-16 h-1 bg-white/30">
        <div 
          className="h-full bg-primary-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Right sidebar - Actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        {/* Author avatar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAuthorClick(video.author.id);
          }}
          className="relative"
          aria-label={`View ${video.author.firstName} profile`}
        >
          <Avatar
            src={video.author.avatarUrl}
            fallback={`${video.author.firstName[0]}${video.author.lastName[0]}`}
            size="md"
            className="ring-2 ring-white"
          />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary-500 rounded-full w-5 h-5 flex items-center justify-center">
            <span className="text-white text-xs">+</span>
          </div>
        </button>

        {/* Like */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(video.id);
          }}
          className="flex flex-col items-center"
          aria-label={video.isLiked ? 'Unlike' : 'Like'}
        >
          <div className={cn(
            "p-2 rounded-full",
            video.isLiked ? "text-red-500" : "text-white"
          )}>
            <Heart className={cn("w-7 h-7", video.isLiked && "fill-current")} />
          </div>
          <span className="text-white text-xs font-medium">{formatCount(video.likes)}</span>
        </button>

        {/* Comment */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComment(video.id);
          }}
          className="flex flex-col items-center"
          aria-label="Open comments"
        >
          <div className="p-2 text-white">
            <MessageCircle className="w-7 h-7" />
          </div>
          <span className="text-white text-xs font-medium">{formatCount(video.comments)}</span>
        </button>

        {/* Bookmark */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBookmark(video.id);
          }}
          className="flex flex-col items-center"
          aria-label={video.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          <div className={cn(
            "p-2",
            video.isBookmarked ? "text-yellow-500" : "text-white"
          )}>
            <Bookmark className={cn("w-7 h-7", video.isBookmarked && "fill-current")} />
          </div>
        </button>

        {/* Share */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(video.id);
          }}
          className="flex flex-col items-center"
          aria-label="Share video"
        >
          <div className="p-2 text-white">
            <Share2 className="w-7 h-7" />
          </div>
          <span className="text-white text-xs font-medium">{formatCount(video.shares)}</span>
        </button>

        {/* Mute toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="p-2 text-white"
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-3 right-20 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold">
            @{video.author.firstName.toLowerCase()}{video.author.lastName.toLowerCase()}
          </span>
          {video.author.isVerified && (
            <span className="bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
              </svg>
            </span>
          )}
        </div>
        <p className="text-sm line-clamp-2 mb-2">{video.title}</p>
        {video.description && (
          <p className="text-xs text-white/80 line-clamp-2">{video.description}</p>
        )}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {video.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-primary-300">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoPlayer;
