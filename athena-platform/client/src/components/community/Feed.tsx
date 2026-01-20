'use client';

import React from 'react';
import { useFeed } from '@/lib/hooks';
import PostCard from './PostCard';
import { Loader2 } from 'lucide-react';

interface FeedProps {
  tab: 'for-you' | 'following';
  contentType?: 'all' | 'video' | 'image' | 'text';
}

export default function Feed({ tab, contentType = 'all' }: FeedProps) {
  const { data: posts, isLoading, isError } = useFeed({ tab, type: contentType });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">
        Failed to load feed. Please try again later.
      </div>
    );
  }

  if (!posts || posts.length === 0) {
     return (
        <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-500">
            <p>No posts yet. Be the first to share something!</p>
        </div>
     );
  }

  return (
    <div className="space-y-4">
      {posts.map((post: any) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
