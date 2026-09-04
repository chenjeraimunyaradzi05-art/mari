'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Pin, Send, Trash2, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { videoApi } from '@/lib/api-extensions';
import { useAuthStore } from '@/lib/store';
import { renderSocialText } from '@/lib/social-text';

interface CommentAuthor {
  id: string;
  displayName?: string | null;
  avatar?: string | null;
}

export interface VideoComment {
  id: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  parentId?: string | null;
  author?: CommentAuthor | null;
  replies?: VideoComment[];
}

interface VideoCommentsProps {
  videoId: string | null;
  /** The reel's author: the one person who can pin, and who can remove any comment. */
  creatorId?: string;
  onClose: () => void;
  /** Called with the thread size whenever it changes, so the player's counter follows. */
  onCountChange?: (videoId: string, count: number) => void;
}

function authorName(author?: CommentAuthor | null) {
  return author?.displayName?.trim() || 'ATHENA member';
}

function timeAgo(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true });
}

function CommentRow({
  comment,
  depth = 0,
  viewerId,
  creatorId,
  onReply,
  onPin,
  onDelete,
}: {
  comment: VideoComment;
  depth?: number;
  viewerId?: string;
  creatorId?: string;
  onReply: (comment: VideoComment) => void;
  onPin: (comment: VideoComment) => void;
  onDelete: (comment: VideoComment) => void;
}) {
  const isCreator = Boolean(viewerId) && viewerId === creatorId;
  const isOwn = Boolean(viewerId) && viewerId === comment.author?.id;
  const canPin = isCreator && depth === 0;
  const canDelete = isOwn || isCreator;

  return (
    <li className={depth > 0 ? 'ml-10 mt-3' : 'mt-4 first:mt-0'}>
      <div className="flex gap-3">
        <Link href={`/profile/${comment.author?.id ?? ''}`} className="shrink-0">
          <Avatar
            src={comment.author?.avatar}
            alt={authorName(comment.author)}
            fallback={authorName(comment.author).charAt(0)}
            size={depth > 0 ? 'xs' : 'sm'}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <Link
              href={`/profile/${comment.author?.id ?? ''}`}
              className="truncate text-sm font-medium text-white hover:underline"
            >
              {authorName(comment.author)}
            </Link>
            {comment.author?.id === creatorId && (
              <span className="shrink-0 rounded-full bg-white/15 px-1.5 text-[10px] font-medium uppercase tracking-wide text-white/80">
                Creator
              </span>
            )}
            <span className="shrink-0 text-xs text-white/40">{timeAgo(comment.createdAt)}</span>
          </div>
          {comment.isPinned && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/50">
              <Pin className="h-3 w-3" /> Pinned by the creator
            </p>
          )}
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/80">
            {renderSocialText(comment.content, 'font-medium text-white hover:underline')}
          </p>
          {viewerId && (
            <div className="mt-1.5 flex items-center gap-3 text-xs text-white/50">
              <button type="button" onClick={() => onReply(comment)} className="hover:text-white">
                Reply
              </button>
              {canPin && (
                <button type="button" onClick={() => onPin(comment)} className="hover:text-white">
                  {comment.isPinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(comment)}
                  className="inline-flex items-center gap-1 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <ul>
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              viewerId={viewerId}
              creatorId={creatorId}
              onReply={onReply}
              onPin={onPin}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function VideoComments({ videoId, creatorId, onClose, onCountChange }: VideoCommentsProps) {
  const { isAuthenticated, user } = useAuthStore();
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<VideoComment | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await videoApi.getComments(id, { limit: 50 });
      setComments(response.data?.data ?? []);
    } catch {
      setLoadError('Comments could not be loaded right now.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!videoId) return;
    setComments([]);
    setDraft('');
    setReplyTo(null);
    setPostError(null);
    void load(videoId);
  }, [videoId, load]);

  // Escape closes the sheet, matching the rest of the app's overlays.
  useEffect(() => {
    if (!videoId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [videoId, onClose]);

  const total = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  // Only after a thread has actually loaded: the empty list while fetching
  // must not zero the counter on the player.
  useEffect(() => {
    if (videoId && !isLoading && !loadError && onCountChange) onCountChange(videoId, total);
  }, [videoId, isLoading, loadError, total, onCountChange]);

  if (!videoId) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isPosting) return;

    setIsPosting(true);
    setPostError(null);
    try {
      await videoApi.addComment(videoId, content, replyTo?.id);
      setDraft('');
      setReplyTo(null);
      // The create response omits the author relation, so re-read the thread.
      await load(videoId);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setPostError(
        status === 401 || status === 403
          ? 'Sign in to join this conversation.'
          : 'Your comment could not be posted. Try again.'
      );
    } finally {
      setIsPosting(false);
    }
  };

  const pin = async (comment: VideoComment) => {
    try {
      await videoApi.pinComment(videoId, comment.id);
      await load(videoId);
    } catch {
      setPostError('That comment could not be pinned.');
    }
  };

  const remove = async (comment: VideoComment) => {
    // Optimistic: the row disappears now and comes back only if the server
    // refused, so a delete never looks like it did nothing.
    const previous = comments;
    setComments((current) =>
      current
        .filter((c) => c.id !== comment.id)
        .map((c) => ({ ...c, replies: (c.replies ?? []).filter((r) => r.id !== comment.id) }))
    );
    try {
      await videoApi.deleteComment(videoId, comment.id);
    } catch {
      setComments(previous);
      setPostError('That comment could not be deleted.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Comments">
      <button
        type="button"
        aria-label="Close comments"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60"
        onClick={onClose}
      />

      <section className="relative mx-auto flex max-h-[70vh] w-full max-w-md flex-col rounded-t-2xl border-t border-white/10 bg-zinc-950">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">
            Comments{total > 0 ? ` (${total})` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            </div>
          )}

          {!isLoading && loadError && <p className="py-8 text-center text-sm text-white/60">{loadError}</p>}

          {!isLoading && !loadError && comments.length === 0 && (
            <p className="py-8 text-center text-sm text-white/60">
              No comments yet. Be the first to reply.
            </p>
          )}

          {!isLoading && !loadError && comments.length > 0 && (
            <ul>
              {comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  viewerId={user?.id}
                  creatorId={creatorId}
                  onReply={(target) => {
                    setReplyTo(target);
                    setPostError(null);
                  }}
                  onPin={pin}
                  onDelete={remove}
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-white/10 px-4 py-3">
          {isAuthenticated ? (
            <form onSubmit={submit} className="space-y-2">
              {replyTo && (
                <p className="flex items-center gap-2 text-xs text-white/60">
                  Replying to {authorName(replyTo.author)}
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-white/40 hover:text-white"
                  >
                    Cancel
                  </button>
                </p>
              )}
              <div className="flex items-center gap-2">
                <label htmlFor="video-comment" className="sr-only">
                  {replyTo ? 'Write a reply' : 'Add a comment'}
                </label>
                <input
                  id="video-comment"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={2000}
                  placeholder={replyTo ? `Reply to ${authorName(replyTo.author)}...` : 'Add a comment...'}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isPosting}
                  aria-label={replyTo ? 'Post reply' : 'Post comment'}
                  className="rounded-full bg-white p-2 text-black transition disabled:opacity-40"
                >
                  {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-center text-sm text-white/60">
              <Link href="/login" className="font-medium text-white underline">
                Sign in
              </Link>{' '}
              to join the conversation.
            </p>
          )}

          {postError && <p className="mt-2 text-center text-sm text-rose-400">{postError}</p>}
        </footer>
      </section>
    </div>
  );
}
