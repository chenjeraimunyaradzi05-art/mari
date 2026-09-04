'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bell, BellOff, Hash, Loader2, Play, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { topicApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import PostCard from '@/components/community/PostCard';
import { cn } from '@/lib/utils';

/**
 * A topic page: everything carrying one hashtag, and a Follow button.
 * Following a topic boosts it in your ranked feed, which then says
 * "You follow #salary" on the posts it surfaces for that reason.
 */

type TopicData = {
  tag: string;
  counts: { posts: number; videos: number; followers: number };
  isFollowing: boolean;
  related: string[];
  posts: Array<{ id: string } & Record<string, unknown>>;
  videos: Array<{ id: string; thumbnailUrl: string | null; title: string | null; viewCount: number; author: { displayName: string | null } }>;
};

export default function TopicPage() {
  const params = useParams<{ tag: string }>();
  const tag = decodeURIComponent(params?.tag ?? '').replace(/^#+/, '').toLowerCase();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [data, setData] = useState<TopicData | null>(null);
  const [failed, setFailed] = useState(false);
  const [following, setFollowing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await topicApi.get(tag);
      const topic: TopicData | undefined = res.data?.data;
      if (!topic) throw new Error('missing');
      setData(topic);
      setFollowing(topic.isFollowing);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [tag]);

  useEffect(() => {
    if (authLoading || !tag) return;
    void load();
  }, [authLoading, isAuthenticated, tag, load]);

  const toggleFollow = async () => {
    if (!isAuthenticated) {
      toast.error('Sign in to follow topics');
      return;
    }
    const next = !following;
    setFollowing(next);
    setSaving(true);
    try {
      await (next ? topicApi.follow(tag) : topicApi.unfollow(tag));
      setData((current) =>
        current ? { ...current, counts: { ...current.counts, followers: Math.max(0, current.counts.followers + (next ? 1 : -1)) } } : current
      );
      toast.success(next ? `Following #${tag}. Your feed will show more of it.` : `Unfollowed #${tag}`);
    } catch (error) {
      setFollowing(!next);
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not update the topic');
    } finally {
      setSaving(false);
    }
  };

  if (failed) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">
        This topic could not be loaded.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 text-white">
            <Hash className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">#{data.tag}</h1>
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-500 dark:text-slate-400">
              <span>{data.counts.posts} {data.counts.posts === 1 ? 'post' : 'posts'}</span>
              <span>{data.counts.videos} {data.counts.videos === 1 ? 'reel' : 'reels'}</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {data.counts.followers} following
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void toggleFollow()}
          disabled={saving}
          aria-pressed={following}
          className={cn('inline-flex items-center gap-2 px-4 py-2', following ? 'btn-outline' : 'btn-primary')}
        >
          {following ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {following ? 'Following' : 'Follow topic'}
        </button>
      </div>

      {data.related.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-400">Also tagged</span>
          {data.related.map((other) => (
            <Link
              key={other}
              href={`/topics/${encodeURIComponent(other)}`}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              #{other}
            </Link>
          ))}
        </div>
      )}

      {data.videos.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reels</h2>
            <Link href={`/explore?topic=${encodeURIComponent(data.tag)}`} className="text-sm font-medium text-rose-600 dark:text-rose-400">
              Watch all
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {data.videos.map((video) => (
              <Link
                key={video.id}
                href={`/explore?topic=${encodeURIComponent(data.tag)}&video=${video.id}`}
                className="group relative aspect-[9/16] overflow-hidden rounded-lg bg-slate-900"
                aria-label={video.title || 'Reel'}
              >
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media CDN
                  <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/60">
                    <Play className="h-6 w-6" />
                  </div>
                )}
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                  {video.viewCount} views
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Posts</h2>
        {data.posts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
            Nothing has been posted with #{data.tag} yet.{' '}
            <Link href="/dashboard/create-post" className="font-medium text-rose-600 dark:text-rose-400">
              Start it.
            </Link>
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {data.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
