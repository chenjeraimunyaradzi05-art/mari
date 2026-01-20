'use client';

import React, { useState } from 'react';
import { useAuthStore, useCreatePost } from '@/lib/hooks';
import { mediaApi } from '@/lib/api';
import { Image, Video, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

export default function CreatePostWidget() {
  const { user } = useAuthStore();
  const createPost = useCreatePost();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [postType, setPostType] = useState<'TEXT' | 'IMAGE' | 'VIDEO'>('TEXT');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createPost.mutate(
      { content, type: postType, mediaUrls, isPublic: true },
      {
        onSuccess: () => {
          setContent('');
          setIsExpanded(false);
          setMediaUrls([]);
          setPostType('TEXT');
        },
      }
    );
  };

  const handlePickFile = (accept: string) => {
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
        if (url) {
          setMediaUrls([url]);
          setPostType(uploadType === 'video' ? 'VIDEO' : 'IMAGE');
        }
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  if (!user) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {/* Avatar */}
          <Avatar
            src={user.avatar || undefined}
            alt={user.firstName}
            fallback={`${user.firstName[0]}${user.lastName[0]}`}
            className="w-10 h-10"
          />
        </div>
        <div className="flex-1">
          {!isExpanded ? (
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 rounded-full px-4 py-2.5 transition-colors"
            >
              Start a post...
            </button>
          ) : (
            <form onSubmit={handleSubmit}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you want to talk about?"
                rows={4}
                className="w-full border-none focus:ring-0 resize-none p-0 text-gray-900 placeholder-gray-500 text-base"
                autoFocus
              />
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    title="Add Image"
                    onClick={() => handlePickFile('image/*')}
                  >
                    <Image size={20} />
                  </button>
                    <button
                    type="button"
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    title="Add Video"
                    onClick={() => handlePickFile('video/*')}
                  >
                    <Video size={20} />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(false)}
                        className="px-4 py-1.5 text-gray-600 font-medium hover:bg-gray-100 rounded-full"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!content.trim() || createPost.isPending || uploading}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Send size={16} />
                        {uploading ? 'Uploading…' : 'Post'}
                    </button>
                </div>
              </div>

              {mediaUrls.length > 0 && (
                <div className="mt-3 text-xs text-gray-500">
                  Attached: {postType === 'VIDEO' ? 'Video' : 'Image'}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
