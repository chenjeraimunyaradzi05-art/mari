'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, Play, Pause, Music, Copy, Subtitles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { handleFromName } from '@/lib/social-text';
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
  /** The sound the reel plays; links to every reel using it. */
  sound?: { id: string; title: string };
  /** The reel this one answers, when it is a duet. */
  duetOf?: { id: string; name: string };
  duetCount?: number;
  /** WebVTT captions, shown with the CC toggle. */
  captionsUrl?: string;
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
  onDuet?: (id: string) => void;
  onView?: (id: string, watchDuration: number, completionPct: number) => void;
}

export function VideoPlayer({
  video,
  isActive,
  onLike,
  onBookmark,
  onShare,
  onComment,
  onAuthorClick,
  onDuet,
  onView,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { isMuted, toggleMute } = useVideoFeedStore(); // Global mute state
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const watchTimeRef = useRef(0);

  // Subtitles follow the toggle; the browser's own track UI is hidden behind it.
  useEffect(() => {
    const track = videoRef.current?.textTracks?.[0];
    if (track) track.mode = captionsOn ? 'showing' : 'hidden';
  }, [captionsOn, video.captionsUrl]);

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
        const total = videoRef.current.duration;
        const completionPct = Number.isFinite(total) && total > 0
          ? Math.min(100, Math.max(0, (watchTimeRef.current / total) * 100))
          : 0;
        onView(video.id, watchTimeRef.current, completionPct);
        watchTimeRef.current = 0;
      }
    }
  }, [isActive, video.id, onView]);

  // Track progress
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    // duration is NaN until metadata loads, which would poison the progress bar.
    setProgress(Number.isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0);
    watchTimeRef.current = currentTime;
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
        crossOrigin={video.captionsUrl ? 'anonymous' : undefined}
      >
        {video.captionsUrl && (
          <track kind="captions" src={video.captionsUrl} srcLang="en" label="Subtitles" default />
        )}
      </video>

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
            // Indexing a possibly-empty name yields undefined, which the
            // template then printed literally — every reel avatar read
            // "Aundefined", because VideoFeed maps a single displayName into
            // firstName and hardcodes lastName to ''.
            fallback={
              `${video.author.firstName?.[0] ?? ''}${video.author.lastName?.[0] ?? ''}`.toUpperCase() ||
              '?'
            }
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
          data-testid="video-like-button"
          data-liked={video.isLiked}
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
          data-testid="video-comment-button"
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
          data-testid="video-share-button"
        >
          <div className="p-2 text-white">
            <Share2 className="w-7 h-7" />
          </div>
          <span className="text-white text-xs font-medium">{formatCount(video.shares)}</span>
        </button>

        {/* Duet: answer this reel with one of your own, composed side by side. */}
        {onDuet && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuet(video.id);
            }}
            className="flex flex-col items-center"
            aria-label="Duet this reel"
          >
            <div className="p-2 text-white">
              <Copy className="w-6 h-6" />
            </div>
            <span className="text-white text-xs font-medium">{video.duetCount ? formatCount(video.duetCount) : 'Duet'}</span>
          </button>
        )}

        {video.captionsUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCaptionsOn((on) => !on);
            }}
            className={cn('p-2', captionsOn ? 'text-white' : 'text-white/50')}
            aria-label={captionsOn ? 'Hide captions' : 'Show captions'}
            aria-pressed={captionsOn}
          >
            <Subtitles className="w-6 h-6" />
          </button>
        )}

        {/* Mute toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="p-2 text-white"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-3 right-20 text-white">
        <div className="flex items-center gap-2 mb-2">
          {/* One handle from the display name, so "Mei Chen" reads @meichen
              rather than "@mei chen" with a space in it. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAuthorClick(video.author.id);
            }}
            className="font-semibold hover:underline"
          >
            @{handleFromName(`${video.author.firstName} ${video.author.lastName}`)}
          </button>
          {video.author.isVerified && (
            <span className="bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
              </svg>
            </span>
          )}
        </div>
        {video.duetOf && (
          <Link
            href={`/explore?video=${video.duetOf.id}`}
            onClick={(e) => e.stopPropagation()}
            className="mb-1 inline-flex items-center gap-1 text-xs text-white/80 hover:text-white hover:underline"
          >
            <Copy className="h-3 w-3" /> Duet with @{handleFromName(video.duetOf.name)}
          </Link>
        )}
        <p className="text-sm line-clamp-2 mb-2">{video.title}</p>
        {video.description && (
          <p className="text-xs text-white/80 line-clamp-2">{video.description}</p>
        )}
        {/* Tags open the feed sliced to that topic. They were rendered as
            plain text before, so a tag could be read but never followed. */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {video.tags.slice(0, 4).map((tag) => (
              <Link
                key={tag}
                href={`/explore?topic=${encodeURIComponent(tag)}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium text-white/80 hover:text-white hover:underline"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
        {/* The sound: tap it to see every reel that uses it, and to use it yourself. */}
        {video.sound && (
          <Link
            href={`/explore?sound=${encodeURIComponent(video.sound.id)}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs text-white backdrop-blur hover:bg-white/25"
            aria-label={`Sound: ${video.sound.title}`}
          >
            <Music className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{video.sound.title}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default VideoPlayer;
