'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePost, useCommentOnPost, useAuthStore } from '@/lib/hooks';
import { useToggleCommentLike } from '@/lib/social-hooks';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/avatar';
import { Heart, Send, Loader2, Pin, MessageCircleOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { postApi } from '@/lib/api';

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
import { renderSocialText } from '@/lib/social-text';
import { serializeMentions, type MentionPick } from '@/lib/mentions';
import { MentionTextarea } from './MentionTextarea';
import { cn } from '@/lib/utils';

interface CommentSectionProps {
  postId: string;
}

type CommentAuthor = {
  id?: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  avatar?: string | null;
};

function commentAuthorName(author: CommentAuthor): string {
  return author.displayName?.trim() || `${author.firstName} ${author.lastName}`.trim() || 'Member';
}

type PostComment = {
  id: string;
  content: string;
  createdAt: string | Date;
  author: CommentAuthor;
  parentId?: string | null;
  replies?: PostComment[];
  likeCount?: number;
  isLiked?: boolean;
  // Kept at the top of the thread by the post's author.
  isPinned?: boolean;
};

export default function CommentSection({ postId }: CommentSectionProps) {
  const { data: post, isLoading } = usePost(postId);
  const queryClient = useQueryClient();
  const addComment = useCommentOnPost();
  const toggleLike = useToggleCommentLike();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [picks, setPicks] = useState<MentionPick[]>([]);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [sort, setSort] = useState<'top' | 'newest'>('top');
  // Optimistic like state per comment, keyed by id, on top of what the API said.
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>({});

  const submit = () => {
    if (!content.trim()) return;

    // A reply is threaded by parentId. Replies to replies attach to the same
    // top-level comment, which keeps the thread one level deep on screen.
    addComment.mutate(
      {
        postId,
        content: serializeMentions(content.trim(), picks),
        parentId: replyTo ? replyTo.parentId || replyTo.id : undefined,
      },
      {
        onSuccess: () => {
          setContent('');
          setPicks([]);
          setReplyTo(null);
        },
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const likeStateOf = (comment: PostComment) =>
    likes[comment.id] ?? { liked: Boolean(comment.isLiked), count: comment.likeCount ?? 0 };

  const toggle = (comment: PostComment) => {
    if (!user) return;
    const current = likeStateOf(comment);
    const next = { liked: !current.liked, count: Math.max(0, current.count + (current.liked ? -1 : 1)) };
    setLikes((prev) => ({ ...prev, [comment.id]: next }));
    toggleLike.mutate(
      { postId, commentId: comment.id, liked: current.liked },
      { onError: () => setLikes((prev) => ({ ...prev, [comment.id]: current })) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
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

    // Replies arrive nested on their parent from the API; flatten so a reply
    // that also came as a top-level row is not shown twice.
    items.forEach((comment) => {
      (comment.replies ?? []).forEach((reply) => {
        if (!map.has(reply.id)) map.set(reply.id, { ...reply, replies: [] });
      });
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

  const likesOf = (comment: PostComment) =>
    likes[comment.id]?.count ?? comment.likeCount ?? 0;
  const threadedComments = buildThread(comments).sort((a, b) => {
    // The author's pinned comment leads whatever the sort.
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    const byLikes = likesOf(b) - likesOf(a);
    return byLikes !== 0 ? byLikes : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // The post's author runs the thread: pin one comment, remove any. A
  // commenter can always remove their own.
  const postAuthorId: string | undefined = (post as { authorId?: string } | undefined)?.authorId;
  const isPostAuthor = Boolean(user && postAuthorId && user.id === postAuthorId);
  const commentsOff = Boolean((post as { commentsOff?: boolean } | undefined)?.commentsOff);

  const pin = async (comment: PostComment) => {
    try {
      await postApi.pinComment(postId, comment.id, !comment.isPinned);
      toast.success(comment.isPinned ? 'Comment unpinned' : 'Comment pinned');
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not pin the comment');
    }
  };

  const remove = async (comment: PostComment) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await postApi.deleteComment(postId, comment.id);
      toast.success('Comment deleted');
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not delete the comment');
    }
  };

  const CommentItem = ({ comment, depth = 0 }: { comment: PostComment; depth?: number }) => {
    const state = likeStateOf(comment);
    return (
      <div className="flex gap-3" style={{ marginLeft: depth * 20 }}>
        <Link href={comment.author.id ? `/profile/${comment.author.id}` : '#'} className="flex-shrink-0">
          <Avatar
            src={comment.author.avatar || undefined}
            fallback={comment.author.firstName?.[0] ?? '?'}
            size="sm"
          />
        </Link>
        <div className="flex-1">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg rounded-tl-none shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-2">
                <Link
                  href={comment.author.id ? `/profile/${comment.author.id}` : '#'}
                  className="text-sm font-semibold text-slate-900 dark:text-white hover:underline"
                >
                  {commentAuthorName(comment.author)}
                </Link>
                {postAuthorId && comment.author.id === postAuthorId && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Author
                  </span>
                )}
                {comment.isPinned && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-500">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
              {renderSocialText(comment.content)}
            </p>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => toggle(comment)}
              disabled={!user}
              aria-pressed={state.liked}
              aria-label={state.liked ? 'Unlike comment' : 'Like comment'}
              className={cn('inline-flex items-center gap-1 hover:text-rose-600', state.liked && 'text-rose-600')}
            >
              <Heart className={cn('h-3.5 w-3.5', state.liked && 'fill-current')} />
              {state.count > 0 && <span>{state.count}</span>}
            </button>
            {user && !commentsOff && (
              <button className="hover:text-purple-600" onClick={() => setReplyTo(comment)}>
                Reply
              </button>
            )}
            {isPostAuthor && depth === 0 && (
              <button type="button" className="hover:text-rose-600" onClick={() => void pin(comment)}>
                {comment.isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
            {user && (isPostAuthor || comment.author.id === user.id) && (
              <button type="button" className="hover:text-red-600" onClick={() => void remove(comment)}>
                Delete
              </button>
            )}
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
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4 dark:border-slate-800 dark:bg-slate-900/40">
      {commentsOff && !isPostAuthor && (
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <MessageCircleOff className="h-4 w-4" /> The author has turned comments off for this post.
        </p>
      )}

      {/* Input */}
      {user && (!commentsOff || isPostAuthor) && (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Avatar src={user.avatar || undefined} fallback={user.firstName[0]} size="sm" />
          <div className="flex-1 relative">
            {replyTo && (
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                Replying to {commentAuthorName(replyTo.author)}
                <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setReplyTo(null)}>
                  Cancel
                </button>
              </div>
            )}
            <MentionTextarea
              singleLine
              value={content}
              onChange={setContent}
              picks={picks}
              onPicksChange={setPicks}
              onSubmitShortcut={submit}
              placeholder={replyTo ? `Reply to ${commentAuthorName(replyTo.author)}...` : 'Add a comment... @ to mention someone'}
              maxLength={2000}
              disabled={addComment.isPending}
              className="w-full px-4 py-2 pr-10 rounded-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!content.trim() || addComment.isPending}
              className="absolute right-2 top-2 text-slate-400 hover:text-purple-600 disabled:opacity-50"
              aria-label="Post comment"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {threadedComments.length > 1 && (
        <div className="flex items-center gap-1 text-xs" role="tablist" aria-label="Sort comments">
          {(['top', 'newest'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={sort === option}
              onClick={() => setSort(option)}
              className={cn(
                'rounded-full px-2.5 py-1 font-medium',
                sort === option ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              {option === 'top' ? 'Top' : 'Newest'}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {threadedComments.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-2">No comments yet. Be the first!</p>
        ) : (
          threadedComments.map((comment) => <CommentItem key={comment.id} comment={comment} />)
        )}
      </div>
    </div>
  );
}
