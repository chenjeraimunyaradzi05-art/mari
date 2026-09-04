'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Music, Play, Sparkles, TrendingUp } from 'lucide-react';
import { soundApi, type TrendingSound } from '@/lib/api-extensions';
import { cn } from '@/lib/utils';

/**
 * Trending sounds: the audio reels are being made with this week. Each row
 * plays a preview, opens every reel using the sound, and hands the sound to
 * the creator studio.
 */

type Period = 'day' | 'week' | 'month' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SoundsPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [sounds, setSounds] = useState<TrendingSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    soundApi
      .trending({ period, limit: 30 })
      .then((response) => {
        if (cancelled) return;
        setSounds(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  // One preview at a time: starting a sound stops the one before it.
  useEffect(() => {
    const audios = document.querySelectorAll<HTMLAudioElement>('audio[data-sound]');
    audios.forEach((audio) => {
      if (audio.dataset.sound !== playing) audio.pause();
    });
  }, [playing]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
        <Music className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Sounds</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">What reels are being made with</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Ranked by how many reels used each sound. Tap a sound to hear it, see every reel that uses it, or make
        your own with it.
      </p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Period">
        {PERIODS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={period === option.value}
            onClick={() => setPeriod(option.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              period === option.value
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 space-y-3 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : failed ? (
        <p className="mt-6 text-sm text-slate-500">Sounds could not be loaded right now.</p>
      ) : sounds.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-slate-600 dark:text-slate-300">No sounds yet. Publish a reel and its audio becomes the first.</p>
          <Link href="/dashboard/creator-studio" className="btn-primary mt-4 inline-flex px-4 py-2">
            Publish a reel
          </Link>
        </div>
      ) : (
        <ol className="mt-6 space-y-3">
          {sounds.map((sound, index) => (
            <li
              key={sound.id}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="w-6 text-center text-sm font-semibold text-slate-400">{index + 1}</span>
              <button
                type="button"
                onClick={() => setPlaying((current) => (current === sound.id ? null : sound.id))}
                aria-label={playing === sound.id ? `Pause ${sound.title}` : `Play ${sound.title}`}
                className={cn(
                  'flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg',
                  sound.coverUrl ? 'bg-black' : 'bg-gradient-to-br from-rose-500 to-purple-600 text-white'
                )}
              >
                {sound.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media CDN
                  <img src={sound.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Music className="h-6 w-6" />
                )}
              </button>
              <audio
                data-sound={sound.id}
                src={sound.audioUrl}
                preload="none"
                ref={(el) => {
                  if (!el) return;
                  if (playing === sound.id && el.paused) el.play().catch(() => setPlaying(null));
                }}
                onEnded={() => setPlaying((current) => (current === sound.id ? null : current))}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{sound.title}</p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {sound.artist || (sound.isOriginal ? 'Original sound' : 'Uploaded sound')} · {formatDuration(sound.duration)}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <TrendingUp className="h-3 w-3" />
                  {sound.videoCount} {sound.videoCount === 1 ? 'reel' : 'reels'}
                </p>
              </div>
              <div className="hidden sm:flex -space-x-2">
                {sound.recentVideos.slice(0, 3).map((video) => (
                  <Link key={video.id} href={`/explore?video=${video.id}`} className="block h-12 w-8 overflow-hidden rounded border-2 border-white bg-slate-200 dark:border-slate-900 dark:bg-slate-800">
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media CDN
                      <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href={`/explore?sound=${encodeURIComponent(sound.id)}`}
                  className="btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-sm"
                >
                  <Play className="h-3.5 w-3.5" /> Reels
                </Link>
                <Link
                  href={`/dashboard/creator-studio?sound=${encodeURIComponent(sound.id)}`}
                  className="btn-primary inline-flex items-center px-3 py-1.5 text-sm"
                >
                  Use
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
