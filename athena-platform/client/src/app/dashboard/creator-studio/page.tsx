'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Tag, UploadCloud, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mediaApi } from '@/lib/api';
import { videoApi } from '@/lib/api-extensions';
import { cn } from '@/lib/utils';

/**
 * Publish a reel.
 *
 * This page had a file picker, a title, a rich-text editor and a Publish
 * button that did nothing at all: no upload, no request, no message. It was
 * the only "upload" entry point linked from the creator dashboard, the videos
 * page and the reels rail, so nobody could put a reel on the platform.
 *
 * Publishing is two calls: the file goes to the media store, and the returned
 * URL becomes a Video row. The description is plain text because that is what
 * the Video model holds and what the player shows; HTML from an editor would
 * have been rendered as tags.
 */

const VIDEO_TYPES = [
  { value: 'REEL', label: 'Reel' },
  { value: 'CAREER_STORY', label: 'Career story' },
  { value: 'MENTOR_TIP', label: 'Mentor tip' },
  { value: 'TUTORIAL', label: 'Tutorial' },
] as const;

type VideoType = (typeof VIDEO_TYPES)[number]['value'];

const MAX_FILE_BYTES = 200 * 1024 * 1024;

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

export default function CreatorStudioPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [type, setType] = useState<VideoType>('REEL');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'publishing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const parsedTags = parseTags(tags);
  const busy = stage !== 'idle';

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
      setStage('uploading');
      const upload = await mediaApi.upload('video', file);
      const videoUrl = upload.data?.data?.url as string | undefined;
      if (!videoUrl) {
        throw new Error('The upload finished but returned no file.');
      }

      setStage('publishing');
      const created = await videoApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        videoUrl,
        type,
        hashtags: parsedTags,
      });

      const id = created.data?.data?.id as string | undefined;
      toast.success('Your reel is live.');
      router.push(id ? `/explore?video=${id}` : '/explore');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Publishing failed. Try again.';
      setError(message);
      setStage('idle');
    }
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
          {stage === 'uploading' ? 'Uploading...' : stage === 'publishing' ? 'Publishing...' : 'Publish'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
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
              and on your profile straight away.
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
