'use client';

/**
 * Wins worth celebrating: real posts members have marked as a win, from the
 * feed, as warm cards. Nothing invented; with no wins posted, nothing shows.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Heart, MessageCircle, Trophy } from 'lucide-react';
import { postApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Rail, SkeletonTiles, StaggerItem, StaggerList, TILE_GRADIENTS } from './RailShell';

type Author = { id: string; displayName?: string | null; firstName?: string | null; lastName?: string | null; avatar?: string | null; headline?: string | null };
type Post = {
  id: string;
  content: string;
  createdAt: string;
  type?: string;
  likeCount?: number;
  commentCount?: number;
  reactionCounts?: Record<string, number>;
  author: Author;
};

const nameOf = (a: Author) => a.displayName?.trim() || [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || 'ATHENA member';
const initials = (a: Author) =>
  nameOf(a)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'A';
const reactions = (p: Post) => (p.reactionCounts ? Object.values(p.reactionCounts).reduce((n, v) => n + (v ?? 0), 0) : p.likeCount ?? 0);

export function WinsRail() {
  const [wins, setWins] = useState<Post[] | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    let cancelled = false;
    postApi
      .getFeed({ tab: 'for-you', type: 'win', limit: 6 })
      .then((r) => {
        if (cancelled) return;
        const data = r.data?.data;
        const list: Post[] = Array.isArray(data) ? data : [];
        setWins(list.filter((p) => (p.type ?? 'WIN') === 'WIN' && p.content?.trim()).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setWins([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (wins !== null && wins.length === 0) return null;

  return (
    <Rail icon={Trophy} tone="amber" kicker="worth a cheer" title="Wins worth celebrating" titleId="home-wins-title" description="Women here marking a win, in their own words. Go on, cheer them on." cta={{ href: '/feed', label: 'See the feed' }}>
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wins === null ? (
          <SkeletonTiles count={3} height="h-44" />
        ) : (
          wins.map((post, index) => {
            const count = reactions(post);
            return (
              <StaggerItem key={post.id}>
                <Link href={`/posts/${post.id}`} className="tile-glass group relative flex h-full flex-col overflow-hidden p-4">
                  <span aria-hidden className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-amber-300/50 to-rose-400/40 blur-2xl" />
                  <span className="relative flex items-center gap-3">
                    {post.author.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element -- avatars come from the media store
                      <img src={post.author.avatar} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-900" />
                    ) : (
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white', TILE_GRADIENTS[(index + 1) % TILE_GRADIENTS.length])}>{initials(post.author)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{nameOf(post.author)}</span>
                      <span suppressHydrationWarning className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {hydrated ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : post.createdAt.slice(0, 10)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                      <Trophy className="h-3 w-3" /> Win
                    </span>
                  </span>
                  <span className="relative mt-3 line-clamp-4 text-sm leading-6 text-slate-700 dark:text-slate-200">{post.content}</span>
                  <span className="relative mt-auto flex items-center gap-3 pt-4 text-[11px] text-slate-500 dark:text-slate-400">
                    {count > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3 fill-rose-500 text-rose-500" /> {count}
                      </span>
                    )}
                    {(post.commentCount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> {post.commentCount}
                      </span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-300">
                      Cheer her on <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            );
          })
        )}
      </StaggerList>
    </Rail>
  );
}
