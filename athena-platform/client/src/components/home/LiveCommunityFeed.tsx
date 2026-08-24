'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, MessageCircle } from 'lucide-react';
import { postApi } from '@/lib/api';

type FeedAuthor = {
  id: string;
  displayName?: string | null;
  avatar?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
};

type FeedPost = {
  id: string;
  content: string;
  type?: string;
  mediaUrls?: string[] | null;
  likeCount?: number;
  commentCount?: number;
  author: FeedAuthor;
};

function authorName(author: FeedAuthor): string {
  const full = [author.firstName, author.lastName].filter(Boolean).join(' ').trim();
  return author.displayName?.trim() || full || 'ATHENA Member';
}

function initials(author: FeedAuthor): string {
  return (
    authorName(author)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'A'
  );
}

const AVATAR_TINTS = ['#fde4ec', '#ede9fe', '#ffedd5', '#dbeafe', '#dcfce7'];

export function LiveCommunityFeed() {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The feed endpoint is optionalAuth, so signed-out visitors get real public
    // posts. This panel used to render three invented people under a "Live
    // community" label.
    postApi
      .getFeed({ tab: 'for-you', algorithm: 'engagement', limit: 3 })
      .then((response) => {
        if (cancelled) return;
        const data = response.data?.data;
        setPosts(Array.isArray(data) ? data.slice(0, 3) : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-rose-400/10 dark:bg-slate-900/70">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-600 dark:text-rose-300">
            Live community
          </span>
        </div>
        <Link
          href="/feed"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-300"
        >
          Open feed <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {posts === null && !failed &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            </div>
          ))}

        {(failed || posts?.length === 0) && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {failed ? 'The community feed is reconnecting.' : 'No public posts yet — be the first.'}
            </p>
            <Link
              href="/feed"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-300"
            >
              Go to the feed <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {posts?.map((post, index) => (
          <Link
            key={post.id}
            href="/feed"
            className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-rose-200 hover:shadow dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-rose-400/20"
          >
            <div className="flex items-start gap-3">
              {post.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.author.avatar}
                  alt=""
                  className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
                />
              ) : (
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ring-white dark:ring-slate-900"
                  style={{
                    backgroundColor: AVATAR_TINTS[index % AVATAR_TINTS.length],
                    color: '#9f1239',
                  }}
                >
                  {initials(post.author)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {authorName(post.author)}
                  </span>
                  {(post.type === 'IMAGE' || post.type === 'VIDEO') && (
                    <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                      {post.type === 'VIDEO' ? 'Video' : 'Photo'}
                    </span>
                  )}
                </div>
                {post.author.headline && (
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {post.author.headline}
                  </div>
                )}
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
                  {post.content}
                </p>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {post.likeCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {post.commentCount ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
