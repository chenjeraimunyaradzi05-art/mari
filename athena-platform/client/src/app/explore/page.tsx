'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VideoFeed } from '@/components/video';
import { cn } from '@/lib/utils';
import { Compass, TrendingUp, Users, Bookmark, X, Music } from 'lucide-react';
import { soundApi } from '@/lib/api-extensions';

/**
 * /explore?video=<id> opens on that reel, /explore?topic=<tag> shows one topic.
 *
 * Both parameters were already being written: every reel tile on the
 * homepage, the saved list, the share sheet and the topic circles link here
 * with one of them. This page ignored both, so a shared reel opened the feed
 * on whatever was newest and the topic circles were five identical links.
 */
function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVideoId = searchParams.get('video') ?? undefined;
  const topic = (searchParams.get('topic') ?? '').replace(/^#+/, '').trim().toLowerCase() || undefined;
  // /explore?sound=<id>: every reel that plays one sound, with a way to use it.
  const soundId = searchParams.get('sound')?.trim() || undefined;

  const [activeTab, setActiveTab] = useState('for-you');
  const [soundTitle, setSoundTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!soundId) {
      setSoundTitle(null);
      return;
    }
    let cancelled = false;
    soundApi
      .get(soundId)
      .then((r) => {
        if (!cancelled) setSoundTitle(r.data?.data?.title ?? 'Sound');
      })
      .catch(() => {
        if (!cancelled) setSoundTitle('Sound');
      });
    return () => {
      cancelled = true;
    };
  }, [soundId]);

  // A tab change drops the deep link: once the viewer has moved on, the
  // requested reel should not keep leading every tab.
  useEffect(() => {
    if (activeTab !== 'for-you' && (initialVideoId || topic || soundId)) {
      router.replace('/explore');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="h-[100dvh] flex flex-col bg-black">
      {/* Header with tabs */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent pt-4 pb-8">
        <div className="flex justify-center">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-transparent border-0">
              <TabsTrigger
                value="for-you"
                className="text-white/70 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
              >
                For You
              </TabsTrigger>
              <TabsTrigger
                value="following"
                className="text-white/70 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
              >
                Following
              </TabsTrigger>
              <TabsTrigger
                value="trending"
                className="text-white/70 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
              >
                Trending
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {topic && activeTab === 'for-you' && (
          <div className="mt-2 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              #{topic}
              <button
                type="button"
                onClick={() => router.replace('/explore')}
                aria-label="Clear topic"
                className="rounded-full p-0.5 hover:bg-white/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {soundId && activeTab === 'for-you' && (
          <div className="mt-2 flex justify-center gap-2">
            <span className="inline-flex max-w-[60vw] items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              <Music className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{soundTitle ?? 'Sound'}</span>
              <button
                type="button"
                onClick={() => router.replace('/explore')}
                aria-label="Clear sound"
                className="rounded-full p-0.5 hover:bg-white/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
            <Link
              href={`/dashboard/creator-studio?sound=${encodeURIComponent(soundId)}`}
              className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-white/90"
            >
              Use this sound
            </Link>
          </div>
        )}
      </div>

      {/* Video feed */}
      <VideoFeed
        category={activeTab === 'for-you' ? undefined : activeTab}
        hashtag={activeTab === 'for-you' ? topic : undefined}
        soundId={activeTab === 'for-you' ? soundId : undefined}
        initialVideoId={activeTab === 'for-you' ? initialVideoId : undefined}
      />

      {/* Bottom navigation */}
      <nav className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black to-transparent pb-4 pt-8">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('for-you')}
            className={cn('flex flex-col items-center', activeTab === 'for-you' ? 'text-white' : 'text-white/60 hover:text-white')}
          >
            <Compass className="w-6 h-6" />
            <span className="text-xs mt-1">Explore</span>
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={cn('flex flex-col items-center', activeTab === 'trending' ? 'text-white' : 'text-white/60 hover:text-white')}
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs mt-1">Trending</span>
          </button>
          <button
            onClick={() => router.push('/community')}
            className="flex flex-col items-center text-white/60 hover:text-white"
          >
            <Users className="w-6 h-6" />
            <span className="text-xs mt-1">Community</span>
          </button>
          <button
            onClick={() => router.push('/explore/saved')}
            className="flex flex-col items-center text-white/60 hover:text-white"
          >
            <Bookmark className="w-6 h-6" />
            <span className="text-xs mt-1">Saved</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// useSearchParams needs a Suspense boundary above it or the whole route is
// forced to render on the client at request time.
export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-black" />}>
      <ExploreContent />
    </Suspense>
  );
}
