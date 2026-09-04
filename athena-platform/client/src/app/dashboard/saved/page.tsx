'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Play } from 'lucide-react';
import { postApi } from '@/lib/api';
import { videoApi } from '@/lib/api-extensions';
import { useAuthStore } from '@/lib/hooks';
import PostCard from '@/components/community/PostCard';
import { cn } from '@/lib/utils';

/**
 * Everything the member has saved, in one place. Posts and reels could both
 * be saved from their players, and both saves were persisted, but nothing on
 * the site listed them again, so a saved post was as good as lost.
 */

type Tab = 'posts' | 'reels';

type SavedVideo = {
  id: string;
  title?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  viewCount?: number;
  author?: { id: string; displayName?: string | null } | null;
};

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>('posts');
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const ready = isAuthenticated && !authLoading;

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['saved-posts'],
    queryFn: postApi.getSaved,
    enabled: ready,
    select: (response) => (Array.isArray(response.data?.data) ? response.data.data : []),
  });

  const { data: reels = [], isLoading: reelsLoading } = useQuery({
    queryKey: ['saved-reels'],
    queryFn: () => videoApi.getBookmarked({ limit: 50 }),
    enabled: ready,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as SavedVideo[]) : []),
  });

  const loading = tab === 'posts' ? postsLoading : reelsLoading;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary-600">
          <Bookmark className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Saved</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Things you kept</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Posts and reels you saved, newest first. Saved jobs have their own page.
        </p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Saved content">
        {(
          [
            { value: 'posts', label: 'Posts', count: posts.length },
            { value: 'reels', label: 'Reels', count: reels.length },
          ] as { value: Tab; label: string; count: number }[]
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              tab === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            {option.label}
            {ready && !loading && <span className="ml-1 opacity-70">{option.count}</span>}
          </button>
        ))}
      </div>

      {!ready || loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-36 rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-36 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      ) : tab === 'posts' ? (
        posts.length === 0 ? (
          <EmptyState
            title="No saved posts yet"
            body="Use the bookmark on any post to keep it here."
            href="/feed"
            cta="Browse the feed"
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post: { id: string }) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )
      ) : reels.length === 0 ? (
        <EmptyState
          title="No saved reels yet"
          body="Tap the bookmark on a reel to keep it here."
          href="/explore"
          cta="Watch reels"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {reels.map((video) => (
            <Link key={video.id} href={`/explore?video=${video.id}`} className="reel-tile group">
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- media CDN, outside the image config
                <img src={video.thumbnailUrl} alt={video.title || 'Saved reel'} className="reel-tile-media" />
              ) : (
                <video src={video.videoUrl || undefined} muted playsInline preload="metadata" className="reel-tile-media" />
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white">
                <span className="line-clamp-2 pr-2">{video.title || video.description || 'Reel'}</span>
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" /> {video.viewCount ?? 0}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="card p-10 text-center">
      <Bookmark className="mx-auto h-8 w-8 text-slate-300" />
      <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
      <Link href={href} className="btn-primary mt-4 inline-flex px-4 py-2">
        {cta}
      </Link>
    </div>
  );
}
