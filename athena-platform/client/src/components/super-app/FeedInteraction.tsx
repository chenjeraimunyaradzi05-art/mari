'use client';

/**
 * Feed Interaction UI - TikTok-style overlay controls
 * Like, Comment, Share, Save with animations
 * Phase 3: Web Client - Super App Core
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Send,
  Copy,
  Flag,
  UserPlus,
  Repeat2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useVideoFeedStore } from '@/lib/stores/video.store';
import { useUIStore } from '@/lib/stores/ui.store';
import { api } from '@/lib/api';

interface FeedInteractionProps {
  videoId: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  isFollowing?: boolean;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

export function FeedInteraction({
  videoId,
  likes,
  comments,
  shares,
  isLiked: initialIsLiked,
  isSaved: initialIsSaved,
  creatorId,
  creatorName,
  creatorAvatar,
  isFollowing = false,
  className,
  orientation = 'vertical',
}: FeedInteractionProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [likeCount, setLikeCount] = useState(likes);
  const [isAnimating, setIsAnimating] = useState<string | null>(null);
  
  const { addToast } = useUIStore();
  const { toggleLike } = useVideoFeedStore();

  const handleLike = useCallback(async () => {
    // Optimistic update
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    setIsAnimating('like');
    
    setTimeout(() => setIsAnimating(null), 500);

    try {
      await api.post(`/api/videos/${videoId}/like`);
      toggleLike(videoId);
    } catch (error) {
      // Revert on error
      setIsLiked(isLiked);
      setLikeCount(prev => isLiked ? prev + 1 : prev - 1);
      addToast('Failed to update like', 'error');
    }
  }, [isLiked, videoId, toggleLike, addToast]);

  const handleSave = useCallback(async () => {
    setIsSaved(!isSaved);
    setIsAnimating('save');
    
    setTimeout(() => setIsAnimating(null), 500);

    try {
      await api.post(`/api/videos/${videoId}/save`);
      addToast(isSaved ? 'Removed from saved' : 'Saved to collection', 'success');
    } catch (error) {
      setIsSaved(isSaved);
      addToast('Failed to save video', 'error');
    }
  }, [isSaved, videoId, addToast]);

  const handleShare = useCallback(async (type: 'copy' | 'native' | 'dm') => {
    const shareUrl = `${window.location.origin}/video/${videoId}`;
    
    if (type === 'copy') {
      await navigator.clipboard.writeText(shareUrl);
      addToast('Link copied to clipboard', 'success');
    } else if (type === 'native' && navigator.share) {
      try {
        await navigator.share({
          title: `Check out this video by ${creatorName}`,
          url: shareUrl,
        });
      } catch (e) {
        // User cancelled
      }
    } else if (type === 'dm') {
      // Open DM modal with share link
      // This would integrate with the chat system
      addToast('Opening messages...', 'info');
    }

    // Track share
    try {
      await api.post(`/api/videos/${videoId}/share`, { type });
    } catch (error) {
      // Non-critical
    }
  }, [videoId, creatorName, addToast]);

  const handleComment = useCallback(() => {
    // Emit event to open comments panel
    window.dispatchEvent(new CustomEvent('open-comments', { detail: { videoId } }));
  }, [videoId]);

  const handleFollow = useCallback(async () => {
    try {
      await api.post(`/api/users/${creatorId}/follow`);
      addToast(`Following ${creatorName}`, 'success');
    } catch (error) {
      addToast('Failed to follow', 'error');
    }
  }, [creatorId, creatorName, addToast]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'flex gap-4',
        isVertical ? 'flex-col items-center' : 'flex-row items-center',
        className
      )}
    >
      {/* Creator Avatar with Follow */}
      {isVertical && (
        <div className="relative mb-2">
          <button
            onClick={() => window.location.href = `/profile/${creatorId}`}
            className="relative"
          >
            {creatorAvatar ? (
              <img
                src={creatorAvatar}
                alt={creatorName}
                className="w-12 h-12 rounded-full border-2 border-white dark:border-zinc-800 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                {creatorName.charAt(0)}
              </div>
            )}
          </button>
          {!isFollowing && (
            <button
              onClick={handleFollow}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-rose-600 transition-colors"
            >
              <span className="text-xs font-bold">+</span>
            </button>
          )}
        </div>
      )}

      {/* Like Button */}
      <InteractionButton
        icon={Heart}
        count={formatCount(likeCount)}
        isActive={isLiked}
        isAnimating={isAnimating === 'like'}
        onClick={handleLike}
        activeColor="text-rose-500"
        fillActive
        label="Like"
        vertical={isVertical}
      />

      {/* Comment Button */}
      <InteractionButton
        icon={MessageCircle}
        count={formatCount(comments)}
        onClick={handleComment}
        label="Comments"
        vertical={isVertical}
      />

      {/* Share Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div>
            <InteractionButton
              icon={Share2}
              count={formatCount(shares)}
              label="Share"
              vertical={isVertical}
              asChild
            />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side={isVertical ? 'left' : 'top'}>
          <DropdownMenuItem onClick={() => handleShare('copy')}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('dm')}>
            <Send className="h-4 w-4 mr-2" />
            Send as Message
          </DropdownMenuItem>
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <DropdownMenuItem onClick={() => handleShare('native')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Share to...
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Repeat2 className="h-4 w-4 mr-2" />
            Repost
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save/Bookmark Button */}
      <InteractionButton
        icon={Bookmark}
        isActive={isSaved}
        isAnimating={isAnimating === 'save'}
        onClick={handleSave}
        activeColor="text-amber-500"
        fillActive
        label="Save"
        vertical={isVertical}
      />

      {/* More Options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div>
            <InteractionButton
              icon={MoreHorizontal}
              label="More"
              vertical={isVertical}
              asChild
            />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side={isVertical ? 'left' : 'top'}>
          <DropdownMenuItem onClick={handleFollow}>
            <UserPlus className="h-4 w-4 mr-2" />
            Follow @{creatorName}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-500">
            <Flag className="h-4 w-4 mr-2" />
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface InteractionButtonProps {
  icon: React.ElementType;
  count?: string;
  isActive?: boolean;
  isAnimating?: boolean;
  onClick?: () => void;
  activeColor?: string;
  fillActive?: boolean;
  label: string;
  vertical?: boolean;
  asChild?: boolean;
}

function InteractionButton({
  icon: Icon,
  count,
  isActive,
  isAnimating,
  onClick,
  activeColor = 'text-white',
  fillActive = false,
  label,
  vertical = true,
  asChild = false,
}: InteractionButtonProps) {
  const content = (
    <>
      <div
        className={cn(
          'w-12 h-12 rounded-full bg-zinc-800/70 dark:bg-zinc-700/70 backdrop-blur-sm flex items-center justify-center transition-all',
          'hover:bg-zinc-700/80 dark:hover:bg-zinc-600/80',
          isActive && activeColor,
          isAnimating && 'scale-125'
        )}
      >
        <Icon
          className={cn(
            'h-6 w-6 transition-all',
            isActive && fillActive ? 'fill-current' : ''
          )}
        />
      </div>
      {count !== undefined && (
        <span className="text-xs font-medium text-white drop-shadow-lg">
          {count}
        </span>
      )}
    </>
  );

  if (asChild) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              'flex gap-1 text-white',
              vertical ? 'flex-col items-center' : 'flex-row items-center'
            )}
          >
            {content}
          </button>
        </TooltipTrigger>
        <TooltipContent side={vertical ? 'left' : 'top'}>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'flex gap-1 text-white transition-transform hover:scale-105 active:scale-95',
            vertical ? 'flex-col items-center' : 'flex-row items-center'
          )}
        >
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent side={vertical ? 'left' : 'top'}>{label}</TooltipContent>
    </Tooltip>
  );
}

export default FeedInteraction;
