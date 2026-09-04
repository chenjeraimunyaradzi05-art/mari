'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { VideoComments } from './VideoComments';
import { useRouter } from 'next/navigation';
import { videoApi } from '@/lib/api-extensions';
import { Loader2 } from 'lucide-react';
import { useVideoFeedStore, VideoItem } from '@/lib/stores/video.store';
import { useAuthStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/loading';
import toast from 'react-hot-toast';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { useSeeFewerFrom } from '@/lib/social-hooks';

// Maps a Video row from GET /video/feed onto the store interface. The field names
// here follow the Prisma model the endpoint returns (likeCount, author.displayName,
// author.avatar), not the flattened shape an earlier draft of this file assumed.
function mapApiToVideoItem(v: any): VideoItem {
  return {
    id: v.id,
    url: v.videoUrl,
    thumbnail: v.thumbnailUrl ?? undefined,
    description: v.description || v.title || '',
    creator: {
      id: v.author?.id,
      username: v.author?.displayName || 'ATHENA member',
      avatar: v.author?.avatar ?? undefined,
    },
    likes: v.likeCount ?? 0,
    comments: v.commentCount ?? 0,
    shares: v.shareCount ?? 0,
    views: v.viewCount ?? 0,
    duration: v.duration ?? undefined,
    isLiked: v.isLiked ?? false,
    isBookmarked: v.isSaved ?? false,
    hashtags: Array.isArray(v.hashtags) ? v.hashtags : undefined,
    soundId: v.sound?.id ?? v.audioTrackId ?? undefined,
    soundTitle: v.sound?.title ?? undefined,
    duetOf: v.duetOf ? { id: v.duetOf.id, name: v.duetOf.author?.displayName || 'ATHENA member' } : undefined,
    duetCount: v.duetCount ?? 0,
    captionsUrl: v.captionsUrl ?? undefined,
    createdAt: v.createdAt,
  };
}

interface VideoFeedProps {
  initialVideos?: any[];
  category?: string;
  /** Restrict the feed to one topic; comes from ?topic= on /explore. */
  hashtag?: string;
  /** Restrict the feed to every reel using one sound; ?sound= on /explore. */
  soundId?: string;
  /**
   * A reel to open on. Share links, the homepage reel tiles and the saved
   * list all arrive as /explore?video=<id>; the feed used to ignore it and
   * open on whatever was newest.
   */
  initialVideoId?: string;
}

export function VideoFeed({ initialVideos = [], category, hashtag, soundId, initialVideoId }: VideoFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Use global store
  const {
      feed,
      currentIndex,
      setFeed,
      appendVideos,
      setIndex,
      toggleLike,
      toggleBookmark,
      bookmarkedVideos,
      markAsShared,
      addToHistory,
      setCommentCount,
  } = useVideoFeedStore();

  const router = useRouter();
  // The feed reports isLiked / isSaved for the signed-in viewer, so it waits
  // for the session to be restored before the first fetch (see useFeed).
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const seeFewer = useSeeFewerFrom();

  // A ref, not `loadingLocal`, guards re-entry. Reading the state here would put
  // it in fetchVideos' dependency list, and because it flips on every call the
  // callback identity would change, retriggering the load effect and spinning up
  // an unbounded retry loop whenever the feed request fails.
  const isFetchingRef = useRef(false);

  // The endpoint paginates by cursor, not page number, so the next cursor it
  // hands back is what drives loading more.
  const cursorRef = useRef<string | null>(null);

  const fetchVideos = useCallback(async (mode: 'reset' | 'more') => {
    if (isFetchingRef.current) return;
    if (mode === 'more' && !cursorRef.current) return;

    isFetchingRef.current = true;
    setLoadingLocal(true);
    try {
      const response = await videoApi.getFeed({
        limit: 10,
        feed: category,
        hashtag: hashtag || undefined,
        sound: soundId || undefined,
        cursor: mode === 'more' ? cursorRef.current ?? undefined : undefined,
      });

      const newVideos: any[] = Array.isArray(response.data?.data) ? response.data.data : [];
      let mappedVideos: VideoItem[] = newVideos.map(mapApiToVideoItem);
      cursorRef.current = response.data?.nextCursor ?? null;

      // The requested reel leads, then the feed continues behind it. A reel
      // that is gone (removed, hidden) simply falls through to the feed.
      if (mode === 'reset' && initialVideoId) {
        const opener = await videoApi
          .getVideo(initialVideoId)
          .then((r) => (r.data?.data ? mapApiToVideoItem(r.data.data) : null))
          .catch(() => null);
        if (opener) {
          mappedVideos = [opener, ...mappedVideos.filter((v) => v.id !== opener.id)];
        }
      }

      if (mode === 'reset') setFeed(mappedVideos);
      else if (mappedVideos.length > 0) appendVideos(mappedVideos);

      setLoadError(null);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      setLoadError('Videos could not be loaded right now.');
    } finally {
      isFetchingRef.current = false;
      setLoadingLocal(false);
    }
  }, [category, hashtag, soundId, initialVideoId, setFeed, appendVideos]);

  // Load on mount and whenever the slice changes. Keying the effect on the
  // category, topic, sound and opener is deliberate: the feed belongs to that
  // slice, so switching tabs has to clear the old videos and pull the new ones.
  useEffect(() => {
    if (initialVideos.length > 0) {
      setFeed(initialVideos.map(mapApiToVideoItem));
      return;
    }
    if (authLoading) return;
    setFeed([]);
    setIndex(0);
    if (containerRef.current) containerRef.current.scrollTo({ top: 0 });
    void fetchVideos('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, hashtag, soundId, initialVideoId, authLoading, isAuthenticated]);

  const handleScroll = () => {
      if (!containerRef.current) return;

      const { scrollTop, clientHeight } = containerRef.current;
      const index = Math.round(scrollTop / clientHeight);

      if (index !== currentIndex) {
        setIndex(index);

        // Load more
        if (index > feed.length - 4) {
          void fetchVideos('more');
        }
      }
  };

  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;
    const { clientHeight } = containerRef.current;
    containerRef.current.scrollTo({ top: index * clientHeight, behavior: 'smooth' });
  };

  // Interactions. Each one updates the store optimistically and then persists to
  // the API, reverting only if the write actually failed. Signed-out viewers get
  // a 401, and for them the locally persisted state is the intended behaviour, so
  // that case is left alone rather than reverted.
  const persist = useCallback(async (write: () => Promise<unknown>, revert: () => void) => {
    try {
      await write();
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return;
      revert();
    }
  }, []);

  const handleLike = useCallback((id: string) => {
    const wasLiked = feed.find((v) => v.id === id)?.isLiked ?? false;
    toggleLike(id);
    void persist(
      () => (wasLiked ? videoApi.unlike(id) : videoApi.like(id)),
      () => toggleLike(id)
    );
  }, [feed, toggleLike, persist]);

  const handleBookmark = useCallback((id: string) => {
    const wasBookmarked = bookmarkedVideos.includes(id);
    toggleBookmark(id);
    void persist(
      () => (wasBookmarked ? videoApi.unbookmark(id) : videoApi.bookmark(id)),
      () => toggleBookmark(id)
    );
  }, [bookmarkedVideos, toggleBookmark, persist]);

  const handleShare = useCallback(async (id: string) => {
    const shareUrl = `${window.location.origin}/explore?video=${id}`;
    const description = feed.find((v) => v.id === id)?.description;
    markAsShared(id);
    try {
      if (navigator.share) {
        await navigator.share({ title: description || 'ATHENA', url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // A cancelled share sheet or a blocked clipboard is not a failure worth surfacing.
    }
  }, [feed, markAsShared]);

  const handleAuthorClick = useCallback((authorId: string) => {
    router.push(`/profile/${authorId}`);
  }, [router]);

  // A duet is recorded in the studio with the original alongside.
  const handleDuet = useCallback((id: string) => {
    router.push(isAuthenticated ? `/dashboard/creator-studio?duet=${id}` : `/login?redirect=${encodeURIComponent(`/dashboard/creator-studio?duet=${id}`)}`);
  }, [router, isAuthenticated]);

  const handleCopyLink = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/explore?video=${id}`);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  }, []);

  // Hiding a creator removes their reels from this session at once and from
  // every ranked feed after the preference saves.
  const handleSeeFewer = useCallback((authorId: string) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/explore');
      return;
    }
    seeFewer.mutate(authorId);
    setFeed(feed.filter((v) => v.creator.id !== authorId));
  }, [isAuthenticated, router, seeFewer, setFeed, feed]);

  const handleView = useCallback((id: string, watchDuration: number, completionPct: number) => {
    addToHistory(id, completionPct / 100, completionPct >= 90);
    void videoApi
      .trackView(id, Math.max(1, Math.round(watchDuration)), completionPct, 'feed')
      .catch(() => {
        // View telemetry is best-effort and must never interrupt playback.
      });
  }, [addToHistory]);

  const commentsVideo = commentsFor ? feed.find((v) => v.id === commentsFor) : undefined;

  return (
    <>
    <div
      ref={containerRef}
      data-testid="video-feed"
      onScroll={handleScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = Math.min(feed.length - 1, currentIndex + 1);
          setIndex(nextIndex);
          scrollToIndex(nextIndex);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = Math.max(0, currentIndex - 1);
          setIndex(prevIndex);
          scrollToIndex(prevIndex);
        }
      }}
      tabIndex={0}
      role="list"
      aria-label="Video feed"
      className="h-[100dvh] w-full max-w-md mx-auto overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar bg-black focus:outline-none"
    >
      {feed.length === 0 && loadingLocal && (
        <div className="h-full w-full snap-start flex items-center justify-center bg-zinc-900">
          <div className="w-full max-w-sm space-y-3 p-6">
            <Skeleton className="h-[70vh] w-full rounded-2xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      )}

      {feed.length === 0 && !loadingLocal && (
        <div className="h-full w-full snap-start flex items-center justify-center bg-zinc-900 px-8 text-center">
          <div>
            <p className="text-sm text-white/70">
              {loadError ??
                (hashtag
                  ? `No reels tagged #${hashtag} yet.`
                  : soundId
                    ? 'No reels use this sound yet. Be the first.'
                  : category === 'following'
                    ? 'Nobody you follow has posted a reel yet.'
                    : 'There are no videos in this feed yet.')}
            </p>
            {loadError && (
              <button
                type="button"
                onClick={() => void fetchVideos('reset')}
                className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}
      {feed.map((video, index) => (
        <div
          key={video.id}
          className="h-full w-full snap-start relative"
          role="listitem"
          data-testid="video-player"
          data-video-id={video.id}
          data-active={index === currentIndex}
        >
          <VideoPlayer
            video={{
                id: video.id,
                title: video.description,
                description: video.description,
                videoUrl: video.url,
                thumbnailUrl: video.thumbnail,
                duration: 0,
                author: {
                    id: video.creator.id,
                    firstName: video.creator.username,
                    lastName: '',
                    avatarUrl: video.creator.avatar
                },
                likes: video.likes,
                comments: video.comments,
                shares: video.shares,
                isLiked: video.isLiked || false,
                isBookmarked: bookmarkedVideos.includes(video.id) || Boolean(video.isBookmarked),
                tags: video.hashtags,
                sound: video.soundId ? { id: video.soundId, title: video.soundTitle || 'Original sound' } : undefined,
                duetOf: video.duetOf,
                duetCount: video.duetCount,
                captionsUrl: video.captionsUrl,
                createdAt: video.createdAt || new Date().toISOString()
            }}
            isActive={index === currentIndex}
            onLike={handleLike}
            onBookmark={handleBookmark}
            onShare={handleShare}
            onComment={setCommentsFor}
            onAuthorClick={handleAuthorClick}
            onDuet={handleDuet}
            onView={handleView}
            onCopyLink={handleCopyLink}
            onSeeFewer={handleSeeFewer}
            onReport={isAuthenticated ? setReportFor : undefined}
          />
        </div>
      ))}

      {loadingLocal && (
        <div className="h-full w-full snap-start flex items-center justify-center bg-zinc-900">
           <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </div>

    <VideoComments
      videoId={commentsFor}
      creatorId={commentsVideo?.creator.id}
      onClose={() => setCommentsFor(null)}
      onCountChange={setCommentCount}
    />

    <ReportDialog
      open={Boolean(reportFor)}
      onClose={() => setReportFor(null)}
      targetType="video"
      targetId={reportFor ?? ''}
      targetLabel="this reel"
    />
    </>
  );
}
