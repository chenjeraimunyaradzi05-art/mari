'use client';

/**
 * Reels on the front page. With reels, three tiles from the trending feed;
 * without, an invitation shaped like the thing itself: three tall tiles for
 * the three kinds of reel people post here, the last one a way to record.
 * Never stock footage pretending to be members.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Mic, Play, Rocket, Trophy, Video as VideoIcon } from 'lucide-react';
import { videoApi } from '@/lib/api-extensions';
import { cn } from '@/lib/utils';
import { Rail, StaggerItem, StaggerList } from './RailShell';

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

const INVITES = [
  { label: 'Career wins', hint: 'The offer, the promotion, the pivot', icon: Trophy, tint: 'from-rose-500 via-pink-500 to-orange-400' },
  { label: 'Salary talk', hint: 'What you asked for, and what worked', icon: Mic, tint: 'from-violet-600 via-purple-500 to-fuchsia-500' },
  { label: 'Founder stories', hint: 'Ninety seconds of building in public', icon: Rocket, tint: 'from-amber-400 via-orange-500 to-rose-500' },
];

function ReelTile({ reel }: { reel: Reel }) {
  return (
    <Link href={`/explore?video=${reel.id}`} className="reel-tile group">
      {reel.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={reel.thumbnailUrl} alt={reel.title || reel.description || 'Reel'} loading="lazy" className="reel-tile-media" />
      ) : (
        <video src={reel.videoUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      )}
      <div className="reel-scrim" />
      <span className="absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition group-hover:bg-white/35">
        <Play className="h-3.5 w-3.5 fill-current" />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="line-clamp-2 text-[11px] font-medium leading-4 text-white">{reel.title || reel.description || 'Untitled'}</p>
        {/* A "0" play count reads worse than no count at all. */}
        {(reel.viewCount ?? 0) > 0 && (
          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/70">
            <span className="inline-flex items-center gap-1">
              <Play className="h-2.5 w-2.5 fill-current" />
              {compact(reel.viewCount ?? 0)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/** The empty state: the three kinds of reel, as tiles, the last one recording. */
function Invitation() {
  return (
    <StaggerList className="grid grid-cols-3 gap-2">
      {INVITES.map((item, i) => {
        const last = i === INVITES.length - 1;
        return (
          <StaggerItem key={item.label}>
            <Link href="/explore" className={cn('group relative block aspect-[9/16] overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-[0_18px_40px_-24px_rgba(168,85,247,0.6)] transition hover:-translate-y-1', item.tint)}>
              <span aria-hidden className="grid-fade absolute inset-0 opacity-50" />
              <span aria-hidden className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
              <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <item.icon className="h-4 w-4" />
              </span>
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                <span className="mt-1 block text-[11px] leading-4 text-white/85">{item.hint}</span>
                {last && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition group-hover:bg-rose-50">
                    <VideoIcon className="h-3 w-3" /> Record one
                  </span>
                )}
              </span>
            </Link>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
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

  if (isCompact) {
    return (
      <Rail icon={Play} tone="violet" kicker="Reels" title="Short video from women building in public" titleId="home-reels-title" description="Career wins, salary talk and founder stories, ninety seconds each." cta={{ href: '/explore', label: 'Watch reels' }}>
        {reels === null ? (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[9/16] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : reels.length === 0 ? (
          <>
            <Invitation />
            <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">Nobody has posted one today. Ninety seconds of your week would make a lovely first.</p>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {reels.slice(0, 3).map((reel) => (
              <ReelTile key={reel.id} reel={reel} />
            ))}
          </div>
        )}
      </Rail>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gradient-to-tr from-rose-500 to-purple-600 p-1.5 text-white">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
            <span className="kicker">Reels</span>
          </div>
          <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">Short video from women building in public</h2>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">Career wins, salary talk and founder stories, ninety seconds each.</p>
        </div>
        <Link href="/explore" className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-200">
          Watch reels <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-8">
        {reels === null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-[9/16] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : reels.length === 0 ? (
          <div className="mx-auto max-w-xl">
            <Invitation />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {reels.map((reel) => (
              <ReelTile key={reel.id} reel={reel} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
