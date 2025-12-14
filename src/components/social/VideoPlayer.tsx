'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommentsDrawer } from './CommentsDrawer';

export interface VideoPost {
  id: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  content?: string;
  author: {
    firstName: string | null;
    lastName: string | null;
    profileImage?: string | null;
  };
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  tags: string[];
}

interface VideoPlayerProps {
  post: VideoPost;
  isActive: boolean;
}

export function VideoPlayer({ post, isActive }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.play().catch(() => {
        // Auto-play might be blocked
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistic update
    const newLikedState = !liked;
    setLiked(newLikedState);
    
    try {
      const res = await fetch('/api/social/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      });
      
      if (!res.ok) {
        // Revert if failed
        setLiked(!newLikedState);
      }
    } catch (error) {
      setLiked(!newLikedState);
    }
  };

  return (
    <div className="relative h-full w-full bg-black snap-start">
      {/* Video Layer */}
      <div className="absolute inset-0 flex items-center justify-center" onClick={togglePlay}>
        {post.videoUrl ? (
          <video
            ref={videoRef}
            src={post.videoUrl}
            className="h-full w-full object-cover"
            loop
            muted={isMuted}
            playsInline
            poster={post.thumbnailUrl}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-900 text-white">
            <p className="text-center p-4">{post.content || 'No Video Content'}</p>
          </div>
        )}
      </div>

      {/* Play/Pause Overlay Indicator */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 p-4 rounded-full">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Right Sidebar Actions */}
      <div className="absolute right-4 bottom-20 flex flex-col items-center gap-6 z-10">
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={handleLike}
            className="p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
          >
            <Heart 
              className={cn("w-8 h-8 transition-colors", liked ? "text-red-500 fill-red-500" : "text-white")} 
            />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow-md">
            {post.likesCount + (liked ? 1 : 0)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(true);
            }}
            className="p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
          >
            <MessageCircle className="w-8 h-8 text-white fill-white/10" />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow-md">
            {post.commentsCount}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button className="p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors">
            <Share2 className="w-8 h-8 text-white" />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow-md">
            {post.sharesCount}
          </span>
        </div>
      </div>

      {/* Bottom Info Layer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
        <div className="flex justify-between items-end">
          <div className="flex-1 mr-12">
            <h3 className="text-white font-bold text-lg mb-1">
              @{post.author.firstName}{post.author.lastName}
            </h3>
            <p className="text-white/90 text-sm mb-2 line-clamp-2">
              {post.content}
            </p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="text-xs font-bold text-white bg-white/20 px-2 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          
          <button onClick={toggleMute} className="p-2 text-white hover:bg-white/10 rounded-full">
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <CommentsDrawer 
        postId={post.id} 
        isOpen={showComments} 
        onClose={() => setShowComments(false)} 
      />
    </div>
  );
}
