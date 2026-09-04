'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  Flag,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  Share2,
  Trash2,
} from 'lucide-react';
import { useDeletePost, useAuthStore } from '@/lib/hooks';
import { usePinPost, useReactToPost } from '@/lib/social-hooks';
import { postApi, type ReactionType } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { renderSocialText } from '@/lib/social-text';
import { MENTION_MARKUP, mentionsToPlainText, serializeMentions, type MentionPick } from '@/lib/mentions';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { ReactionButton, ReactionSummary, type ReactionCounts } from './ReactionBar';
import { PollCard } from './PollCard';
import { WhyThis } from './WhyThis';
import { SensitiveGate } from './SensitiveGate';
import { LinkPreviewCard } from './LinkPreviewCard';
import { MentionTextarea } from './MentionTextarea';
import CommentSection from './CommentSection';

// The mentions already in a post, so editing keeps them resolvable.
function picksIn(content: string): MentionPick[] {
  const picks: MentionPick[] = [];
  for (const match of content.matchAll(MENTION_MARKUP)) {
    if (!picks.some((p) => p.id === match[2])) picks.push({ name: match[1], id: match[2] });
  }
  return picks;
}
import toast from 'react-hot-toast';

interface PostCardProps {
  post: any;
  // The post page opens with the thread showing; the feed keeps it folded.
  defaultShowComments?: boolean;
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export default function PostCard({ post, defaultShowComments = false }: PostCardProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const react = useReactToPost();
  const pinPost = usePinPost();
  const deletePost = useDeletePost();
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [showMenu, setShowMenu] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Editing in place: the readable form in the box, mentions kept resolvable.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [picks, setPicks] = useState<MentionPick[]>([]);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<string>(String(post.content ?? ''));
  useEffect(() => {
    setContent(String(post.content ?? ''));
  }, [post.content, post.id]);
  const wasEdited =
    post.updatedAt && post.createdAt && new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 60_000;

  const startEditing = () => {
    setShowMenu(false);
    setDraft(mentionsToPlainText(content));
    setPicks(picksIn(content));
    setEditing(true);
  };

  const saveEdit = async () => {
    const next = serializeMentions(draft.trim(), picks);
    if (!next) return;
    setSaving(true);
    try {
      await postApi.update(post.id, { content: next });
      setContent(next);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Post updated');
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not save the edit');
    } finally {
      setSaving(false);
    }
  };

  // Reactions are optimistic: the emoji and the counts move at once and a
  // failed write puts both back. Seeded from the server on every refetch.
  const [reaction, setReaction] = useState<ReactionType | null>(post.myReaction ?? (post.isLiked ? 'LIKE' : null));
  const [counts, setCounts] = useState<ReactionCounts>(
    post.reactionCounts ?? (post.likeCount ? { LIKE: Number(post.likeCount) } : {})
  );
  useEffect(() => {
    setReaction(post.myReaction ?? (post.isLiked ? 'LIKE' : null));
    setCounts(post.reactionCounts ?? (post.likeCount ? { LIKE: Number(post.likeCount) } : {}));
  }, [post.id, post.myReaction, post.isLiked, post.reactionCounts, post.likeCount]);

  // Saved state is optimistic: seeded from the server, flipped on tap and put
  // back only if the request fails.
  const [saved, setSaved] = useState<boolean>(Boolean(post.isSaved));
  useEffect(() => {
    setSaved(Boolean(post.isSaved));
  }, [post.isSaved, post.id]);

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

  const changeReaction = (next: ReactionType | null) => {
    if (!user) {
      toast.error('Sign in to react');
      return;
    }
    const previous = reaction;
    const previousCounts = counts;
    const updated: ReactionCounts = { ...counts };
    if (previous) updated[previous] = Math.max(0, (updated[previous] ?? 0) - 1);
    if (next) updated[next] = (updated[next] ?? 0) + 1;
    setReaction(next);
    setCounts(updated);
    react.mutate(
      { postId: post.id, type: next },
      {
        onError: () => {
          setReaction(previous);
          setCounts(previousCounts);
        },
      }
    );
  };

  const togglePin = () => {
    setShowMenu(false);
    pinPost.mutate({ postId: post.id, pinned: !post.isPinned });
  };

  const handleSave = async () => {
    setShowMenu(false);
    if (!user) {
      toast.error('Sign in to save posts');
      return;
    }
    const next = !saved;
    setSaved(next);
    try {
      await (next ? postApi.save(post.id) : postApi.unsave(post.id));
      toast.success(next ? 'Saved' : 'Removed from saved');
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    } catch (error) {
      setSaved(!next);
      toast.error(errorMessage(error) || 'Could not update your saved posts');
    }
  };

  const postUrl = () => `${window.location.origin}/posts/${post.id}`;

  const copyLink = async () => {
    setShowMenu(false);
    try {
      await navigator.clipboard.writeText(postUrl());
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  // Same behaviour as the feed's share: the system sheet on mobile, a copied
  // link everywhere else. The link is the public post page, so it opens for
  // whoever it is sent to.
  const handleShare = async () => {
    const url = postUrl();

    if (navigator.share) {
      try {
        await navigator.share({ title: `${authorName} on ATHENA`, url });
        return;
      } catch {
        // Cancelled, not failed — fall through to copying.
      }
    }

    await copyLink();
  };

  if (hidden) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {(post.isPinned || post.type === 'WIN') && (
        <div className="flex items-center gap-2 px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide">
          {post.isPinned && (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Pin size={12} /> Pinned
            </span>
          )}
          {post.type === 'WIN' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
              🏆 Win
            </span>
          )}
        </div>
      )}
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex gap-3">
          <Link href={`/profile/${post.author?.id}`} className="flex-shrink-0">
            <Avatar
              src={post.author?.avatar || undefined}
              alt={authorName}
              fallback={(authorName || 'U').slice(0, 2).toUpperCase()}
              className="w-12 h-12"
            />
          </Link>
          <div>
            <Link
              href={`/profile/${post.author?.id}`}
              className="font-semibold text-slate-900 hover:underline hover:text-blue-600"
            >
              {authorName}
            </Link>
            <p className="text-xs text-slate-500 line-clamp-1">{post.author?.headline || 'Member'}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })} •
              <span className="ml-1">Public</span>
            </p>
          </div>
        </div>
        {/* The menu used to exist only for the author, so nobody else could
            save, copy a link to, or report a post from here. */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-haspopup="menu"
            aria-expanded={showMenu}
            aria-label="Post options"
          >
            <MoreHorizontal size={20} />
          </button>
          {showMenu && (
            <div
              role="menu"
              className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 min-w-[160px]"
            >
              {user && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSave}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Bookmark size={16} className={saved ? 'fill-current' : ''} />
                  {saved ? 'Unsave' : 'Save'}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={copyLink}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Link2 size={16} />
                Copy link
              </button>
              {user && !isOwner && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false);
                    setReportOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Flag size={16} />
                  Report
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={startEditing}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={16} />
                  Edit
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={togglePin}
                  disabled={pinPost.isPending}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pin size={16} />
                  {post.isPinned ? 'Unpin from profile' : 'Pin to profile'}
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <SensitiveGate active={Boolean(post.isSensitive) && !editing} className="mx-4 mb-2">
      {/* Content */}
      <div className="px-4 pb-2">
        {editing ? (
          <div className="space-y-2">
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              picks={picks}
              onPicksChange={setPicks}
              rows={4}
              maxLength={5000}
              onSubmitShortcut={() => void saveEdit()}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="btn-outline px-3 py-1.5 text-xs">
                Cancel
              </button>
              <button type="button" onClick={() => void saveEdit()} disabled={saving || !draft.trim()} className="btn-primary px-3 py-1.5 text-xs">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed">
            {renderSocialText(content)}
            {wasEdited && <span className="ml-1 text-xs text-slate-400">(edited)</span>}
          </p>
        )}
        {post.poll && (
          <div className="mt-3">
            <PollCard postId={post.id} poll={post.poll} canVote={Boolean(user)} />
          </div>
        )}
        {!editing && <LinkPreviewCard preview={post.linkPreview} className="mt-3" />}
      </div>

      {/* Media */}
      {Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 && !mediaError && (
        <div className="mt-2">
          {String(post.type).toUpperCase() === 'VIDEO' ? (
            <video
              src={post.mediaUrls[0]}
              controls
              onError={() => setMediaError(true)}
              className="w-full max-h-[520px] object-contain bg-black"
            />
          ) : post.mediaUrls.length === 1 ? (
            <img
              src={post.mediaUrls[0]}
              alt="Post media"
              onError={() => setMediaError(true)}
              className="w-full h-auto object-cover max-h-[520px]"
            />
          ) : (
            <div className={`grid gap-1 ${
              post.mediaUrls.length === 2 ? 'grid-cols-2' :
              post.mediaUrls.length === 3 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {post.mediaUrls.slice(0, 4).map((url: string, idx: number) => (
                <div
                  key={idx}
                  className={`relative ${
                    post.mediaUrls.length === 3 && idx === 0 ? 'row-span-2' : ''
                  }`}
                >
                  <img
                    src={url}
                    alt={`Post media ${idx + 1}`}
                    onError={() => setMediaError(true)}
                    className="w-full h-full object-cover aspect-square"
                  />
                  {idx === 3 && post.mediaUrls.length > 4 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-2xl font-semibold">
                        +{post.mediaUrls.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </SensitiveGate>

      {/* Stats/Counts */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
        <ReactionSummary counts={counts} />
        <div className="flex items-center gap-3">
          <WhyThis
            reasons={post.reasons}
            authorId={post.author?.id}
            authorName={authorName}
            isOwn={isOwner}
            onHidden={() => setHidden(true)}
          />
          {Number(post.commentCount) > 0 && (
            <button
              type="button"
              onClick={() => setShowComments((open) => !open)}
              className="hover:text-blue-600 hover:underline"
            >
              {post.commentCount} comments
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 flex items-center justify-between">
        <ReactionButton value={reaction} onChange={changeReaction} disabled={!user} />
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 px-3 py-3 rounded-md transition-colors text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          <MessageCircle size={20} />
          <span>Comment</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3 py-3 rounded-md transition-colors text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          <Share2 size={20} />
          <span>Share</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          aria-pressed={saved}
          className={`flex items-center gap-2 px-3 py-3 rounded-md transition-colors text-sm font-medium ${
            saved ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Bookmark size={20} className={saved ? 'fill-blue-600' : ''} />
          <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <CommentSection postId={post.id} />
      )}

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        targetLabel={`${authorName}'s post`}
      />
    </div>
  );
}
