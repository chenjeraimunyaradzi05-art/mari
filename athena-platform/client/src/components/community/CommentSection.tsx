'use client';

import React, { useState } from 'react';
import { usePost, useCommentOnPost, useAuthStore } from '@/lib/hooks';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';

interface CommentSectionProps {
  postId: string;
}

type CommentAuthor = {
  firstName: string;
  lastName: string;
  avatar?: string | null;
};

type PostComment = {
  id: string;
  content: string;
  createdAt: string | Date;
  author: CommentAuthor;
  parentId?: string | null;
  replies?: PostComment[];
};

export default function CommentSection({ postId }: CommentSectionProps) {
  const { data: post, isLoading } = usePost(postId);
  const addComment = useCommentOnPost();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    addComment.mutate(
      { postId, content: replyTo ? `@${replyTo.author.firstName} ${replyTo.author.lastName} ${content}` : content },
      {
        onSuccess: () => {
          setContent('');
          setReplyTo(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Comments are nested in the post object from the API
  const comments: PostComment[] = Array.isArray((post as any)?.comments)
    ? ((post as any).comments as PostComment[])
    : [];

  const buildThread = (items: PostComment[]) => {
    const map = new Map<string, PostComment>();
    const roots: PostComment[] = [];

    items.forEach((comment) => {
      map.set(comment.id, { ...comment, replies: [] });
    });

    map.forEach((comment) => {
      if (comment.parentId) {
        const parent = map.get(comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
          return;
        }
      }
      roots.push(comment);
    });

    return roots;
  };

  const threadedComments = buildThread(comments);

  const CommentItem = ({ comment, depth = 0 }: { comment: PostComment; depth?: number }) => (
    <div className="flex gap-3" style={{ marginLeft: depth * 20 }}>
      <Avatar 
        src={comment.author.avatar || undefined} 
        fallback={comment.author.firstName?.[0] ?? '?'}
        size="sm"
      />
      <div className="flex-1">
        <div className="bg-white dark:bg-gray-900 p-3 rounded-lg rounded-tl-none shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {comment.author.firstName} {comment.author.lastName}
            </span>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.content}</p>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          <button
            className="hover:text-purple-600"
            onClick={() => setReplyTo(comment)}
          >
            Reply
          </button>
        </div>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
      {/* Input */}
      {user && (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Avatar 
             src={user.avatar || undefined} 
             fallback={user.firstName[0]} 
             size="sm"
          />
          <div className="flex-1 relative">
            {replyTo && (
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                Replying to {replyTo.author.firstName} {replyTo.author.lastName}
                <button type="button" className="text-gray-400 hover:text-gray-600" onClick={() => setReplyTo(null)}>
                  Cancel
                </button>
              </div>
            )}
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={replyTo ? `Reply to ${replyTo.author.firstName}...` : 'Add a comment...'}
              className="w-full px-4 py-2 pr-10 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              disabled={addComment.isPending}
            />
            <button
               type="submit"
               disabled={!content.trim() || addComment.isPending}
               className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 disabled:opacity-50"
            >
                <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-4">
        {threadedComments.length === 0 ? (
           <p className="text-center text-sm text-gray-500 py-2">No comments yet. Be the first!</p>
        ) : (
          threadedComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}
