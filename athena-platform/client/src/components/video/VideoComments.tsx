'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Send, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { videoApi } from '@/lib/api-extensions';
import { useAuthStore } from '@/lib/store';

interface CommentAuthor {
  id: string;
  displayName?: string | null;
  avatar?: string | null;
}

export interface VideoComment {
  id: string;
  content: string;
  createdAt: string;
  author?: CommentAuthor | null;
  replies?: VideoComment[];
}

interface VideoCommentsProps {
  videoId: string | null;
  onClose: () => void;
}

function authorName(author?: CommentAuthor | null) {
  return author?.displayName?.trim() || 'ATHENA member';
}

function timeAgo(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true });
}

function CommentRow({ comment, depth = 0 }: { comment: VideoComment; depth?: number }) {
  return (
    <li className={depth > 0 ? 'ml-10 mt-3' : 'mt-4 first:mt-0'}>
      <div className="flex gap-3">
        <Avatar
          src={comment.author?.avatar}
          alt={authorName(comment.author)}
          fallback={authorName(comment.author).charAt(0)}
          size={depth > 0 ? 'xs' : 'sm'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium text-white">
              {authorName(comment.author)}
            </span>
            <span className="shrink-0 text-xs text-white/40">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/80">
            {comment.content}
          </p>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <ul>
          {comment.replies.map((reply) => (
            <CommentRow key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function VideoComments({ videoId, onClose }: VideoCommentsProps) {
  const { isAuthenticated } = useAuthStore();
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
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

  if (!videoId) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isPosting) return;

    setIsPosting(true);
    setPostError(null);
    try {
      await videoApi.addComment(videoId, content);
      setDraft('');
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
            Comments{comments.length > 0 ? ` (${comments.length})` : ''}
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
                <CommentRow key={comment.id} comment={comment} />
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-white/10 px-4 py-3">
          {isAuthenticated ? (
            <form onSubmit={submit} className="flex items-center gap-2">
              <label htmlFor="video-comment" className="sr-only">
                Add a comment
              </label>
              <input
                id="video-comment"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                placeholder="Add a comment..."
                className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || isPosting}
                aria-label="Post comment"
                className="rounded-full bg-white p-2 text-black transition disabled:opacity-40"
              >
                {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
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
