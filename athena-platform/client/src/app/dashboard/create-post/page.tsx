'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { BarChart3, CalendarClock, EyeOff, Image, Loader2, MessageSquare, Plus, Send, Trash2, Trophy, Video, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useCreatePost } from '@/lib/hooks';
import { useScheduledPosts } from '@/lib/social-hooks';
import { mediaApi, postApi } from '@/lib/api';
import { serializeMentions, mentionsToPlainText, type MentionPick } from '@/lib/mentions';
import { MentionTextarea } from '@/components/community/MentionTextarea';
import { cn } from '@/lib/utils';

/**
 * The composer. An update, a win to celebrate, or a poll; with a photo or a
 * video; naming people with @; posted now or scheduled for a time you pick.
 */

type Kind = 'TEXT' | 'WIN' | 'POLL';

const KINDS: { value: Kind; label: string; icon: typeof MessageSquare; hint: string }[] = [
  { value: 'TEXT', label: 'Update', icon: MessageSquare, hint: 'Share what is on your mind.' },
  { value: 'WIN', label: 'Win', icon: Trophy, hint: 'Something worth celebrating. The community will cheer.' },
  { value: 'POLL', label: 'Poll', icon: BarChart3, hint: 'Ask the community. Two to four options.' },
];

const POLL_DURATIONS = [
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '1 week' },
];

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreatePostPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const createPost = useCreatePost();
  const scheduled = useScheduledPosts(Boolean(user));

  const [kind, setKind] = useState<Kind>('TEXT');
  const [content, setContent] = useState('');
  const [picks, setPicks] = useState<MentionPick[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaKind, setMediaKind] = useState<'IMAGE' | 'VIDEO' | null>(null);
  // Alt text for the attached image, for members who use a screen reader.
  const [mediaAlt, setMediaAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<string[]>(['', '']);
  const [durationHours, setDurationHours] = useState(24);

  const [scheduling, setScheduling] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const minSchedule = useMemo(() => toLocalInputValue(new Date(Date.now() + 10 * 60000)), []);

  const handlePickFile = (accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        setUploading(true);
        setError(null);
        const uploadType = file.type.startsWith('video/') ? 'video' : 'post';
        const res = await mediaApi.upload(uploadType, file);
        const url = res.data?.data?.url as string | undefined;
        if (url) {
          setMediaUrls([url]);
          setMediaKind(uploadType === 'video' ? 'VIDEO' : 'IMAGE');
        }
      } catch (err) {
        setError(errorMessage(err, 'Failed to upload media'));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const postType = kind === 'TEXT' ? mediaKind ?? 'TEXT' : kind;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError(kind === 'POLL' ? 'Ask your question first.' : 'Please enter a post before publishing.');
      return;
    }
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (kind === 'POLL' && cleanOptions.length < 2) {
      setError('A poll needs at least two options.');
      return;
    }
    if (scheduling && !scheduledFor) {
      setError('Pick a time to publish, or turn scheduling off.');
      return;
    }

    try {
      const response = await createPost.mutateAsync({
        content: serializeMentions(content.trim(), picks),
        isPublic,
        type: postType,
        mediaUrls: kind !== 'POLL' && mediaUrls.length ? mediaUrls : undefined,
        mediaAlt: kind !== 'POLL' && mediaUrls.length && mediaKind === 'IMAGE' && mediaAlt.trim() ? [mediaAlt.trim()] : undefined,
        poll: kind === 'POLL' ? { options: cleanOptions, durationHours } : undefined,
        scheduledFor: scheduling && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        isSensitive,
      });

      setContent('');
      setPicks([]);
      setMediaUrls([]);
      setMediaKind(null);
      setMediaAlt('');
      setOptions(['', '']);
      if (scheduling) {
        toast.success(`Scheduled for ${format(new Date(scheduledFor), 'd MMM, h:mm a')}`);
        setScheduledFor('');
        setScheduling(false);
        queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
        return;
      }
      const id = response.data?.data?.id as string | undefined;
      router.push(id ? `/posts/${id}` : '/dashboard/community');
    } catch (err) {
      setError(errorMessage(err, 'Failed to create post'));
    }
  };

  const removeScheduled = async (id: string) => {
    setDeleting(id);
    try {
      await postApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      toast.success('Scheduled post removed');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove it'));
    } finally {
      setDeleting(null);
    }
  };

  if (!user) {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Post</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Please sign in to publish a post.</p>
        <Link href="/login" className="btn-primary mt-4 inline-flex">
          Go to Login
        </Link>
      </div>
    );
  }

  const active = KINDS.find((k) => k.value === kind)!;
  const busy = createPost.isPending || uploading;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Post</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Share an update with the community.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kind of post">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={kind === option.value}
              onClick={() => setKind(option.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition',
                kind === option.value
                  ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <option.icon className="h-4 w-4" />
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{active.hint} Type @ to mention someone.</p>

        <MentionTextarea
          value={content}
          onChange={setContent}
          picks={picks}
          onPicksChange={setPicks}
          rows={kind === 'POLL' ? 3 : 6}
          maxLength={5000}
          placeholder={
            kind === 'POLL'
              ? 'What do you want to ask?'
              : kind === 'WIN'
                ? 'What happened? Say it proudly.'
                : 'What’s on your mind?'
          }
          className="w-full min-h-[120px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
        />
        {picks.length > 0 && (
          <p className="text-xs text-slate-500">
            Mentioning {picks.map((p) => p.name).join(', ')}. Preview: {mentionsToPlainText(serializeMentions(content, picks)).slice(0, 120)}
          </p>
        )}

        {kind === 'POLL' && (
          <div className="rounded-xl border border-slate-200 p-4 space-y-3 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Options</p>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={option}
                  onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))}
                  maxLength={80}
                  placeholder={`Option ${index + 1}`}
                  className="input flex-1 text-sm"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove option ${index + 1}`}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={options.length >= 4}
                onClick={() => setOptions((prev) => [...prev, ''])}
                className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 disabled:opacity-40 dark:text-rose-400"
              >
                <Plus className="h-4 w-4" /> Add option
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                Runs for
                <select value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="input text-sm">
                  {POLL_DURATIONS.map((d) => (
                    <option key={d.hours} value={d.hours}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {kind !== 'POLL' && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={() => handlePickFile('image/*')} disabled={uploading}>
              <Image className="w-4 h-4" />
              Add image
            </button>
            <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={() => handlePickFile('video/*')} disabled={uploading}>
              <Video className="w-4 h-4" />
              Add video
            </button>
            {uploading && (
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
              </span>
            )}
            {mediaUrls.length > 0 && (
              <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                Attached: {mediaKind === 'VIDEO' ? 'Video' : 'Image'}
                <button
                  type="button"
                  onClick={() => {
                    setMediaUrls([]);
                    setMediaKind(null);
                    setMediaAlt('');
                  }}
                  aria-label="Remove attachment"
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {mediaUrls.length > 0 && mediaKind === 'IMAGE' && (
              <label className="block w-full">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Describe the image (alt text)</span>
                <input
                  value={mediaAlt}
                  onChange={(e) => setMediaAlt(e.target.value)}
                  maxLength={300}
                  placeholder="What is in the picture, for members who use a screen reader"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4" />
            Post publicly
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={scheduling} onChange={(e) => setScheduling(e.target.checked)} className="h-4 w-4" />
            <CalendarClock className="h-4 w-4 text-slate-400" />
            Schedule for later
          </label>
          <label
            className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
            title="Blurred in the feed until a reader chooses to see it. For posts about harassment, loss, medical detail and the like."
          >
            <input type="checkbox" checked={isSensitive} onChange={(e) => setIsSensitive(e.target.checked)} className="h-4 w-4" />
            <EyeOff className="h-4 w-4 text-slate-400" />
            Sensitive content
          </label>
          {scheduling && (
            <input
              type="datetime-local"
              value={scheduledFor}
              min={minSchedule}
              onChange={(e) => setScheduledFor(e.target.value)}
              aria-label="Publish at"
              className="input text-sm"
            />
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-2 text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy}>
            {createPost.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {scheduling ? 'Scheduling...' : 'Posting...'}
              </>
            ) : (
              <>
                {scheduling ? <CalendarClock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {scheduling ? 'Schedule' : kind === 'POLL' ? 'Ask' : kind === 'WIN' ? 'Share the win' : 'Post'}
              </>
            )}
          </button>
          <button type="button" className="btn-outline" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>

      {scheduled.data && scheduled.data.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Scheduled</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {scheduled.data.map((post: { id: string; content: string; scheduledFor: string; type: string }) => (
              <li key={post.id} className="flex items-center gap-3 p-3 text-sm">
                <CalendarClock className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-slate-800 dark:text-slate-200">{mentionsToPlainText(post.content)}</p>
                  <p className="text-xs text-slate-500">
                    {post.type === 'POLL' ? 'Poll · ' : post.type === 'WIN' ? 'Win · ' : ''}
                    Publishes {format(new Date(post.scheduledFor), 'EEE d MMM, h:mm a')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeScheduled(post.id)}
                  disabled={deleting === post.id}
                  aria-label="Remove scheduled post"
                  className="p-1 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
