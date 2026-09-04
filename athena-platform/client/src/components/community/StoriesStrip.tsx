'use client';

import { useState } from 'react';
import { Eye, ImagePlus, Loader2, Video as VideoIcon, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuthStore, useStatusFeed, useCreateStatus } from '@/lib/hooks';
import { mediaApi, statusApi } from '@/lib/api';
import { StoryViewer, type Story, type StoryBucket } from './StoryViewer';

/**
 * The stories rail. A gradient ring means there is something you have not
 * watched; a grey ring means you have seen it all. Your own bucket leads.
 * Adding a story takes a photo or clip and an optional caption; watching one
 * tells the server so the author sees the count.
 */

type Draft = { file: File; kind: 'image' | 'video'; previewUrl: string };

export default function StoriesStrip() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useStatusFeed();
  const createStatus = useCreateStatus();
  const [uploading, setUploading] = useState(false);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [caption, setCaption] = useState('');
  const [viewers, setViewers] = useState<{ story: Story; list: Array<{ id: string; displayName: string; avatar: string | null }> } | null>(null);

  const buckets: StoryBucket[] = Array.isArray(data) ? data : [];

  const pickFile = (accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const kind = file.type.startsWith('video/') ? 'video' : 'image';
      setDraft({ file, kind, previewUrl: URL.createObjectURL(file) });
      setCaption('');
    };
    input.click();
  };

  const publish = async () => {
    if (!draft) return;
    try {
      setUploading(true);
      const res = await mediaApi.upload(draft.kind === 'video' ? 'video' : 'post', draft.file);
      const url = res.data?.data?.url as string | undefined;
      if (!url) throw new Error('Upload returned no file');
      await createStatus.mutateAsync({ type: draft.kind, mediaUrl: url, caption: caption.trim() || undefined });
      URL.revokeObjectURL(draft.previewUrl);
      setDraft(null);
      setCaption('');
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not post the story');
    } finally {
      setUploading(false);
    }
  };

  const markViewed = (story: Story) => {
    statusApi
      .view(story.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['status', 'feed'] }))
      .catch(() => {});
  };

  const showViewers = async (story: Story) => {
    try {
      const res = await statusApi.viewers(story.id);
      setViewers({ story, list: Array.isArray(res.data?.data?.viewers) ? res.data.data.viewers : [] });
    } catch {
      toast.error('Could not load who watched');
    }
  };

  const deleteStory = async (story: Story) => {
    if (!window.confirm('Delete this story?')) return;
    try {
      await statusApi.delete(story.id);
      setOpenAt(null);
      queryClient.invalidateQueries({ queryKey: ['status', 'feed'] });
      toast.success('Story deleted');
    } catch {
      toast.error('Could not delete the story');
    }
  };

  const busy = uploading || createStatus.isPending;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Stories</h2>
        {user && !draft && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => pickFile('image/*')}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => pickFile('video/*')}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <VideoIcon className="h-3.5 w-3.5" />
              Video
            </button>
          </div>
        )}
      </div>

      {draft && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-600">
          <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-black">
            {draft.kind === 'video' ? (
              <video src={draft.previewUrl} className="h-full w-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.previewUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            placeholder="Add a caption (optional)"
            className="input flex-1 text-sm"
            disabled={busy}
          />
          <button type="button" onClick={() => void publish()} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Share'}
          </button>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(draft.previewUrl);
              setDraft(null);
            }}
            disabled={busy}
            aria-label="Discard"
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : isError ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Stories could not be loaded.</p>
      ) : buckets.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {user ? 'No stories yet — add the first one.' : 'No stories in the last 24 hours.'}
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {buckets.map((bucket, index) => {
            const own = bucket.user.id === user?.id;
            const unseen = bucket.hasUnseen ?? true;
            return (
              <button
                key={bucket.user.id}
                type="button"
                title={own ? 'Your story' : bucket.user.displayName}
                onClick={() => setOpenAt(index)}
                className="flex min-w-[68px] flex-col items-center gap-2"
              >
                {/* Gradient ring: something to watch. Grey: all seen. */}
                <span className={cn(unseen ? 'story-ring' : 'rounded-full bg-slate-300 p-[2px] dark:bg-slate-600')}>
                  <span className="block rounded-full border-2 border-white dark:border-slate-800">
                    <span className="block h-14 w-14 overflow-hidden rounded-full">
                      {bucket.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bucket.user.avatar} alt={bucket.user.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {bucket.user.displayName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </span>
                </span>
                <span className="line-clamp-1 max-w-[68px] text-xs text-slate-600 dark:text-slate-400">
                  {own ? 'Your story' : bucket.user.displayName}
                </span>
                {own && (
                  <span className="-mt-1 inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                    <Eye className="h-3 w-3" /> {bucket.stories.reduce((sum, s) => sum + (s.viewCount ?? 0), 0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {openAt !== null && (
        <StoryViewer
          buckets={buckets}
          initialBucket={openAt}
          currentUserId={user?.id}
          onClose={() => setOpenAt(null)}
          onView={markViewed}
          onViewers={(story) => void showViewers(story)}
          onDelete={(story) => void deleteStory(story)}
        />
      )}

      {viewers && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-label="Who watched">
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 dark:bg-slate-900 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {viewers.list.length} {viewers.list.length === 1 ? 'person' : 'people'} watched
              </h3>
              <button type="button" onClick={() => setViewers(null)} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {viewers.list.length === 0 && <li className="text-sm text-slate-500">Nobody yet.</li>}
              {viewers.list.map((viewer) => (
                <li key={viewer.id} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                  {viewer.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={viewer.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold dark:bg-slate-700">
                      {viewer.displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {viewer.displayName}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
