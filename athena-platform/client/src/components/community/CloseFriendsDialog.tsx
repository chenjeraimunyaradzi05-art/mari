'use client';

/**
 * The close-friends list: who sees the stories you mark for close friends.
 * People you follow are offered first; anyone else can be found by name.
 * Nobody is told they were added or removed.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Search, Star, X } from 'lucide-react';
import { closeFriendApi, mentionApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';

export type ClosePerson = { id: string; name: string; avatar: string | null; headline?: string | null };

export function useCloseFriends(enabled = true) {
  const { isAuthenticated, isLoading } = useAuthStore();
  return useQuery({
    queryKey: ['close-friends'],
    queryFn: closeFriendApi.list,
    enabled: enabled && isAuthenticated && !isLoading,
    select: (response) => ({
      friends: (Array.isArray(response.data?.data?.friends) ? response.data.data.friends : []) as ClosePerson[],
      suggestions: (Array.isArray(response.data?.data?.suggestions) ? response.data.data.suggestions : []) as ClosePerson[],
    }),
  });
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

function Row({ person, action, onAction, disabled }: { person: ClosePerson; action: 'add' | 'remove'; onAction: () => void; disabled?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <Avatar src={person.avatar || undefined} alt={person.name} fallback={person.name.slice(0, 2).toUpperCase()} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{person.name}</span>
        {person.headline && <span className="block truncate text-xs text-slate-500">{person.headline}</span>}
      </span>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        aria-label={action === 'add' ? `Add ${person.name}` : `Remove ${person.name}`}
        className={
          action === 'add'
            ? 'rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50'
            : 'rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800'
        }
      >
        {action === 'add' ? 'Add' : <X className="h-4 w-4" />}
      </button>
    </li>
  );
}

export function CloseFriendsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { data, isLoading } = useCloseFriends(open);
  const [search, setSearch] = useState('');

  const { data: found = [] } = useQuery({
    queryKey: ['close-friends-search', search],
    queryFn: () => mentionApi.suggest(search.trim()),
    enabled: open && search.trim().length > 0,
    select: (response) =>
      (Array.isArray(response.data?.data) ? response.data.data : []).filter((p: ClosePerson) => p.id !== user?.id) as ClosePerson[],
  });

  const change = useMutation({
    mutationFn: ({ id, add }: { id: string; add: boolean }) => (add ? closeFriendApi.add(id) : closeFriendApi.remove(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['close-friends'] });
      queryClient.invalidateQueries({ queryKey: ['status', 'feed'] });
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not update close friends'),
  });

  const friends = data?.friends ?? [];
  const friendIds = new Set(friends.map((f) => f.id));
  const candidates = (search.trim() ? found : data?.suggestions ?? []).filter((p) => !friendIds.has(p.id));

  return (
    <Modal isOpen={open} onClose={onClose} title="Close friends" size="sm">
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Star className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
          Stories you mark for close friends are seen by these people only. They are not told they are on the list.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                On your list · {friends.length}
              </h3>
              {friends.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">Nobody yet.</p>
              ) : (
                <ul className="max-h-40 overflow-y-auto">
                  {friends.map((person) => (
                    <Row key={person.id} person={person} action="remove" disabled={change.isPending} onAction={() => change.mutate({ id: person.id, add: false })} />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Add someone"
                  aria-label="Search people to add"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <ul className="mt-2 max-h-48 overflow-y-auto">
                {candidates.length === 0 ? (
                  <li className="py-2 text-center text-xs text-slate-500">{search.trim() ? 'Nobody by that name.' : 'Everyone you follow is already on the list.'}</li>
                ) : (
                  candidates.map((person) => (
                    <Row key={person.id} person={person} action="add" disabled={change.isPending} onAction={() => change.mutate({ id: person.id, add: true })} />
                  ))
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
