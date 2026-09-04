'use client';

/**
 * File a saved post into one of your collections, or make a new one on the
 * spot. Picking "Unsorted" takes it out of a folder without unsaving it.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, FolderPlus, Loader2 } from 'lucide-react';
import { collectionApi, postApi } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

export type SavedCollection = {
  id: string;
  name: string;
  description?: string | null;
  count: number;
  cover?: string | null;
  updatedAt?: string;
};

export function useCollections(enabled = true) {
  return useQuery({
    queryKey: ['saved-collections'],
    queryFn: collectionApi.list,
    enabled,
    select: (response) => ({
      unsortedCount: Number(response.data?.data?.unsortedCount ?? 0),
      collections: (Array.isArray(response.data?.data?.collections) ? response.data.data.collections : []) as SavedCollection[],
    }),
  });
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export function SaveToCollection({
  postId,
  currentCollectionId,
  open,
  onClose,
  onFiled,
}: {
  postId: string;
  currentCollectionId?: string | null;
  open: boolean;
  onClose: () => void;
  onFiled?: (collectionId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useCollections(open);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const file = useMutation({
    mutationFn: (collectionId: string | null) => postApi.saveTo(postId, collectionId),
    onSuccess: (_res, collectionId) => {
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
      queryClient.invalidateQueries({ queryKey: ['saved-collections'] });
      const name = data?.collections.find((c) => c.id === collectionId)?.name;
      toast.success(name ? `Saved to ${name}` : 'Moved to Unsorted');
      onFiled?.(collectionId);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not file the post'),
  });

  const createAndFile = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await collectionApi.create({ name });
      const id = res.data?.data?.id as string;
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['saved-collections'] });
      file.mutate(id);
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not create the collection');
    } finally {
      setCreating(false);
    }
  };

  const busy = file.isPending || creating;

  return (
    <Modal isOpen={open} onClose={() => !busy && onClose()} title="Save to collection" size="sm">
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="max-h-64 space-y-1 overflow-y-auto" role="listbox" aria-label="Collections">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!currentCollectionId}
                disabled={busy}
                onClick={() => file.mutate(null)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800',
                  !currentCollectionId && 'font-semibold'
                )}
              >
                <span>Unsorted</span>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {data?.unsortedCount ?? 0}
                  {!currentCollectionId && <Check className="h-4 w-4 text-emerald-600" />}
                </span>
              </button>
            </li>
            {data?.collections.map((collection) => (
              <li key={collection.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={currentCollectionId === collection.id}
                  disabled={busy}
                  onClick={() => file.mutate(collection.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800',
                    currentCollectionId === collection.id && 'font-semibold'
                  )}
                >
                  <span className="truncate">{collection.name}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {collection.count}
                    {currentCollectionId === collection.id && <Check className="h-4 w-4 text-emerald-600" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createAndFile();
            }}
            className="flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700"
          >
            <FolderPlus className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={40}
              placeholder="New collection"
              aria-label="New collection name"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button type="submit" disabled={busy || !newName.trim()} className="btn-primary px-3 py-1.5 text-xs">
              Create
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
