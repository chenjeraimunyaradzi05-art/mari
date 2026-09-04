'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Bookmark,
  Flag,
  FolderPlus,
  Link2,
  MessageCircle,
  MessageCircleOff,
  MoreHorizontal,
  Pencil,
  Pin,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import { SharePostDialog } from './SharePostDialog';
import { useImpression } from '@/lib/impressions';
import { RepostButton, formatCount } from './RepostButton';
import { RepostEmbed, RepostedBy, type RepostOriginal } from './RepostEmbed';
import { PostInsightsDialog } from './PostInsightsDialog';
import { SaveToCollection } from './SaveToCollection';
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

/** The author's description of an image, when they wrote one. */
export function altFor(mediaAlt: unknown, index: number): string {
  return Array.isArray(mediaAlt) && typeof mediaAlt[index] === 'string' ? (mediaAlt[index] as string) : '';
}

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
  // Where the card is shown, for the author's insights: feed, profile, saved, post.
  source?: string;
  // Set when this card is the original inside someone's plain repost.
  repostedBy?: string;
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export default function PostCard({ post, defaultShowComments = false, source = 'feed', repostedBy }: PostCardProps) {
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
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const impressionRef = useImpression(post.id, source);

  // Share: copy, send to someone here, or the system sheet.
  const [shareOpen, setShareOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shareOpen) return;
    const onClick = (event: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) setShareOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [shareOpen]);

  // The author can close the thread; existing comments stay readable.
  const [commentsOff, setCommentsOff] = useState<boolean>(Boolean(post.commentsOff));
  useEffect(() => setCommentsOff(Boolean(post.commentsOff)), [post.commentsOff, post.id]);
  const toggleComments = async () => {
    setShowMenu(false);
    const next = !commentsOff;
    setCommentsOff(next);
    try {
      await postApi.setCommentsOff(post.id, next);
      toast.success(next ? 'Comments turned off' : 'Comments turned on');
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    } catch (error) {
      setCommentsOff(!next);
      toast.error(errorMessage(error) || 'Could not change the comment setting');
    }
  };

  // Reposts: the original this post points at, and whether this is a plain
  // repost (no words of its own) that should render as the original.
  const original = (post.repostOf ?? null) as RepostOriginal | null;
  const isPlainRepost = Boolean(post.repostOfId) && !String(post.content ?? '').trim();
  const selfAsOriginal: RepostOriginal = {
    id: post.id,
    content: String(post.content ?? ''),
    type: post.type,
    mediaUrls: post.mediaUrls,
    createdAt: post.createdAt,
    isSensitive: post.isSensitive,
    author: post.author,
  };

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

  // A plain repost is the original, with a line saying who reposted it, and
  // the original's own live counts and buttons.
  if (isPlainRepost && original) {
    return <PostCard post={original} defaultShowComments={defaultShowComments} source={source} repostedBy={authorName} />;
  }

  return (
    <div ref={impressionRef} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {repostedBy && <RepostedBy name={repostedBy} className="px-4 pt-3" />}
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
              {user && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false);
                    setCollectionOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FolderPlus size={16} />
                  {saved ? 'Move to collection' : 'Save to collection'}
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false);
                    setInsightsOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <BarChart3 size={16} />
                  View insights
                </button>
              )}
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
                  onClick={() => void toggleComments()}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {commentsOff ? <MessageCircle size={16} /> : <MessageCircleOff size={16} />}
                  {commentsOff ? 'Turn comments on' : 'Turn comments off'}
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
        {!editing && (original || post.repostUnavailable) && (
          <RepostEmbed original={original} unavailable={Boolean(post.repostUnavailable)} className="mt-3" />
        )}
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
              alt={altFor(post.mediaAlt, 0) || 'Post media'}
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
                    alt={altFor(post.mediaAlt, idx) || `Post media ${idx + 1}`}
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
          {isOwner && typeof post.impressionCount === 'number' && (
            <button
              type="button"
              onClick={() => setInsightsOpen(true)}
              className="hover:text-blue-600 hover:underline"
              aria-label="View insights"
            >
              {formatCount(post.impressionCount)} {post.impressionCount === 1 ? 'view' : 'views'}
            </button>
          )}
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
          title={commentsOff ? 'The author has turned comments off' : undefined}
        >
          {commentsOff ? <MessageCircleOff size={20} /> : <MessageCircle size={20} />}
          <span>{commentsOff ? 'Comments off' : 'Comment'}</span>
        </button>
        <RepostButton
          targetId={post.id}
          original={selfAsOriginal}
          isReposted={Boolean(post.isReposted)}
          repostCount={Number(post.repostCount ?? 0)}
          disabled={!user}
        />
        <div className="relative" ref={shareRef}>
          <button
            onClick={() => setShareOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={shareOpen}
            className="flex items-center gap-2 px-3 py-3 rounded-md transition-colors text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            <Share2 size={20} />
            <span>Share</span>
          </button>
          {shareOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-20 mb-1 min-w-[190px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {user && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShareOpen(false);
                    setSendOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Send size={16} /> Send in a message
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShareOpen(false);
                  void copyLink();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Link2 size={16} /> Copy link
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShareOpen(false);
                  void handleShare();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Share2 size={16} /> Share elsewhere
              </button>
            </div>
          )}
        </div>
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

      {isOwner && insightsOpen && <PostInsightsDialog postId={post.id} open onClose={() => setInsightsOpen(false)} />}
      {user && sendOpen && (
        <SharePostDialog postId={post.id} excerpt={`${authorName}: ${mentionsToPlainText(content).slice(0, 140)}`} open onClose={() => setSendOpen(false)} />
      )}
      {user && collectionOpen && (
        <SaveToCollection
          postId={post.id}
          currentCollectionId={post.collectionId ?? null}
          open
          onClose={() => setCollectionOpen(false)}
          onFiled={() => setSaved(true)}
        />
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
