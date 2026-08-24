'use client';

import { useState } from 'react';
import { ImagePlus, Loader2, Video as VideoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, useStatusFeed, useCreateStatus } from '@/lib/hooks';
import { mediaApi } from '@/lib/api';
import { StoryViewer, type StoryBucket } from './StoryViewer';

export default function StoriesStrip() {
  const { user } = useAuthStore();
  const { data, isLoading, isError } = useStatusFeed();
  const createStatus = useCreateStatus();
  const [uploading, setUploading] = useState(false);
  const [openAt, setOpenAt] = useState<number | null>(null);

  const buckets: StoryBucket[] = Array.isArray(data) ? data : [];

  const handleAddStory = async (accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        setUploading(true);
        const uploadType = file.type.startsWith('video/') ? 'video' : 'post';
        const res = await mediaApi.upload(uploadType, file);
        const url = res.data?.data?.url as string | undefined;
        if (!url) return;

        createStatus.mutate({
          type: uploadType === 'video' ? 'video' : 'image',
          mediaUrl: url,
        });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const busy = uploading || createStatus.isPending;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Stories</h2>
        {user && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAddStory('image/*')}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAddStory('video/*')}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <VideoIcon className="h-3.5 w-3.5" />
              Video
            </button>
          </div>
        )}
      </div>

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
          {buckets.map((bucket, index) => (
            <button
              key={bucket.user.id}
              type="button"
              title={bucket.user.displayName}
              onClick={() => setOpenAt(index)}
              className="flex min-w-[68px] flex-col items-center gap-2"
            >
              {/* Gradient ring is the Instagram affordance for "there is something to watch". */}
              <span className="story-ring">
                <span className="block rounded-full border-2 border-white dark:border-slate-800">
                  <span className="block h-14 w-14 overflow-hidden rounded-full">
                    {bucket.user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bucket.user.avatar}
                        alt={bucket.user.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className={cn(
                          'flex h-full w-full items-center justify-center text-sm font-semibold',
                          'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        )}
                      >
                        {bucket.user.displayName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
              </span>
              <span className="line-clamp-1 max-w-[68px] text-xs text-slate-600 dark:text-slate-400">
                {bucket.user.displayName}
              </span>
            </button>
          ))}
        </div>
      )}

      {user && busy && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading story...
        </p>
      )}

      {openAt !== null && (
        <StoryViewer buckets={buckets} initialBucket={openAt} onClose={() => setOpenAt(null)} />
      )}
    </div>
  );
}
