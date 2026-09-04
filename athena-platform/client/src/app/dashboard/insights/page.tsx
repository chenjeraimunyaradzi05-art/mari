'use client';

/**
 * How your posts are doing: totals for the window and the posts that carried
 * furthest, each opening its own insights.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Loader2 } from 'lucide-react';
import { postApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { PostInsightsDialog, Stat } from '@/components/community/PostInsightsDialog';
import { formatCount } from '@/components/community/RepostButton';

type Overview = {
  days: number;
  posts: number;
  impressions: number;
  reach: number;
  reactions: number;
  comments: number;
  reposts: number;
  saves: number;
  engagements: number;
  engagementRate: number;
  newFollowers: number;
  top: Array<{
    id: string;
    excerpt: string;
    type: string;
    hasMedia: boolean;
    createdAt: string;
    impressions: number;
    engagements: number;
    engagementRate: number;
  }>;
};

const WINDOWS = [7, 30, 90] as const;

export default function InsightsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [openPost, setOpenPost] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-post-insights', days],
    queryFn: () => postApi.getMyInsights(days),
    enabled: isAuthenticated && !authLoading,
    select: (response) => response.data?.data as Overview,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-primary-600">
          <BarChart3 className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Insights</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">How your posts are doing</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Impressions are every time a post was on someone&apos;s screen; reach is how many different people that was.
        </p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Window">
        {WINDOWS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={days === option}
            onClick={() => setDays(option)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              days === option
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            Last {option} days
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Posts" value={data.posts} />
            <Stat label="Impressions" value={data.impressions} />
            <Stat label="People reached" value={data.reach} />
            <Stat label="Engagement rate" value={`${data.engagementRate}%`} hint={`${formatCount(data.engagements)} actions`} />
            <Stat label="Reactions" value={data.reactions} />
            <Stat label="Comments" value={data.comments} />
            <Stat label="Reposts" value={data.reposts} />
            <Stat label="New followers" value={data.newFollowers} />
          </div>

          <section className="card">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Posts that carried furthest</h2>
            {data.top.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Nothing posted in this window yet.{' '}
                <Link href="/dashboard/create-post" className="text-primary-600 hover:underline">
                  Write something
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.top.map((post) => (
                  <li key={post.id} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/posts/${post.id}`} className="line-clamp-2 text-sm text-slate-900 hover:underline dark:text-white">
                        {post.excerpt || (post.hasMedia ? 'Media post' : 'Post')}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatCount(post.impressions)} impressions · {formatCount(post.engagements)} actions · {post.engagementRate}%
                      </p>
                    </div>
                    <button type="button" onClick={() => setOpenPost(post.id)} className="btn-outline px-3 py-1.5 text-xs">
                      Insights
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {openPost && <PostInsightsDialog postId={openPost} open onClose={() => setOpenPost(null)} />}
    </div>
  );
}
