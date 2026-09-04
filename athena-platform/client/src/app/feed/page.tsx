'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowRight, 
  Sparkles, 
  Users, 
  MessageCircle, 
  Play,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  MoreHorizontal,
  Plus,
  TrendingUp,
  Clock,
  ImagePlus,
  Loader2,
  X
} from 'lucide-react';
import {
  useFeed,
  useCreatePost,
  useSavePost,
  useUnsavePost,
  useAuth,
} from '@/lib/hooks';
import { useReactToPost } from '@/lib/social-hooks';
import toast from 'react-hot-toast';
import StoriesStrip from '@/components/community/StoriesStrip';
import { ReactionButton, ReactionSummary, type ReactionCounts } from '@/components/community/ReactionBar';
import { PollCard, type PollResults } from '@/components/community/PollCard';
import { WhyThis } from '@/components/community/WhyThis';
import { SensitiveGate } from '@/components/community/SensitiveGate';
import { LinkPreviewCard, type LinkPreview } from '@/components/community/LinkPreviewCard';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { renderSocialText } from '@/lib/social-text';
import { mediaApi, safetyApi, type ReactionType } from '@/lib/api';

type FeedFilter = 'latest' | 'trending' | 'following';

// GET /posts/feed accepts tab ('for-you' | 'following') and algorithm
// ('chronological' | 'engagement' | 'personalized').
const FEED_QUERY: Record<FeedFilter, Record<string, string>> = {
  latest: { tab: 'for-you', algorithm: 'chronological' },
  trending: { tab: 'for-you', algorithm: 'engagement' },
  following: { tab: 'following' },
};

interface Post {
  id: string;
  content: string;
  createdAt: string;
  // The feed endpoint returns { id, displayName, avatar, headline }. The
  // following-tab branch additionally selects firstName/lastName, so both are
  // optional here and resolved through authorName()/authorInitials().
  author: {
    id: string;
    displayName?: string | null;
    avatar?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    headline?: string | null;
  };
  type?: string;
  mediaUrls?: string[] | null;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  // Returned per post by GET /posts/feed for a signed-in viewer, so the
  // bookmark shows the right state on first paint rather than after a toggle.
  isSaved?: boolean;
  myReaction?: ReactionType | null;
  reactionCounts?: ReactionCounts;
  poll?: PollResults | null;
  reasons?: string[];
  isPinned?: boolean;
  isSensitive?: boolean;
  linkPreview?: LinkPreview | null;
  _count?: {
    likes: number;
    comments: number;
  };
  likes?: { userId: string }[];
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i;

function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.test(url);
}

function authorName(author: Post['author']): string {
  const full = [author.firstName, author.lastName].filter(Boolean).join(' ').trim();
  return author.displayName?.trim() || full || 'ATHENA Member';
}

function authorInitials(author: Post['author']): string {
  if (author.firstName || author.lastName) {
    return `${author.firstName?.[0] ?? ''}${author.lastName?.[0] ?? ''}`.toUpperCase() || 'A';
  }
  // displayName can be a single word, so take the first letter of up to two parts.
  return (
    authorName(author)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'A'
  );
}

function PostCard({ post, currentUserId }: { post: Post; currentUserId?: string }) {
  const react = useReactToPost();
  const savePost = useSavePost();
  const unsavePost = useUnsavePost();
  // The API returns myReaction and reactionCounts; isLiked/likeCount and the
  // older likes[]/_count shapes are kept as fallbacks.
  const [reaction, setReaction] = useState<ReactionType | null>(
    post.myReaction ??
      ((post.isLiked ?? post.likes?.some((like) => like.userId === currentUserId)) ? 'LIKE' : null)
  );
  const [counts, setCounts] = useState<ReactionCounts>(() => {
    const total = post.likeCount ?? post._count?.likes ?? 0;
    return post.reactionCounts ?? (total ? { LIKE: total } : {});
  });
  const [isSaved, setIsSaved] = useState(post.isSaved ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const mediaUrls = (post.mediaUrls ?? []).filter(
    (url): url is string => typeof url === 'string' && url.length > 0
  );

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const changeReaction = (next: ReactionType | null) => {
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

  // Optimistic like the heart, and rolled back if the request fails so the
  // bookmark never claims a save the server did not record.
  const handleSave = () => {
    const next = !isSaved;
    setIsSaved(next);
    const mutation = next ? savePost : unsavePost;
    mutation.mutate(post.id, { onError: () => setIsSaved(!next) });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    const title = `${post.author.displayName || 'Someone'} on ATHENA`;

    // The Web Share API is the right thing on mobile, where it opens the
    // system sheet. Everywhere else, copying the link is more useful than a
    // dialog that cannot actually reach the user's apps.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // A cancelled share is not a failure; fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  // Goes through the one safety pipeline, which handles trust scoring and the
  // moderation queue. The reason is deliberately unspecified here — the
  // moderation team triages, and asking for a category inline is a worse
  // experience than letting someone flag it and move on.
  const handleReport = async () => {
    setMenuOpen(false);
    try {
      await safetyApi.createReport({
        targetType: 'post',
        targetId: post.id,
        reason: 'OTHER',
        details: 'Reported from the feed',
      });
      setReported(true);
      toast.success('Reported. Our team will take a look.');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not send that report';
      toast.error(message);
    }
  };

  if (hidden) return null;

  return (
    <article className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition">
      {post.type === 'WIN' && (
        <p className="mb-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          🏆 Win
        </p>
      )}
      {/* Author */}
      <div className="flex items-start justify-between mb-4">
        <Link href={`/profile/${post.author.id}`} className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-semibold overflow-hidden">
            {post.author.avatar ? (
              <Image
                src={post.author.avatar}
                alt={authorName(post.author)}
                width={48}
                height={48}
                className="object-cover"
              />
            ) : (
              authorInitials(post.author)
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white hover:text-primary-600 transition">
              {authorName(post.author)}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {post.author.headline || 'ATHENA Member'}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span suppressHydrationWarning>
                {isHydrated
                  ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
                  : post.createdAt.slice(0, 10)}
              </span>
            </div>
          </div>
        </Link>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Post options"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <MoreHorizontal className="w-5 h-5 text-slate-500" />
          </button>

          {menuOpen && (
            <>
              {/* Full-screen catcher so a click anywhere dismisses the menu,
                  including on touch where there is no blur event to rely on. */}
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleShare();
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Copy link
                </button>
                <button
                  role="menuitem"
                  onClick={handleReport}
                  disabled={reported}
                  className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  {reported ? 'Reported' : 'Report post'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <SensitiveGate active={Boolean(post.isSensitive)} className="mb-4">
      {/* Content */}
      <div className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-4">
        {renderSocialText(post.content)}
      </div>

      {post.poll && (
        <div className="mb-4">
          <PollCard postId={post.id} poll={post.poll} canVote={Boolean(currentUserId)} />
        </div>
      )}

      <LinkPreviewCard preview={post.linkPreview} className="mb-4" />

      {/* Media. The API returns mediaUrls: string[] alongside a post type; an
          earlier shape (post.media) never existed on the wire, so image posts
          rendered without their image. Plain <img> keeps one bad URL from
          taking down the whole feed. */}
      {mediaUrls.length > 0 && (
        <div
          className={cn(
            'mb-4 grid gap-1 overflow-hidden rounded-lg',
            mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}
        >
          {mediaUrls.map((url) =>
            isVideoUrl(url) ? (
              <video
                key={url}
                src={url}
                controls
                playsInline
                className="max-h-[32rem] w-full bg-black object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                className="max-h-[32rem] w-full object-cover"
              />
            )
          )}
        </div>
      )}
      </SensitiveGate>

      {/* Stats */}
      <div className="flex items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400 py-2 border-t border-b border-slate-100 dark:border-slate-700">
        <ReactionSummary counts={counts} className="text-sm" />
        <div className="flex items-center gap-3">
          <WhyThis
            reasons={post.reasons}
            authorId={post.author.id}
            authorName={authorName(post.author)}
            isOwn={post.author.id === currentUserId}
            onHidden={() => setHidden(true)}
          />
          <span>{post.commentCount ?? post._count?.comments ?? 0} comments</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3">
        <ReactionButton value={reaction} onChange={changeReaction} disabled={!currentUserId} />
        <Link 
          href={`/posts/${post.id}`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <MessageSquare className="w-5 h-5" />
          Comment
        </Link>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <Share2 className="w-5 h-5" />
          Share
        </button>
        <button
          onClick={handleSave}
          aria-pressed={isSaved}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-700',
            isSaved
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-slate-600 dark:text-slate-400'
          )}
        >
          <Bookmark className={cn('w-5 h-5', isSaved && 'fill-current')} />
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    </article>
  );
}

function CreatePostBox() {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const createPost = useCreatePost();
  const { user } = useAuth();

  // Opens the composer with a prompt already typed. Appends rather than
  // overwrites so a shortcut pressed twice, or after typing, never eats what
  // is already there.
  const startWith = (prompt: string) => {
    setIsExpanded(true);
    setContent((current) => (current ? current : prompt));
  };

  const attach = (accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setUploadError(null);
      setUploading(true);
      try {
        const uploadType = file.type.startsWith('video/') ? 'video' : 'post';
        const res = await mediaApi.upload(uploadType, file);
        const url = res.data?.data?.url as string | undefined;
        if (!url) {
          setUploadError('Upload finished but returned no file.');
          return;
        }
        // The endpoint accepts at most 10 media urls per post.
        setMedia((current) => [...current, url].slice(0, 10));
        setIsExpanded(true);
      } catch {
        setUploadError('That file could not be uploaded. Try again.');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || uploading) return;

    // The endpoint reads mediaUrls/type/isPublic; the old `visibility` key was
    // never part of its contract and was silently dropped.
    await createPost.mutateAsync({
      content,
      isPublic: true,
      ...(media.length > 0
        ? { mediaUrls: media, type: media.some(isVideoUrl) ? 'VIDEO' : 'IMAGE' }
        : {}),
    });
    setContent('');
    setMedia([]);
    setIsExpanded(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <div className="flex-1">
          {isExpanded ? (
            <form onSubmit={handleSubmit}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share a win, ask a question, or post a helpful resource..."
                className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                rows={4}
                autoFocus
              />

              {media.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {media.map((url) => (
                    <div key={url} className="group relative overflow-hidden rounded-lg">
                      {isVideoUrl(url) ? (
                        <video src={url} className="h-24 w-full bg-black object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-24 w-full object-cover" />
                      )}
                      <button
                        type="button"
                        aria-label="Remove attachment"
                        onClick={() => setMedia((c) => c.filter((u) => u !== url))}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition hover:bg-black"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploadError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => attach('image/*')}
                    disabled={uploading || media.length >= 10}
                    aria-label="Add photo"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => attach('video/*')}
                    disabled={uploading || media.length >= 10}
                    aria-label="Add video"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
                  >
                    <Play className="h-5 w-5" />
                  </button>
                  {uploading && (
                    <span className="ml-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!content.trim() || createPost.isPending || uploading}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                  >
                    {createPost.isPending ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full text-left p-3 bg-slate-50 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 transition"
            >
              What&apos;s on your mind?
            </button>
          )}
        </div>
      </div>
      {!isExpanded && (
        <div className="flex items-center justify-around mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          {/* Shortcuts into the composer. Video opens the file picker
              directly, since that is the one that needs an attachment; the
              other two open the composer with an opening line already in it,
              which is the part people stall on. */}
          <button
            onClick={() => attach('video/*')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Play className="w-5 h-5 text-red-500" />
            Video
          </button>
          <button
            onClick={() => startWith('Something I have been wondering about: ')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <MessageCircle className="w-5 h-5 text-green-500" />
            Question
          </button>
          <button
            onClick={() => startWith('A win worth sharing: ')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Win
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  const [filter, setFilter] = useState<FeedFilter>('latest');
  // The endpoint takes tab + algorithm; it has never read a `sort` param, so
  // all three tabs were returning the same for-you feed.
  const { data: posts, isLoading, error } = useFeed(FEED_QUERY[filter]);
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary-600">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Social</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Your Feed</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter('latest')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'latest'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Latest
                </button>
                <button
                  onClick={() => setFilter('trending')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'trending'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Trending
                </button>
                <button
                  onClick={() => setFilter('following')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'following'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Following
                </button>
              </div>
            </div>

            {/* Stories */}
            <StoriesStrip />

            {/* Reels entry point */}
            <Link
              href="/explore"
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-gradient-to-r from-rose-500 via-purple-600 to-cyan-500 p-[1px] transition hover:shadow-md dark:border-slate-700"
            >
              <span className="flex w-full items-center gap-4 rounded-[11px] bg-white p-4 dark:bg-slate-800">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 to-purple-600 text-white">
                  <Play className="h-5 w-5 fill-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900 dark:text-white">Reels</span>
                  <span className="block text-sm text-slate-600 dark:text-slate-400">
                    Short videos from women building their careers
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
              </span>
            </Link>

            {/* Create Post */}
            {isAuthenticated && <CreatePostBox />}

            {/* Posts */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">Unable to load feed. Please try again.</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  Retry
                </button>
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post: Post) => (
                  <PostCard key={post.id} post={post} currentUserId={user?.id} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Your feed is empty</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Start following people and join communities to see posts here.
                </p>
                <div className="flex justify-center gap-3">
                  <Link 
                    href="/community" 
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Explore Communities
                  </Link>
                  <Link 
                    href="/mentors" 
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    Find Mentors
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link 
                  href="/dashboard/community" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <Users className="w-5 h-5 text-primary-600" />
                  <span className="text-slate-700 dark:text-slate-300">Community Feed</span>
                </Link>
                <Link 
                  href="/dashboard/create-post" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <Plus className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700 dark:text-slate-300">Create Post</span>
                </Link>
                <Link 
                  href="/explore" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <Play className="w-5 h-5 text-red-600" />
                  <span className="text-slate-700 dark:text-slate-300">Explore Videos</span>
                </Link>
              </div>
            </div>

            {/* Trending Topics */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                Trending Topics
              </h3>
              <div className="space-y-3">
                {['#CareerGrowth', '#TechJobs', '#RemoteWork', '#AISkills', '#Mentorship'].map((topic) => (
                  <Link 
                    key={topic}
                    href={`/search?q=${encodeURIComponent(topic)}`}
                    className="block text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition"
                  >
                    {topic}
                  </Link>
                ))}
              </div>
            </div>

            {/* Suggested Connections */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">People to Follow</h3>
              <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Connect with mentors and peers to grow your network.
                </p>
                <Link 
                  href="/mentors"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition"
                >
                  Browse Mentors <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
