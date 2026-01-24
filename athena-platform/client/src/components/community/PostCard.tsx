'use client';

import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2 } from 'lucide-react';
import { useLikePost, useUnlikePost, useDeletePost, useAuthStore } from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';
import CommentSection from './CommentSection';

interface PostCardProps {
  post: any;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuthStore();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const deletePost = useDeletePost();
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this post?')) {
      deletePost.mutate(post.id);
    }
    setShowMenu(false);
  };

  const isOwner = user?.id === post.author?.id;

  const authorName =
    post?.author?.displayName ||
    `${post?.author?.firstName || ''} ${post?.author?.lastName || ''}`.trim() ||
    'Member';

  const handleLike = () => {
    if (!user) return;
    if (post.isLiked) {
      unlikePost.mutate(post.id);
    } else {
      likePost.mutate(post.id);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <Avatar
              src={post.author.avatar || undefined}
              alt={authorName}
              fallback={(authorName || 'U').slice(0, 2).toUpperCase()}
              className="w-12 h-12"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group cursor-pointer hover:underline hover:text-blue-600">
                {authorName}
            </h3>
            <p className="text-xs text-gray-500 line-clamp-1">{post.author.headline || 'Member'}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })} • 
              <span className="ml-1">Public</span>
            </p>
          </div>
        </div>
        {isOwner && (
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <MoreHorizontal size={20} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
      </div>

      {/* Media */}
      {Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 && !mediaError && (
        <div className="mt-2">
          {String(post.type).toUpperCase() === 'VIDEO' ? (
            <video
              src={post.mediaUrls[0]}
              controls
              playsInline
              preload="metadata"
              onError={() => setMediaError(true)}
              className="w-full max-h-[520px] object-contain bg-black"
              crossOrigin="anonymous"
            >
              <source src={post.mediaUrls[0]} type="video/mp4" />
              <source src={post.mediaUrls[0]} type="video/webm" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <img
              src={post.mediaUrls[0]}
              alt="Post media"
              loading="lazy"
              onError={() => setMediaError(true)}
              className="w-full h-auto object-cover max-h-[520px]"
              crossOrigin="anonymous"
            />
          )}
        </div>
      )}

      {/* Stats/Counts */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1 group cursor-pointer hover:text-blue-600 hover:underline">
         {Number(post.likeCount) > 0 && (
                <>
                 <span className="bg-blue-100 p-0.5 rounded-full"><Heart size={10} className="fill-blue-600 text-blue-600" /></span>
            <span>{post.likeCount} likes</span>
                </>
           )}
        </div>
        <div className="hover:text-blue-600 hover:underline cursor-pointer">
          {Number(post.commentCount) > 0 ? `${post.commentCount} comments` : ''}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-1 flex items-center justify-between">
        <button 
            onClick={handleLike}
            className={`flex items-center gap-2 px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                post.isLiked 
                ? 'text-blue-600 hover:bg-blue-50' 
                : 'text-gray-500 hover:bg-gray-100'
            }`}
        >
          <Heart size={20} className={post.isLiked ? 'fill-blue-600' : ''} />
          <span>Like</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 px-4 py-3 rounded-md transition-colors text-sm font-medium text-gray-500 hover:bg-gray-100"
        >
          <MessageCircle size={20} />
          <span>Comment</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-3 rounded-md transition-colors text-sm font-medium text-gray-500 hover:bg-gray-100">
          <Share2 size={20} />
          <span>Share</span>
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <CommentSection postId={post.id} />
      )}
    </div>
  );
}
