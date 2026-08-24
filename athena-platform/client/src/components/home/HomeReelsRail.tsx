'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, Video as VideoIcon } from 'lucide-react';
import { videoApi } from '@/lib/api-extensions';

type Reel = {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  description?: string | null;
  viewCount?: number;
  likeCount?: number;
  author?: { id: string; displayName?: string | null; avatar?: string | null } | null;
};

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function HomeReelsRail({ compact: isCompact = false }: { compact?: boolean } = {}) {
  const [reels, setReels] = useState<Reel[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    videoApi
      .getFeed({ feed: 'trending', limit: 6 })
      .then((response) => {
        if (cancelled) return;
        const data = response.data?.data;
        setReels(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setReels([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={isCompact ? '' : 'mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8'}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gradient-to-tr from-rose-500 to-purple-600 p-1.5 text-white">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
            <span className="kicker">Reels</span>
          </div>
          <h2 className={isCompact ? 'mt-2 text-lg font-semibold text-slate-900 dark:text-white' : 'mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white'}>
            Short video from women building in public
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
            Career wins, salary talk, and founder stories — ninety seconds each.
          </p>
        </div>
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-rose-400/40 dark:hover:text-rose-300"
        >
          Watch reels <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className={isCompact ? 'mt-4' : 'mt-8'}>
        {reels === null ? (
          <div className={isCompact ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="aspect-[9/16] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : reels.length === 0 ? (
          // Honest empty state rather than stock footage pretending to be members.
          // Compact (the homepage) gets one warm line instead: a tall dashed box
          // announcing an absence is the least inviting thing that can sit in the
          // middle of the page, and it reads as broken rather than as new.
          isCompact ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gradient-to-r from-rose-50 to-purple-50 px-4 py-3 dark:from-rose-950/30 dark:to-purple-950/30">
              <VideoIcon className="h-5 w-5 flex-shrink-0 text-rose-500" />
              <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300">
                Nobody has posted one today. Ninety seconds of your week would make a
                lovely first.
              </p>
              <Link
                href="/explore"
                className="focusable flex-shrink-0 rounded-full bg-gradient-to-tr from-rose-500 to-purple-600 px-4 py-1.5 text-sm font-semibold text-white"
              >
                Record one
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <VideoIcon className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-medium text-slate-900 dark:text-white">
                Nobody has posted one yet
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                The first one could be yours.
              </p>
              <Link
                href="/explore"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-tr from-rose-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white"
              >
                Open Reels <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )
        ) : (
          <div className={isCompact ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'}>
            {reels.map((reel) => (
              <Link
                key={reel.id}
                href={`/explore?video=${reel.id}`}
                className="reel-tile group"
              >
                {reel.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reel.thumbnailUrl}
                    alt={reel.title || reel.description || 'Reel'}
                    loading="lazy"
                    className="reel-tile-media"
                  />
                ) : (
                  <video
                    src={reel.videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                )}

                <div className="reel-scrim" />

                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className="line-clamp-2 text-[11px] font-medium leading-4 text-white">
                    {reel.description || reel.title || 'Untitled'}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-white/70">
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-2.5 w-2.5 fill-current" />
                      {compact(reel.viewCount ?? 0)}
                    </span>
                    {reel.author?.displayName && (
                      <span className="truncate">{reel.author.displayName}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
