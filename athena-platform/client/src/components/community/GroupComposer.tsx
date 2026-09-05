'use client';

/**
 * Posting into a group: words with @ mentions and # topics, an optional
 * photo with alt text, and a sensitive-content flag. The post is a full post
 * from here on, with reactions, comments and the rest.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { EyeOff, Image as ImageIcon, Loader2, Send, X } from 'lucide-react';
import { mediaApi } from '@/lib/api';
import { useCreateGroupPost } from '@/lib/hooks';
import { serializeMentions, type MentionPick } from '@/lib/mentions';
import { MentionTextarea } from './MentionTextarea';

export function GroupComposer({ groupId, groupName }: { groupId: string; groupName: string }) {
  const createPost = useCreateGroupPost();
  const [content, setContent] = useState('');
  const [picks, setPicks] = useState<MentionPick[]>([]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaAlt, setMediaAlt] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const res = await mediaApi.upload('post', file);
        const url = res.data?.data?.url as string | undefined;
        if (!url) throw new Error('Upload returned no file');
        setMediaUrl(url);
      } catch (error) {
        toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not upload the photo');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const submit = () => {
    if (!content.trim() || createPost.isPending) return;
    createPost.mutate(
      {
        groupId,
        content: serializeMentions(content.trim(), picks),
        mediaUrls: mediaUrl ? [mediaUrl] : undefined,
        mediaAlt: mediaUrl && mediaAlt.trim() ? [mediaAlt.trim()] : undefined,
        isSensitive,
      },
      {
        onSuccess: () => {
          setContent('');
          setPicks([]);
          setMediaUrl(null);
          setMediaAlt('');
          setIsSensitive(false);
        },
      }
    );
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="font-medium text-slate-900 dark:text-white">Post to {groupName}</div>
      <MentionTextarea
        value={content}
        onChange={setContent}
        picks={picks}
        onPicksChange={setPicks}
        rows={3}
        maxLength={5000}
        placeholder="Share something with the group… @ to mention, # for a topic"
        onSubmitShortcut={submit}
        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      />
      {mediaUrl && (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- member upload */}
          <img src={mediaUrl} alt={mediaAlt || 'Attached photo'} className="h-20 w-20 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <input
              value={mediaAlt}
              onChange={(e) => setMediaAlt(e.target.value)}
              maxLength={300}
              placeholder="Describe the photo (alt text)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button type="button" onClick={() => setMediaUrl(null)} aria-label="Remove photo" className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={pickPhoto}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Photo
        </button>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" title="Blurred until a reader chooses to see it">
          <input type="checkbox" checked={isSensitive} onChange={(e) => setIsSensitive(e.target.checked)} className="h-3.5 w-3.5" />
          <EyeOff className="h-3.5 w-3.5 text-slate-400" /> Sensitive
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={createPost.isPending || uploading || !content.trim()}
          className="btn-primary ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {createPost.isPending ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}
