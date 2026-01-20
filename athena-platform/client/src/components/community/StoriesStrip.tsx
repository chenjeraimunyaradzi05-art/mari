'use client';

import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, useStatusFeed, useCreateStatus } from '@/lib/hooks';
import { mediaApi } from '@/lib/api';

type Story = {
  id: string;
  userId: string;
  type: 'image' | 'video';
  mediaUrl: string;
  createdAt: string;
  expiresAt: string;
};

type StoryBucket = {
  user: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  stories: Story[];
};

export default function StoriesStrip() {
  const { user } = useAuthStore();
  const { data, isLoading, isError } = useStatusFeed();
  const createStatus = useCreateStatus();
  const [uploading, setUploading] = useState(false);

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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-900">Status</div>
        {user && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading || createStatus.isPending}
              onClick={() => handleAddStory('image/*')}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Add photo
            </button>
            <button
              type="button"
              disabled={uploading || createStatus.isPending}
              onClick={() => handleAddStory('video/*')}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Add video
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <div className="text-sm text-gray-500">Failed to load status.</div>
      ) : buckets.length === 0 ? (
        <div className="text-sm text-gray-500">No status updates yet.</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {buckets.map((b) => (
            <button
              key={b.user.id}
              type="button"
              title={b.user.displayName}
              className="flex flex-col items-center gap-2 min-w-[64px]"
              onClick={() => {
                // Phase 1 MVP: no full-screen viewer yet; keep UX minimal.
                const first = b.stories?.[0];
                if (!first) return;
                window.open(first.mediaUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              <div
                className={cn(
                  'w-14 h-14 rounded-full border-2 flex items-center justify-center overflow-hidden',
                  'border-primary-500'
                )}
              >
                {b.user.avatar ? (
                  <img src={b.user.avatar} alt={b.user.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm font-semibold">
                    {b.user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-600 line-clamp-1 max-w-[64px]">
                {b.user.displayName}
              </div>
            </button>
          ))}
        </div>
      )}

      {user && uploading && (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading story…
        </div>
      )}
    </div>
  );
}
