'use client';

import React, { useCallback } from 'react';
import { useInfiniteFeed } from '@/lib/hooks';
import PostCard from './PostCard';
import { NewPostsPill } from './NewPostsPill';
import { FeedPager } from '@/components/feed/FeedPager';
import { Loader2 } from 'lucide-react';

interface FeedProps {
  tab: 'for-you' | 'following';
  contentType?: 'all' | 'video' | 'image' | 'text' | 'poll' | 'win';
}

// The community feed was one page of twenty posts with no way past it, the
// same dead end the /feed page had. It pages now, like that one.
export default function Feed({ tab, contentType = 'all' }: FeedProps) {
  const {
    data: posts,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteFeed({ tab, type: contentType });
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // A failure is only the whole feed's when nothing has loaded; a later page
  // that fails is reported at the bottom of what she can already read.
  if (isError && (!posts || posts.length === 0)) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">
        Failed to load feed. Please try again later.
      </div>
    );
  }

  if (!posts || posts.length === 0) {
     return (
        <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
            <p>No posts yet. Be the first to share something!</p>
        </div>
     );
  }

  return (
    <div className="space-y-4">
      <NewPostsPill />
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <FeedPager
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        failed={isFetchNextPageError}
        onLoadMore={loadMore}
      />
    </div>
  );
}
