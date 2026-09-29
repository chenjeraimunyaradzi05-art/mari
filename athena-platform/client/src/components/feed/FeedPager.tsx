'use client';

/**
 * The bottom of a paged feed.
 *
 * The feeds used to show their first twenty posts and stop, with nothing to
 * say there were more. The next page now loads as she scrolls near the end,
 * and the button does the same for anyone not scrolling (a keyboard, a screen
 * reader, a browser without IntersectionObserver). A page that failed to load
 * says so and offers to try again: it is not the end of the feed, and ending
 * the list in silence would tell her it was.
 */

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export function FeedPager({
  hasNextPage,
  isFetchingNextPage,
  failed,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  failed: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const canAutoLoad = hasNextPage && !isFetchingNextPage && !failed;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !canAutoLoad || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canAutoLoad, onLoadMore]);

  if (failed) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200"
      >
        <p>The next posts could not be loaded. There are more; this is not the end of your feed.</p>
        <button
          type="button"
          onClick={onLoadMore}
          className="mt-3 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!hasNextPage) {
    return <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">You are all caught up.</p>;
  }

  return (
    <div ref={sentinelRef} className="flex justify-center py-2">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={isFetchingNextPage}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {isFetchingNextPage ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading more posts
          </>
        ) : (
          'Load more posts'
        )}
      </button>
    </div>
  );
}

export default FeedPager;
