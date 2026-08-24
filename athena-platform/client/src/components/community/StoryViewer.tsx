'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export type Story = {
  id: string;
  userId: string;
  type: 'image' | 'video';
  mediaUrl: string;
  createdAt: string;
  expiresAt: string;
};

export type StoryBucket = {
  user: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  stories: Story[];
};

interface StoryViewerProps {
  buckets: StoryBucket[];
  initialBucket: number;
  onClose: () => void;
}

const IMAGE_DURATION_MS = 5000;
const TICK_MS = 50;

export function StoryViewer({ buckets, initialBucket, onClose }: StoryViewerProps) {
  const [bucketIndex, setBucketIndex] = useState(initialBucket);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const bucket = buckets[bucketIndex];
  const story = bucket?.stories?.[storyIndex];

  const goNext = useCallback(() => {
    setProgress(0);
    const stories = buckets[bucketIndex]?.stories ?? [];
    if (storyIndex < stories.length - 1) {
      setStoryIndex((i) => i + 1);
      return;
    }
    if (bucketIndex < buckets.length - 1) {
      setBucketIndex((i) => i + 1);
      setStoryIndex(0);
      return;
    }
    onClose();
  }, [buckets, bucketIndex, storyIndex, onClose]);

  const goPrev = useCallback(() => {
    setProgress(0);
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      return;
    }
    if (bucketIndex > 0) {
      const prev = bucketIndex - 1;
      setBucketIndex(prev);
      setStoryIndex(Math.max(0, (buckets[prev]?.stories?.length ?? 1) - 1));
    }
  }, [buckets, bucketIndex, storyIndex]);

  // Images advance on a timer. Videos advance on their own `ended` event, so the
  // timer would fight the playhead — the bar tracks currentTime instead.
  useEffect(() => {
    if (!story || story.type === 'video' || isPaused) return;

    const started = Date.now();
    const id = window.setInterval(() => {
      const pct = ((Date.now() - started) / IMAGE_DURATION_MS) * 100;
      if (pct >= 100) {
        window.clearInterval(id);
        goNext();
      } else {
        setProgress(pct);
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [story, isPaused, goNext]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key === ' ') {
        event.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, goNext, goPrev]);

  // The page behind must not scroll while the viewer owns the screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!bucket || !story) return null;

  const posted = (() => {
    const date = new Date(story.createdAt);
    return Number.isNaN(date.getTime()) ? '' : formatDistanceToNow(date, { addSuffix: true });
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Stories from ${bucket.user.displayName}`}
    >
      <div className="relative h-full w-full max-w-md">
        {/* Progress bars, one per story in this bucket */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-3">
          {bucket.stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white transition-[width] duration-75 ease-linear"
                style={{ width: `${i < storyIndex ? 100 : i === storyIndex ? progress : 0}%` }}
              />
            </div>
          ))}
        </div>

        <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pb-4 pt-8 bg-gradient-to-b from-black/70 to-transparent">
          <div className="h-9 w-9 overflow-hidden rounded-full border border-white/30">
            {bucket.user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bucket.user.avatar}
                alt={bucket.user.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/15 text-xs font-semibold text-white">
                {bucket.user.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{bucket.user.displayName}</p>
            {posted && <p className="text-xs text-white/60">{posted}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stories"
            className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex h-full w-full items-center justify-center">
          {story.type === 'video' ? (
            <video
              ref={videoRef}
              key={story.id}
              src={story.mediaUrl}
              className="max-h-full max-w-full"
              autoPlay
              playsInline
              onEnded={goNext}
              onTimeUpdate={() => {
                const el = videoRef.current;
                if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
                setProgress((el.currentTime / el.duration) * 100);
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={story.id}
              src={story.mediaUrl}
              alt={`Story from ${bucket.user.displayName}`}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        {/* Tap zones: left third goes back, the rest advances. */}
        <button
          type="button"
          aria-label="Previous story"
          onClick={goPrev}
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          className="group absolute inset-y-0 left-0 z-10 w-1/3 cursor-default"
        >
          <ChevronLeft className="h-6 w-6 text-white/0 transition group-hover:text-white/50" />
        </button>
        <button
          type="button"
          aria-label="Next story"
          onClick={goNext}
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          className="group absolute inset-y-0 right-0 z-10 w-2/3 cursor-default"
        >
          <ChevronRight className="ml-auto h-6 w-6 text-white/0 transition group-hover:text-white/50" />
        </button>
      </div>
    </div>
  );
}
