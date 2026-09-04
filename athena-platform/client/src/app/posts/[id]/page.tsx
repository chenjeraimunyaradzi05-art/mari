'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { usePost } from '@/lib/hooks';
import PostCard from '@/components/community/PostCard';

/**
 * A single post with its comment thread.
 *
 * This is the page every "Comments", "View all N comments" and share link on
 * the feeds resolves to, and the page notification links point at. It is
 * public on purpose: a shared link has to open for someone who is signed out,
 * and the API already serves a public post to anyone.
 */
export default function PostPage() {
  const params = useParams<{ id: string }>();
  const { data: post, isLoading, error } = usePost(params.id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/feed"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the feed
        </Link>

        {isLoading && (
          <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        )}

        {!isLoading && (error || !post) && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">This post is not available</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              It may have been removed, or it is only visible to people its author follows.
            </p>
          </div>
        )}

        {post && <PostCard post={post} defaultShowComments />}
      </div>
    </div>
  );
}
