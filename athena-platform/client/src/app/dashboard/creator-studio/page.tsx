'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Subtitles, Check, Copy, Loader2, Music, Sparkles, Tag, UploadCloud, Video, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mediaApi } from '@/lib/api';
import { soundApi, videoApi, type SoundSummary, type TrendingSound } from '@/lib/api-extensions';
import { cn } from '@/lib/utils';

/**
 * Publish a reel.
 *
 * Publishing is: capture a poster frame and the duration in the browser,
 * upload the file, create the Video row (which the server hands to its
 * processing pipeline), then follow the pipeline until the reel is live.
 * The pipeline probes the file, makes its own poster and a web rendition,
 * and registers the reel's original sound; the browser-side capture means
 * the reel has a poster and a length even before that finishes.
 *
 * A sound can be chosen from what is trending, handed in from a reel or the
 * sounds page as ?sound=<id>, or uploaded as an audio file.
 */

const VIDEO_TYPES = [
  { value: 'REEL', label: 'Reel' },
  { value: 'CAREER_STORY', label: 'Career story' },
  { value: 'MENTOR_TIP', label: 'Mentor tip' },
  { value: 'TUTORIAL', label: 'Tutorial' },
] as const;

type VideoType = (typeof VIDEO_TYPES)[number]['value'];
type Stage = 'idle' | 'preparing' | 'uploading' | 'publishing' | 'processing';

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const PROCESSING_POLL_MS = 2000;
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#+/, '').toLowerCase().trim())
        .filter((tag) => tag.length >= 2)
    )
  ).slice(0, 20);
}

interface CapturedMetadata {
  duration: number | null;
  width: number | null;
  height: number | null;
  poster: Blob | null;
}

/** Reads the length and dimensions and grabs a frame, all in the browser. */
function captureVideoMetadata(file: File): Promise<CapturedMetadata> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const finish = (result: CapturedMetadata) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ duration: null, width: null, height: null, poster: null }), 15000);

    video.onerror = () => {
      clearTimeout(timer);
      finish({ duration: null, width: null, height: null, poster: null });
    };
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      video.currentTime = Math.min(1, (duration ?? 2) / 2);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      const width = video.videoWidth || null;
      const height = video.videoHeight || null;
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      try {
        const scale = width && width > 720 ? 720 / width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round((width ?? 720) * scale);
        canvas.height = Math.round((height ?? 1280) * scale);
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish({ duration, width, height, poster: blob }), 'image/jpeg', 0.85);
      } catch {
        finish({ duration, width, height, poster: null });
      }
    };
    video.src = url;
  });
}

function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

function aspectRatioOf(width: number | null, height: number | null): string | undefined {
  if (!width || !height) return undefined;
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.02) return '9:16';
  if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(ratio - 1) < 0.02) return '1:1';
  if (Math.abs(ratio - 4 / 5) < 0.02) return '4:5';
  return `${width}:${height}`;
}

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (err as Error)?.message ||
  fallback;

function CreatorStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetSoundId = searchParams.get('sound')?.trim() || null;
  // ?duet=<id>: this reel answers another and is composed beside it.
  const duetId = searchParams.get('duet')?.trim() || null;
  const [duetOf, setDuetOf] = useState<{ id: string; title: string; author: string; thumbnailUrl: string | null; videoUrl: string } | null>(null);
  const [captionsFile, setCaptionsFile] = useState<File | null>(null);

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [type, setType] = useState<VideoType>('REEL');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [trending, setTrending] = useState<TrendingSound[]>([]);
  const [sound, setSound] = useState<SoundSummary | null>(null);
  const [soundBusy, setSoundBusy] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const parsedTags = parseTags(tags);
  const busy = stage !== 'idle';

  useEffect(() => {
    soundApi
      .trending({ limit: 8 })
      .then((r) => setTrending(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setTrending([]));
  }, []);

  useEffect(() => {
    if (!presetSoundId) return;
    soundApi
      .get(presetSoundId)
      .then((r) => {
        if (r.data?.data) setSound(r.data.data);
      })
      .catch(() => toast.error('That sound could not be found'));
  }, [presetSoundId]);

  useEffect(() => {
    if (!duetId) {
      setDuetOf(null);
      return;
    }
    videoApi
      .getVideo(duetId)
      .then((r) => {
        const v = r.data?.data;
        if (!v) throw new Error('missing');
        setDuetOf({
          id: v.id,
          title: v.title || v.description || 'a reel',
          author: v.author?.displayName || 'ATHENA member',
          thumbnailUrl: v.thumbnailUrl ?? null,
          videoUrl: v.videoUrl,
        });
        setTitle((current) => current || `Duet with ${v.author?.displayName || 'a member'}`);
      })
      .catch(() => toast.error('That reel could not be found'));
  }, [duetId]);

  const pick = (next: File | null) => {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.type.startsWith('video/')) {
      setError('Choose a video file.');
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError('That video is over 200 MB. Trim it or export at a lower bitrate.');
      return;
    }
    setFile(next);
  };

  const uploadOwnSound = async (audio: File | null) => {
    if (!audio) return;
    if (!audio.type.startsWith('audio/')) {
      toast.error('Choose an audio file (MP3, M4A, WAV or OGG).');
      return;
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      toast.error('That audio file is over 20 MB.');
      return;
    }
    setSoundBusy(true);
    try {
      const duration = await audioDuration(audio);
      const upload = await mediaApi.upload('audio', audio);
      const audioUrl = upload.data?.data?.url as string | undefined;
      if (!audioUrl) throw new Error('The upload returned no file.');
      const created = await soundApi.create({
        title: audio.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'My sound',
        audioUrl,
        duration: Math.max(1, Math.round(duration ?? 1)),
      });
      setSound(created.data?.data ?? null);
      toast.success('Sound added');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add that sound'));
    } finally {
      setSoundBusy(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const waitForProcessing = async (id: string) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < PROCESSING_TIMEOUT_MS) {
      const status = await videoApi.getProcessing(id).then((r) => r.data?.data).catch(() => null);
      if (status) {
        setProgress(Number(status.processingProgress) || 0);
        if (status.status !== 'PROCESSING') return status;
      }
      await new Promise((resolve) => setTimeout(resolve, PROCESSING_POLL_MS));
    }
    return null;
  };

  const publish = async () => {
    setError(null);
    if (!file) {
      setError('Add a video first.');
      return;
    }
    if (!title.trim()) {
      setError('Give it a title so people know what they are about to watch.');
      return;
    }

    try {
      setStage('preparing');
      const meta = await captureVideoMetadata(file);

      setStage('uploading');
      let thumbnailUrl: string | undefined;
      if (meta.poster) {
        const poster = new File([meta.poster], 'poster.jpg', { type: 'image/jpeg' });
        thumbnailUrl = await mediaApi
          .upload('thumbnail', poster)
          .then((r) => r.data?.data?.url as string | undefined)
          .catch(() => undefined);
      }
      const upload = await mediaApi.upload('video', file);
      const videoUrl = upload.data?.data?.url as string | undefined;
      if (!videoUrl) {
        throw new Error('The upload finished but returned no file.');
      }

      let captionsUrl: string | undefined;
      if (captionsFile) {
        captionsUrl = await mediaApi
          .upload('captions', captionsFile)
          .then((r) => r.data?.data?.url as string | undefined)
          .catch(() => {
            toast('The captions file could not be uploaded; publishing without it.', { icon: '⚠️' });
            return undefined;
          });
      }

      setStage('publishing');
      const created = await videoApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        videoUrl,
        thumbnailUrl,
        duration: meta.duration ? Math.max(1, Math.round(meta.duration)) : undefined,
        aspectRatio: aspectRatioOf(meta.width, meta.height),
        type,
        hashtags: parsedTags,
        audioTrackId: sound?.id,
        duetOfVideoId: duetOf?.id,
        captionsUrl,
      });
      const id = created.data?.data?.id as string | undefined;
      if (!id) throw new Error('The reel was not created.');

      setStage('processing');
      setProgress(5);
      const result = await waitForProcessing(id);
      if (result?.processingError) {
        toast('Published, though processing hit a snag: ' + result.processingError, { icon: '⚠️' });
      } else {
        toast.success('Your reel is live.');
      }
      router.push(`/explore?video=${id}`);
    } catch (err) {
      setError(errorMessage(err, 'Publishing failed. Try again.'));
      setStage('idle');
      setProgress(0);
    }
  };

  const stageLabel: Record<Stage, string> = {
    idle: 'Publish',
    preparing: 'Reading the video...',
    uploading: 'Uploading...',
    publishing: 'Publishing...',
    processing: `Processing ${progress}%`,
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Publish a reel</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ninety seconds of your week: a win, a lesson, the thing nobody told you.
          </p>
        </div>
        <Button className="gap-2" onClick={publish} disabled={busy || !file}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {stageLabel[stage]}
        </Button>
      </div>

      {stage === 'processing' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900 dark:text-white">Making your reel web-ready</span>
            <span className="text-slate-500">{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-rose-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Poster frame, a rendition every phone can play, and the reel&apos;s sound. You can leave this page; it
            publishes on its own.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {duetOf && (
            <div className="flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/50 dark:bg-purple-900/20">
              <div className="h-20 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-black">
                {duetOf.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media CDN
                  <img src={duetOf.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <video src={duetOf.videoUrl} muted className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-semibold text-purple-900 dark:text-purple-100">
                  <Copy className="h-4 w-4" /> Duet with {duetOf.author}
                </p>
                <p className="truncate text-xs text-purple-800/80 dark:text-purple-200/80">{duetOf.title}</p>
                <p className="mt-1 text-xs text-purple-800/80 dark:text-purple-200/80">
                  Record your reply. It will be composed beside the original, yours on the left, when you publish.
                </p>
              </div>
              <Link href="/dashboard/creator-studio" aria-label="Cancel the duet" className="p-1 text-purple-700 hover:text-purple-900 dark:text-purple-200">
                <X className="h-4 w-4" />
              </Link>
            </div>
          )}
          <label
            className={cn(
              'block cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition',
              file
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-slate-200 hover:border-rose-300 dark:border-slate-700'
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <UploadCloud className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {file ? file.name : 'Drag a video here, or click to choose one'}
            </p>
            <p className="mt-1 text-xs text-slate-400">MP4, MOV or WebM up to 200 MB. Portrait works best.</p>
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="space-y-3">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="E.g. Negotiating your offer with confidence"
            />
            <div>
              <label htmlFor="reel-description" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Caption
              </label>
              <textarea
                id="reel-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="What happens in it, and what you want people to take away. #tags in here count too."
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Sound */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Music className="w-4 h-4" /> Sound
              </h2>
              <Link href="/sounds" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                Browse all
              </Link>
            </div>
            {sound ? (
              <div className="flex items-center gap-3 rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-900/20">
                <Check className="w-4 h-4 text-rose-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{sound.title}</p>
                  <p className="truncate text-xs text-slate-500">{sound.artist || (sound.isOriginal ? 'Original sound' : 'Uploaded sound')}</p>
                </div>
                <audio src={sound.audioUrl} controls preload="none" className="h-8 w-40" />
                <button
                  type="button"
                  onClick={() => setSound(null)}
                  aria-label="Remove sound"
                  className="p-1 text-slate-500 hover:text-slate-700"
                  disabled={busy}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Leave this empty and the reel&apos;s own audio becomes its sound, which others can then use.
              </p>
            )}
            {trending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {trending.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSound(option)}
                    disabled={busy}
                    className={cn(
                      'max-w-full truncate rounded-full border px-3 py-1 text-xs transition',
                      sound?.id === option.id
                        ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    {option.title}
                  </button>
                ))}
              </div>
            )}
            <div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="sr-only"
                id="own-sound"
                disabled={busy || soundBusy}
                onChange={(e) => void uploadOwnSound(e.target.files?.[0] ?? null)}
              />
              <label
                htmlFor="own-sound"
                className={cn('btn-outline inline-flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs', (busy || soundBusy) && 'opacity-60')}
              >
                {soundBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                Upload your own sound
              </label>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 bg-white dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Details</h2>
            <Input
              label="Tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="interviews, salary, leadership"
              icon={<Tag className="w-4 h-4 text-slate-400" />}
            />
            {parsedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parsedTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div>
              <label htmlFor="reel-type" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Kind
              </label>
              <select
                id="reel-type"
                value={type}
                onChange={(e) => setType(e.target.value as VideoType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {VIDEO_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reel-captions" className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Subtitles className="h-4 w-4" /> Subtitles (optional)
              </label>
              <input
                id="reel-captions"
                type="file"
                accept=".vtt,text/vtt"
                disabled={busy}
                onChange={(e) => setCaptionsFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-slate-700 dark:file:bg-slate-800 dark:file:text-slate-200"
              />
              <p className="mt-1 text-xs text-slate-400">
                A WebVTT file. Viewers can turn captions on and off in the player.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Before you publish</p>
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <li className={title.trim() ? 'text-emerald-600 dark:text-emerald-400' : ''}>• A clear, short title</li>
                <li className={parsedTags.length >= 2 ? 'text-emerald-600 dark:text-emerald-400' : ''}>• Two or three tags</li>
                <li className={description.trim() ? 'text-emerald-600 dark:text-emerald-400' : ''}>• A caption</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Preview</h2>
            <div className="aspect-[9/16] max-h-80 mx-auto overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              {previewUrl ? (
                <video src={previewUrl} controls playsInline className="h-full w-full object-contain bg-black" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm">
                  <Video className="h-6 w-6" />
                  Choose a video to preview it
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Published reels appear in{' '}
              <Link href="/explore" className="font-medium text-rose-600 dark:text-rose-400">
                Reels
              </Link>{' '}
              and on your profile as soon as processing finishes, usually within a minute.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary above it.
export default function CreatorStudioPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-6 text-slate-500">Loading...</div>}>
      <CreatorStudioContent />
    </Suspense>
  );
}
