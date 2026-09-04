'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bookmark,
  Briefcase,
  Calendar,
  Compass,
  GraduationCap,
  Heart,
  Home,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { handleFromName, renderSocialText } from '@/lib/social-text';
import { postApi, userApi, type ReactionType } from '@/lib/api';
import { useAuth } from '@/lib/hooks';
import { useReactToPost } from '@/lib/social-hooks';
import StoriesStrip from '@/components/community/StoriesStrip';
import { ReactionButton, ReactionSummary, type ReactionCounts } from '@/components/community/ReactionBar';
import { PollCard, type PollResults } from '@/components/community/PollCard';
import { WhyThis } from '@/components/community/WhyThis';
import { HomeMiddleColumn } from './HomeMiddleColumn';

type FeedAuthor = {
  id: string;
  displayName?: string | null;
  avatar?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
  isFollowing?: boolean;
};

type FeedPost = {
  id: string;
  content: string;
  createdAt: string;
  type?: string;
  mediaUrls?: string[] | null;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  myReaction?: ReactionType | null;
  reactionCounts?: ReactionCounts;
  poll?: PollResults | null;
  reasons?: string[];
  author: FeedAuthor;
};

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i;
const isVideoUrl = (url: string) => VIDEO_EXTENSIONS.test(url);

function authorName(author: FeedAuthor): string {
  const full = [author.firstName, author.lastName].filter(Boolean).join(' ').trim();
  return author.displayName?.trim() || full || 'ATHENA Member';
}

function handleFor(author: FeedAuthor): string {
  return handleFromName(authorName(author));
}

function initials(author: FeedAuthor): string {
  return (
    authorName(author)
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'A'
  );
}

// The mobile bar takes the first five, so the order matters: those five are the
// ones worth a permanent slot on a phone. The rest of the platform is named in
// full by <PlatformDirectory /> in the middle column rather than crammed here.
const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Reels', icon: Compass },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/mentors', label: 'Mentors', icon: Users },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/learning', label: 'Learning', icon: GraduationCap },
  { href: '/communities', label: 'Communities', icon: Sparkles },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/salary-insights', label: 'Salary', icon: TrendingUp },
];

function Avatar({ author, size = 32 }: { author: FeedAuthor; size?: number }) {
  if (author.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatar}
        alt=""
        style={{ width: size, height: size }}
        className="flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-purple-600 text-xs font-semibold text-white"
    >
      {initials(author)}
    </span>
  );
}

function PostCard({
  post,
  isAuthenticated,
  currentUserId,
}: {
  post: FeedPost;
  isAuthenticated: boolean;
  currentUserId?: string;
}) {
  const react = useReactToPost();
  const [reaction, setReaction] = useState<ReactionType | null>(post.myReaction ?? (post.isLiked ? 'LIKE' : null));
  const [counts, setCounts] = useState<ReactionCounts>(post.reactionCounts ?? (post.likeCount ? { LIKE: post.likeCount } : {}));
  const [comments, setComments] = useState(post.commentCount ?? 0);
  const [hidden, setHidden] = useState(false);
  const [saved, setSaved] = useState(post.isSaved ?? false);
  const [following, setFollowing] = useState(post.author.isFollowing ?? false);
  const [shareLabel, setShareLabel] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  // Optimistic, reverting only on a real failure. A signed-out viewer gets 401
  // and is sent to sign in rather than silently losing the interaction.
  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await (next ? postApi.save(post.id) : postApi.unsave(post.id));
    } catch {
      setSaved(!next);
    }
  };

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    try {
      await (next ? userApi.follow(post.author.id) : userApi.unfollow(post.author.id));
    } catch {
      setFollowing(!next);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: authorName(post.author), text: post.content, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareLabel('Link copied');
      window.setTimeout(() => setShareLabel(null), 1800);
    } catch {
      // Cancelled share sheet or blocked clipboard: nothing to recover from.
    }
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || posting) return;

    setPosting(true);
    setCommentError(null);
    try {
      await postApi.comment(post.id, content);
      setDraft('');
      setComments((n) => n + 1);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setCommentError(
        status === 401 || status === 403
          ? 'Sign in again to comment.'
          : 'Your comment could not be posted.'
      );
    } finally {
      setPosting(false);
    }
  };

  const media = (post.mediaUrls ?? []).filter(
    (u): u is string => typeof u === 'string' && u.length > 0
  );

  // Optimistic: the emoji and the counts move at once; a failed write puts
  // both back. Changing from one reaction to another moves one count across.
  const changeReaction = (next: ReactionType | null) => {
    if (!isAuthenticated) return;
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
  const toggleLike = () => changeReaction(reaction ? null : 'LIKE');
  const liked = reaction !== null;

  if (hidden) return null;

  return (
    <article className="border-b border-slate-200 pb-4 dark:border-slate-800">
      {post.type === 'WIN' && (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          🏆 Win
        </p>
      )}
      <header className="flex items-center gap-3 py-3">
        <Link href={`/profile/${post.author.id}`} className="story-ring">
          <span className="block rounded-full border-2 border-white dark:border-slate-950">
            <Avatar author={post.author} size={32} />
          </span>
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link
            href={`/profile/${post.author.id}`}
            className="text-sm font-semibold text-slate-900 hover:opacity-70 dark:text-white"
          >
            {handleFor(post.author)}
          </Link>
          {post.author.headline && (
            // Hidden in the narrow desktop column, where a truncated job title
            // is just noise; still shown when the column runs full width.
            <p className="truncate text-xs text-slate-500 lg:hidden dark:text-slate-400">
              {post.author.headline}
            </p>
          )}
        </div>
        <span suppressHydrationWarning className="flex-shrink-0 text-[11px] text-slate-400">
          {hydrated
            ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
            : post.createdAt.slice(0, 10)}
        </span>
        {isAuthenticated && post.author.id !== currentUserId && (
          <button
            type="button"
            onClick={toggleFollow}
            className={cn(
              'flex-shrink-0 text-xs font-semibold transition',
              following
                ? 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                : 'text-rose-600 hover:text-rose-700 dark:text-rose-400'
            )}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </header>

      {media.length > 0 && (
        <div
          className={cn(
            'overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800',
            media.length > 1 && 'grid grid-cols-2 gap-0.5'
          )}
          onDoubleClick={() => !liked && toggleLike()}
        >
          {media.map((url) =>
            isVideoUrl(url) ? (
              <video
                key={url}
                src={url}
                controls
                playsInline
                className="max-h-[585px] w-full bg-black object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                className="max-h-[585px] w-full object-cover"
              />
            )
          )}
        </div>
      )}

      {post.poll && (
        <div className="mt-3">
          <PollCard postId={post.id} poll={post.poll} canVote={isAuthenticated} compact />
        </div>
      )}

      <div className="flex items-center gap-3 pt-3 lg:gap-2">
        {isAuthenticated ? (
          <ReactionButton value={reaction} onChange={changeReaction} compact />
        ) : (
          <Link href="/login" aria-label="Sign in to like">
            <Heart className="h-6 w-6 text-slate-900 hover:opacity-60 lg:h-5 lg:w-5 dark:text-white" />
          </Link>
        )}
        <Link href={`/posts/${post.id}`} aria-label="Comments">
          <MessageCircle className="h-6 w-6 text-slate-900 hover:opacity-60 lg:h-5 lg:w-5 dark:text-white" />
        </Link>
        <button type="button" onClick={share} aria-label="Share">
          <Send className="h-6 w-6 text-slate-900 hover:opacity-60 lg:h-5 lg:w-5 dark:text-white" />
        </button>
        {shareLabel && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{shareLabel}</span>
        )}
        {/* Signed out, this is a deliberate trip to sign-in. Firing the request
            anyway would 401, and the axios interceptor would yank the whole page
            to /login mid-browse. */}
        {isAuthenticated ? (
          <button
            type="button"
            onClick={toggleSave}
            aria-label={saved ? 'Remove from saved' : 'Save'}
            className="ml-auto"
          >
            <Bookmark
              className={cn(
                'h-6 w-6 transition lg:h-5 lg:w-5',
                saved
                  ? 'fill-slate-900 text-slate-900 dark:fill-white dark:text-white'
                  : 'text-slate-900 hover:opacity-60 dark:text-white'
              )}
            />
          </button>
        ) : (
          <Link href="/login" aria-label="Sign in to save" className="ml-auto">
            <Bookmark className="h-6 w-6 text-slate-900 hover:opacity-60 lg:h-5 lg:w-5 dark:text-white" />
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <ReactionSummary counts={counts} className="text-sm font-semibold text-slate-900 dark:text-white" />
        <WhyThis
          reasons={post.reasons}
          authorId={post.author.id}
          authorName={authorName(post.author)}
          isOwn={post.author.id === currentUserId}
          onHidden={() => setHidden(true)}
          className="ml-auto"
        />
      </div>

      {/* break-words matters in the narrow column: a long unbroken token (a URL,
          a hashtag) otherwise pushes the caption past the column edge. pre-line
          rather than pre-wrap keeps newlines without letting preserved trailing
          spaces hang past the content edge. */}
      <p className="break-words pt-1 text-sm leading-5 text-slate-900 dark:text-slate-100">
        <Link href={`/profile/${post.author.id}`} className="font-semibold">
          {handleFor(post.author)}
        </Link>{' '}
        <span className="whitespace-pre-line break-words">{renderSocialText(post.content)}</span>
      </p>

      {comments > 0 && (
        <Link
          href={`/posts/${post.id}`}
          className="mt-1 inline-block text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
        >
          View all {comments} comments
        </Link>
      )}

      {isAuthenticated ? (
        <form onSubmit={submitComment} className="mt-2 flex items-center gap-2">
          <label htmlFor={`comment-${post.id}`} className="sr-only">
            Add a comment
          </label>
          <input
            id={`comment-${post.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment..."
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
          <button
            type="submit"
            disabled={!draft.trim() || posting}
            className="flex-shrink-0 text-sm font-semibold text-rose-600 disabled:opacity-40 dark:text-rose-400"
          >
            {posting ? '...' : 'Post'}
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          className="mt-2 inline-block text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Sign in to join the conversation
        </Link>
      )}

      {commentError && (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{commentError}</p>
      )}
    </article>
  );
}

const PAGE_SIZE = 10;

export default function InstagramHome() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // The feed carries per-viewer state (liked, saved, followed). On a full
  // load the silent session refresh races this request, and a fetch that goes
  // out before the token exists returns the signed-out view: every author
  // showed "Follow" and every heart was empty until the next navigation. So
  // wait for auth to settle, and fetch again whenever it changes.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    setPosts(null);
    setFailed(false);
    setPage(1);

    postApi
      .getFeed({ tab: 'for-you', algorithm: 'engagement', limit: PAGE_SIZE, page: 1 })
      .then((response) => {
        if (cancelled) return;
        const data = response.data?.data;
        setPosts(Array.isArray(data) ? data : []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setLoadingMore(true);
    setAnnouncement('Loading more posts');
    try {
      const response = await postApi.getFeed({
        tab: 'for-you',
        algorithm: 'engagement',
        limit: PAGE_SIZE,
        page: next,
      });
      const data = response.data?.data;
      // Counted out here, not inside the setPosts updater: React may defer or
      // re-run that callback, so a counter assigned in it reads back as 0.
      const seen = new Set((posts ?? []).map((p) => p.id));
      const fresh: FeedPost[] = Array.isArray(data)
        ? data.filter((p: FeedPost) => !seen.has(p.id))
        : [];
      const added = fresh.length;

      if (added > 0) {
        setPosts((current) => [...(current ?? []), ...fresh]);
        setPage(next);
      }
      setHasMore(Boolean(response.data?.pagination?.hasMore));
      setAnnouncement(added > 0 ? `${added} more posts loaded` : 'No more posts');
    } catch {
      setHasMore(false);
      setAnnouncement('Could not load more posts');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      {/* Wide container with tight gutters: the previous max-w-6xl left large
          empty margins either side of a single 470px column. */}
      <div className="mx-auto flex w-full max-w-[1600px] gap-5 px-3 xl:gap-6 xl:px-5">
        {/* Left rail — navigation, then the join actions as buttons. */}
        <aside
          aria-label="Primary"
          className="sticky top-0 hidden h-screen w-16 flex-shrink-0 flex-col gap-1 py-6 md:flex xl:w-56"
        >
          <Link href="/" className="mb-5 flex items-center gap-3 px-3">
            <Image src="/icon.svg" alt="ATHENA" width={32} height={32} className="rounded-lg" />
            <span className="hidden text-xl font-bold gradient-text-feminine xl:inline">ATHENA</span>
          </Link>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 rounded-full px-3 py-2.5 transition hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <item.icon className="h-6 w-6 flex-shrink-0" />
              <span className="hidden text-base xl:inline">{item.label}</span>
            </Link>
          ))}

          {!isAuthenticated && (
            <div className="mt-auto hidden flex-col gap-2 pb-2 xl:flex">
              <Link
                href="/register"
                className="rounded-lg bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] py-2.5 text-center text-sm font-semibold text-white"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-slate-300 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Log in
              </Link>
            </div>
          )}
        </aside>

        {/* Middle column — the product story and the revenue surfaces. */}
        <section aria-label="Discover" className="hidden min-w-0 flex-1 py-6 lg:block">
          <HomeMiddleColumn />
        </section>

        {/* Third column — the live feed, half Instagram's 470px so the middle
            column gets the reclaimed width. Below lg it is the only column, so
            it stretches to full width there rather than staying at 235px. */}
        <main
          aria-label="Feed"
          className="mx-auto w-full max-w-[470px] py-6 lg:mx-0 lg:max-w-[235px] lg:flex-shrink-0"
        >
          {isAuthenticated && user && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <Avatar author={{ id: user.id, displayName: user.firstName, avatar: null }} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.firstName}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">Your account</p>
              </div>
              <Link href="/dashboard" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Dashboard
              </Link>
            </div>
          )}

          <div className="mb-4">
            <StoriesStrip />
          </div>

          {posts === null && !failed && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          )}

          {failed && (
            <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              We can&apos;t reach the feed right now. Try refreshing in a moment.
            </p>
          )}

          {posts?.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                It&apos;s quiet in here. Be the one who starts it.
              </p>
              {/* A member goes straight to the composer; a visitor joins first. */}
              <Link
                href={isAuthenticated ? '/dashboard/create-post' : '/register'}
                className="mt-3 inline-block text-sm font-semibold text-rose-600 dark:text-rose-400"
              >
                Write the first post
              </Link>
            </div>
          )}

          {posts?.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isAuthenticated={isAuthenticated}
              currentUserId={user?.id}
            />
          ))}

          {hasMore && (
            <div className="py-6 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </main>

      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Primary, mobile"
        className="sticky bottom-0 flex items-center justify-around border-t border-slate-200 bg-white py-3 md:hidden dark:border-slate-800 dark:bg-slate-950"
      >
        {NAV.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} aria-label={item.label}>
            <item.icon className="h-6 w-6" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
