'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Image, Video, Send, Loader2 } from 'lucide-react';
import { useAuthStore, useCreatePost } from '@/lib/hooks';
import { mediaApi } from '@/lib/api';

export default function CreatePostPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const createPost = useCreatePost();
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [postType, setPostType] = useState<'TEXT' | 'IMAGE' | 'VIDEO'>('TEXT');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setPostType(uploadType === 'video' ? 'VIDEO' : 'IMAGE');
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to upload media');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError('Please enter a post before publishing.');
      return;
    }

    try {
      await createPost.mutateAsync({
        content: content.trim(),
        isPublic,
        type: postType,
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
      });

      setContent('');
      setMediaUrls([]);
      setPostType('TEXT');
      router.push('/dashboard/community');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create post');
    }
  };

  if (!user) {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Post</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Please sign in to publish a post.
        </p>
        <Link href="/login" className="btn-primary mt-4 inline-flex">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Post</h1>
      <p className="mt-1 text-gray-500 dark:text-gray-400">Share an update with the community.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What’s on your mind?"
          className="w-full min-h-[160px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-outline inline-flex items-center gap-2"
            onClick={() => handlePickFile('image/*')}
            disabled={uploading}
          >
            <Image className="w-4 h-4" />
            Add image
          </button>
          <button
            type="button"
            className="btn-outline inline-flex items-center gap-2"
            onClick={() => handlePickFile('video/*')}
            disabled={uploading}
          >
            <Video className="w-4 h-4" />
            Add video
          </button>
          {uploading && (
            <span className="inline-flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
            </span>
          )}
        </div>

        {mediaUrls.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Attached: {postType === 'VIDEO' ? 'Video' : 'Image'}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4"
          />
          Post publicly
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="btn-primary inline-flex items-center gap-2"
            disabled={createPost.isPending || uploading}
          >
            {createPost.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Posting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Post
              </>
            )}
          </button>
          <button type="button" className="btn-outline" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
