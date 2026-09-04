'use client';

import { useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Plays a live stream. HLS (.m3u8) goes through hls.js where the browser
 * cannot play it natively (everything but Safari); anything else is handed
 * to the <video> element as-is, which covers a plain MP4 or WebM URL.
 */
interface LivePlayerProps {
  src: string | null | undefined;
  poster?: string | null;
  muted?: boolean;
  className?: string;
  /** Shown over the player while there is nothing to play yet. */
  waitingMessage?: string;
}

const isHlsUrl = (url: string) => /\.m3u8(\?|#|$)/i.test(url);

export function LivePlayer({ src, poster, muted = false, className, waitingMessage }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    setError(null);
    if (!video || !src) return;

    let cancelled = false;
    let hls: { destroy: () => void; startLoad: () => void } | null = null;

    if (!isHlsUrl(src) || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => {
        // Autoplay may be blocked until the viewer interacts; the controls handle that.
      });
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError('This browser cannot play live video.');
          return;
        }
        const instance = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3, enableWorker: true });
        hls = instance;
        instance.loadSource(src);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        instance.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean; type?: string }) => {
          if (!data?.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // The playlist may simply not exist yet (the host has not started
            // pushing); keep trying rather than giving up.
            setTimeout(() => instance.startLoad(), 3000);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            instance.recoverMediaError();
          } else {
            setError('The stream could not be played.');
          }
        });
      })
      .catch(() => setError('The video player could not be loaded.'));

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  return (
    <div className={cn('relative overflow-hidden bg-black', className)}>
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        muted={muted}
        poster={poster ?? undefined}
        className="h-full w-full"
        aria-label="Live stream"
      />
      {(!src || error) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center text-white">
          <Radio className={cn('h-8 w-8', !error && 'animate-pulse')} />
          <p className="text-sm">{error ?? waitingMessage ?? 'Waiting for the host to start streaming...'}</p>
        </div>
      )}
    </div>
  );
}

export default LivePlayer;
