'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bookmark, Loader2, Play } from 'lucide-react';
import { videoApi } from '@/lib/api-extensions';
import { useVideoFeedStore, VideoItem } from '@/lib/stores/video.store';

function mapApiToVideoItem(v: any): VideoItem {
  return {
    id: v.id,
    url: v.videoUrl,
    thumbnail: v.thumbnailUrl,
    description: v.description || v.title,
    creator: {
      id: v.author?.id,
      username: v.author?.displayName || v.author?.firstName || 'ATHENA member',
      avatar: v.author?.avatarUrl || v.author?.avatar,
    },
    likes: v.likes ?? 0,
    comments: v.comments ?? 0,
    shares: v.shares ?? 0,
    createdAt: v.createdAt,
  };
}

export default function SavedVideosPage() {
  const { bookmarkedVideos, toggleBookmark } = useVideoFeedStore();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const load = useCallback(async (ids: string[]) => {
    setIsLoading(true);
    // Saved videos are persisted as ids only, so each one is resolved against the
    // public video endpoint. Anything that no longer resolves is reported rather
    // than silently dropped, so the counts on screen stay honest.
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await videoApi.getVideo(id);
          const payload = response.data?.data ?? response.data;
          return payload ? mapApiToVideoItem(payload) : null;
        } catch {
          return null;
        }
      })
    );

    setVideos(results.filter((v): v is VideoItem => v !== null));
    setUnavailable(ids.filter((id, index) => results[index] === null));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (bookmarkedVideos.length === 0) {
      setVideos([]);
      setUnavailable([]);
      setIsLoading(false);
      return;
    }
    void load(bookmarkedVideos);
    // Re-resolving on every bookmark change would refetch the whole list on an
    // unsave, so this intentionally tracks only the initial hydrated set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const remove = (id: string) => {
    toggleBookmark(id);
    setVideos((current) => current.filter((v) => v.id !== id));
    setUnavailable((current) => current.filter((v) => v !== id));
    void videoApi.unbookmark(id).catch(() => {
      // Signed-out viewers keep bookmarks locally; a failed sync is not fatal.
    });
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white">
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <header className="mb-6">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Explore
          </Link>
          <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold">
            <Bookmark className="h-6 w-6" />
            Saved
          </h1>
          <p className="mt-1 text-sm text-white/60">Videos you bookmarked while browsing.</p>
        </header>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        )}

        {!isLoading && videos.length === 0 && unavailable.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <Bookmark className="mx-auto h-8 w-8 text-white/30" />
            <p className="mt-4 text-sm text-white/70">You have not saved any videos yet.</p>
            <Link
              href="/explore"
              className="mt-4 inline-block rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
            >
              Browse Explore
            </Link>
          </div>
        )}

        {!isLoading && videos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3">
            {videos.map((video) => (
              <li key={video.id} className="group relative overflow-hidden rounded-xl bg-zinc-900">
                <Link href={`/explore?video=${video.id}`} className="block">
                  <div className="relative aspect-[9/16] w-full">
                    {video.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnail}
                        alt={video.description || 'Saved video'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                        <Play className="h-8 w-8 text-white/40" />
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 px-2 py-2 text-xs text-white/80">
                    {video.description || 'Untitled'}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(video.id)}
                  aria-label="Remove from saved"
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-yellow-400 transition hover:bg-black"
                >
                  <Bookmark className="h-4 w-4 fill-current" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && unavailable.length > 0 && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/70">
              {unavailable.length} saved {unavailable.length === 1 ? 'video is' : 'videos are'} no
              longer available.
            </p>
            <button
              type="button"
              onClick={() => unavailable.forEach(remove)}
              className="mt-2 text-sm font-medium text-white underline"
            >
              Clear them
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
