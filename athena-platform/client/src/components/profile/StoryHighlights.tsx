'use client';

/**
 * Story highlights on a profile: the stories a member chose to keep. A row of
 * covers under the header; tapping one plays it in the story viewer. The
 * owner can make a highlight from any past story, add to one from the story
 * viewer, and edit or remove them.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { highlightApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { StoryViewer, type Story, type StoryBucket } from '@/components/community/StoryViewer';

export type HighlightItem = {
  id: string;
  statusId: string | null;
  userId: string;
  type: 'image' | 'video';
  mediaUrl: string;
  caption?: string | null;
  createdAt: string;
  position: number;
};

export type Highlight = {
  id: string;
  userId: string;
  title: string;
  coverUrl: string | null;
  itemCount: number;
  updatedAt: string;
  items: HighlightItem[];
};

type ArchivedStory = Story & { expired: boolean; viewCount?: number };

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export function useHighlights(userId?: string) {
  return useQuery({
    queryKey: ['story-highlights', userId],
    queryFn: () => highlightApi.forUser(userId!),
    enabled: Boolean(userId),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Highlight[]) : []),
  });
}

function useArchive(enabled: boolean) {
  return useQuery({
    queryKey: ['story-archive'],
    queryFn: highlightApi.archive,
    enabled,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as ArchivedStory[]) : []),
  });
}

function Cover({ url, type, size = 'md' }: { url: string | null; type?: 'image' | 'video'; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-12 w-12' : 'h-16 w-16';
  if (!url) {
    return (
      <div className={cn(dims, 'flex items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800')}>
        <Sparkles className="h-5 w-5" />
      </div>
    );
  }
  return type === 'video' ? (
    <video src={url} muted playsInline preload="metadata" className={cn(dims, 'rounded-full object-cover')} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cn(dims, 'rounded-full object-cover')} />
  );
}

/** Pick from your past stories. Used when creating and when adding. */
function ArchivePicker({
  selected,
  onToggle,
  exclude = [],
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  exclude?: Array<string | null>;
}) {
  const { data: archive = [], isLoading } = useArchive(true);
  const choices = archive.filter((story) => !exclude.includes(story.id));

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (choices.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No stories to add. Post a story first and it will appear here.</p>;
  }
  return (
    <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto" role="group" aria-label="Your stories">
      {choices.map((story) => {
        const on = selected.has(story.id);
        return (
          <button
            key={story.id}
            type="button"
            onClick={() => onToggle(story.id)}
            aria-pressed={on}
            className={cn(
              'relative aspect-[9/16] overflow-hidden rounded-lg border-2 bg-black',
              on ? 'border-rose-500' : 'border-transparent'
            )}
          >
            {story.type === 'video' ? (
              <video src={story.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.mediaUrl} alt={story.caption || ''} className="h-full w-full object-cover" />
            )}
            {on && (
              <span className="absolute right-1 top-1 rounded-full bg-rose-500 p-0.5 text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
            {story.expired && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">past</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Create a highlight, or edit one: rename, add stories, remove stories, delete. */
export function HighlightEditor({
  open,
  onClose,
  highlight,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  highlight?: Highlight | null;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(highlight?.title ?? '');
      setSelected(new Set());
    }
  }, [open, highlight]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['story-highlights', userId] });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    const name = title.trim();
    if (!name) {
      toast.error('Give the highlight a name');
      return;
    }
    setBusy(true);
    try {
      if (highlight) {
        if (name !== highlight.title) await highlightApi.update(highlight.id, { title: name });
        for (const statusId of selected) await highlightApi.addItem(highlight.id, statusId);
        toast.success('Highlight updated');
      } else {
        if (selected.size === 0) {
          toast.error('Pick at least one story');
          return;
        }
        await highlightApi.create({ title: name, statusIds: Array.from(selected) });
        toast.success('Highlight added to your profile');
      }
      refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not save the highlight');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (item: HighlightItem) => {
    if (!highlight) return;
    try {
      await highlightApi.removeItem(highlight.id, item.id);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not remove the story');
    }
  };

  const remove = async () => {
    if (!highlight || !window.confirm(`Remove the "${highlight.title}" highlight? The stories themselves are kept.`)) return;
    setBusy(true);
    try {
      await highlightApi.remove(highlight.id);
      toast.success('Highlight removed');
      refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not remove the highlight');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={() => !busy && onClose()} title={highlight ? 'Edit highlight' : 'New highlight'} size="md">
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Name</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={30}
            placeholder="Launch week, Behind the scenes..."
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        {highlight && highlight.items.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">In this highlight</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {highlight.items.map((item) => (
                <div key={item.id} className="relative flex-shrink-0">
                  <Cover url={item.mediaUrl} type={item.type} size="sm" />
                  <button
                    type="button"
                    onClick={() => void removeItem(item)}
                    aria-label="Remove from highlight"
                    className="absolute -right-1 -top-1 rounded-full bg-slate-900 p-0.5 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">{highlight ? 'Add stories' : 'Choose stories'}</p>
          <ArchivePicker selected={selected} onToggle={toggle} exclude={highlight?.items.map((i) => i.statusId) ?? []} />
        </div>

        <div className="flex items-center justify-between gap-2">
          {highlight ? (
            <button type="button" onClick={() => void remove()} disabled={busy} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
              <Trash2 className="h-3.5 w-3.5" /> Remove highlight
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="btn-outline px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={busy} className="btn-primary px-3 py-1.5 text-sm">
              {busy ? 'Saving...' : highlight ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** From the story viewer: put one of your stories into a highlight. */
export function AddToHighlightDialog({ story, open, onClose }: { story: Story | null; open: boolean; onClose: () => void }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: highlights = [], isLoading } = useHighlights(open ? user?.id : undefined);
  const [newTitle, setNewTitle] = useState('');

  const add = useMutation({
    mutationFn: async (target: { highlightId?: string; title?: string }) => {
      if (!story) throw new Error('No story');
      if (target.highlightId) return highlightApi.addItem(target.highlightId, story.id);
      return highlightApi.create({ title: target.title!, statusIds: [story.id] });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['story-highlights', user?.id] });
      toast.success(res.data?.message || 'Added to highlight');
      setNewTitle('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not add to the highlight'),
  });

  return (
    <Modal isOpen={open} onClose={() => !add.isPending && onClose()} title="Add to highlight" size="sm">
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-3">
          {highlights.length > 0 && (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {highlights.map((highlight) => (
                <li key={highlight.id}>
                  <button
                    type="button"
                    disabled={add.isPending}
                    onClick={() => add.mutate({ highlightId: highlight.id })}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Cover url={highlight.coverUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{highlight.title}</span>
                      <span className="text-xs text-slate-500">{highlight.itemCount} {highlight.itemCount === 1 ? 'story' : 'stories'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (newTitle.trim()) add.mutate({ title: newTitle.trim() });
            }}
            className={cn('flex items-center gap-2', highlights.length > 0 && 'border-t border-slate-200 pt-3 dark:border-slate-700')}
          >
            <Plus className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              maxLength={30}
              placeholder="New highlight"
              aria-label="New highlight name"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button type="submit" disabled={add.isPending || !newTitle.trim()} className="btn-primary px-3 py-1.5 text-xs">
              Create
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}

export function StoryHighlights({
  userId,
  isOwn,
  displayName,
  avatar,
  className,
}: {
  userId: string;
  isOwn: boolean;
  displayName: string;
  avatar: string | null;
  className?: string;
}) {
  const { data: highlights = [], isLoading } = useHighlights(userId);
  const [playing, setPlaying] = useState<Highlight | null>(null);
  const [editing, setEditing] = useState<Highlight | null | undefined>(undefined);

  if (isLoading || (highlights.length === 0 && !isOwn)) return null;

  const bucket: StoryBucket | null = playing
    ? {
        user: { id: userId, displayName, avatar },
        stories: playing.items.map((item) => ({
          id: item.id,
          userId: item.userId,
          type: item.type,
          mediaUrl: item.mediaUrl,
          caption: item.caption,
          createdAt: item.createdAt,
        })),
      }
    : null;

  return (
    <section className={cn('card', className)} aria-label="Story highlights">
      <div className="flex gap-4 overflow-x-auto pb-1">
        {isOwn && (
          <button type="button" onClick={() => setEditing(null)} className="flex w-16 flex-shrink-0 flex-col items-center gap-1.5">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-rose-400 hover:text-rose-500 dark:border-slate-600">
              <Plus className="h-6 w-6" />
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">New</span>
          </button>
        )}
        {highlights.map((highlight) => (
          <div key={highlight.id} className="group relative flex w-16 flex-shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPlaying(highlight)}
              aria-label={`Play highlight ${highlight.title}`}
              className="rounded-full ring-2 ring-slate-200 ring-offset-2 transition hover:ring-rose-400 dark:ring-slate-700 dark:ring-offset-slate-900"
            >
              <Cover url={highlight.coverUrl} />
            </button>
            <span className="w-full truncate text-center text-xs font-medium text-slate-700 dark:text-slate-200">{highlight.title}</span>
            {isOwn && (
              <button
                type="button"
                onClick={() => setEditing(highlight)}
                aria-label={`Edit highlight ${highlight.title}`}
                className="absolute -right-1 top-0 rounded-full bg-white p-1 text-slate-500 shadow opacity-0 transition group-hover:opacity-100 focus:opacity-100 dark:bg-slate-800"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {isOwn && highlights.length === 0 && (
          <p className="self-center text-sm text-slate-500 dark:text-slate-400">Keep your best stories on your profile.</p>
        )}
      </div>

      {bucket && <StoryViewer buckets={[bucket]} initialBucket={0} onClose={() => setPlaying(null)} />}

      {isOwn && editing !== undefined && (
        <HighlightEditor open onClose={() => setEditing(undefined)} highlight={editing} userId={userId} />
      )}
    </section>
  );
}
