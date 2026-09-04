'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bookmark, FolderPlus, MoreHorizontal, Play } from 'lucide-react';
import { collectionApi, postApi } from '@/lib/api';
import { videoApi } from '@/lib/api-extensions';
import { useAuthStore } from '@/lib/hooks';
import PostCard from '@/components/community/PostCard';
import { useCollections } from '@/components/community/SaveToCollection';
import { cn } from '@/lib/utils';

/**
 * Everything the member has saved, in one place. Posts can be filed into
 * collections: the chips below the tabs switch between all of them, the
 * unsorted ones and each folder; a folder can be renamed or removed from its
 * chip, and a post moves between folders from its own menu.
 */

type Tab = 'posts' | 'reels';

type SavedVideo = {
  id: string;
  title?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  viewCount?: number;
  author?: { id: string; displayName?: string | null } | null;
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>('posts');
  // 'all', 'none' (unsorted) or a collection id.
  const [folder, setFolder] = useState<string>('all');
  const [folderMenu, setFolderMenu] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const ready = isAuthenticated && !authLoading;

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['saved-posts', folder],
    queryFn: () => (folder === 'all' ? postApi.getSaved() : postApi.getSavedIn(folder)),
    enabled: ready,
    select: (response) => (Array.isArray(response.data?.data) ? response.data.data : []),
  });

  const { data: folders } = useCollections(ready);

  const { data: reels = [], isLoading: reelsLoading } = useQuery({
    queryKey: ['saved-reels'],
    queryFn: () => videoApi.getBookmarked({ limit: 50 }),
    enabled: ready,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as SavedVideo[]) : []),
  });

  const loading = tab === 'posts' ? postsLoading : reelsLoading;
  const collections = folders?.collections ?? [];
  const totalSaved = (folders?.unsortedCount ?? 0) + collections.reduce((sum, c) => sum + c.count, 0);
  const current = collections.find((c) => c.id === folder);

  const refreshFolders = () => {
    queryClient.invalidateQueries({ queryKey: ['saved-collections'] });
    queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
  };

  const createFolder = async () => {
    const name = window.prompt('Name the new collection');
    if (!name?.trim()) return;
    try {
      const res = await collectionApi.create({ name: name.trim() });
      refreshFolders();
      setFolder(res.data?.data?.id ?? 'all');
      toast.success('Collection created');
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not create the collection');
    }
  };

  const renameFolder = async () => {
    if (!current) return;
    setFolderMenu(false);
    const name = window.prompt('Rename the collection', current.name);
    if (!name?.trim() || name.trim() === current.name) return;
    try {
      await collectionApi.update(current.id, { name: name.trim() });
      refreshFolders();
      toast.success('Collection renamed');
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not rename the collection');
    }
  };

  const deleteFolder = async () => {
    if (!current) return;
    setFolderMenu(false);
    if (!window.confirm(`Remove "${current.name}"? The posts in it stay saved, under Unsorted.`)) return;
    try {
      await collectionApi.remove(current.id);
      setFolder('all');
      refreshFolders();
      toast.success('Collection removed');
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not remove the collection');
    }
  };

  const chip = (value: string, label: string, count?: number) => (
    <button
      key={value}
      type="button"
      role="tab"
      aria-selected={folder === value}
      onClick={() => setFolder(value)}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition',
        folder === value
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      )}
    >
      {label}
      {typeof count === 'number' && <span className="ml-1 opacity-60">{count}</span>}
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary-600">
          <Bookmark className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Saved</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Things you kept</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Posts and reels you saved, newest first. Saved jobs have their own page.
        </p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Saved content">
        {(
          [
            { value: 'posts', label: 'Posts', count: totalSaved || posts.length },
            { value: 'reels', label: 'Reels', count: reels.length },
          ] as { value: Tab; label: string; count: number }[]
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              tab === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            {option.label}
            {ready && !loading && <span className="ml-1 opacity-70">{option.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'posts' && ready && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Collections">
          {chip('all', 'All', totalSaved)}
          {chip('none', 'Unsorted', folders?.unsortedCount)}
          {collections.map((collection) => chip(collection.id, collection.name, collection.count))}
          <button
            type="button"
            onClick={() => void createFolder()}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-400"
          >
            <FolderPlus className="h-3.5 w-3.5" /> New collection
          </button>
          {current && (
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setFolderMenu((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={folderMenu}
                aria-label={`Options for ${current.name}`}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {folderMenu && (
                <div role="menu" className="absolute right-0 z-10 mt-1 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <button type="button" role="menuitem" onClick={() => void renameFolder()} className="block w-full px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                    Rename
                  </button>
                  <button type="button" role="menuitem" onClick={() => void deleteFolder()} className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Remove collection
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!ready || loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-36 rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-36 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      ) : tab === 'posts' ? (
        posts.length === 0 ? (
          folder === 'all' ? (
            <EmptyState
              title="No saved posts yet"
              body="Use the bookmark on any post to keep it here."
              href="/feed"
              cta="Browse the feed"
            />
          ) : (
            <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nothing filed here yet. Open a saved post&apos;s menu and choose &ldquo;Move to collection&rdquo;.
            </div>
          )
        ) : (
          <div className="space-y-4">
            {posts.map((post: { id: string }) => (
              <PostCard key={post.id} post={post} source="saved" />
            ))}
          </div>
        )
      ) : reels.length === 0 ? (
        <EmptyState
          title="No saved reels yet"
          body="Tap the bookmark on a reel to keep it here."
          href="/explore"
          cta="Watch reels"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {reels.map((video) => (
            <Link key={video.id} href={`/explore?video=${video.id}`} className="reel-tile group">
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- media CDN, outside the image config
                <img src={video.thumbnailUrl} alt={video.title || 'Saved reel'} className="reel-tile-media" />
              ) : (
                <video src={video.videoUrl || undefined} muted playsInline preload="metadata" className="reel-tile-media" />
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white">
                <span className="line-clamp-2 pr-2">{video.title || video.description || 'Reel'}</span>
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" /> {video.viewCount ?? 0}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="card p-10 text-center">
      <Bookmark className="mx-auto h-8 w-8 text-slate-300" />
      <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
      <Link href={href} className="btn-primary mt-4 inline-flex px-4 py-2">
        {cta}
      </Link>
    </div>
  );
}
