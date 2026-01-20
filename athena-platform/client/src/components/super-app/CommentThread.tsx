'use client';

/**
 * Comment Threading - Recursive comment component with replies
 * Phase 3: Web Client - Super App Core
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/ui.store';
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Send,
  Flag,
  Trash2,
  Edit,
  Copy,
  Pin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';

export interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    headline?: string;
    isVerified?: boolean;
  };
  createdAt: Date | string;
  updatedAt?: Date | string;
  likes: number;
  isLiked: boolean;
  replies?: Comment[];
  replyCount: number;
  isPinned?: boolean;
  isAuthor?: boolean; // Is the comment author the post creator
}

interface CommentThreadProps {
  comments: Comment[];
  postId: string;
  currentUserId?: string;
  isPostAuthor?: boolean;
  onAddComment?: (content: string, parentId?: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onLikeComment?: (commentId: string) => Promise<void>;
  maxDepth?: number;
  className?: string;
}

export function CommentThread({
  comments,
  postId,
  currentUserId,
  isPostAuthor = false,
  onAddComment,
  onDeleteComment,
  onLikeComment,
  maxDepth = 3,
  className,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useUIStore();

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (onAddComment) {
        await onAddComment(newComment.trim());
      } else {
        await api.post(`/api/posts/${postId}/comments`, {
          content: newComment.trim(),
        });
      }
      setNewComment('');
      addToast('Comment added', 'success');
    } catch (error) {
      addToast('Failed to add comment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, isSubmitting, postId, onAddComment, addToast]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* New comment input */}
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-zinc-500">
              Press ⌘+Enter to submit
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
            >
              <Send className="h-4 w-4 mr-1" />
              Comment
            </Button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            postId={postId}
            currentUserId={currentUserId}
            isPostAuthor={isPostAuthor}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            onLikeComment={onLikeComment}
            depth={0}
            maxDepth={maxDepth}
          />
        ))}
      </div>

      {comments.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No comments yet</p>
          <p className="text-sm">Be the first to share your thoughts!</p>
        </div>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  postId: string;
  currentUserId?: string;
  isPostAuthor?: boolean;
  onAddComment?: (content: string, parentId?: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onLikeComment?: (commentId: string) => Promise<void>;
  depth: number;
  maxDepth: number;
}

function CommentItem({
  comment,
  postId,
  currentUserId,
  isPostAuthor,
  onAddComment,
  onDeleteComment,
  onLikeComment,
  depth,
  maxDepth,
}: CommentItemProps) {
  const [isLiked, setIsLiked] = useState(comment.isLiked);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [showReplies, setShowReplies] = useState(depth < 1);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const { addToast } = useUIStore();
  const isOwn = currentUserId === comment.author.id;
  const canReply = depth < maxDepth;

  const handleLike = useCallback(async () => {
    // Optimistic update
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));

    try {
      if (onLikeComment) {
        await onLikeComment(comment.id);
      } else {
        await api.post(`/api/comments/${comment.id}/like`);
      }
    } catch (error) {
      // Revert on error
      setIsLiked(isLiked);
      setLikeCount((prev) => (isLiked ? prev + 1 : prev - 1));
      addToast('Failed to like comment', 'error');
    }
  }, [isLiked, comment.id, onLikeComment, addToast]);

  const handleReply = useCallback(async () => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (onAddComment) {
        await onAddComment(replyContent.trim(), comment.id);
      } else {
        await api.post(`/api/posts/${postId}/comments`, {
          content: replyContent.trim(),
          parentId: comment.id,
        });
      }
      setReplyContent('');
      setIsReplying(false);
      setShowReplies(true);
      addToast('Reply added', 'success');
    } catch (error) {
      addToast('Failed to add reply', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [replyContent, isSubmitting, comment.id, postId, onAddComment, addToast]);

  const handleDelete = useCallback(async () => {
    try {
      if (onDeleteComment) {
        await onDeleteComment(comment.id);
      } else {
        await api.delete(`/api/comments/${comment.id}`);
      }
      addToast('Comment deleted', 'success');
    } catch (error) {
      addToast('Failed to delete comment', 'error');
    }
  }, [comment.id, onDeleteComment, addToast]);

  const handleEdit = useCallback(async () => {
    if (!editContent.trim()) return;

    try {
      await api.patch(`/api/comments/${comment.id}`, {
        content: editContent.trim(),
      });
      setIsEditing(false);
      addToast('Comment updated', 'success');
    } catch (error) {
      addToast('Failed to update comment', 'error');
    }
  }, [editContent, comment.id, addToast]);

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className={cn('group', depth > 0 && 'ml-8 mt-3')}>
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.author.avatar} />
          <AvatarFallback>{comment.author.name.charAt(0)}</AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm hover:underline cursor-pointer">
              {comment.author.name}
            </span>
            {comment.author.isVerified && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                ✓
              </Badge>
            )}
            {comment.isAuthor && (
              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                Author
              </Badge>
            )}
            {comment.isPinned && (
              <Badge className="h-4 px-1 text-[10px] bg-amber-500">
                <Pin className="h-2.5 w-2.5 mr-0.5" />
                Pinned
              </Badge>
            )}
            <span className="text-xs text-zinc-500">
              {formatTime(comment.createdAt)}
            </span>
            {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
              <span className="text-xs text-zinc-400">(edited)</span>
            )}
          </div>

          {comment.author.headline && (
            <p className="text-xs text-zinc-500 truncate">
              {comment.author.headline}
            </p>
          )}

          {/* Content or Edit mode */}
          {isEditing ? (
            <div className="mt-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px]"
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleEdit}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleLike}
              className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                isLiked
                  ? 'text-rose-500'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
            >
              <Heart
                className={cn('h-4 w-4', isLiked && 'fill-current')}
              />
              {likeCount > 0 && likeCount}
            </button>

            {canReply && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Reply
              </button>
            )}

            {/* More actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(comment.content)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy text
                </DropdownMenuItem>
                {isOwn && (
                  <>
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-500"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
                {!isOwn && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-500">
                      <Flag className="h-4 w-4 mr-2" />
                      Report
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Reply input */}
          {isReplying && (
            <div className="mt-3 flex gap-2">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder={`Reply to ${comment.author.name}...`}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="min-h-[60px] text-sm"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={handleReply} disabled={isSubmitting}>
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsReplying(false);
                      setReplyContent('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {!showReplies ? (
                <button
                  onClick={() => setShowReplies(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <ChevronDown className="h-4 w-4" />
                  View {comment.replies.length} replies
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowReplies(false)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mb-2"
                  >
                    <ChevronUp className="h-4 w-4" />
                    Hide replies
                  </button>
                  <div className="space-y-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    {comment.replies.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        postId={postId}
                        currentUserId={currentUserId}
                        isPostAuthor={isPostAuthor}
                        onAddComment={onAddComment}
                        onDeleteComment={onDeleteComment}
                        onLikeComment={onLikeComment}
                        depth={depth + 1}
                        maxDepth={maxDepth}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Load more replies indicator */}
          {comment.replyCount > (comment.replies?.length || 0) && showReplies && (
            <button className="mt-2 text-xs text-blue-600 hover:text-blue-700">
              Load {comment.replyCount - (comment.replies?.length || 0)} more replies
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommentThread;
